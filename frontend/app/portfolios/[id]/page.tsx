"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getToken } from "@/lib/auth/token";
import {
  api,
  PortfolioOverview,
  PortfolioPerformancePoint,
  PortfolioTransaction,
  PositionRow
} from "@/lib/api/client";
import { PortfolioPerformanceChart } from "@/components/portfolio/PortfolioPerformanceChart";
import { TradePreviewTicket } from "@/components/portfolio/TradePreviewTicket";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

type PageProps = {
  params: { id: string };
};

const FINANCE_CELL: CSSProperties = {
  padding: "0.5rem 0.65rem",
  borderBottom: "1px solid var(--border)"
};
const FINANCE_TH: CSSProperties = {
  ...FINANCE_CELL,
  color: "var(--muted)",
  fontWeight: 600,
  fontSize: "0.78rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em"
};

function PositionsTable({ rows }: { rows: PositionRow[] }) {
  if (rows.length === 0) {
    return <p className="muted">No positions yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto", margin: "-0.25rem 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr>
            <th style={{ ...FINANCE_TH, textAlign: "left" }}>Symbol</th>
            <th style={{ ...FINANCE_TH, textAlign: "right" }}>Shares</th>
            <th style={{ ...FINANCE_TH, textAlign: "right" }}>Average cost</th>
            <th style={{ ...FINANCE_TH, textAlign: "right" }}>Current price</th>
            <th style={{ ...FINANCE_TH, textAlign: "right" }}>Market value</th>
            <th style={{ ...FINANCE_TH, textAlign: "right" }}>Unrealized P/L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol}>
              <td style={{ ...FINANCE_CELL, fontWeight: 600 }}>{row.symbol}</td>
              <td style={{ ...FINANCE_CELL, textAlign: "right" }}>{row.shares.toFixed(4)}</td>
              <td style={{ ...FINANCE_CELL, textAlign: "right" }}>${row.avg_cost.toFixed(2)}</td>
              <td style={{ ...FINANCE_CELL, textAlign: "right" }}>${row.price.toFixed(2)}</td>
              <td style={{ ...FINANCE_CELL, textAlign: "right" }}>${row.market_value.toFixed(2)}</td>
              <td
                style={{
                  ...FINANCE_CELL,
                  textAlign: "right",
                  color:
                    row.unrealized_pl > 0
                      ? "var(--success)"
                      : row.unrealized_pl < 0
                        ? "var(--danger)"
                        : "var(--text)"
                }}
              >
                ${row.unrealized_pl.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionsTable({ rows }: { rows: PortfolioTransaction[] }) {
  if (rows.length === 0) {
    return <p className="muted">No transactions yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto", margin: "-0.25rem 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr>
            <th style={{ ...FINANCE_TH, textAlign: "left" }}>Timestamp</th>
            <th style={{ ...FINANCE_TH, textAlign: "left" }}>Symbol</th>
            <th style={{ ...FINANCE_TH, textAlign: "left" }}>Type</th>
            <th style={{ ...FINANCE_TH, textAlign: "right" }}>Shares</th>
            <th style={{ ...FINANCE_TH, textAlign: "right" }}>Price</th>
            <th style={{ ...FINANCE_TH, textAlign: "right" }}>Total value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ ...FINANCE_CELL, whiteSpace: "nowrap" }}>
                {new Date(row.timestamp).toLocaleString()}
              </td>
              <td style={{ ...FINANCE_CELL, fontWeight: 600 }}>{row.symbol}</td>
              <td style={FINANCE_CELL}>{row.side}</td>
              <td style={{ ...FINANCE_CELL, textAlign: "right" }}>{row.shares.toFixed(4)}</td>
              <td style={{ ...FINANCE_CELL, textAlign: "right" }}>${row.price.toFixed(2)}</td>
              <td style={{ ...FINANCE_CELL, textAlign: "right" }}>${(row.shares * row.price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PortfolioPage({ params }: PageProps) {
  const TX_LIMIT = 50;
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txOffset, setTxOffset] = useState(0);
  const [performance, setPerformance] = useState<PortfolioPerformancePoint[]>([]);
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transaction filters
  const [symbolFilter, setSymbolFilter] = useState("");
  const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");

  // Task 3.3 — rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const transactionsNewestFirst = useMemo(
    () =>
      [...transactions].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [transactions]
  );

  const filteredTransactions = useMemo(
    () =>
      transactionsNewestFirst.filter((tx) => {
        const matchesSymbol =
          symbolFilter === "" ||
          tx.symbol.toUpperCase().includes(symbolFilter.toUpperCase());
        const matchesSide = sideFilter === "ALL" || tx.side === sideFilter;
        return matchesSymbol && matchesSide;
      }),
    [transactionsNewestFirst, symbolFilter, sideFilter]
  );

  const [txLoadingMore, setTxLoadingMore] = useState(false);

  const loadPortfolioData = useCallback(async () => {
    if (!getToken()) return;
    setPerfLoading(true);
    setPerfError(null);
    const [ov, pos, txPage] = await Promise.all([
      api.getPortfolioOverview(params.id),
      api.getPortfolioPositions(params.id),
      api.getPortfolioTransactions(params.id, TX_LIMIT, 0)
    ]);
    setOverview(ov);
    setPositions(pos);
    setTransactions(txPage.items);
    setTxTotal(txPage.total);
    setTxOffset(TX_LIMIT);
    try {
      const perf = await api.getPortfolioPerformance(params.id);
      setPerformance(perf);
    } catch (e) {
      setPerfError(e instanceof Error ? e.message : "Failed to load performance");
    } finally {
      setPerfLoading(false);
    }
  }, [params.id, TX_LIMIT]);

  const loadMoreTransactions = useCallback(async () => {
    if (!getToken() || txLoadingMore) return;
    setTxLoadingMore(true);
    try {
      const txPage = await api.getPortfolioTransactions(params.id, TX_LIMIT, txOffset);
      setTransactions((prev) => [...prev, ...txPage.items]);
      setTxTotal(txPage.total);
      setTxOffset((prev) => prev + TX_LIMIT);
    } finally {
      setTxLoadingMore(false);
    }
  }, [params.id, TX_LIMIT, txOffset, txLoadingMore]);

  useEffect(() => {
    async function load() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        await loadPortfolioData();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load portfolio");
        setPerfLoading(false);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.id, loadPortfolioData]);

  async function handleRenameSave() {
    if (!renameValue.trim()) return;
    setRenameSaving(true);
    setRenameError(null);
    try {
      await api.renamePortfolio(params.id, renameValue.trim());
      setIsRenaming(false);
      await loadPortfolioData();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "Failed to rename");
    } finally {
      setRenameSaving(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="stack">
        {/* Task 3.3 — inline rename */}
        <div className="row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          {isRenaming ? (
            <>
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRenameSave();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.5rem",
                  background: "rgba(47, 174, 255, 0.08)",
                  border: "1px solid rgba(99, 216, 255, 0.4)",
                  borderRadius: 6,
                  color: "inherit",
                  minWidth: 200,
                }}
                disabled={renameSaving}
              />
              <button
                type="button"
                onClick={() => void handleRenameSave()}
                disabled={renameSaving || !renameValue.trim()}
                style={{ fontSize: "0.85rem" }}
              >
                {renameSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                style={{
                  fontSize: "0.85rem",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  borderRadius: 6,
                  padding: "0.3rem 0.6rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              {renameError && (
                <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{renameError}</p>
              )}
            </>
          ) : (
            <>
              <h1 style={{ margin: 0 }}>{overview?.name ?? "Portfolio"}</h1>
              <button
                type="button"
                onClick={() => {
                  setRenameValue(overview?.name ?? "");
                  setRenameError(null);
                  setIsRenaming(true);
                }}
                style={{
                  fontSize: "0.78rem",
                  padding: "0.25rem 0.6rem",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  borderRadius: 5,
                  cursor: "pointer",
                }}
              >
                Rename
              </button>
            </>
          )}
        </div>

        <div className="card stack">
          <strong style={{ fontSize: "0.95rem" }}>Performance</strong>
          <ErrorBoundary sectionName="Performance Chart">
            <PortfolioPerformanceChart
              points={performance}
              loading={perfLoading}
              error={perfError}
            />
          </ErrorBoundary>
        </div>
        {loading && <p className="muted">Loading...</p>}
        {error && <p className="error">{error}</p>}
        {overview && (
          <div className="stack">
            {/* Task 2.4 — 4th Cash Available card */}
            <div className="grid">
              <div className="card stack">
                <span className="metric-label">Total value</span>
                <span className="metric-value">${overview.total_value.toFixed(2)}</span>
              </div>
              <div className="card stack">
                <span className="metric-label">Cash balance</span>
                <span className="metric-value">${overview.cash_balance.toFixed(2)}</span>
              </div>
              <div className="card stack">
                <span className="metric-label">Gain/loss</span>
                <span className="metric-value">${overview.total_gain_loss.toFixed(2)}</span>
              </div>
              <div className="card stack">
                <span className="metric-label">Invested</span>
                <span className="metric-value">
                  ${(overview.total_value - overview.cash_balance).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            <ErrorBoundary sectionName="Trade Ticket">
              <TradePreviewTicket portfolioId={params.id} onPortfolioRefresh={loadPortfolioData} />
            </ErrorBoundary>
            <ErrorBoundary sectionName="Positions">
              <div className="card stack">
                <strong style={{ fontSize: "0.95rem" }}>Positions</strong>
                <PositionsTable rows={positions} />
              </div>
            </ErrorBoundary>
            <div className="card stack">
              <strong style={{ fontSize: "0.95rem" }}>Recent transactions</strong>
              <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Filter by symbol"
                  value={symbolFilter}
                  onChange={(e) => setSymbolFilter(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: "0.45rem 0.75rem",
                    background: "rgba(47, 174, 255, 0.06)",
                    border: "1px solid rgba(47, 174, 255, 0.2)",
                    borderRadius: 6,
                    color: "inherit",
                    fontSize: "0.85rem",
                  }}
                />
                <select
                  value={sideFilter}
                  onChange={(e) => setSideFilter(e.target.value as "ALL" | "BUY" | "SELL")}
                  style={{
                    padding: "0.45rem 0.75rem",
                    background: "rgba(8, 26, 51, 0.8)",
                    border: "1px solid rgba(47, 174, 255, 0.2)",
                    borderRadius: 6,
                    color: "inherit",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="ALL">All</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              {txTotal > 0 && (
                <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                  Showing {transactions.length} of {txTotal} transactions
                </p>
              )}
              <ErrorBoundary sectionName="Transactions Table">
                <TransactionsTable rows={filteredTransactions} />
              </ErrorBoundary>
              {transactions.length < txTotal && (
                <button
                  type="button"
                  onClick={() => void loadMoreTransactions()}
                  disabled={txLoadingMore}
                  style={{
                    alignSelf: "center",
                    padding: "0.4rem 1.25rem",
                    fontSize: "0.85rem",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    borderRadius: 6,
                    cursor: txLoadingMore ? "default" : "pointer",
                  }}
                >
                  {txLoadingMore ? "Loading…" : "Load More"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
