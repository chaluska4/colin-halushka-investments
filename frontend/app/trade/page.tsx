"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, MarketQuote, Portfolio, SymbolSearchResult, TradePreviewResponse } from "@/lib/api/client";
import { getToken } from "@/lib/auth/token";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const searchInputStyle: CSSProperties = {
  width: "100%",
  padding: "0.75rem 1rem",
  fontSize: "0.95rem",
  background: "rgba(8, 26, 51, 0.8)",
  border: "1px solid rgba(47, 174, 255, 0.25)",
  borderRadius: 10,
  color: "var(--text)"
};

const stockRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.85rem 0.75rem",
  borderBottom: "1px solid rgba(47, 174, 255, 0.1)",
  cursor: "pointer",
  transition: "all 0.15s ease",
  borderRadius: 6
};

const cardStyle: CSSProperties = {
  background: "linear-gradient(165deg, rgba(13, 28, 53, 0.95) 0%, rgba(8, 26, 51, 0.98) 100%)",
  border: "1px solid rgba(47, 174, 255, 0.2)",
  borderRadius: 12,
  padding: "1.25rem",
  boxShadow: "inset 0 1px 0 rgba(158, 235, 255, 0.08), 0 0 30px rgba(99, 216, 255, 0.08), 0 4px 24px rgba(0, 0, 0, 0.3)"
};

const tradePanelStyle: CSSProperties = {
  ...cardStyle,
  border: "1px solid rgba(99, 216, 255, 0.35)",
  boxShadow: "inset 0 1px 0 rgba(158, 235, 255, 0.12), 0 0 35px rgba(99, 216, 255, 0.12), 0 4px 24px rgba(0, 0, 0, 0.4)"
};

type DisplayStock = {
  symbol: string;
  name?: string;
  price: number;
  change_percent: number;
  priceLoading?: boolean;
};

// Quote cache with TTL
type CachedQuote = MarketQuote & { cachedAt: number };
const quoteCache = new Map<string, CachedQuote>();
const QUOTE_CACHE_TTL = 15000; // 15 seconds

function getCachedQuote(symbol: string): MarketQuote | null {
  const cached = quoteCache.get(symbol.toUpperCase());
  if (cached && Date.now() - cached.cachedAt < QUOTE_CACHE_TTL) {
    return cached;
  }
  return null;
}

function setCachedQuotes(quotes: MarketQuote[]) {
  const now = Date.now();
  for (const q of quotes) {
    quoteCache.set(q.symbol.toUpperCase(), { ...q, cachedAt: now });
  }
}

function PriceSkeleton() {
  return (
    <div
      style={{
        width: 60,
        height: 16,
        background: "linear-gradient(90deg, rgba(99, 216, 255, 0.08) 0%, rgba(99, 216, 255, 0.15) 50%, rgba(99, 216, 255, 0.08) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: 4,
      }}
    />
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: "1rem" }}>
      <span className="muted" style={{ fontSize: "0.8rem" }}>{label}</span>
      <span style={{ fontSize: "0.9rem", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default function TradePage() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [defaultSymbols, setDefaultSymbols] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [loadingQuotes, setLoadingQuotes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchIdRef = useRef(0);

  // Trade panel state
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; price: number } | null>(null);
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [shares, setShares] = useState("");
  const [preview, setPreview] = useState<TradePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const busy = previewLoading || executing;

  // Batch fetch quotes with caching
  const fetchQuotes = useCallback(async (symbols: string[], searchId?: number) => {
    if (symbols.length === 0) return;

    // Filter out symbols we already have cached
    const uncached: string[] = [];
    const fromCache: MarketQuote[] = [];

    for (const sym of symbols) {
      const cached = getCachedQuote(sym);
      if (cached) {
        fromCache.push(cached);
      } else {
        uncached.push(sym);
      }
    }

    // Apply cached quotes immediately
    if (fromCache.length > 0) {
      setQuotes((prev) => {
        const newMap = new Map(prev);
        for (const q of fromCache) {
          newMap.set(q.symbol.toUpperCase(), q);
        }
        return newMap;
      });
    }

    if (uncached.length === 0) return;

    // Mark as loading
    setLoadingQuotes((prev) => {
      const next = new Set(prev);
      for (const s of uncached) next.add(s.toUpperCase());
      return next;
    });

    try {
      const quoteList = await api.getMarketQuotes(uncached);

      // Check if this is still the current search
      if (searchId !== undefined && searchId !== searchIdRef.current) return;

      setCachedQuotes(quoteList);
      setQuotes((prev) => {
        const newMap = new Map(prev);
        for (const q of quoteList) {
          newMap.set(q.symbol.toUpperCase(), q);
        }
        return newMap;
      });
    } catch {
      // Silently handle quote errors
    } finally {
      setLoadingQuotes((prev) => {
        const next = new Set(prev);
        for (const s of uncached) next.delete(s.toUpperCase());
        return next;
      });
    }
  }, []);

  // Load portfolio and default stocks
  const loadInitialData = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setError(null);
    try {
      const portfolios = await api.getPortfolios();
      if (portfolios.length === 0) {
        const created = await api.createPortfolio("My Portfolio");
        setPortfolio(created);
      } else {
        setPortfolio(portfolios[0]);
      }

      const { symbols } = await api.getMarketDataSymbols();
      const upperSymbols = symbols.map((s) => s.toUpperCase());
      setDefaultSymbols(upperSymbols);

      if (upperSymbols.length > 0) {
        await fetchQuotes(upperSymbols);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [fetchQuotes]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Debounced search with immediate quote loading
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    const term = search.trim();
    if (!term || term.length < 1) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const currentSearchId = ++searchIdRef.current;

      try {
        const response = await api.searchSymbols(term);

        // Check if search is still current
        if (currentSearchId !== searchIdRef.current) return;

        setSearchResults(response.results);
        setSearching(false);

        // Immediately fetch quotes for top 10 results
        if (response.results.length > 0) {
          const topSymbols = response.results.slice(0, 10).map((r) => r.symbol);
          void fetchQuotes(topSymbols, currentSearchId);
        }
      } catch {
        if (currentSearchId === searchIdRef.current) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [search, fetchQuotes]);

  const handleSelectStock = async (symbol: string) => {
    const upperSymbol = symbol.toUpperCase();
    let price = quotes.get(upperSymbol)?.price ?? getCachedQuote(upperSymbol)?.price ?? 0;

    // Fetch fresh quote if needed
    if (price === 0) {
      try {
        const quoteList = await api.getMarketQuotes([upperSymbol]);
        if (quoteList.length > 0) {
          price = quoteList[0].price;
          setCachedQuotes(quoteList);
          setQuotes((prev) => {
            const newMap = new Map(prev);
            newMap.set(upperSymbol, quoteList[0]);
            return newMap;
          });
        }
      } catch {
        // Use 0 if fetch fails
      }
    }

    setSelectedStock({ symbol: upperSymbol, price });
    setShares("");
    setPreview(null);
    setTradeError(null);
    setExecuteError(null);
    setSuccessMessage(null);
  };

  const handlePreview = async () => {
    if (!selectedStock || !portfolio) return;
    setTradeError(null);
    setExecuteError(null);
    setSuccessMessage(null);
    setPreview(null);

    const n = parseFloat(shares);
    if (!Number.isFinite(n) || n <= 0) {
      setTradeError("Enter a positive number of shares");
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await api.previewTrade({
        portfolio_id: portfolio.id,
        symbol: selectedStock.symbol,
        type: tradeType,
        shares: n
      });
      setPreview(res);
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!preview?.can_execute || !portfolio) return;

    setExecuting(true);
    setExecuteError(null);
    setSuccessMessage(null);
    try {
      await api.executeTrade({
        portfolio_id: portfolio.id,
        symbol: preview.symbol,
        side: preview.type as "BUY" | "SELL",
        shares: preview.shares
      });
      setPreview(null);
      setShares("");
      setSuccessMessage(`${preview.type} order executed for ${preview.shares} shares of ${preview.symbol}`);
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : "Trade failed");
    } finally {
      setExecuting(false);
    }
  };

  // Determine display stocks
  const isSearching = search.trim().length > 0;
  const displayStocks: DisplayStock[] = isSearching
    ? searchResults.map((r) => {
        const upperSym = r.symbol.toUpperCase();
        const quote = quotes.get(upperSym);
        return {
          symbol: r.symbol,
          name: r.name,
          price: quote?.price ?? 0,
          change_percent: quote?.change_percent ?? 0,
          priceLoading: loadingQuotes.has(upperSym)
        };
      })
    : defaultSymbols.map((symbol) => {
        const quote = quotes.get(symbol);
        return {
          symbol,
          price: quote?.price ?? 0,
          change_percent: quote?.change_percent ?? 0,
          priceLoading: loadingQuotes.has(symbol)
        };
      });

  const showLoading = loading || (searching && searchResults.length === 0);
  const estimatedTotal = selectedStock ? parseFloat(shares) * selectedStock.price || 0 : 0;

  return (
    <ProtectedRoute>
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div className="stack" style={{ gap: "1.25rem", paddingTop: "1rem", paddingBottom: "2rem" }}>
        <div className="stack" style={{ gap: "0.5rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#9EEBFF" }}>Trade</h1>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            Search and invest in stocks, ETFs, and index funds
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedStock ? "1fr 340px" : "1fr",
            gap: "1.25rem",
            alignItems: "start"
          }}
        >
          {/* Stock List */}
          <div style={cardStyle}>
            <div className="stack" style={{ gap: "1rem" }}>
              <input
                type="text"
                placeholder="Search stocks by symbol or name (e.g. AAPL, Apple)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={searchInputStyle}
              />

              {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {isSearching ? `${searchResults.length} results` : `${defaultSymbols.length} popular`}
                </span>
                {searching && (
                  <span className="muted" style={{ fontSize: "0.75rem" }}>Searching...</span>
                )}
              </div>

              {showLoading ? (
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  {searching ? "Searching..." : "Loading stocks..."}
                </p>
              ) : (
                <div style={{ maxHeight: 420, overflowY: "auto", margin: "0 -0.5rem", padding: "0 0.5rem" }}>
                  {displayStocks.length === 0 ? (
                    <p className="muted" style={{ margin: "0.5rem 0", fontSize: "0.85rem" }}>
                      {isSearching ? "No stocks found. Try a different search." : "No stocks available"}
                    </p>
                  ) : (
                    displayStocks.map((stock) => {
                      const isUp = stock.change_percent > 0;
                      const isDown = stock.change_percent < 0;
                      const changeColor = isUp ? "var(--success)" : isDown ? "var(--danger)" : "var(--muted)";
                      const isSelected = selectedStock?.symbol === stock.symbol;

                      return (
                        <div
                          key={stock.symbol}
                          style={{
                            ...stockRowStyle,
                            background: isSelected ? "rgba(99, 216, 255, 0.12)" : "transparent",
                            borderColor: isSelected ? "rgba(99, 216, 255, 0.3)" : "transparent"
                          }}
                          onClick={() => void handleSelectStock(stock.symbol)}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              const el = e.currentTarget as HTMLDivElement;
                              el.style.background = "rgba(99, 216, 255, 0.06)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              const el = e.currentTarget as HTMLDivElement;
                              el.style.background = "transparent";
                            }
                          }}
                        >
                          <div className="stack" style={{ gap: 2 }}>
                            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{stock.symbol}</span>
                            {stock.name && (
                              <span className="muted" style={{ fontSize: "0.75rem", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {stock.name}
                              </span>
                            )}
                          </div>
                          <div className="row" style={{ gap: 14, alignItems: "baseline" }}>
                            {stock.priceLoading ? (
                              <PriceSkeleton />
                            ) : stock.price > 0 ? (
                              <>
                                <span style={{ fontSize: "0.95rem", fontWeight: 500 }}>
                                  ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: changeColor, minWidth: 58, textAlign: "right" }}>
                                  {isUp ? "+" : ""}{stock.change_percent.toFixed(2)}%
                                </span>
                              </>
                            ) : (
                              <span className="muted" style={{ fontSize: "0.8rem" }}>—</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Trade Panel */}
          {selectedStock && (
            <div style={tradePanelStyle}>
              <div className="stack" style={{ gap: "1rem" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#9EEBFF" }}>{selectedStock.symbol}</span>
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      ${selectedStock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStock(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontSize: "1.25rem",
                      padding: "0.25rem 0.5rem"
                    }}
                  >
                    ×
                  </button>
                </div>

                {successMessage && (
                  <p className="success" style={{ margin: 0, fontSize: "0.85rem" }}>{successMessage}</p>
                )}

                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setTradeType("BUY")}
                    disabled={busy}
                    style={{
                      flex: 1,
                      padding: "0.55rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      background: tradeType === "BUY"
                        ? "linear-gradient(180deg, rgba(74, 222, 128, 0.2) 0%, rgba(74, 222, 128, 0.1) 100%)"
                        : "transparent",
                      color: tradeType === "BUY" ? "#4ade80" : "var(--muted)",
                      border: tradeType === "BUY" ? "1px solid rgba(74, 222, 128, 0.5)" : "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      boxShadow: tradeType === "BUY" ? "0 0 12px rgba(74, 222, 128, 0.2)" : "none",
                      transition: "all 0.15s ease"
                    }}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeType("SELL")}
                    disabled={busy}
                    style={{
                      flex: 1,
                      padding: "0.55rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      background: tradeType === "SELL"
                        ? "linear-gradient(180deg, rgba(255, 107, 107, 0.2) 0%, rgba(255, 107, 107, 0.1) 100%)"
                        : "transparent",
                      color: tradeType === "SELL" ? "#ff6b6b" : "var(--muted)",
                      border: tradeType === "SELL" ? "1px solid rgba(255, 107, 107, 0.5)" : "1px solid var(--border)",
                      borderRadius: 6,
                      cursor: "pointer",
                      boxShadow: tradeType === "SELL" ? "0 0 12px rgba(255, 107, 107, 0.2)" : "none",
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
                  <div style={{ padding: "0.5rem 0.65rem", background: "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: "0.85rem" }}>
                    <PreviewRow
                      label="Estimated total"
                      value={`$${estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                  </div>
                )}

                {tradeError && <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{tradeError}</p>}

                <button type="button" onClick={() => void handlePreview()} disabled={busy} style={{ marginTop: 4 }}>
                  {previewLoading ? "Calculating..." : "Review Order"}
                </button>

                {preview && (
                  <div className="stack" style={{ gap: "0.5rem", paddingTop: "0.65rem", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)" }}>ORDER PREVIEW</span>
                    <PreviewRow label="Symbol" value={preview.symbol} />
                    <PreviewRow label="Type" value={preview.type} />
                    <PreviewRow label="Shares" value={String(preview.shares)} />
                    <PreviewRow label="Price" value={`$${preview.price.toFixed(2)}`} />
                    <PreviewRow label="Total cost" value={`$${preview.estimated_total_cost.toFixed(2)}`} />
                    <PreviewRow label="Cash after" value={`$${preview.estimated_cash_after.toFixed(2)}`} />

                    {!preview.can_execute && preview.error_message && (
                      <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{preview.error_message}</p>
                    )}

                    {preview.can_execute && (
                      <button
                        type="button"
                        disabled={executing}
                        onClick={() => void handleExecute()}
                        style={{
                          marginTop: 4,
                          background: tradeType === "BUY" ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                          color: tradeType === "BUY" ? "var(--success)" : "var(--danger)",
                          border: `1px solid ${tradeType === "BUY" ? "var(--success)" : "var(--danger)"}`
                        }}
                      >
                        {executing ? "Executing..." : `Confirm ${tradeType}`}
                      </button>
                    )}
                    {executeError && <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{executeError}</p>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
