"use client";

import { useMemo } from "react";
import type { PortfolioPerformancePoint } from "@/lib/api/client";

function buildLinePath(points: PortfolioPerformancePoint[]): string | null {
  if (points.length < 2) return null;
  const times = points.map((p) => new Date(p.timestamp).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const vals = points.map((p) => p.portfolio_value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const padX = 2;
  const padY = 4;
  const w = 100 - padX * 2;
  const h = 100 - padY * 2;
  const rangeT = maxT - minT || 1;
  const rangeV = maxV - minV || 1;

  return points
    .map((p, i) => {
      const t = (new Date(p.timestamp).getTime() - minT) / rangeT;
      const vn = (p.portfolio_value - minV) / rangeV;
      const x = padX + t * w;
      const y = padY + h - vn * h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

type Props = {
  points: PortfolioPerformancePoint[];
  loading: boolean;
  error: string | null;
};

export function PortfolioPerformanceChart({ points, loading, error }: Props) {
  const pathD = useMemo(() => buildLinePath(points), [points]);

  if (loading) {
    return <p className="muted" style={{ margin: 0 }}>Loading chart…</p>;
  }
  if (error) {
    return <p className="error" style={{ margin: 0 }}>{error}</p>;
  }
  if (points.length === 0) {
    return <p className="muted" style={{ margin: 0 }}>No performance data yet.</p>;
  }
  if (!pathD) {
    return <p className="muted" style={{ margin: 0 }}>Not enough history to chart.</p>;
  }

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          width: "100%",
          height: 200,
          display: "block",
          borderRadius: 8
        }}
        aria-label="Portfolio value over time"
      >
        <defs>
          <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#63D8FF" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#2FAEFF" stopOpacity="0.02" />
          </linearGradient>
          <filter id="chartGlow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="url(#chartBg)" />
        <line
          x1="2"
          y1="96"
          x2="98"
          y2="96"
          stroke="rgba(47, 174, 255, 0.2)"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#63D8FF"
          strokeWidth="0.7"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          filter="url(#chartGlow)"
        />
      </svg>
    </div>
  );
}
