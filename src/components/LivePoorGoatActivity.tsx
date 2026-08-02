"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type LiveActivityKind = "buy" | "sell" | "received" | "transfer";

interface LiveActivityItem {
  signature: string;
  timestamp: string;
  kind: LiveActivityKind;
  wallet: string;
  counterparty: string | null;
  amount: number;
  usdValue: number | null;
  source: string | null;
}

interface LiveActivityResponse {
  items: LiveActivityItem[];
  generatedAt: string;
  coverage: string;
  warning?: string;
}

type ActivityFilter = "all" | LiveActivityKind;

interface MarketSummary {
  buys24h: number | null;
  sells24h: number | null;
}

interface LivePoorGoatActivityProps {
  market: MarketSummary | null;
}

const FILTERS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "buy", label: "Buys" },
  { value: "sell", label: "Sells" },
  { value: "received", label: "Rewards" },
  { value: "transfer", label: "Transfers" },
];

function shorten(value: string) {
  if (!value) return "Unknown";
  return value.length > 14
    ? `${value.slice(0, 6)}...${value.slice(-6)}`
    : value;
}

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";

  return new Intl.NumberFormat("en-US", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 2 : 4,
  }).format(value);
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function kindLabel(kind: LiveActivityKind) {
  if (kind === "received") return "Reward";
  return kind;
}

export function LivePoorGoatActivity({ market }: LivePoorGoatActivityProps) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [payload, setPayload] = useState<LiveActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    try {
      const response = await fetch("/api/live-activity", {
        cache: "no-store",
      });

      const nextPayload = (await response.json()) as LiveActivityResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(nextPayload.error || "Live activity request failed");
      }

      setPayload(nextPayload);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Live activity is temporarily unavailable",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadActivity();
    }, 0);

    const interval = window.setInterval(() => {
      void loadActivity();
    }, 15_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadActivity]);

  const items = payload?.items ?? [];
  const rows =
    filter === "all"
      ? items
      : items.filter((item) => item.kind === filter);

  const status = error || payload?.warning || "Live Solana activity";

  return (
    <section className="herd-history-v2 page-width" id="activity">
      <div className="herd-history-v2-heading">
        <div>
          <p className="section-label">POORGOAT LIVE ACTIVITY</p>
          <h2>
            WATCH THE HERD
            <br />
            MOVE ON-CHAIN.
          </h2>
        </div>

        <p>
          Real recent buys, sells, rewards and transfers connected to the
          $POORGOAT pair and mint. The table refreshes every 15 seconds.
        </p>
      </div>

      <div className="herd-history-v2-terminal">
        <div className="herd-history-v2-topbar">
          <div className="herd-history-v2-tabs" role="tablist" aria-label="Live activity filters">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={filter === item.value ? "is-active" : ""}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="herd-history-v2-controls">
            <span className="herd-history-v2-live">
              <i /> POORGOAT LIVE
            </span>
            <button
              type="button"
              onClick={() => void loadActivity()}
              disabled={loading}
            >
              <RefreshCw size={13} />
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="herd-history-v2-statusbar">
          <span>{status}</span>
          <span>
            24H BUYS {formatCount(market?.buys24h ?? null)} · 24H SELLS {formatCount(market?.sells24h ?? null)}
          </span>
        </div>

        <div className="herd-history-v2-table-wrap">
          <table className="herd-history-v2-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Wallet / Time</th>
                <th>Amount</th>
                <th>USD value</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((item) => (
                  <tr key={`${item.signature}-${item.kind}-${item.wallet}-${item.amount}`}>
                    <td>
                      <span className={`herd-history-v2-kind ${item.kind}`}>
                        {kindLabel(item.kind)}
                      </span>
                    </td>
                    <td>
                      <strong>{shorten(item.wallet)}</strong>
                      <span>{formatTime(item.timestamp)}</span>
                    </td>
                    <td>
                      <strong>
                        {item.kind === "sell" || item.kind === "transfer" ? "−" : "+"}
                        {formatAmount(item.amount)} $POORGOAT
                      </strong>
                      <span>
                        {item.counterparty
                          ? `With ${shorten(item.counterparty)}`
                          : item.source || "On-chain movement"}
                      </span>
                    </td>
                    <td>
                      <strong>{formatMoney(item.usdValue)}</strong>
                      <span>Current pair price</span>
                    </td>
                    <td>
                      <a
                        href={`https://solscan.io/tx/${item.signature}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.signature.slice(0, 8)}...{item.signature.slice(-6)}
                        <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="herd-history-v2-empty">
                      <strong>
                        {loading
                          ? "Loading recent $POORGOAT activity"
                          : "No matching activity returned yet"}
                      </strong>
                      <span>
                        The table shows verified parsed Solana rows only. It does not add placeholders.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="herd-history-v2-footer">
          <span>{payload?.coverage ?? "Recent pair and mint coverage"}</span>
          <span>
            {payload?.items.length ?? 0} indexed events · 15 second refresh
          </span>
        </div>
      </div>
    </section>
  );
}
