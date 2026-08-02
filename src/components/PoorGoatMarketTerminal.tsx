"use client";

import { ArrowRight, Check, Copy, ExternalLink } from "lucide-react";
import Image from "next/image";

import { LiveSessionAreaChart } from "@/components/LiveSessionAreaChart";
import { TOKENS } from "@/lib/constants";

interface MarketData {
  symbol: string;
  priceUsd: string | null;
  marketCap: number | null;
  volume24h: number | null;
  liquidity: number | null;
  change24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
  pairUrl: string;
  updatedAt: string;
}

interface PoorGoatMarketTerminalProps {
  market: MarketData | null;
  loading: boolean;
  error: string;
  copied: boolean;
  onCopyContract: () => void | Promise<void>;
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPrice(value: string | null) {
  if (!value) return "—";

  const price = Number(value);
  if (!Number.isFinite(price)) return "—";
  if (price >= 1) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  }
  if (price >= 0.01) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(10).replace(/0+$/, "")}`;
}

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function PoorGoatMarketTerminal({
  market,
  loading,
  error,
  copied,
  onCopyContract,
}: PoorGoatMarketTerminalProps) {
  const change = market?.change24h ?? null;
  const isPositive = change !== null && change >= 0;
  const trades =
    market?.buys24h !== null && market?.buys24h !== undefined &&
    market?.sells24h !== null && market?.sells24h !== undefined
      ? market.buys24h + market.sells24h
      : null;

  return (
    <div className="pg-terminal-v2">
      <div className="pg-terminal-v2-header">
        <div className="pg-terminal-v2-token">
          <span className="pg-terminal-v2-logo">
            <Image
              src="/images/brand/logo.webp"
              alt="PoorGoat"
              width={52}
              height={52}
              priority
            />
          </span>

          <div>
            <strong>$POORGOAT / SOL</strong>
            <span>Solana · Live pair</span>
          </div>
        </div>

        <div className={`pg-terminal-v2-change ${isPositive ? "positive" : "negative"}`}>
          {change === null
            ? "—"
            : `${isPositive ? "+" : ""}${change.toFixed(2)}%`}
          <span>24H</span>
        </div>
      </div>

      <div className="pg-terminal-v2-body">
        <aside className="pg-terminal-v2-sidebar">
          <span className="pg-terminal-v2-label">POORGOAT PRICE</span>
          <strong className="pg-terminal-v2-price">
            {loading ? "LOADING" : formatPrice(market?.priceUsd ?? null)}
          </strong>
          <small>{error || "Live USD price · 15 second session"}</small>

          <div className="pg-terminal-v2-stats">
            <div>
              <span>Market cap</span>
              <strong>{loading ? "—" : formatMoney(market?.marketCap ?? null)}</strong>
            </div>
            <div>
              <span>Liquidity</span>
              <strong>{loading ? "—" : formatMoney(market?.liquidity ?? null)}</strong>
            </div>
            <div>
              <span>24H volume</span>
              <strong>{loading ? "—" : formatMoney(market?.volume24h ?? null)}</strong>
            </div>
            <div>
              <span>24H trades</span>
              <strong>{loading ? "—" : formatCount(trades)}</strong>
            </div>
          </div>

          <div className="pg-terminal-v2-split">
            <div>
              <span>Buys</span>
              <strong>{formatCount(market?.buys24h ?? null)}</strong>
            </div>
            <div>
              <span>Sells</span>
              <strong>{formatCount(market?.sells24h ?? null)}</strong>
            </div>
          </div>
        </aside>

        <div className="pg-terminal-v2-chart">
          <div className="pg-terminal-v2-chartbar">
            <div>
              <button type="button" className="is-active">SESSION</button>
              <span>STARTS WHEN THIS PAGE OPENS</span>
            </div>

            <a
              href={market?.pairUrl ?? TOKENS.poorGoat.dexUrl}
              target="_blank"
              rel="noreferrer"
            >
              Buy / full market <ExternalLink size={13} />
            </a>
          </div>

          <LiveSessionAreaChart
            priceUsd={market?.priceUsd ?? null}
            updatedAt={market?.updatedAt ?? null}
          />
        </div>
      </div>

      <div className="pg-terminal-v2-footer">
        <div>
          <span>OFFICIAL CONTRACT</span>
          <code>{TOKENS.poorGoat.mint}</code>
        </div>

        <div className="pg-terminal-v2-actions">
          <button type="button" onClick={() => void onCopyContract()}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy CA"}
          </button>

          <a href={TOKENS.poorGoat.dexUrl} target="_blank" rel="noreferrer">
            Buy $POORGOAT <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
