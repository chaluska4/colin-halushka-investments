"use client";

import { type CSSProperties, useState } from "react";
import { MarketQuote, SymbolSuggestion } from "@/lib/api/client";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";

const rowStyle: CSSProperties = {
  display: "flex",
  width: "100%",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  padding: "0.85rem 0.5rem",
  margin: 0,
  background: "transparent",
  borderBottom: "1px solid rgba(47, 174, 255, 0.12)",
  color: "inherit",
  textAlign: "left",
  font: "inherit"
};

const symbolBtn: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  padding: 0,
  borderRadius: 4,
  transition: "all 0.15s ease"
};

const removeBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  padding: 0,
  background: "rgba(255, 90, 90, 0.1)",
  border: "1px solid rgba(255, 90, 90, 0.25)",
  borderRadius: 6,
  color: "var(--danger)",
  cursor: "pointer",
  fontSize: "1rem",
  fontWeight: 600,
  lineHeight: 1,
  transition: "all 0.15s ease",
  flexShrink: 0
};

const addForm: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  padding: "0.75rem 0.65rem",
  borderTop: "1px solid rgba(47, 174, 255, 0.12)"
};

const addInput: CSSProperties = {
  flex: 1,
  padding: "0.5rem 0.75rem",
  background: "rgba(47, 174, 255, 0.08)",
  border: "1px solid rgba(47, 174, 255, 0.2)",
  borderRadius: 6,
  color: "inherit",
  fontSize: "0.85rem",
  outline: "none"
};

const addBtn: CSSProperties = {
  padding: "0.5rem 1rem",
  background: "rgba(47, 174, 255, 0.15)",
  border: "1px solid rgba(47, 174, 255, 0.35)",
  borderRadius: 6,
  color: "var(--primary)",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
  transition: "all 0.15s ease"
};

const suggestionsList: CSSProperties = {
  padding: "0.5rem 0.65rem",
  borderTop: "1px solid rgba(47, 174, 255, 0.12)"
};

const suggestionBtn: CSSProperties = {
  display: "flex",
  width: "100%",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0.6rem 0.5rem",
  margin: 0,
  background: "rgba(47, 174, 255, 0.05)",
  border: "1px solid rgba(47, 174, 255, 0.15)",
  borderRadius: 6,
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  fontSize: "0.85rem",
  marginBottom: "0.4rem",
  transition: "all 0.15s ease"
};

type Props = {
  quotes: MarketQuote[];
  loading: boolean;
  error: string | null;
  onSymbolPress?: (symbol: string) => void;
  onResolveAndAdd?: (query: string) => Promise<{ added: boolean; suggestions?: SymbolSuggestion[] }>;
  onAddSymbol?: (symbol: string) => Promise<void>;
  onRemoveSymbol?: (symbol: string) => Promise<void>;
  addError?: string | null;
};

export function DashboardWatchlist({
  quotes,
  loading,
  error,
  onSymbolPress,
  onResolveAndAdd,
  onAddSymbol,
  onRemoveSymbol,
  addError
}: Props) {
  const [inputValue, setInputValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;

    setSuggestions([]);
    setAdding(true);

    try {
      if (onResolveAndAdd) {
        const result = await onResolveAndAdd(query);
        if (result.added) {
          setInputValue("");
        } else if (result.suggestions && result.suggestions.length > 0) {
          setSuggestions(result.suggestions);
        }
      } else if (onAddSymbol) {
        await onAddSymbol(query.toUpperCase());
        setInputValue("");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleSelectSuggestion = async (symbol: string) => {
    setSuggestions([]);
    setAdding(true);
    try {
      if (onAddSymbol) {
        await onAddSymbol(symbol);
        setInputValue("");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleCancelSuggestions = () => {
    setSuggestions([]);
  };

  const handleRemove = async (symbol: string) => {
    if (!onRemoveSymbol) return;
    setRemovingSymbol(symbol);
    try {
      await onRemoveSymbol(symbol);
    } finally {
      setRemovingSymbol(null);
    }
  };

  return (
    <section className="card stack" style={{ padding: "0" }}>
      <div style={{ padding: "1rem 1rem 0" }}>
        <strong style={{ fontSize: "0.95rem" }}>Watchlist</strong>
        <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>
          Your tracked symbols
        </p>
      </div>
      <div style={{ padding: "0 0.65rem 0.35rem" }}>
        {loading && (
          <div className="stack" style={{ gap: "0.5rem", padding: "0.75rem 1rem" }}>
            <SkeletonBlock height={18} />
            <SkeletonBlock height={18} />
            <SkeletonBlock height={18} width="60%" />
          </div>
        )}
        {error && <p className="error" style={{ margin: "0.75rem 1rem" }}>{error}</p>}
        {!loading && !error && quotes.length === 0 && (
          <p className="muted" style={{ margin: "0.75rem 1rem" }}>
            No symbols yet. Add one below!
          </p>
        )}
        {!loading &&
          quotes.map((q, i) => {
            const isUp = q.change_percent > 0;
            const isDown = q.change_percent < 0;
            const pctColor = isUp ? "var(--success)" : isDown ? "var(--danger)" : "var(--muted)";
            const last = i === quotes.length - 1;
            const isRemoving = removingSymbol === q.symbol;
            return (
              <div
                key={q.symbol}
                style={{
                  ...rowStyle,
                  borderBottom: last ? "none" : rowStyle.borderBottom,
                  opacity: isRemoving ? 0.5 : 1
                }}
              >
                <button
                  type="button"
                  style={symbolBtn}
                  onClick={() => onSymbolPress?.(q.symbol)}
                >
                  <div className="stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 700 }}>{q.symbol}</span>
                  </div>
                  <div className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                    <span style={{ fontWeight: 600 }}>
                      $
                      {q.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: pctColor }}>
                      {q.change_percent >= 0 ? "+" : ""}
                      {q.change_percent.toFixed(2)}%
                    </span>
                  </div>
                </button>
                {onRemoveSymbol && (
                  <button
                    type="button"
                    style={removeBtn}
                    onClick={() => handleRemove(q.symbol)}
                    disabled={isRemoving}
                    title={`Remove ${q.symbol}`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {/* Suggestions list */}
      {suggestions.length > 0 && (
        <div style={suggestionsList}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span className="muted" style={{ fontSize: "0.8rem" }}>Select a symbol:</span>
            <button
              type="button"
              onClick={handleCancelSuggestions}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: "0.75rem",
                padding: "0.25rem 0.5rem"
              }}
            >
              Cancel
            </button>
          </div>
          {suggestions.slice(0, 5).map((s) => (
            <button
              key={s.symbol}
              type="button"
              style={suggestionBtn}
              onClick={() => handleSelectSuggestion(s.symbol)}
              disabled={adding}
            >
              <div>
                <span style={{ fontWeight: 700 }}>{s.symbol}</span>
                <span
                  className="muted"
                  title={s.name}
                  style={{
                    marginLeft: "0.5rem",
                    fontSize: "0.8rem",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "inline-block",
                    verticalAlign: "bottom",
                  }}
                >
                  {s.name}
                </span>
              </div>
              <span className="muted" style={{ fontSize: "0.75rem", flexShrink: 0 }}>{s.type}</span>
            </button>
          ))}
        </div>
      )}

      {(onResolveAndAdd || onAddSymbol) && suggestions.length === 0 && (
        <form onSubmit={handleAdd} style={addForm}>
          <input
            type="text"
            placeholder="Add ticker or company name"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={addInput}
            disabled={adding}
          />
          <button type="submit" style={addBtn} disabled={adding || !inputValue.trim()}>
            {adding ? "…" : "Add"}
          </button>
        </form>
      )}
      {addError && (
        <p className="error" style={{ margin: "0 1rem 0.75rem", fontSize: "0.82rem" }}>
          {addError}
        </p>
      )}
    </section>
  );
}
