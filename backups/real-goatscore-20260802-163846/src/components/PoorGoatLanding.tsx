"use client";

import {
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

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

type WalletState =
  | { type: "idle"; message: string }
  | { type: "error"; message: string }
  | { type: "ready"; message: string };

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const ANSEM_CARDS = Array.from(
  { length: 5 },
  (_, index) => `/images/cards/ansem/ansem-card-0${index + 1}.webp`,
);

const POORGOAT_CARDS = Array.from(
  { length: 5 },
  (_, index) => `/images/cards/poorgoat/goat-card-0${index + 1}.webp`,
);

const DEX_EMBED_URL = `${TOKENS.poorGoat.dexUrl}?embed=1&info=0&theme=dark&trades=0`;

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
  if (price >= 1) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
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

function shortenWallet(wallet: string) {
  return wallet.length < 14 ? wallet : `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
}

function walletSeed(wallet: string) {
  return Array.from(wallet).reduce((total, character, index) => {
    return (total + character.charCodeAt(0) * (index + 11)) % 100_003;
  }, 0);
}

export function PoorGoatLanding() {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [wallet, setWallet] = useState("");
  const [copied, setCopied] = useState(false);
  const [ansemCardIndex, setAnsemCardIndex] = useState(0);
  const [goatCardIndex, setGoatCardIndex] = useState(2);
  const [walletState, setWalletState] = useState<WalletState>({
    type: "idle",
    message: "No wallet connection. Public Solana activity only.",
  });

  useEffect(() => {
    let active = true;

    async function loadMarket() {
      try {
        const response = await fetch("/api/market", { cache: "no-store" });
        if (!response.ok) throw new Error("Market request failed");

        const payload = (await response.json()) as MarketData;
        if (!active) return;

        setMarket(payload);
        setMarketError("");
      } catch {
        if (active) setMarketError("Market feed temporarily delayed");
      } finally {
        if (active) setMarketLoading(false);
      }
    }

    void loadMarket();
    const interval = window.setInterval(() => void loadMarket(), 30_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const change = market?.change24h ?? null;
  const isPositive = change !== null && change >= 0;

  const currentAnsemCard = ANSEM_CARDS[ansemCardIndex];
  const currentGoatCard = POORGOAT_CARDS[goatCardIndex];

  const updatedLabel = market?.updatedAt
    ? `Updated ${new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(market.updatedAt))}`
    : "Updates every 30 seconds";

  async function copyContract() {
    try {
      await navigator.clipboard.writeText(TOKENS.poorGoat.mint);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function cycleCardArtwork() {
    setAnsemCardIndex((current) => (current + 1) % ANSEM_CARDS.length);
    setGoatCardIndex((current) => (current + 2) % POORGOAT_CARDS.length);
  }

  function handleWalletSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedWallet = wallet.trim();

    if (!SOLANA_ADDRESS_PATTERN.test(normalizedWallet)) {
      setWalletState({ type: "error", message: "Enter a valid Solana wallet address." });
      return;
    }

    const seed = walletSeed(normalizedWallet);
    setAnsemCardIndex(seed % ANSEM_CARDS.length);
    setGoatCardIndex((seed * 3 + 1) % POORGOAT_CARDS.length);
    setWalletState({
      type: "ready",
      message: `${shortenWallet(normalizedWallet)} is ready for on-chain analysis.`,
    });
  }

  return (
    <main className="pg-site" id="top">
      <div className="top-tape">
        <span>POORGOAT TERMINAL</span>
        <span>PUBLIC ON-CHAIN DATA</span>
        <span>$ANSEM 75 / $POORGOAT 25</span>
      </div>

      <header className="pg-header page-width">
        <a className="wordmark" href="#top" aria-label="PoorGoat home">
          <span className="wordmark-symbol">PG</span>
          <span>POORGOAT</span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#market">Market</a>
          <a href="#goatscore">GoatScore</a>
          <a href="#method">Method</a>
        </nav>

        <a className="header-cta" href="#goatscore">
          Check score <ArrowRight size={15} />
        </a>
      </header>

      <section className="hero page-width">
        <div className="hero-copy">
          <p className="section-label">BUILT AROUND THE $ANSEM FLYWHEEL</p>
          <h1>
            TRACK THE GOAT.
            <span>PROVE YOUR CONVICTION.</span>
          </h1>
          <p className="hero-intro">
            A live $POORGOAT market terminal and an on-chain score for the people
            who held, accumulated and stayed in the trenches.
          </p>

          <div className="hero-actions">
            <a className="solid-button" href="#goatscore">
              Check my GoatScore <ArrowRight size={17} />
            </a>
            <a className="text-button" href="#market">
              Open live market <BarChart3 size={17} />
            </a>
          </div>

          <div className="hero-proof">
            <div>
              <strong>75</strong>
              <span>$ANSEM points</span>
            </div>
            <div>
              <strong>25</strong>
              <span>$POORGOAT points</span>
            </div>
            <div>
              <strong>0</strong>
              <span>wallet signatures</span>
            </div>
          </div>
        </div>

        <div className="hero-art-stage">
          <Image
            src="/images/hero/hero-image.webp"
            alt="PoorGoat ecosystem artwork"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 48vw"
            className="hero-art"
          />
        </div>
      </section>

      <section className="market-section page-width" id="market">
        <div className="section-title-row">
          <div>
            <p className="section-label">LIVE MARKET INTELLIGENCE</p>
            <h2>THE POORGOAT<br />TERMINAL.</h2>
          </div>
          <p className="section-copy">
            Price, liquidity, volume and trading activity in one restrained,
            real-time view.
          </p>
        </div>

        <div className="market-terminal">
          <div className="terminal-bar">
            <div className="token-identity">
              <span className="token-avatar">PG</span>
              <div>
                <strong>$POORGOAT / SOL</strong>
                <span>Solana · Live pair</span>
              </div>
            </div>

            <div className={`change-pill ${isPositive ? "positive" : "negative"}`}>
              {change === null ? "—" : `${isPositive ? "+" : ""}${change.toFixed(2)}%`}
              <span>24H</span>
            </div>
          </div>

          <div className="terminal-body">
            <aside className="market-sidebar">
              <p className="data-label">POORGOAT PRICE</p>
              <strong className="market-price">
                {marketLoading ? "LOADING" : formatPrice(market?.priceUsd ?? null)}
              </strong>
              <span className="pair-caption">Live USD price via Dexscreener</span>

              <div className="market-stats">
                <div>
                  <span>Market cap</span>
                  <strong>{marketLoading ? "—" : formatMoney(market?.marketCap ?? null)}</strong>
                </div>
                <div>
                  <span>Liquidity</span>
                  <strong>{marketLoading ? "—" : formatMoney(market?.liquidity ?? null)}</strong>
                </div>
                <div>
                  <span>24H volume</span>
                  <strong>{marketLoading ? "—" : formatMoney(market?.volume24h ?? null)}</strong>
                </div>
                <div>
                  <span>24H trades</span>
                  <strong>
                    {marketLoading
                      ? "—"
                      : formatCount((market?.buys24h ?? 0) + (market?.sells24h ?? 0))}
                  </strong>
                </div>
              </div>

              <div className="trade-split">
                <div><span>Buys</span><strong>{formatCount(market?.buys24h ?? null)}</strong></div>
                <div><span>Sells</span><strong>{formatCount(market?.sells24h ?? null)}</strong></div>
              </div>
            </aside>

            <div className="chart-shell">
              <div className="chart-toolbar">
                <span className={marketError ? "status-dot error" : "status-dot"} />
                <span>{marketLoading ? "Connecting to feed" : marketError || updatedLabel}</span>
                <a href={TOKENS.poorGoat.dexUrl} target="_blank" rel="noreferrer">
                  Full chart <ExternalLink size={13} />
                </a>
              </div>
              <iframe
                title="$POORGOAT live Dexscreener chart"
                src={DEX_EMBED_URL}
                loading="lazy"
                allow="clipboard-write"
              />
            </div>
          </div>

          <div className="contract-row">
            <div>
              <span>OFFICIAL CONTRACT</span>
              <code>{TOKENS.poorGoat.mint}</code>
            </div>
            <button type="button" onClick={copyContract}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy CA"}
            </button>
          </div>
        </div>
      </section>

      <section className="score-section page-width" id="goatscore">
        <div className="section-title-row score-title-row">
          <div>
            <p className="section-label">ON-CHAIN CONVICTION CHECK</p>
            <h2>FIND YOUR PLACE<br />IN THE HERD.</h2>
          </div>
          <p className="section-copy">
            $ANSEM activity leads the score. $POORGOAT activity adds the final
            ecosystem layer. Wallet size alone does not decide conviction.
          </p>
        </div>

        <div className="score-workspace">
          <div className="score-control-panel">
            <div className="panel-heading">
              <span>01 / ENTER WALLET</span>
              <ShieldCheck size={18} />
            </div>

            <form className="wallet-form" onSubmit={handleWalletSubmit}>
              <label htmlFor="wallet">SOLANA WALLET ADDRESS</label>
              <textarea
                id="wallet"
                value={wallet}
                rows={3}
                spellCheck={false}
                placeholder="Paste wallet address"
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setWallet(event.target.value);
                  if (walletState.type !== "idle") {
                    setWalletState({
                      type: "idle",
                      message: "No wallet connection. Public Solana activity only.",
                    });
                  }
                }}
              />
              <button className="analyse-button" type="submit">
                Analyse wallet <ArrowRight size={17} />
              </button>
              <p className={`wallet-message ${walletState.type}`}>
                {walletState.type === "ready" && <Check size={14} />}
                {walletState.message}
              </p>
            </form>

            <div className="score-method" id="method">
              <div className="method-row">
                <div><span>$ANSEM</span><strong>75 PTS</strong></div>
                <div className="method-track"><span style={{ width: "75%" }} /></div>
                <p>Holding duration, retention, accumulation, exits and early participation.</p>
              </div>
              <div className="method-row">
                <div><span>$POORGOAT</span><strong>25 PTS</strong></div>
                <div className="method-track"><span style={{ width: "25%" }} /></div>
                <p>Current holding, airdrop retention, added conviction and major sells.</p>
              </div>
            </div>
          </div>

          <div className="card-lab">
            <div className="panel-heading">
              <span>02 / SHARE CARD PREVIEW</span>
              <button type="button" onClick={cycleCardArtwork}>
                <RefreshCw size={14} /> Change artwork
              </button>
            </div>

            <div className="score-card-stack">
              <article className="ansem-score-card">
                <Image
                  src={currentAnsemCard}
                  alt="Randomised ANSEM score card artwork"
                  fill
                  sizes="(max-width: 900px) 100vw, 50vw"
                  className="score-art"
                />
                <div className="score-card-shade" />
                <div className="score-card-content">
                  <div className="score-card-top">
                    <span>POORGOAT.FUN</span>
                    <span>ANSEM CONVICTION</span>
                  </div>
                  <div className="score-card-number">
                    <strong>--</strong><span>/75</span>
                  </div>
                  <p>{walletState.type === "ready" ? shortenWallet(wallet.trim()) : "AWAITING WALLET"}</p>
                  <div className="score-card-footer">
                    <span>HOLDING</span><span>RETENTION</span><span>ACCUMULATION</span>
                  </div>
                </div>
              </article>

              <article className="goat-score-card">
                <Image
                  src={currentGoatCard}
                  alt="Randomised PoorGoat score card artwork"
                  fill
                  sizes="320px"
                  className="score-art"
                />
                <div className="score-card-shade" />
                <div className="goat-card-content">
                  <span>$POORGOAT ACTIVITY</span>
                  <strong>-- / 25</strong>
                  <small>ECOSYSTEM SIGNAL</small>
                </div>
              </article>
            </div>

            <div className="card-lab-footer">
              <span>Each verified result receives artwork from one of five $ANSEM and five $POORGOAT card sets.</span>
              <span>Built for X sharing</span>
            </div>
          </div>
        </div>
      </section>

      <section className="method-section page-width">
        <div className="method-intro">
          <p className="section-label">THE RULES ARE SIMPLE</p>
          <h2>CONVICTION<br />OVER WALLET SIZE.</h2>
        </div>
        <div className="method-grid">
          <article><span>01</span><h3>READ</h3><p>We read public Solana history for the two official token contracts.</p></article>
          <article><span>02</span><h3>MEASURE</h3><p>We measure duration, retained position, accumulation and major exits.</p></article>
          <article><span>03</span><h3>SCORE</h3><p>$ANSEM carries 75 points. $POORGOAT contributes the remaining 25.</p></article>
          <article><span>04</span><h3>SHARE</h3><p>Your result becomes a branded card ready to post directly on X.</p></article>
        </div>
      </section>

      <section className="closing-section page-width">
        <div className="closing-art">
          <Image
            src="/images/cards/poorgoat/goat-card-03.webp"
            alt="PoorGoat community artwork"
            fill
            sizes="100vw"
            className="closing-image"
          />
          <div className="closing-shade" />
          <div className="closing-copy">
            <p>THE HERD REMEMBERS.</p>
            <h2>THE PEOPLE WHO HELD<br />WILL HAVE THE RECEIPTS.</h2>
            <a className="solid-button" href="#goatscore">
              Check my wallet <Wallet size={17} />
            </a>
          </div>
        </div>
      </section>

      <footer className="pg-footer page-width">
        <div>
          <span className="footer-wordmark">POORGOAT</span>
          <p>Track the goat. Prove your conviction.</p>
        </div>
        <div className="footer-links">
          <a href={TOKENS.ansem.dexUrl} target="_blank" rel="noreferrer">$ANSEM chart</a>
          <a href={TOKENS.poorGoat.dexUrl} target="_blank" rel="noreferrer">$POORGOAT chart</a>
        </div>
        <span>{SITE.domain}</span>
      </footer>
    </main>
  );
}
