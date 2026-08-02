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

import { LivePoorGoatActivity } from "@/components/LivePoorGoatActivity";
import { PoorGoatMarketTerminal } from "@/components/PoorGoatMarketTerminal";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    const interval = window.setInterval(() => void loadMarket(), 15_000);

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
          <a href="#goatscore">Check Score</a>
          <a href="#market">Terminal</a>
          <a href="#flywheel">Flywheel</a>
          <a href="#activity">Activity</a>
        </nav>

        <a
          className="header-cta"
          href={TOKENS.poorGoat.dexUrl}
          target="_blank"
          rel="noreferrer"
        >
          Buy $POORGOAT <ArrowRight size={15} />
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
          <div className="mobile-nav-heading">
            <div>
              <span>MISSION NAVIGATION</span>
              <strong>Where to, explorer?</strong>
            </div>
            <span className="mobile-live-pill">
              <i />
              SOL LIVE
            </span>
          </div>

          <div className="mobile-nav-links">
            <a href="#goatscore" onClick={() => setMobileMenuOpen(false)}>
              <span>01</span>
              <div>
                <strong>CHECK SCORE</strong>
                <small>Analyse $ANSEM conviction</small>
              </div>
              <ArrowRight size={15} />
            </a>

            <a href="#market" onClick={() => setMobileMenuOpen(false)}>
              <span>02</span>
              <div>
                <strong>TERMINAL</strong>
                <small>Price, liquidity and chart</small>
              </div>
              <ArrowRight size={15} />
            </a>

            <a href="#flywheel" onClick={() => setMobileMenuOpen(false)}>
              <span>03</span>
              <div>
                <strong>FLYWHEEL</strong>
                <small>How $POORGOAT rewards holders</small>
              </div>
              <ArrowRight size={15} />
            </a>

            <a href="#activity" onClick={() => setMobileMenuOpen(false)}>
              <span>04</span>
              <div>
                <strong>ACTIVITY</strong>
                <small>Buys, sells and transfers</small>
              </div>
              <ArrowRight size={15} />
            </a>
          </div>

          <div className="mobile-nav-actions">
            <a
              href="#goatscore"
              onClick={() => setMobileMenuOpen(false)}
            >
              Check Score
            </a>
            <a
              href={TOKENS.poorGoat.dexUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileMenuOpen(false)}
            >
              Buy $POORGOAT <ArrowRight size={14} />
            </a>
          </div>

          <p className="mobile-nav-footnote">
            VERIFIED ON SOLANA Â· POORGOAT.FUN
          </p>
        </nav>
      </header>

      <section className="hero page-width">
        <div className="hero-copy">
          <p className="section-label">THE $ANSEM HOLDER REWARD FLYWHEEL</p>
          <h1>
            TRACK THE GOAT.
            <span>PROVE YOUR CONVICTION.</span>
          </h1>
                    <p className="hero-intro">
            $POORGOAT rewards the $ANSEM holders who hold with conviction and
            bagwork for the ecosystem. GoatScore verifies the on-chain side of
            that journey.
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
              <span>$ANSEM conviction</span>
            </div>
            <div>
              <strong>25</strong>
              <span>$POORGOAT reward signal</span>
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
            Enter your wallet and optional X name. GoatScore measures your
            public $ANSEM conviction and how you retained or used any
            $POORGOAT rewards received by the wallet.
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
                <p>Primary score: holding time, accumulation, retained position, buys, sells, transfers and major exits.</p>
              </div>
              <div className="method-row">
                <div>
                  <span>$POORGOAT REWARD ACTIVITY</span>
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
                  Measuring $ANSEM conviction and how the wallet handled its $POORGOAT rewards.
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
                  <p>One card. $ANSEM conviction and $POORGOAT reward activity. Ready for X.</p>
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
                  <span>$ANSEM HOLDER CONVICTION RECEIPT</span>
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
                  <span>AIRDROP REWARD SIGNAL</span>
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

      <section className="market-section page-width" id="market">
        <div className="section-title-row terminal-v2-title-row">
          <div>
            <p className="section-label">LIVE MARKET INTELLIGENCE</p>
            <h2>
              THE POORGOAT
              <br />
              TERMINAL.
            </h2>
          </div>

          <p className="section-copy">
            A custom PoorGoat market dashboard with live pair statistics and an
            area chart that begins collecting price points when this page opens.
          </p>
        </div>

        <PoorGoatMarketTerminal
          market={market}
          loading={marketLoading}
          error={marketError}
          copied={copiedContract}
          onCopyContract={copyContract}
        />
      </section>

            <section className="method-section page-width" id="flywheel">
        <div className="method-intro">
          <p className="section-label">HOW THE FLYWHEEL WORKS</p>
          <h2>
            HOLD $ANSEM.
            <br />
            BAGWORK.
            <br />
            RECEIVE $POORGOAT.
          </h2>
          <p className="flywheel-intro">
            $POORGOAT is the reward layer for qualifying $ANSEM holders who
            hold with conviction and actively help the ecosystem grow.
          </p>
        </div>

        <div className="method-grid">
          <article>
            <span>01</span>
            <h3>HOLD $ANSEM</h3>
            <p>
              Maintain genuine $ANSEM exposure instead of appearing only for
              the reward.
            </p>
          </article>

          <article>
            <span>02</span>
            <h3>BAGWORK</h3>
            <p>
              Create, support, promote and contribute useful work to the
              $ANSEM ecosystem.
            </p>
          </article>

          <article>
            <span>03</span>
            <h3>QUALIFY</h3>
            <p>
              PoorGoat identifies qualifying holders through the project&apos;s
              airdrop process.
            </p>
          </article>

          <article>
            <span>04</span>
            <h3>RECEIVE $POORGOAT</h3>
            <p>
              Eligible $ANSEM holders receive $POORGOAT as the flywheel reward.
            </p>
          </article>
        </div>

        <p className="bagwork-note">
          GoatScore verifies the public on-chain side of conviction. Off-chain
          bagwork cannot be fully proven by wallet transactions alone and does
          not guarantee an airdrop.
        </p>
      </section>

      <LivePoorGoatActivity market={market} />

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
            <p>THE FLYWHEEL REWARDS CONTRIBUTORS.</p>
            <h2>
              HOLD $ANSEM.
              <br />
              BAGWORK.
              <br />
              EARN $POORGOAT.
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
          <p>The reward flywheel for $ANSEM holders who hold and bagwork.</p>
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
