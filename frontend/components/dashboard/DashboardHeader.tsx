"use client";

import type { CSSProperties } from "react";
import type { DashboardSnapshot, PortfolioPerformancePoint } from "@/lib/api/client";
import { DashboardHeroChart } from "@/components/dashboard/DashboardHeroChart";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";

export const TIME_RANGES = ["1H", "1D", "1W", "1M", "1Y", "ALL"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

const pillRow: CSSProperties = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 4,
  overflowX: "auto",
  marginTop: 2,
  paddingBottom: 2,
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "none"
};

type Props = {
  snapshot: DashboardSnapshot | null;
  timeRange: TimeRange;
  onTimeRangeChange: (r: TimeRange) => void;
  loading: boolean;
  performancePoints: PortfolioPerformancePoint[];
  performanceLoading: boolean;
  dollarChange: number;
  percentChange: number;
};

export function DashboardHeader({
  snapshot,
  timeRange,
  onTimeRangeChange,
  loading,
  performancePoints,
  performanceLoading,
  dollarChange,
  percentChange
}: Props) {
  const changeUp = dollarChange > 0;
  const changeDown = dollarChange < 0;
  const changeColor = changeUp ? "var(--success)" : changeDown ? "var(--danger)" : "var(--muted)";
  const chartTrendUp =
    performancePoints.length >= 2
      ? performancePoints[performancePoints.length - 1].portfolio_value >=
        performancePoints[0].portfolio_value
      : changeUp || !changeDown;

  return (
    <section
      className="card stack"
      style={{
        padding: "0.75rem 0.85rem 0.65rem",
        gap: "0.35rem",
        background: "linear-gradient(165deg, rgba(13, 28, 53, 0.95) 0%, rgba(8, 26, 51, 0.98) 55%, rgba(6, 13, 26, 0.99) 100%)",
        borderColor: "rgba(47, 174, 255, 0.2)",
        boxShadow: "inset 0 1px 0 rgba(158, 235, 255, 0.08), 0 0 30px rgba(47, 174, 255, 0.08), 0 4px 24px rgba(0, 0, 0, 0.4)"
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div className="stack" style={{ gap: "0.2rem", minWidth: 0 }}>
          {loading && !snapshot ? (
            <div className="stack" style={{ gap: "0.4rem" }}>
              <SkeletonBlock height={32} width={180} />
              <SkeletonBlock height={16} width={120} />
            </div>
          ) : snapshot ? (
            <>
              <div
                style={{
                  fontSize: "clamp(1.65rem, 5.2vw, 2.05rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.028em",
                  lineHeight: 1.08,
                  color: "var(--text)"
                }}
              >
                $
                {snapshot.total_account_value.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
              <div
                className="row"
                style={{ gap: 6, flexWrap: "wrap", alignItems: "baseline" }}
              >
                <span style={{ fontSize: "0.88rem", fontWeight: 600, color: changeColor }}>
                  {changeUp ? "↗" : changeDown ? "↘" : ""}
                  {dollarChange >= 0 ? "+" : "-"}$
                  {Math.abs(dollarChange).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                  {" "}
                  ({percentChange >= 0 ? "+" : ""}{percentChange.toFixed(2)}%)
                  <span className="muted" style={{ fontWeight: 500, fontSize: "0.8rem" }}>
                    {" "}
                    {timeRange} ›
                  </span>
                </span>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "baseline", marginTop: 2 }}>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  Cash{" "}
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>
                    ${snapshot.total_cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
                <span className="muted" style={{ fontSize: "0.78rem" }}>·</span>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  Stocks{" "}
                  <span style={{ color: "var(--text)", fontWeight: 600 }}>
                    ${snapshot.total_portfolio_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
                <span className="muted" style={{ fontSize: "0.78rem" }}>·</span>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  P&amp;L{" "}
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        snapshot.total_unrealized_pl > 0
                          ? "var(--success)"
                          : snapshot.total_unrealized_pl < 0
                          ? "var(--danger)"
                          : "var(--text)",
                    }}
                  >
                    {snapshot.total_unrealized_pl >= 0 ? "+" : "-"}$
                    {Math.abs(snapshot.total_unrealized_pl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              </div>
              {snapshot.total_realized_pl !== undefined && (
                <div className="row" style={{ gap: 4, alignItems: "baseline", marginTop: 1 }}>
                  <span className="muted" style={{ fontSize: "0.78rem" }}>Realized P&amp;L:</span>
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      color:
                        snapshot.total_realized_pl > 0
                          ? "var(--success)"
                          : snapshot.total_realized_pl < 0
                          ? "var(--danger)"
                          : "var(--muted)",
                    }}
                  >
                    {snapshot.total_realized_pl >= 0 ? "+" : "-"}$
                    {Math.abs(snapshot.total_realized_pl).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
            </>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Expand"
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "1px solid rgba(99, 216, 255, 0.25)",
            background: "rgba(47, 174, 255, 0.08)",
            color: "#9EEBFF",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            padding: 0,
            fontSize: "0.7rem",
            boxShadow: "inset 0 1px 0 rgba(158, 235, 255, 0.15), 0 0 8px rgba(99, 216, 255, 0.1)",
            transition: "all 0.2s ease"
          }}
        >
          ⌃
        </button>
      </div>

      <DashboardHeroChart
        points={performancePoints}
        loading={performanceLoading}
        positiveTrend={chartTrendUp}
      />

      <div style={{ marginTop: 2 }}>
        <div style={pillRow} role="tablist" aria-label="Chart time range">
          {TIME_RANGES.map((r) => {
            const active = r === timeRange;
            return (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTimeRangeChange(r)}
                style={{
                  padding: "0.28rem 0.55rem",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  borderRadius: 999,
                  border: active ? "1px solid rgba(99, 216, 255, 0.3)" : "1px solid transparent",
                  background: active
                    ? "linear-gradient(180deg, rgba(99, 216, 255, 0.2) 0%, rgba(47, 174, 255, 0.12) 100%)"
                    : "transparent",
                  color: active ? "#DDFBFF" : "var(--muted)",
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: active ? "0 0 12px rgba(99, 216, 255, 0.2), inset 0 1px 0 rgba(221, 251, 255, 0.15)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
