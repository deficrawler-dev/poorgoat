"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  LoaderCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
  Wallet,
  Menu,
  X,
} from "lucide-react";
import { toBlob } from "html-to-image";
import Image from "next/image";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { GoatScoreResult, TokenScoreSummary } from "@/lib/goatscore/types";
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

interface PoorGoatLandingProps {
  initialWallet?: string;
  initialXUsername?: string;
  autoAnalyse?: boolean;
}

type AnalysisState = "idle" | "loading" | "success" | "error";

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const X_USERNAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
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

function formatTokenAmount(value: number) {
  if (!Number.isFinite(value)) return "0";

  return new Intl.NumberFormat("en-US", {
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 2 : 4,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "No activity";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function shortenWallet(wallet: string) {
  return wallet.length < 14
    ? wallet
    : `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
}

function normalizeXUsername(value: string) {
  return value.trim().replace(/^@/, "");
}

function tokenArtworkPath(kind: "ansem" | "poorGoat", index: number) {
  if (kind === "ansem") {
    return `/images/cards/ansem/ansem-card-0${(index % 5) + 1}.webp`;
  }

  return `/images/cards/poorgoat/goat-card-0${(index % 5) + 1}.webp`;
}

function TokenResultPanel({ summary }: { summary: TokenScoreSummary }) {
  return (
    <article className="token-result-panel">
      <div className="token-result-heading">
        <div>
          <span>{summary.symbol}</span>
          <strong>
            {summary.score} / {summary.maxScore}
          </strong>
        </div>
        <span className={summary.currentlyHolding ? "holding-badge" : "holding-badge empty"}>
          {summary.currentlyHolding ? "CURRENTLY HOLDING" : "NO CURRENT BALANCE"}
        </span>
      </div>

      <div className="token-result-grid">
        <div>
          <span>Holding time</span>
          <strong>{summary.holdingDays} days</strong>
        </div>
        <div>
          <span>Current balance</span>
          <strong>{formatTokenAmount(summary.currentBalance)}</strong>
        </div>
        <div>
          <span>Total bought</span>
          <strong>{formatTokenAmount(summary.totalBought)}</strong>
        </div>
        <div>
          <span>Total sold</span>
          <strong>{formatTokenAmount(summary.totalSold)}</strong>
        </div>
        <div>
          <span>Received</span>
          <strong>{formatTokenAmount(summary.totalReceived)}</strong>
        </div>
        <div>
          <span>Transferred</span>
          <strong>{formatTokenAmount(summary.totalTransferred)}</strong>
        </div>
        <div>
          <span>Position retained</span>
          <strong>{summary.retainedPercentage.toFixed(1)}%</strong>
        </div>
        <div>
          <span>First activity</span>
          <strong>{formatDate(summary.firstActivityAt)}</strong>
        </div>
        <div>
          <span>Accumulations</span>
          <strong>{summary.accumulationEvents}</strong>
        </div>
        <div>
          <span>Major exits</span>
          <strong>{summary.majorExits}</strong>
        </div>
      </div>
    </article>
  );
}

export function PoorGoatLanding({
  initialWallet = "",
  initialXUsername = "",
  autoAnalyse = false,
}: PoorGoatLandingProps) {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [wallet, setWallet] = useState(initialWallet);
  const [xUsername, setXUsername] = useState(initialXUsername);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [result, setResult] = useState<GoatScoreResult | null>(null);
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [cardVariant, setCardVariant] = useState(0);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const hasAutoAnalysed = useRef(false);

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

  const runAnalysis = useCallback(async (walletValue: string, xValue: string) => {
    const normalizedWallet = walletValue.trim();
    const normalizedX = normalizeXUsername(xValue);

    if (!SOLANA_ADDRESS_PATTERN.test(normalizedWallet)) {
      setAnalysisState("error");
      setAnalysisError("Enter a valid Solana wallet address.");
      return;
    }

    if (normalizedX && !X_USERNAME_PATTERN.test(normalizedX)) {
      setAnalysisState("error");
      setAnalysisError("Enter a valid X username without spaces.");
      return;
    }

    setAnalysisState("loading");
    setAnalysisError("");
    setResult(null);

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: normalizedWallet,
          xUsername: normalizedX,
        }),
      });

      const payload = (await response.json()) as GoatScoreResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Wallet analysis failed.");
      }

      setResult(payload);
      setCardVariant(0);
      setAnalysisState("success");

      window.setTimeout(() => {
        document.getElementById("goatscore-result")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    } catch (error) {
      setAnalysisState("error");
      setAnalysisError(
        error instanceof Error ? error.message : "Wallet analysis failed.",
      );
    }
  }, []);

  useEffect(() => {
    if (!autoAnalyse || !initialWallet || hasAutoAnalysed.current) return;

    hasAutoAnalysed.current = true;
    void runAnalysis(initialWallet, initialXUsername);
  }, [autoAnalyse, initialWallet, initialXUsername, runAnalysis]);

  const change = market?.change24h ?? null;
  const isPositive = change !== null && change >= 0;
  const updatedLabel = market?.updatedAt
    ? `Updated ${new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(market.updatedAt))}`
    : "Updates every 30 seconds";

  const sharePath = result
    ? `/score/${result.wallet}${
        result.xUsername ? `?x=${encodeURIComponent(result.xUsername)}` : ""
      }`
    : "";

  const ansemArtwork = result
    ? tokenArtworkPath("ansem", result.artwork.ansemIndex + cardVariant)
    : "/images/cards/ansem/ansem-card-01.webp";
  const poorGoatArtwork = result
    ? tokenArtworkPath("poorGoat", result.artwork.poorGoatIndex + cardVariant)
    : "/images/cards/poorgoat/goat-card-03.webp";

  async function copyContract() {
    try {
      await navigator.clipboard.writeText(TOKENS.poorGoat.mint);
      setCopiedContract(true);
      window.setTimeout(() => setCopiedContract(false), 1600);
    } catch {
      setCopiedContract(false);
    }
  }

  function handleWalletSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runAnalysis(wallet, xUsername);
  }

  async function buildScoreCardFile() {
    if (!cardRef.current || !result) return null;

    const blob = await toBlob(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#050605",
    });

    if (!blob) return null;

    return new File([blob], `goatscore-${result.resultId}.png`, {
      type: "image/png",
    });
  }

  async function downloadScoreCard() {
    if (!result) return;

    setExporting(true);
    try {
      const file = await buildScoreCardFile();
      if (!file) throw new Error("Could not create the scorecard image.");

      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setExporting(false);
    }
  }

  async function copyResultLink() {
    if (!result) return;

    const url = `${window.location.origin}${sharePath}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1600);
  }

  async function shareOnX() {
    if (!result) return;

    const url = `${window.location.origin}${sharePath}`;
    const text = `${result.xUsername ? `@${result.xUsername} scored` : "I scored"} ${
      result.score
    }/100 on GoatScore — ${result.rank}. ${result.ansem.holdingDays} days in $ANSEM with ${result.ansem.retainedPercentage.toFixed(
      1,
    )}% retained. Check yours:`;

    setExporting(true);
    try {
      const file = await buildScoreCardFile();
      const canShareFile = Boolean(
        file && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }),
      );

      if (file && canShareFile) {
        await navigator.share({
          files: [file],
          text,
          url,
          title: `GoatScore ${result.score}/100`,
        });
        return;
      }

      if (file) {
        const objectUrl = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      }

      const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(
        text,
      )}&url=${encodeURIComponent(url)}`;
      window.open(intent, "_blank", "noopener,noreferrer");
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setAnalysisError(error.message);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="pg-site" id="top">
      <header className="pg-header page-width">
        <a
          className="wordmark"
          href="#top"
          aria-label="PoorGoat home"
          onClick={() => setMobileMenuOpen(false)}
        >
          <Image
            src="/images/brand/logo.webp"
            alt="PoorGoat"
            width={220}
            height={68}
            priority
            className="wordmark-logo"
          />
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#market">Market</a>
          <a href="#goatscore">GoatScore</a>
          <a href="#method">Method</a>
        </nav>

        <a className="header-cta" href="#goatscore">
          Check score <ArrowRight size={15} />
        </a>

        <button
          className="mobile-menu-trigger"
          type="button"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? (
            <X size={29} strokeWidth={1.8} />
          ) : (
            <Menu size={31} strokeWidth={1.8} />
          )}
        </button>

        <nav
          id="mobile-navigation"
          className={`mobile-navigation ${mobileMenuOpen ? "is-open" : ""}`}
          aria-label="Mobile navigation"
        >
          <a href="#market" onClick={() => setMobileMenuOpen(false)}>
            Market
          </a>

          <a href="#goatscore" onClick={() => setMobileMenuOpen(false)}>
            GoatScore
          </a>

          <a href="#method" onClick={() => setMobileMenuOpen(false)}>
            Method
          </a>

          <a
            className="mobile-score-link"
            href="#goatscore"
            onClick={() => setMobileMenuOpen(false)}
          >
            Check my GoatScore
            <ArrowRight size={16} />
          </a>
        </nav>
      </header>

      <section className="hero page-width">
        <div className="hero-copy">
          <p className="section-label">BUILT AROUND THE $ANSEM FLYWHEEL</p>
          <h1>
            TRACK THE GOAT.
            <span>PROVE YOUR CONVICTION.</span>
          </h1>
          <p className="hero-intro">
            A live $POORGOAT market terminal and an on-chain score for the
            people who held, accumulated and stayed in the trenches.
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
            <h2>
              THE POORGOAT
              <br />
              TERMINAL.
            </h2>
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
              {change === null
                ? "—"
                : `${isPositive ? "+" : ""}${change.toFixed(2)}%`}
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
              {copiedContract ? <Check size={15} /> : <Copy size={15} />}
              {copiedContract ? "Copied" : "Copy CA"}
            </button>
          </div>
        </div>
      </section>

      <section className="score-section page-width" id="goatscore">
        <div className="section-title-row score-title-row">
          <div>
            <p className="section-label">ON-CHAIN CONVICTION CHECK</p>
            <h2>
              FIND YOUR PLACE
              <br />
              IN THE HERD.
            </h2>
          </div>
          <p className="section-copy">
            Enter your wallet and optional X name. We read public $ANSEM and
            $POORGOAT activity, calculate a real score and create a branded card.
          </p>
        </div>

        <div className="analysis-workspace">
          <div className="analysis-form-panel">
            <div className="panel-heading">
              <span>01 / WALLET DETAILS</span>
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
                  if (analysisState === "error") setAnalysisState("idle");
                }}
              />

              <label htmlFor="xUsername" className="secondary-label">
                X USERNAME <span>OPTIONAL</span>
              </label>
              <div className="x-input-wrap">
                <span>@</span>
                <input
                  id="xUsername"
                  value={xUsername.replace(/^@/, "")}
                  placeholder="deficrawler"
                  maxLength={15}
                  spellCheck={false}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    setXUsername(event.target.value.replace(/[^A-Za-z0-9_]/g, ""));
                    if (analysisState === "error") setAnalysisState("idle");
                  }}
                />
              </div>

              <button className="analyse-button" type="submit" disabled={analysisState === "loading"}>
                {analysisState === "loading" ? (
                  <>
                    Reading the chain <LoaderCircle size={17} className="spinner" />
                  </>
                ) : (
                  <>
                    Analyse my wallet <ArrowRight size={17} />
                  </>
                )}
              </button>

              <p className={`wallet-message ${analysisState}`}>
                {analysisState === "error" ? (
                  <AlertTriangle size={14} />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {analysisState === "error"
                  ? analysisError
                  : "No wallet connection or signature required."}
              </p>
            </form>

            <div className="score-method" id="method">
              <div className="method-row">
                <div>
                  <span>$ANSEM CONVICTION</span>
                  <strong>75 PTS</strong>
                </div>
                <div className="method-track">
                  <span style={{ width: "75%" }} />
                </div>
                <p>Holding time, retained position, buys, sells, transfers and major exits.</p>
              </div>
              <div className="method-row">
                <div>
                  <span>$POORGOAT ACTIVITY</span>
                  <strong>25 PTS</strong>
                </div>
                <div className="method-track">
                  <span style={{ width: "25%" }} />
                </div>
                <p>Current balance, airdrop or transfer retention, accumulation and sell discipline.</p>
              </div>
            </div>
          </div>

          <div className="analysis-status-panel">
            <div className="panel-heading">
              <span>02 / ANALYSIS OUTPUT</span>
              <span>{analysisState === "success" ? "COMPLETE" : "AWAITING WALLET"}</span>
            </div>

            {analysisState === "loading" ? (
              <div className="analysis-loading">
                <LoaderCircle size={32} className="spinner" />
                <strong>READING PUBLIC WALLET HISTORY</strong>
                <p>
                  Classifying $ANSEM and $POORGOAT buys, sells, transfers and received tokens.
                </p>
              </div>
            ) : result ? (
              <div className="quick-result">
                <span>GOATSCORE READY</span>
                <strong>{result.score}<small>/100</small></strong>
                <h3>{result.rank}</h3>
                <p>{result.rankNote}</p>
                <div>
                  <span>$ANSEM {result.ansem.score}/75</span>
                  <span>$POORGOAT {result.poorGoat.score}/25</span>
                </div>
              </div>
            ) : (
              <div className="analysis-empty">
                <span>--</span>
                <strong>YOUR SCORE WILL APPEAR HERE</strong>
                <p>
                  We will show holding time, total bought, sold, received, transferred and retained.
                </p>
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="result-shell" id="goatscore-result">
            <div className="result-heading-row">
              <div>
                <p className="section-label">VERIFIED RESULT · {result.resultId}</p>
                <h3>
                  {result.xUsername ? `@${result.xUsername}` : shortenWallet(result.wallet)}
                  <span>{result.rank}</span>
                </h3>
              </div>
              <div className="result-score-number">
                <strong>{result.score}</strong>
                <span>/100</span>
              </div>
            </div>

            {result.historyTruncated && (
              <div className="history-warning">
                <AlertTriangle size={16} />
                This wallet has an unusually large history. The score uses the most recent indexed activity available in this scan.
              </div>
            )}

            <div className="result-token-grid">
              <TokenResultPanel summary={result.ansem} />
              <TokenResultPanel summary={result.poorGoat} />
            </div>

            <div className="share-card-section">
              <div className="share-card-toolbar">
                <div>
                  <span>BRANDED SCORECARD</span>
                  <p>One card. Both ecosystem scores. Ready for X.</p>
                </div>
                <button type="button" onClick={() => setCardVariant((current) => current + 1)}>
                  <RefreshCw size={14} /> Change artwork
                </button>
              </div>

              <div
                className="final-score-card"
                ref={cardRef}
                style={{ backgroundImage: `url(${ansemArtwork})` }}
              >
                <div className="final-card-overlay" />
                <div className="final-card-grid" />
                <div className="final-card-topline">
                  <span>POORGOAT.FUN</span>
                  <span>ON-CHAIN CONVICTION RECEIPT</span>
                </div>

                <div className="final-card-main">
                  <div className="final-card-identity">
                    <span>{result.xUsername ? `@${result.xUsername}` : shortenWallet(result.wallet)}</span>
                    <h4>{result.rank}</h4>
                    <p>{result.rankNote}</p>
                  </div>

                  <div className="final-card-score">
                    <strong>{result.score}</strong>
                    <span>/100</span>
                  </div>
                </div>

                <div className="final-card-metrics">
                  <div>
                    <span>$ANSEM</span>
                    <strong>{result.ansem.score}/75</strong>
                  </div>
                  <div>
                    <span>$POORGOAT</span>
                    <strong>{result.poorGoat.score}/25</strong>
                  </div>
                  <div>
                    <span>HELD $ANSEM</span>
                    <strong>{result.ansem.holdingDays}D</strong>
                  </div>
                  <div>
                    <span>RETAINED</span>
                    <strong>{result.ansem.retainedPercentage.toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span>BOUGHT</span>
                    <strong>{formatTokenAmount(result.ansem.totalBought)}</strong>
                  </div>
                  <div>
                    <span>SOLD</span>
                    <strong>{formatTokenAmount(result.ansem.totalSold)}</strong>
                  </div>
                </div>

                <div
                  className="final-card-goat"
                  style={{ backgroundImage: `url(${poorGoatArtwork})` }}
                >
                  <span>ECOSYSTEM SIGNAL</span>
                  <strong>{result.poorGoat.score}/25</strong>
                </div>

                <div className="final-card-footer">
                  <span>{shortenWallet(result.wallet)}</span>
                  <span>RESULT #{result.resultId}</span>
                </div>
              </div>

              <div className="share-actions">
                <button type="button" className="primary-share" onClick={shareOnX} disabled={exporting}>
                  {exporting ? <LoaderCircle size={16} className="spinner" /> : <Share2 size={16} />}
                  Share on X
                </button>
                <button type="button" onClick={downloadScoreCard} disabled={exporting}>
                  <Download size={16} /> Download scorecard
                </button>
                <button type="button" onClick={copyResultLink}>
                  {copiedLink ? <Check size={16} /> : <Link2 size={16} />}
                  {copiedLink ? "Link copied" : "Copy result link"}
                </button>
              </div>
              <p className="share-note">
                On supported phones, Share on X sends the image through the native share sheet. On desktop, the card downloads and the X composer opens with the result link.
              </p>
            </div>

            <div className="activity-section">
              <div className="activity-heading">
                <div>
                  <span>RECENT TOKEN ACTIVITY</span>
                  <p>Public transactions used in the current score. Buy and sell labels are inferred from opposite token flows in the same transaction.</p>
                </div>
                <span>{result.activity.length} EVENTS SHOWN</span>
              </div>

              <div className="activity-table-wrap">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Token</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.activity.length > 0 ? (
                      result.activity.map((event) => (
                        <tr key={`${event.signature}-${event.token}-${event.kind}`}>
                          <td><span className={`activity-kind ${event.kind}`}>{event.kind}</span></td>
                          <td>${event.symbol}</td>
                          <td>{formatTokenAmount(event.amount)}</td>
                          <td>{formatDate(event.timestamp)}</td>
                          <td>
                            <a
                              href={`https://solscan.io/tx/${event.signature}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {event.signature.slice(0, 7)}...{event.signature.slice(-5)}
                              <ExternalLink size={12} />
                            </a>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>No $ANSEM or $POORGOAT activity was found in the indexed history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="method-section page-width">
        <div className="method-intro">
          <p className="section-label">THE RULES ARE SIMPLE</p>
          <h2>
            CONVICTION
            <br />
            OVER WALLET SIZE.
          </h2>
        </div>
        <div className="method-grid">
          <article>
            <span>01</span>
            <h3>READ</h3>
            <p>Read public Solana activity for the two official token contracts.</p>
          </article>
          <article>
            <span>02</span>
            <h3>CLASSIFY</h3>
            <p>Separate buys, sells, received tokens and wallet transfers.</p>
          </article>
          <article>
            <span>03</span>
            <h3>SCORE</h3>
            <p>$ANSEM carries 75 points. $POORGOAT contributes the remaining 25.</p>
          </article>
          <article>
            <span>04</span>
            <h3>SHARE</h3>
            <p>Download the branded card, copy the result link and post it on X.</p>
          </article>
        </div>
      </section>

      <section className="closing-section page-width">
        <div className="closing-art">
          <Image
            src="/images/landing/goat-landing.webp"
            alt="PoorGoat landscape artwork"
            fill
            sizes="100vw"
            className="closing-image"
          />
          <div className="closing-shade" />
          <div className="closing-copy">
            <p>THE HERD REMEMBERS.</p>
            <h2>
              THE PEOPLE WHO HELD
              <br />
              WILL HAVE THE RECEIPTS.
            </h2>
            <a className="solid-button" href="#goatscore">
              Check my wallet <Wallet size={17} />
            </a>
          </div>
        </div>
      </section>

      <footer className="pg-footer page-width">
        <div>
          <Image
            src="/images/brand/logo.webp"
            alt="PoorGoat"
            width={190}
            height={58}
            className="footer-logo"
          />
          <p>Track the goat. Prove your conviction.</p>
        </div>
        <div className="footer-links">
          <a href={TOKENS.ansem.dexUrl} target="_blank" rel="noreferrer">
            $ANSEM chart
          </a>
          <a href={TOKENS.poorGoat.dexUrl} target="_blank" rel="noreferrer">
            $POORGOAT chart
          </a>
        </div>
        <span>{SITE.domain}</span>
      </footer>
    </main>
  );
}
