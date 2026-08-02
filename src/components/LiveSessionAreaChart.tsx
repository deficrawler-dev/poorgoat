"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface SessionPoint {
  price: number;
  capturedAt: number;
}

interface LiveSessionAreaChartProps {
  priceUsd: string | null;
  updatedAt: string | null;
}

const STORAGE_KEY = "poorgoat-live-session-v2";
const MAX_POINTS = 96;
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 420;
const PADDING_X = 34;
const PADDING_Y = 34;

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  }
  if (value >= 0.01) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(10).replace(/0+$/, "")}`;
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function restorePoints() {
  if (typeof window === "undefined") return [] as SessionPoint[];

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as SessionPoint[];
    return parsed.filter((point) => {
      return (
        Number.isFinite(point.price) &&
        point.price > 0 &&
        Number.isFinite(point.capturedAt)
      );
    });
  } catch {
    return [];
  }
}

function buildPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
}

export function LiveSessionAreaChart({
  priceUsd,
  updatedAt,
}: LiveSessionAreaChartProps) {
  const [points, setPoints] = useState<SessionPoint[]>([]);
  const lastUpdateRef = useRef<string | null>(null);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      setPoints(restorePoints());
    }, 0);

    return () => {
      window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const price = Number(priceUsd);

      if (!Number.isFinite(price) || price <= 0 || !updatedAt) return;
      if (lastUpdateRef.current === updatedAt) return;

      lastUpdateRef.current = updatedAt;

      setPoints((current) => {
        const next = [
          ...current,
          {
            price,
            capturedAt: Date.now(),
          },
        ].slice(-MAX_POINTS);

        try {
          window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Session storage is optional. The chart still works without it.
        }

        return next;
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [priceUsd, updatedAt]);

  const chart = useMemo(() => {
    if (points.length === 0) {
      return {
        scaled: [] as Array<{ x: number; y: number }>,
        linePath: "",
        areaPath: "",
        minPrice: null as number | null,
        maxPrice: null as number | null,
      };
    }

    const values = points.map((point) => point.price);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const difference = rawMax - rawMin;
    const padding = difference > 0 ? difference * 0.18 : rawMax * 0.008;
    const minPrice = Math.max(0, rawMin - padding);
    const maxPrice = rawMax + padding;
    const range = Math.max(maxPrice - minPrice, Number.EPSILON);

    const usableWidth = VIEW_WIDTH - PADDING_X * 2;
    const usableHeight = VIEW_HEIGHT - PADDING_Y * 2;

    const scaled = points.map((point, index) => {
      const denominator = Math.max(points.length - 1, 1);
      const x = PADDING_X + (index / denominator) * usableWidth;
      const y =
        PADDING_Y +
        (1 - (point.price - minPrice) / range) * usableHeight;

      return { x, y };
    });

    if (scaled.length === 1) {
      scaled.push({ x: VIEW_WIDTH - PADDING_X, y: scaled[0].y });
    }

    const linePath = buildPath(scaled);
    const areaPath = `${linePath} L${scaled.at(-1)?.x},${VIEW_HEIGHT - PADDING_Y} L${scaled[0].x},${VIEW_HEIGHT - PADDING_Y} Z`;

    return {
      scaled,
      linePath,
      areaPath,
      minPrice,
      maxPrice,
    };
  }, [points]);

  const first = points[0] ?? null;
  const latest = points.at(-1) ?? null;
  const sessionChange =
    first && latest && first.price > 0
      ? ((latest.price - first.price) / first.price) * 100
      : null;

  return (
    <div className="session-chart-v2">
      <div className="session-chart-v2-meta">
        <div>
          <span>LIVE SESSION AREA</span>
          <strong>{latest ? formatPrice(latest.price) : "Awaiting first price"}</strong>
        </div>

        <div className="session-chart-v2-status">
          <span className="session-chart-v2-dot" />
          <div>
            <strong>15 SECOND CAPTURE</strong>
            <small>{points.length} points in this tab session</small>
          </div>
        </div>
      </div>

      <div className="session-chart-v2-canvas">
        {chart.scaled.length > 0 ? (
          <>
            <svg
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="PoorGoat live session price area chart"
            >
              {[0, 1, 2, 3, 4].map((index) => {
                const y = PADDING_Y + (index / 4) * (VIEW_HEIGHT - PADDING_Y * 2);
                return (
                  <line
                    key={index}
                    x1={PADDING_X}
                    x2={VIEW_WIDTH - PADDING_X}
                    y1={y}
                    y2={y}
                    className="session-chart-v2-grid"
                  />
                );
              })}

              <path d={chart.areaPath} className="session-chart-v2-area" />
              <path d={chart.linePath} className="session-chart-v2-line" />

              <circle
                cx={chart.scaled.at(-1)?.x}
                cy={chart.scaled.at(-1)?.y}
                r="5"
                className="session-chart-v2-point"
              />
            </svg>

            <span className="session-chart-v2-axis top">
              {chart.maxPrice === null ? "—" : formatPrice(chart.maxPrice)}
            </span>
            <span className="session-chart-v2-axis bottom">
              {chart.minPrice === null ? "—" : formatPrice(chart.minPrice)}
            </span>
          </>
        ) : (
          <div className="session-chart-v2-empty">
            <span>SESSION OPEN</span>
            <strong>THE FIRST PRICE POINT IS BEING CAPTURED</strong>
            <p>The chart grows from this browser session every 15 seconds.</p>
          </div>
        )}
      </div>

      <div className="session-chart-v2-footer">
        <span>{first ? formatTime(first.capturedAt) : "Session start"}</span>
        <strong>
          SESSION {sessionChange === null ? "—" : `${sessionChange >= 0 ? "+" : ""}${sessionChange.toFixed(2)}%`}
        </strong>
        <span>{latest ? formatTime(latest.capturedAt) : "Awaiting price"}</span>
      </div>
    </div>
  );
}
