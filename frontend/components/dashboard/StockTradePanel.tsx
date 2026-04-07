"use client";

import type { CSSProperties } from "react";
import { FormEvent, useRef, useState } from "react";
import { api, TradePreviewResponse } from "@/lib/api/client";

const executeButtonStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(99, 216, 255, 0.15) 0%, rgba(47, 174, 255, 0.1) 100%)",
  color: "#9EEBFF",
  border: "1px solid rgba(99, 216, 255, 0.4)",
  boxShadow: "0 0 15px rgba(99, 216, 255, 0.15), inset 0 1px 0 rgba(158, 235, 255, 0.15)"
};

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: "1rem" }}>
      <span className="muted" style={{ fontSize: "0.8rem" }}>{label}</span>
      <span style={{ fontSize: "0.9rem", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function TradeConfirmModal({
  preview,
  tradeType,
  executing,
  executeError,
  onConfirm,
  onCancel,
}: {
  preview: TradePreviewResponse;
  tradeType: "BUY" | "SELL";
  executing: boolean;
  executeError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
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
              onClick={onCancel}
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
              onClick={onConfirm}
              disabled={executing}
              style={{
                flex: 1,
                background: tradeType === "BUY" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: tradeType === "BUY" ? "var(--success)" : "var(--danger)",
                border: `1px solid ${tradeType === "BUY" ? "var(--success)" : "var(--danger)"}`,
                borderRadius: 8,
                padding: "0.6rem",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {executing ? "Executing..." : `Confirm ${tradeType}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  portfolioId: number;
  symbol: string;
  currentPrice: number;
  onClose: () => void;
  onTradeComplete: () => void;
};

export function StockTradePanel({
  portfolioId,
  symbol,
  currentPrice,
  onClose,
  onTradeComplete
}: Props) {
  const isSubmitting = useRef(false);
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

    const n = parseFloat(shares);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a positive number of shares");
      return;
    }

    setLoading(true);
    try {
      const res = await api.previewTrade({
        portfolio_id: portfolioId,
        symbol,
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
    setExecuting(true);
    setExecuteError(null);
    setSuccessMessage(null);
    try {
      await api.executeTrade({
        portfolio_id: portfolioId,
        symbol: preview.symbol,
        side: preview.type as "BUY" | "SELL",
        shares: preview.shares
      });
      setShowModal(false);
      setPreview(null);
      setShares("");
      setSuccessMessage(`${preview.type} order executed for ${preview.shares} shares of ${symbol}`);
      onTradeComplete();
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setExecuting(false);
      isSubmitting.current = false;
    }
  }

  const estimatedTotal = parseFloat(shares) * currentPrice || 0;

  return (
    <>
      {showModal && preview?.can_execute && (
        <TradeConfirmModal
          preview={preview}
          tradeType={type}
          executing={executing}
          executeError={executeError}
          onConfirm={() => void handleExecute()}
          onCancel={() => setShowModal(false)}
        />
      )}
      <section
        className="card stack"
        style={{
          gap: "0.75rem",
          background: "linear-gradient(165deg, rgba(13, 28, 53, 0.98) 0%, rgba(8, 26, 51, 0.99) 100%)",
          border: "1px solid rgba(99, 216, 255, 0.3)",
          boxShadow: "inset 0 1px 0 rgba(158, 235, 255, 0.1), 0 0 25px rgba(99, 216, 255, 0.12), 0 4px 24px rgba(0, 0, 0, 0.4)"
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="stack" style={{ gap: 2 }}>
            <strong style={{ fontSize: "1.1rem" }}>{symbol}</strong>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "1.2rem",
              padding: "0.25rem 0.5rem"
            }}
          >
            ×
          </button>
        </div>

        {successMessage && (
          <p className="success" style={{ margin: 0, fontSize: "0.85rem" }}>
            {successMessage}
          </p>
        )}

        <form className="stack" style={{ gap: "0.6rem" }} onSubmit={onSubmit}>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={() => setType("BUY")}
              disabled={busy}
              style={{
                flex: 1,
                padding: "0.5rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                background: type === "BUY"
                  ? "linear-gradient(180deg, rgba(74, 222, 128, 0.2) 0%, rgba(74, 222, 128, 0.1) 100%)"
                  : "transparent",
                color: type === "BUY" ? "#4ade80" : "var(--muted)",
                border: type === "BUY" ? "1px solid rgba(74, 222, 128, 0.5)" : "1px solid var(--border)",
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: type === "BUY" ? "0 0 12px rgba(74, 222, 128, 0.2), inset 0 1px 0 rgba(74, 222, 128, 0.2)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setType("SELL")}
              disabled={busy}
              style={{
                flex: 1,
                padding: "0.5rem",
                fontSize: "0.85rem",
                fontWeight: 600,
                background: type === "SELL"
                  ? "linear-gradient(180deg, rgba(255, 107, 107, 0.2) 0%, rgba(255, 107, 107, 0.1) 100%)"
                  : "transparent",
                color: type === "SELL" ? "#ff6b6b" : "var(--muted)",
                border: type === "SELL" ? "1px solid rgba(255, 107, 107, 0.5)" : "1px solid var(--border)",
                borderRadius: 6,
                cursor: "pointer",
                boxShadow: type === "SELL" ? "0 0 12px rgba(255, 107, 107, 0.2), inset 0 1px 0 rgba(255, 107, 107, 0.2)" : "none",
                transition: "all 0.15s ease"
              }}
            >
              SELL
            </button>
          </div>

          <label className="stack" style={{ gap: 4 }}>
            <span className="muted" style={{ fontSize: "0.75rem" }}>Shares</span>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="0"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              disabled={busy}
              style={{ fontSize: "1.1rem", padding: "0.7rem 0.85rem" }}
            />
          </label>

          {shares && parseFloat(shares) > 0 && (
            <div
              style={{
                padding: "0.5rem 0.65rem",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 6,
                fontSize: "0.85rem"
              }}
            >
              <PreviewRow
                label="Estimated total"
                value={`$${estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              />
            </div>
          )}

          {error && <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{error}</p>}

          <button type="submit" disabled={busy} style={{ marginTop: 4 }}>
            {loading ? "Calculating..." : "Review Order"}
          </button>
        </form>

        {preview && (
          <div
            className="stack"
            style={{
              gap: "0.5rem",
              paddingTop: "0.65rem",
              borderTop: "1px solid var(--border)"
            }}
          >
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)" }}>
              ORDER PREVIEW
            </span>
            <PreviewRow label="Symbol" value={preview.symbol} />
            <PreviewRow label="Type" value={preview.type} />
            <PreviewRow label="Shares" value={String(preview.shares)} />
            <PreviewRow label="Price" value={`$${preview.price.toFixed(2)}`} />
            <PreviewRow label="Total cost" value={`$${preview.estimated_total_cost.toFixed(2)}`} />
            <PreviewRow label="Cash after" value={`$${preview.estimated_cash_after.toFixed(2)}`} />

            {!preview.can_execute && preview.error_message && (
              <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>
                {preview.error_message}
              </p>
            )}

            {preview.can_execute && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                style={{
                  ...executeButtonStyle,
                  marginTop: 4,
                  background: type === "BUY" ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: type === "BUY" ? "var(--success)" : "var(--danger)",
                  borderColor: type === "BUY" ? "var(--success)" : "var(--danger)"
                }}
              >
                Confirm {type}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
