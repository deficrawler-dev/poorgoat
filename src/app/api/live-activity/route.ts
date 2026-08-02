import { NextResponse } from "next/server";

const POORGOAT_MINT = "3m5WmiAs3TewbB9S96jpwuGfodTnn4PVM8a1ytVQpump";
const POORGOAT_PAIR = "6unw1k65axgj7gtdxa9qbmah5ejqshlucwafm7rpqsrl";
const DEX_PAIR_URL = `https://api.dexscreener.com/latest/dex/pairs/solana/${POORGOAT_PAIR}`;

interface HeliusTokenTransfer {
  fromUserAccount?: string | null;
  toUserAccount?: string | null;
  tokenAmount?: number | null;
  mint?: string | null;
}

interface HeliusTransaction {
  signature?: string;
  timestamp?: number;
  type?: string;
  description?: string;
  feePayer?: string;
  source?: string;
  tokenTransfers?: HeliusTokenTransfer[];
}

interface DexPairResponse {
  pair?: {
    priceUsd?: string;
  } | null;
  pairs?: Array<{
    priceUsd?: string;
  }> | null;
}

type ActivityKind = "buy" | "sell" | "received" | "transfer";

interface ActivityItem {
  signature: string;
  timestamp: string;
  kind: ActivityKind;
  wallet: string;
  counterparty: string | null;
  amount: number;
  usdValue: number | null;
  source: string | null;
}

interface AddressResult {
  transactions: HeliusTransaction[];
  warning: string | null;
}

function inferKind(
  transaction: HeliusTransaction,
  transfer: HeliusTokenTransfer,
): ActivityKind {
  const type = (transaction.type ?? "").toUpperCase();
  const description = (transaction.description ?? "").toLowerCase();
  const feePayer = transaction.feePayer ?? "";
  const from = transfer.fromUserAccount ?? "";
  const to = transfer.toUserAccount ?? "";

  if (type.includes("SWAP")) {
    if (to && feePayer && to === feePayer) return "buy";
    if (from && feePayer && from === feePayer) return "sell";
    if (description.includes("bought") || description.includes("buy")) return "buy";
    if (description.includes("sold") || description.includes("sell")) return "sell";
  }

  if (
    type.includes("AIRDROP") ||
    description.includes("airdrop") ||
    description.includes("reward")
  ) {
    return "received";
  }

  if (!from && to) return "received";
  return "transfer";
}

function walletFor(
  kind: ActivityKind,
  transaction: HeliusTransaction,
  transfer: HeliusTokenTransfer,
) {
  if (kind === "buy" || kind === "sell") {
    return (
      transaction.feePayer ||
      transfer.toUserAccount ||
      transfer.fromUserAccount ||
      "Unknown"
    );
  }

  if (kind === "received") {
    return transfer.toUserAccount || transaction.feePayer || "Unknown";
  }

  return (
    transfer.fromUserAccount ||
    transaction.feePayer ||
    transfer.toUserAccount ||
    "Unknown"
  );
}

function counterpartyFor(
  kind: ActivityKind,
  transfer: HeliusTokenTransfer,
) {
  if (kind === "received" || kind === "buy") {
    return transfer.fromUserAccount ?? null;
  }

  return transfer.toUserAccount ?? null;
}

async function getAddressTransactions(
  address: string,
  apiKey: string,
): Promise<AddressResult> {
  const query = new URLSearchParams({
    "api-key": apiKey,
    limit: "100",
  });

  const response = await fetch(
    `https://api-mainnet.helius-rpc.com/v0/addresses/${address}/transactions?${query.toString()}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    const details = (await response.text()).slice(0, 180);
    return {
      transactions: [],
      warning: `Helius ${response.status}${details ? `: ${details}` : ""}`,
    };
  }

  const payload = (await response.json()) as HeliusTransaction[];

  return {
    transactions: Array.isArray(payload) ? payload : [],
    warning: null,
  };
}

async function getCurrentPrice() {
  try {
    const response = await fetch(DEX_PAIR_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as DexPairResponse;
    const value = payload.pair?.priceUsd ?? payload.pairs?.[0]?.priceUsd ?? null;
    const price = Number(value);

    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.HELIUS_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        items: [],
        generatedAt: new Date().toISOString(),
        coverage: "Helius key missing",
        warning: "HELIUS_API_KEY is missing from .env.local",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }

  const pairResult = await getAddressTransactions(POORGOAT_PAIR, apiKey);
  const mintResult = await getAddressTransactions(POORGOAT_MINT, apiKey);
  const price = await getCurrentPrice();

  const uniqueTransactions = new Map<string, HeliusTransaction>();

  for (const transaction of [
    ...pairResult.transactions,
    ...mintResult.transactions,
  ]) {
    if (!transaction.signature) continue;
    uniqueTransactions.set(transaction.signature, transaction);
  }

  const items: ActivityItem[] = [];

  for (const transaction of uniqueTransactions.values()) {
    const transfers = (transaction.tokenTransfers ?? []).filter((transfer) => {
      return (
        transfer.mint === POORGOAT_MINT &&
        Number(transfer.tokenAmount) > 0
      );
    });

    for (const transfer of transfers) {
      const amount = Number(transfer.tokenAmount);
      if (!Number.isFinite(amount) || amount <= 0 || !transaction.signature) {
        continue;
      }

      const kind = inferKind(transaction, transfer);
      const timestamp = transaction.timestamp
        ? new Date(transaction.timestamp * 1000).toISOString()
        : new Date().toISOString();

      items.push({
        signature: transaction.signature,
        timestamp,
        kind,
        wallet: walletFor(kind, transaction, transfer),
        counterparty: counterpartyFor(kind, transfer),
        amount,
        usdValue: price === null ? null : amount * price,
        source: transaction.source ?? null,
      });
    }
  }

  items.sort((left, right) => {
    return (
      new Date(right.timestamp).getTime() -
      new Date(left.timestamp).getTime()
    );
  });

  const deduped = Array.from(
    new Map(
      items.map((item) => [
        `${item.signature}:${item.kind}:${item.wallet}:${item.amount}`,
        item,
      ]),
    ).values(),
  ).slice(0, 100);

  const warnings = [pairResult.warning, mintResult.warning].filter(Boolean);

  return NextResponse.json(
    {
      items: deduped,
      generatedAt: new Date().toISOString(),
      coverage: "Recent indexed $POORGOAT pair and mint activity",
      warning:
        warnings.length > 0
          ? warnings.join(" · ")
          : deduped.length === 0
            ? "No recent parsed $POORGOAT movements were returned yet."
            : undefined,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
