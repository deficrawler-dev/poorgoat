"use client";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { SITE, TOKENS } from "@/lib/constants";

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

type WalletFeedback =
  | {
      type: "idle";
      message: string;
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "ready";
      message: string;
    };

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPrice(value: string | null) {
  if (!value) {
    return "—";
  }

  const price = Number(value);

  if (!Number.isFinite(price)) {
    return "—";
  }

  if (price >= 1) {
    return `$${price.toLocaleString("en-US", {
      maximumFractionDigits: 4,
    })}`;
  }

  if (price >= 0.01) {
    return `$${price.toFixed(6)}`;
  }

  return `$${price.toFixed(10).replace(/0+$/, "")}`;
}

function formatCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function shortenWallet(wallet: string) {
  if (wallet.length < 12) {
    return wallet;
  }

  return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
}

export function PoorGoatLanding() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [wallet, setWallet] = useState("");
  const [copied, setCopied] = useState(false);
  const [walletFeedback, setWalletFeedback] = useState<WalletFeedback>({
    type: "idle",
    message: "No wallet connection required. Public on-chain data only.",
  });

  useEffect(() => {
    let active = true;

    async function loadMarket() {
      try {
        const response = await fetch("/api/market", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Market request failed");
        }

        const payload = (await response.json()) as MarketData;

        if (active) {
          setMarket(payload);
          setMarketError("");
        }
      } catch {
        if (active) {
          setMarketError("Live market feed is temporarily delayed.");
        }
      } finally {
        if (active) {
          setMarketLoading(false);
        }
      }
    }

    void loadMarket();

    const interval = window.setInterval(() => {
      void loadMarket();
    }, 30_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function copyContract() {
    try {
      await navigator.clipboard.writeText(TOKENS.poorGoat.mint);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  function handleWalletSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedWallet = wallet.trim();

    if (!SOLANA_ADDRESS_PATTERN.test(normalizedWallet)) {
      setWalletFeedback({
        type: "error",
        message: "Enter a valid Solana wallet address.",
      });
      return;
    }

    setWalletFeedback({
      type: "ready",
      message: `${shortenWallet(
        normalizedWallet,
      )} is ready for on-chain analysis.`,
    });
  }

  const change = market?.change24h ?? null;
  const isPositive = change !== null && change >= 0;

  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="PoorGoat home">
          <span className="brand-mark">PG</span>

          <span className="brand-name">
            POOR<span>GOAT</span>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#market">Market</a>
          <a href="#goatscore">GoatScore</a>
          <a href="#method">Method</a>
        </nav>

        <a className="header-action" href="#goatscore">
          Check GoatScore
          <ArrowRight size={16} strokeWidth={2} />
        </a>
      </header>

      <section className="hero section-shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Built for the $ANSEM ecosystem
          </div>

          <h1>
            Track the goat.
            <span>Prove your conviction.</span>
          </h1>

          <p className="hero-description">
            Live $POORGOAT market intelligence and an on-chain GoatScore
            measuring activity across $ANSEM and $POORGOAT.
          </p>

          <div className="hero-actions">
            <a className="button button-primary" href="#goatscore">
              Check my GoatScore
              <ArrowRight size={18} />
            </a>

            <a className="button button-secondary" href="#market">
              View live market
              <Activity size={18} />
            </a>
          </div>

          <div className="trust-row">
            <span>
              <ShieldCheck size={17} />
              No wallet connection
            </span>

            <span>
              <Sparkles size={17} />
              Shareable score card
            </span>
          </div>
        </div>

        <div className="hero-visual" aria-label="GoatScore preview">
          <div className="visual-label">
            <span>POORGOAT SIGNAL</span>
            <span className="live-status">
              <span />
              Live
            </span>
          </div>

          <div className="goat-emblem" aria-hidden="true">
            <span className="goat-ear goat-ear-left" />
            <span className="goat-ear goat-ear-right" />
            <span className="goat-horn goat-horn-left" />
            <span className="goat-horn goat-horn-right" />
            <span className="goat-face">PG</span>
          </div>

          <div className="visual-copy">
            <p>Your place in the herd is written on-chain.</p>
            <span>Artwork will replace this signal mark later.</span>
          </div>

          <div className="visual-stats">
            <div>
              <span>Primary signal</span>
              <strong>$ANSEM</strong>
            </div>

            <div>
              <span>Ecosystem signal</span>
              <strong>$POORGOAT</strong>
            </div>

            <div>
              <span>Maximum score</span>
              <strong>100</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="market-section section-shell" id="market">
        <div className="section-heading">
          <div>
            <span className="section-kicker">LIVE MARKET</span>
            <h2>$POORGOAT at a glance.</h2>
          </div>

          <div className="feed-status">
            <span className={marketError ? "feed-dot feed-dot-error" : "feed-dot"} />

            {marketLoading
              ? "Connecting to market feed"
              : marketError || "Updates every 30 seconds"}
          </div>
        </div>

        <div className="market-grid">
          <article className="metric-card metric-card-featured">
            <span className="metric-label">Current price</span>
            <strong className="metric-value">
              {marketLoading ? "Loading" : formatPrice(market?.priceUsd ?? null)}
            </strong>

            <span
              className={`metric-change ${
                isPositive ? "metric-positive" : "metric-negative"
              }`}
            >
              {change === null
                ? "24H movement unavailable"
                : `${isPositive ? "+" : ""}${change.toFixed(2)}% in 24H`}
            </span>
          </article>

          <article className="metric-card">
            <span className="metric-label">Market cap</span>
            <strong className="metric-value">
              {marketLoading
                ? "Loading"
                : formatMoney(market?.marketCap ?? null)}
            </strong>
            <span className="metric-note">Live estimated valuation</span>
          </article>

          <article className="metric-card">
            <span className="metric-label">24H volume</span>
            <strong className="metric-value">
              {marketLoading
                ? "Loading"
                : formatMoney(market?.volume24h ?? null)}
            </strong>
            <span className="metric-note">Trading activity</span>
          </article>

          <article className="metric-card">
            <span className="metric-label">Liquidity</span>
            <strong className="metric-value">
              {marketLoading
                ? "Loading"
                : formatMoney(market?.liquidity ?? null)}
            </strong>
            <span className="metric-note">Available market liquidity</span>
          </article>
        </div>

        <div className="market-detail-panel">
          <div className="market-detail-copy">
            <span className="detail-title">Official $POORGOAT contract</span>

            <code>{TOKENS.poorGoat.mint}</code>

            <span className="detail-note">
              Always verify the contract address before trading.
            </span>
          </div>

          <div className="market-detail-actions">
            <button
              className="icon-action"
              type="button"
              onClick={copyContract}
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
              {copied ? "Copied" : "Copy contract"}
            </button>

            <a
              className="icon-action"
              href={market?.pairUrl ?? TOKENS.poorGoat.dexUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={18} />
              Open chart
            </a>
          </div>

          <div className="market-activity">
            <div>
              <span>24H buys</span>
              <strong>{formatCount(market?.buys24h ?? null)}</strong>
            </div>

            <div>
              <span>24H sells</span>
              <strong>{formatCount(market?.sells24h ?? null)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="score-section section-shell" id="goatscore">
        <div className="score-introduction">
          <span className="section-kicker">GOATSCORE</span>

          <h2>How diamond are your hands?</h2>

          <p>
            GoatScore analyses public activity across both ecosystem tokens.
            $ANSEM remains the primary measure of conviction, while
            $POORGOAT adds an ecosystem activity bonus.
          </p>

          <div className="score-weighting" id="method">
            <div className="weight-row">
              <div className="weight-header">
                <span>$ANSEM conviction</span>
                <strong>75 points</strong>
              </div>

              <div className="weight-track">
                <span className="weight-fill weight-fill-ansem" />
              </div>
            </div>

            <div className="weight-row">
              <div className="weight-header">
                <span>$POORGOAT activity</span>
                <strong>25 points</strong>
              </div>

              <div className="weight-track">
                <span className="weight-fill weight-fill-goat" />
              </div>
            </div>
          </div>

          <ul className="score-signals">
            <li>
              <CheckCircle2 size={17} />
              Holding duration and retained position
            </li>

            <li>
              <CheckCircle2 size={17} />
              Accumulation and major exit behaviour
            </li>

            <li>
              <CheckCircle2 size={17} />
              Activity across both ecosystem tokens
            </li>
          </ul>
        </div>

        <div className="score-terminal">
          <div className="terminal-header">
            <span>
              <Wallet size={18} />
              Wallet analysis
            </span>

            <span className="terminal-step">01 / ENTER WALLET</span>
          </div>

          <form className="wallet-form" onSubmit={handleWalletSubmit}>
            <label htmlFor="wallet">Solana wallet address</label>

            <div className="wallet-input-wrap">
              <input
                id="wallet"
                name="wallet"
                type="text"
                value={wallet}
                onChange={(event) => {
                  setWallet(event.target.value);

                  if (walletFeedback.type !== "idle") {
                    setWalletFeedback({
                      type: "idle",
                      message:
                        "No wallet connection required. Public on-chain data only.",
                    });
                  }
                }}
                placeholder="Paste a Solana wallet address"
                autoComplete="off"
                spellCheck={false}
              />

              <button type="submit">
                Analyse wallet
                <ArrowRight size={18} />
              </button>
            </div>

            <p className={`wallet-feedback wallet-feedback-${walletFeedback.type}`}>
              {walletFeedback.type === "ready" && (
                <CheckCircle2 size={16} />
              )}

              {walletFeedback.message}
            </p>
          </form>

          <div className="score-preview">
            <div className="preview-topline">
              <span>GOATSCORE PREVIEW</span>
              <span>{walletFeedback.type === "ready" ? "READY" : "AWAITING WALLET"}</span>
            </div>

            <div className="preview-score">
              <strong>--</strong>
              <span>/100</span>
            </div>

            <div className="preview-rank">Your rank will appear here</div>

            <div className="preview-breakdown">
              <div>
                <span>$ANSEM</span>
                <strong>-- / 75</strong>
              </div>

              <div>
                <span>$POORGOAT</span>
                <strong>-- / 25</strong>
              </div>
            </div>
          </div>

          <p className="engine-note">
            The scoring interface is ready. We’ll connect real Solana
            transaction analysis in the next build phase.
          </p>
        </div>
      </section>

      <footer className="site-footer section-shell">
        <div>
          <span className="footer-brand">POORGOAT</span>
          <p>
            Track the goat. Prove your conviction.
          </p>
        </div>

        <div className="footer-links">
          <a href={TOKENS.ansem.dexUrl} target="_blank" rel="noreferrer">
            $ANSEM chart
          </a>

          <a href={TOKENS.poorGoat.dexUrl} target="_blank" rel="noreferrer">
            $POORGOAT chart
          </a>
        </div>

        <span className="footer-domain">{SITE.domain}</span>
      </footer>
    </main>
  );
}