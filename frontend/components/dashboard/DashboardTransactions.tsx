"use client";

import type { CSSProperties } from "react";
import type { PortfolioTransaction } from "@/lib/api/client";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";

const cell: CSSProperties = { padding: "0.55rem 0.35rem", fontSize: "0.88rem" };
const th: CSSProperties = {
  ...cell,
  color: "var(--muted)",
  fontWeight: 600,
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border)",
  textAlign: "left"
};

type Row = PortfolioTransaction & { portfolio_id: number };

type Props = {
  rows: Row[];
  loading: boolean;
  error: string | null;
};

export function DashboardTransactions({ rows, loading, error }: Props) {
  return (
    <section className="card stack" style={{ padding: "1rem" }}>
      <strong style={{ fontSize: "0.95rem" }}>Recent activity</strong>
      <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>
        Latest trades across your portfolios
      </p>
      {loading && (
        <div className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} width="80%" />
          <SkeletonBlock height={14} width="90%" />
        </div>
      )}
      {error && <p className="error" style={{ margin: "0.5rem 0 0" }}>{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="muted" style={{ margin: "0.5rem 0 0" }}>No transactions yet.</p>
      )}
      {!loading && !error && rows.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 4 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Time</th>
                <th style={th}>Symbol</th>
                <th style={th}>Type</th>
                <th style={{ ...th, textAlign: "right" }}>Shares</th>
                <th style={{ ...th, textAlign: "right" }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr key={`${tx.portfolio_id}-${tx.id}`}>
                  <td style={{ ...cell, whiteSpace: "nowrap", color: "var(--muted)" }}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                  <td style={{ ...cell, fontWeight: 700 }}>{tx.symbol}</td>
                  <td style={cell}>{tx.side}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{tx.shares.toFixed(4)}</td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    ${tx.price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
