import { createHash } from "node:crypto";

import { TOKENS } from "@/lib/constants";

import type {
  ActivityKind,
  GoatScoreActivity,
  GoatScoreResult,
  TokenKey,
  TokenScoreSummary,
} from "./types";

interface HeliusBalance {
  mint: string;
  balance: number;
  decimals: number;
}

interface HeliusBalancesResponse {
  balances: HeliusBalance[];
  pagination?: {
    hasMore?: boolean;
    page?: number;
  };
}

interface HeliusTransfer {
  signature: string;
  timestamp: number;
  direction: "in" | "out";
  counterparty?: string | null;
  mint: string;
  amount: number;
  amountRaw?: string;
  decimals?: number;
  symbol?: string | null;
}

interface HeliusTransfersResponse {
  data: HeliusTransfer[];
  pagination?: {
    hasMore?: boolean;
    nextCursor?: string | null;
  };
}

interface DexPairResponse {
  pair?: {
    pairCreatedAt?: number;
  } | null;
  pairs?: Array<{
    pairCreatedAt?: number;
  }> | null;
}

interface NormalizedEvent {
  signature: string;
  timestamp: number;
  token: TokenKey;
  symbol: "ANSEM" | "POORGOAT";
  kind: ActivityKind;
  amount: number;
  delta: number;
  counterparty: string | null;
}

interface AnalysisCacheEntry {
  expiresAt: number;
  result: Omit<GoatScoreResult, "xUsername" | "resultId">;
}

const analysisCache = new Map<string, AnalysisCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 86_400_000;
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
let lastHeliusCallAt = 0;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForHeliusRateSlot() {
  const elapsed = Date.now() - lastHeliusCallAt;
  const wait = Math.max(0, 540 - elapsed);

  if (wait > 0) await sleep(wait);
  lastHeliusCallAt = Date.now();
}

async function heliusGet<T>(path: string, apiKey: string): Promise<T> {
  await waitForHeliusRateSlot();

  const response = await fetch(`https://api.helius.xyz${path}`, {
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json()) as T & {
    error?: string;
    details?: string;
  };

  if (!response.ok) {
    const message = payload.details || payload.error || `Helius returned ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function getPairCreatedAt(pairAddress: string) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`,
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as DexPairResponse;
    return payload.pair?.pairCreatedAt ?? payload.pairs?.[0]?.pairCreatedAt ?? null;
  } catch {
    return null;
  }
}

async function getHistoryCutoff() {
  const [ansemCreatedAt, poorGoatCreatedAt] = await Promise.all([
    getPairCreatedAt(TOKENS.ansem.pairAddress),
    getPairCreatedAt(TOKENS.poorGoat.pairAddress),
  ]);

  const timestamps = [ansemCreatedAt, poorGoatCreatedAt]
    .filter((value): value is number => typeof value === "number")
    .map((value) => (value > 10_000_000_000 ? value : value * 1000));

  if (timestamps.length === 0) {
    return Date.now() - 365 * DAY_MS;
  }

  return Math.min(...timestamps) - 14 * DAY_MS;
}

async function getBalances(wallet: string, apiKey: string) {
  const balances: HeliusBalance[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    const payload = await heliusGet<HeliusBalancesResponse>(
      `/v1/wallet/${wallet}/balances?page=${page}&limit=100&showZeroBalance=true&showNative=false&showNfts=false`,
      apiKey,
    );

    balances.push(...(payload.balances ?? []));
    hasMore = Boolean(payload.pagination?.hasMore);

    const hasBoth =
      balances.some((item) => item.mint === TOKENS.ansem.mint) &&
      balances.some((item) => item.mint === TOKENS.poorGoat.mint);

    if (hasBoth) break;
    page += 1;
  }

  return balances;
}

async function getTransfers(wallet: string, apiKey: string, cutoffMs: number) {
  const transfers: HeliusTransfer[] = [];
  const maxPages = Number(process.env.HELIUS_MAX_TRANSFER_PAGES ?? 12);
  let cursor: string | null = null;
  let hasMore = true;
  let page = 0;
  let reachedCutoff = false;

  while (hasMore && page < maxPages && !reachedCutoff) {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);

    const payload = await heliusGet<HeliusTransfersResponse>(
      `/v1/wallet/${wallet}/transfers?${query.toString()}`,
      apiKey,
    );

    const rows = payload.data ?? [];
    transfers.push(...rows);
    page += 1;

    const oldestTimestamp = rows.reduce(
      (oldest, row) => Math.min(oldest, row.timestamp * 1000),
      Number.POSITIVE_INFINITY,
    );

    reachedCutoff = oldestTimestamp <= cutoffMs;
    hasMore = Boolean(payload.pagination?.hasMore);
    cursor = payload.pagination?.nextCursor ?? null;

    if (rows.length === 0 || !cursor) break;
  }

  return {
    transfers,
    historyTruncated: hasMore && !reachedCutoff,
  };
}

function normalizeXUsername(value: string | null | undefined) {
  const normalized = value?.trim().replace(/^@/, "") ?? "";
  return /^[A-Za-z0-9_]{1,15}$/.test(normalized) ? normalized : null;
}

function classifyEvents(transfers: HeliusTransfer[]) {
  const groups = new Map<string, HeliusTransfer[]>();

  for (const transfer of transfers) {
    if (!transfer.signature || !Number.isFinite(Number(transfer.amount))) continue;

    const group = groups.get(transfer.signature) ?? [];
    group.push({ ...transfer, amount: Number(transfer.amount) });
    groups.set(transfer.signature, group);
  }

  const events: NormalizedEvent[] = [];

  for (const [signature, rows] of groups) {
    for (const token of [
      {
        key: "ansem" as const,
        symbol: "ANSEM" as const,
        mint: TOKENS.ansem.mint,
      },
      {
        key: "poorGoat" as const,
        symbol: "POORGOAT" as const,
        mint: TOKENS.poorGoat.mint,
      },
    ]) {
      const tokenRows = rows.filter((row) => row.mint === token.mint);
      if (tokenRows.length === 0) continue;

      const delta = tokenRows.reduce((total, row) => {
        return total + (row.direction === "in" ? row.amount : -row.amount);
      }, 0);

      if (Math.abs(delta) < 1e-12) continue;

      const otherRows = rows.filter((row) => row.mint !== token.mint);
      const hasOtherOutflow = otherRows.some(
        (row) => row.direction === "out" && row.amount > 0,
      );
      const hasOtherInflow = otherRows.some(
        (row) => row.direction === "in" && row.amount > 0,
      );

      let kind: ActivityKind;
      if (delta > 0 && hasOtherOutflow) kind = "bought";
      else if (delta < 0 && hasOtherInflow) kind = "sold";
      else if (delta > 0) kind = "received";
      else kind = "transferred";

      const representative = tokenRows.reduce((largest, row) => {
        return row.amount > largest.amount ? row : largest;
      });

      events.push({
        signature,
        timestamp: representative.timestamp,
        token: token.key,
        symbol: token.symbol,
        kind,
        amount: Math.abs(delta),
        delta,
        counterparty: representative.counterparty ?? null,
      });
    }
  }

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function calculateTokenSummary(
  token: TokenKey,
  events: NormalizedEvent[],
  currentBalance: number,
): Omit<TokenScoreSummary, "score" | "maxScore"> {
  const tokenEvents = events
    .filter((event) => event.token === token)
    .sort((a, b) => a.timestamp - b.timestamp);

  const incoming = tokenEvents.filter((event) => event.delta > 0);
  const firstIncoming = incoming[0] ?? null;
  const totalBought = tokenEvents
    .filter((event) => event.kind === "bought")
    .reduce((total, event) => total + event.amount, 0);
  const totalSold = tokenEvents
    .filter((event) => event.kind === "sold")
    .reduce((total, event) => total + event.amount, 0);
  const totalReceived = tokenEvents
    .filter((event) => event.kind === "received")
    .reduce((total, event) => total + event.amount, 0);
  const totalTransferred = tokenEvents
    .filter((event) => event.kind === "transferred")
    .reduce((total, event) => total + event.amount, 0);
  const totalAcquired = totalBought + totalReceived;

  let runningBalance = 0;
  let peakBalance = Math.max(0, currentBalance);
  let majorExits = 0;

  for (const event of tokenEvents) {
    const before = Math.max(0, runningBalance);

    if (event.delta < 0 && before > 0 && Math.abs(event.delta) >= before * 0.25) {
      majorExits += 1;
    }

    runningBalance += event.delta;
    peakBalance = Math.max(peakBalance, runningBalance);
  }

  const retainedPercentage =
    totalAcquired > 0
      ? clamp((Math.max(0, currentBalance) / totalAcquired) * 100, 0, 100)
      : currentBalance > 0
        ? 100
        : 0;

  const holdingDays = firstIncoming
    ? Math.max(0, Math.floor((Date.now() - firstIncoming.timestamp * 1000) / DAY_MS))
    : 0;

  const isAnsem = token === "ansem";

  return {
    token,
    symbol: isAnsem ? "ANSEM" : "POORGOAT",
    mint: isAnsem ? TOKENS.ansem.mint : TOKENS.poorGoat.mint,
    currentBalance: Math.max(0, currentBalance),
    totalBought,
    totalSold,
    totalReceived,
    totalTransferred,
    peakBalance: Math.max(peakBalance, currentBalance),
    retainedPercentage,
    holdingDays,
    firstActivityAt: firstIncoming
      ? new Date(firstIncoming.timestamp * 1000).toISOString()
      : null,
    accumulationEvents: incoming.length,
    majorExits,
    currentlyHolding: currentBalance > 0,
  };
}

function scoreAnsem(summary: Omit<TokenScoreSummary, "score" | "maxScore">) {
  const hasActivity = summary.accumulationEvents > 0 || summary.currentBalance > 0;
  if (!hasActivity) return 0;

  const duration = clamp(summary.holdingDays / 120, 0, 1) * 20;
  const retention = clamp(summary.retainedPercentage / 100, 0, 1) * 20;
  const accumulation = clamp(summary.accumulationEvents / 8, 0, 1) * 15;
  const discipline = clamp(10 - summary.majorExits * 3.5, 0, 10);
  const activePosition = summary.currentlyHolding ? 10 : 0;

  return Math.round(duration + retention + accumulation + discipline + activePosition);
}

function scorePoorGoat(summary: Omit<TokenScoreSummary, "score" | "maxScore">) {
  const hasActivity = summary.accumulationEvents > 0 || summary.currentBalance > 0;
  if (!hasActivity) return 0;

  const activePosition = summary.currentlyHolding ? 8 : 0;
  const retention = clamp(summary.retainedPercentage / 100, 0, 1) * 7;
  const accumulation = clamp(summary.accumulationEvents / 5, 0, 1) * 5;
  const discipline = clamp(5 - summary.majorExits * 2, 0, 5);

  return Math.round(activePosition + retention + accumulation + discipline);
}

function getRank(score: number) {
  if (score >= 95) {
    return { rank: "Apex Goat", note: "The herd has receipts." };
  }
  if (score >= 85) {
    return { rank: "Legendary Goat", note: "Conviction survived the noise." };
  }
  if (score >= 70) {
    return { rank: "Diamond Hands", note: "Built to hold through the trenches." };
  }
  if (score >= 50) {
    return { rank: "Loyal Goat", note: "Solid conviction with room to climb." };
  }
  if (score >= 30) {
    return { rank: "Trench Goat", note: "Still earning a place in the herd." };
  }

  return { rank: "Paper Goat", note: "The chain remembers every exit." };
}

function walletArtworkSeed(wallet: string) {
  return Array.from(wallet).reduce((total, character, index) => {
    return (total + character.charCodeAt(0) * (index + 17)) % 100_003;
  }, 0);
}

async function buildCoreAnalysis(wallet: string, apiKey: string) {
  const cached = analysisCache.get(wallet);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const cutoffMs = await getHistoryCutoff();
  const balances = await getBalances(wallet, apiKey);
  const { transfers, historyTruncated } = await getTransfers(wallet, apiKey, cutoffMs);
  const events = classifyEvents(transfers);

  const ansemBalance =
    balances.find((item) => item.mint === TOKENS.ansem.mint)?.balance ?? 0;
  const poorGoatBalance =
    balances.find((item) => item.mint === TOKENS.poorGoat.mint)?.balance ?? 0;

  const ansemBase = calculateTokenSummary("ansem", events, ansemBalance);
  const poorGoatBase = calculateTokenSummary("poorGoat", events, poorGoatBalance);
  const ansemScore = scoreAnsem(ansemBase);
  const poorGoatScore = scorePoorGoat(poorGoatBase);
  const score = clamp(ansemScore + poorGoatScore, 0, 100);
  const rank = getRank(score);
  const seed = walletArtworkSeed(wallet);

  const result: Omit<GoatScoreResult, "xUsername" | "resultId"> = {
    wallet,
    generatedAt: new Date().toISOString(),
    score,
    rank: rank.rank,
    rankNote: rank.note,
    ansem: {
      ...ansemBase,
      score: ansemScore,
      maxScore: 75,
    },
    poorGoat: {
      ...poorGoatBase,
      score: poorGoatScore,
      maxScore: 25,
    },
    activity: events.slice(0, 16).map((event): GoatScoreActivity => ({
      signature: event.signature,
      timestamp: new Date(event.timestamp * 1000).toISOString(),
      token: event.token,
      symbol: event.symbol,
      kind: event.kind,
      amount: event.amount,
      counterparty: event.counterparty,
    })),
    artwork: {
      ansemIndex: seed % 5,
      poorGoatIndex: (seed * 3 + 1) % 5,
    },
    historyTruncated,
  };

  analysisCache.set(wallet, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    result,
  });

  return result;
}

export async function analyseGoatScore(
  wallet: string,
  xUsername?: string | null,
): Promise<GoatScoreResult> {
  if (!SOLANA_ADDRESS_PATTERN.test(wallet)) {
    throw new Error("Enter a valid Solana wallet address.");
  }

  const apiKey = process.env.HELIUS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("HELIUS_API_KEY is not configured on the server.");
  }

  const normalizedX = normalizeXUsername(xUsername);
  const core = await buildCoreAnalysis(wallet, apiKey);
  const resultId = createHash("sha256")
    .update(`${wallet}:${core.score}:${normalizedX ?? ""}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

  return {
    ...core,
    resultId,
    xUsername: normalizedX,
  };
}
