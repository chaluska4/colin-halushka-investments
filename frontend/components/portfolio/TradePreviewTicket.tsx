"use client";

import type { CSSProperties } from "react";
import { FormEvent, useRef, useState } from "react";
import { api, TradePreviewResponse } from "@/lib/api/client";

const selectStyle: CSSProperties = {
  width: "100%",
  color: "var(--text)",
  background: "rgba(8, 26, 51, 0.8)",
  border: "1px solid rgba(47, 174, 255, 0.2)",
  borderRadius: 8,
  padding: "0.65rem 0.8rem",
  fontSize: "0.95rem"
};

const executeButtonStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(99, 216, 255, 0.15) 0%, rgba(47, 174, 255, 0.1) 100%)",
  color: "#9EEBFF",
  border: "1px solid rgba(99, 216, 255, 0.4)",
  boxShadow: "0 0 15px rgba(99, 216, 255, 0.15), inset 0 1px 0 rgba(158, 235, 255, 0.15)"
};

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: "1rem" }}>
      <span className="metric-label">{label}</span>
      <span className="metric-value" style={{ textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

type Props = {
  portfolioId: string;
  onPortfolioRefresh?: () => Promise<void>;
};

export function TradePreviewTicket({ portfolioId, onPortfolioRefresh }: Props) {
  const isSubmitting = useRef(false);
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [shares, setShares] = useState("");
  const [preview, setPreview] = useState<TradePreviewResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const busy = loading || executing;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setExecuteError(null);
    setSuccessMessage(null);
    setPreview(null);
    const pid = parseInt(portfolioId, 10);
    if (Number.isNaN(pid)) {
      setError("Invalid portfolio");
      return;
    }
    const sym = symbol.trim().toUpperCase();
    const n = parseFloat(shares);
    if (!sym) {
      setError("Symbol is required");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a positive number of shares");
      return;
    }

    setLoading(true);
    try {
      const res = await api.previewTrade({
        portfolio_id: pid,
        symbol: sym,
        type,
        shares: n
      });
      setPreview(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (isSubmitting.current) return;
    if (!preview?.can_execute) return;
    isSubmitting.current = true;
    const pid = parseInt(portfolioId, 10);
    if (Number.isNaN(pid)) {
      setExecuteError("Invalid portfolio");
      return;
    }
    const side = preview.type === "BUY" || preview.type === "SELL" ? preview.type : null;
    if (!side) {
      setExecuteError("Invalid trade type");
      return;
    }

    setExecuting(true);
    setExecuteError(null);
    setSuccessMessage(null);
    try {
      await api.executeTrade({
        portfolio_id: pid,
        symbol: preview.symbol,
        side,
        shares: preview.shares
      });
      setShowModal(false);
      setPreview(null);
      if (onPortfolioRefresh) {
        await onPortfolioRefresh();
      }
      setSuccessMessage("Trade executed successfully.");
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setExecuting(false);
      isSubmitting.current = false;
    }
  }

  return (
    <>
      {showModal && preview?.can_execute && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(4, 12, 26, 0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "linear-gradient(165deg, rgba(13, 28, 53, 0.98) 0%, rgba(8, 26, 51, 0.99) 100%)",
              border: "1px solid rgba(99, 216, 255, 0.35)",
              borderRadius: 14,
              padding: "1.5rem",
              width: "100%",
              maxWidth: 360,
              boxShadow: "0 0 40px rgba(99, 216, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.6)",
            }}
          >
            <div className="stack" style={{ gap: "0.75rem" }}>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: "#9EEBFF" }}>
                Confirm {preview.type}
              </span>
              <PreviewRow label="Symbol" value={preview.symbol} />
              <PreviewRow label="Shares" value={String(preview.shares)} />
              <PreviewRow label="Price" value={`$${preview.price.toFixed(2)}`} />
              <PreviewRow label="Total cost" value={`$${preview.estimated_total_cost.toFixed(2)}`} />
              <PreviewRow label="Cash after" value={`$${preview.estimated_cash_after.toFixed(2)}`} />
              {executeError && (
                <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{executeError}</p>
              )}
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={executing}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                    borderRadius: 8,
                    padding: "0.6rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleExecute()}
                  disabled={executing}
                  style={{
                    flex: 1,
                    background: type === "BUY" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                    color: type === "BUY" ? "var(--success)" : "var(--danger)",
                    border: `1px solid ${type === "BUY" ? "var(--success)" : "var(--danger)"}`,
                    borderRadius: 8,
                    padding: "0.6rem",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {executing ? "Executing…" : `Confirm ${type}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    <div className="card stack">
      <strong style={{ fontSize: "0.95rem" }}>Trade preview</strong>
      {successMessage && (
        <p className="success" style={{ margin: 0, fontSize: "0.9rem" }}>
          {successMessage}
        </p>
      )}
      <form className="stack" onSubmit={onSubmit}>
        <label className="stack" style={{ gap: 4 }}>
          <span className="metric-label">Symbol</span>
          <input
            type="text"
            placeholder="e.g. AAPL"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="metric-label">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "BUY" | "SELL")}
            disabled={busy}
            style={selectStyle}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="metric-label">Shares</span>
          <input
            type="number"
            min={0}
            step="any"
            placeholder="0"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            disabled={busy}
          />
        </label>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <button type="submit" disabled={busy}>
          {loading ? "Previewing…" : "Preview Trade"}
        </button>
      </form>
      {preview && (
        <div
          className="stack"
          style={{
            marginTop: 4,
            paddingTop: "0.75rem",
            borderTop: "1px solid var(--border)"
          }}
        >
          <span className="metric-label">Preview result</span>
          <PreviewRow label="Symbol" value={preview.symbol} />
          <PreviewRow label="Type" value={preview.type} />
          <PreviewRow label="Shares" value={String(preview.shares)} />
          <PreviewRow label="Price" value={`$${preview.price.toFixed(2)}`} />
          <PreviewRow
            label="Estimated total cost"
            value={`$${preview.estimated_total_cost.toFixed(2)}`}
          />
          <PreviewRow
            label="Estimated cash after"
            value={`$${preview.estimated_cash_after.toFixed(2)}`}
          />
          <PreviewRow
            label="Estimated shares after"
            value={preview.estimated_shares_after.toFixed(4)}
          />
          <PreviewRow
            label="Can execute"
            value={preview.can_execute ? "Yes" : "No"}
          />
          <PreviewRow
            label="Error message"
            value={preview.error_message ?? "—"}
          />
          {preview.can_execute && (
            <div className="stack" style={{ marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                style={executeButtonStyle}
              >
                Confirm {type}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
