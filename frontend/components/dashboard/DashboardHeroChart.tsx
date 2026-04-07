"use client";

import { useMemo, useRef, useState } from "react";
import type { PortfolioPerformancePoint } from "@/lib/api/client";

const VB_W = 100;
const VB_H = 52;
const PAD_L = 0.5;
const PAD_R = 0.5;
const PAD_T = 4;
const PAD_B = 1.5;

function normPoints(points: PortfolioPerformancePoint[]): Array<{ x: number; y: number }> {
  if (points.length === 0) return [];
  // Sort chronologically so left-to-right always means oldest-to-newest
  const sorted = [...points].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const ts = sorted.map((p) => new Date(p.timestamp).getTime());
  const minT = ts[0];
  const maxT = ts[ts.length - 1];
  const vals = sorted.map((p) => p.portfolio_value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const w = VB_W - PAD_L - PAD_R;
  const h = VB_H - PAD_T - PAD_B;
  const rangeT = maxT - minT || 1;
  const rangeV = maxV - minV || 1;
  // SVG Y=0 is the top of the canvas, so higher values need lower Y coordinates.
  // vn=1 (max) → y = PAD_T (top); vn=0 (min) → y = PAD_T + h (bottom)
  return sorted.map((p) => {
    const t = (new Date(p.timestamp).getTime() - minT) / rangeT;
    const vn = (p.portfolio_value - minV) / rangeV;
    const x = PAD_L + t * w;
    const y = PAD_T + h - vn * h;
    return { x, y };
  });
}

function upsample(pts: Array<{ x: number; y: number }>, count: number): Array<{ x: number; y: number }> {
  if (pts.length < 2) return pts;
  const out: Array<{ x: number; y: number }> = [];
  const segments = Math.max(count, (pts.length - 1) * 8);
  for (let s = 0; s <= segments; s++) {
    const u = s / segments;
    const f = u * (pts.length - 1);
    const i = Math.min(Math.floor(f), pts.length - 2);
    const k = f - i;
    const a = pts[i];
    const b = pts[i + 1];
    out.push({
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k
    });
  }
  return out;
}

function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

type TooltipState = {
  x: number;
  y: number;
  value: number;
  timestamp: string;
  hairlineX: number;
};

type Props = {
  points: PortfolioPerformancePoint[];
  loading: boolean;
  positiveTrend: boolean;
};

export function DashboardHeroChart({ points, loading, positiveTrend }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { lineD, areaD, last } = useMemo(() => {
    const raw = normPoints(points);
    if (raw.length < 2) {
      return { lineD: "", areaD: "", last: null as { x: number; y: number } | null };
    }
    const smooth = upsample(raw, 48);
    const line = smoothPath(smooth);
    const baseY = VB_H - PAD_B;
    if (!line) return { lineD: "", areaD: "", last: null };
    const lastPt = smooth[smooth.length - 1];
    const firstX = smooth[0].x;
    const area = `${line} L ${lastPt.x} ${baseY} L ${firstX} ${baseY} Z`;
    return { lineD: line, areaD: area, last: lastPt };
  }, [points]);

  // Pre-sort for hover lookup (same order as normPoints uses internally)
  const sortedPoints = useMemo(
    () =>
      [...points].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [points]
  );

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    if (!svgRef.current || !wrapperRef.current || sortedPoints.length === 0) return;

    const svgRect = svgRef.current.getBoundingClientRect();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();

    // Normalized 0-1 position across chart width
    const ratio = Math.max(0, Math.min(1, (e.clientX - svgRect.left) / svgRect.width));

    // Map to timestamp range and find nearest original data point
    const ts = sortedPoints.map((p) => new Date(p.timestamp).getTime());
    const minT = ts[0];
    const maxT = ts[ts.length - 1];
    const rangeT = maxT - minT || 1;
    const targetT = minT + ratio * rangeT;

    let nearest = sortedPoints[0];
    let minDist = Infinity;
    for (const p of sortedPoints) {
      const dist = Math.abs(new Date(p.timestamp).getTime() - targetT);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }

    // Hairline snaps to the nearest data point's x in SVG viewBox coords
    const nearestRatio = (new Date(nearest.timestamp).getTime() - minT) / rangeT;
    const hairlineX = PAD_L + nearestRatio * (VB_W - PAD_L - PAD_R);

    setTooltip({
      x: e.clientX - wrapperRect.left,
      y: e.clientY - wrapperRect.top,
      value: nearest.portfolio_value,
      timestamp: nearest.timestamp,
      hairlineX,
    });
  }

  const stroke = positiveTrend ? "#63D8FF" : "#9EEBFF";

  if (loading) {
    return (
      <div
        style={{
          height: 132,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <span className="muted" style={{ fontSize: "0.78rem" }}>
          Loading chart…
        </span>
      </div>
    );
  }

  if (!lineD || !last) {
    return (
      <div
        style={{
          height: 132,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <span className="muted" style={{ fontSize: "0.78rem" }}>
          No chart data yet
        </span>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div style={{ margin: "-0.15rem -0.35rem 0", width: "calc(100% + 0.7rem)", overflow: "hidden" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: 132, display: "block" }}
          aria-hidden
        >
          <defs>
            <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="40%" stopColor={stroke} stopOpacity="0.12" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
            <filter id="heroGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="heroDotGlow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="0.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d={areaD} fill="url(#heroArea)" />
          <path
            d={lineD}
            fill="none"
            stroke={stroke}
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            filter="url(#heroGlow)"
          />
          {tooltip && (
            <line
              x1={tooltip.hairlineX} y1={PAD_T}
              x2={tooltip.hairlineX} y2={VB_H - PAD_B}
              stroke="rgba(99, 216, 255, 0.3)"
              strokeWidth="0.3"
              strokeDasharray="1 1"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <circle
            cx={last.x}
            cy={last.y}
            r="1.3"
            fill="#DDFBFF"
            stroke={stroke}
            strokeWidth="0.3"
            filter="url(#heroDotGlow)"
          />
          <rect
            x={PAD_L}
            y={PAD_T}
            width={VB_W - PAD_L - PAD_R}
            height={VB_H - PAD_T - PAD_B}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: "crosshair" }}
          />
        </svg>
      </div>
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: 8,
            transform: "translateX(-50%)",
            background: "rgba(13, 28, 53, 0.95)",
            border: "1px solid rgba(99, 216, 255, 0.3)",
            borderRadius: 6,
            padding: "0.4rem 0.65rem",
            fontSize: "0.78rem",
            color: "#DDFBFF",
            boxShadow: "0 0 12px rgba(99, 216, 255, 0.2)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            ${tooltip.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ color: "#7eb8d4", marginTop: 2 }}>
            {new Date(tooltip.timestamp).toLocaleDateString()}{" "}
            {new Date(tooltip.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
