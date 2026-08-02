import { NextResponse } from "next/server";

import { TOKENS } from "@/lib/constants";

export const revalidate = 30;

interface DexPair {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  priceChange?: {
    h24?: number;
  };
  volume?: {
    h24?: number;
  };
  liquidity?: {
    usd?: number;
  };
  txns?: {
    h24?: {
      buys?: number;
      sells?: number;
    };
  };
  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
  quoteToken?: {
    address?: string;
    name?: string;
    symbol?: string;
  };
}

interface DexResponse {
  pair?: DexPair | null;
  pairs?: DexPair[] | null;
}

export async function GET() {
  try {
    const endpoint =
      `https://api.dexscreener.com/latest/dex/pairs/solana/` +
      TOKENS.poorGoat.pairAddress;

    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: 30,
      },
    });

    if (!response.ok) {
      throw new Error(`Dexscreener returned ${response.status}`);
    }

    const payload = (await response.json()) as DexResponse;
    const pair = payload.pair ?? payload.pairs?.[0];

    if (!pair) {
      return NextResponse.json(
        {
          error: "PoorGoat market pair was not found.",
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        symbol: pair.baseToken?.symbol ?? "POORGOAT",
        priceUsd: pair.priceUsd ?? null,
        marketCap: pair.marketCap ?? pair.fdv ?? null,
        volume24h: pair.volume?.h24 ?? null,
        liquidity: pair.liquidity?.usd ?? null,
        change24h: pair.priceChange?.h24 ?? null,
        buys24h: pair.txns?.h24?.buys ?? null,
        sells24h: pair.txns?.h24?.sells ?? null,
        pairUrl: pair.url ?? TOKENS.poorGoat.dexUrl,
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("PoorGoat market request failed:", error);

    return NextResponse.json(
      {
        error: "Live market data is temporarily unavailable.",
      },
      {
        status: 503,
      },
    );
  }
}