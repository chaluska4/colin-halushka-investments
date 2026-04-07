"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, MarketQuote, SymbolSearchResult } from "@/lib/api/client";
import { getToken } from "@/lib/auth/token";

const searchInputStyle: CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.85rem",
  fontSize: "0.9rem",
  background: "rgba(8, 26, 51, 0.8)",
  border: "1px solid rgba(47, 174, 255, 0.2)",
  borderRadius: 8,
  color: "var(--text)"
};

const stockRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.7rem 0.5rem",
  borderBottom: "1px solid rgba(47, 174, 255, 0.12)",
  cursor: "pointer",
  transition: "all 0.15s ease",
  borderRadius: 4,
  marginBottom: 2
};

type DisplayStock = {
  symbol: string;
  name?: string;
  price: number;
  change_percent: number;
};

type Props = {
  onSelectStock: (symbol: string, price: number) => void;
};

export function StockExplorer({ onSelectStock }: Props) {
  const [defaultSymbols, setDefaultSymbols] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load default symbols and their quotes
  const loadDefaultStocks = useCallback(async () => {
    if (!getToken()) return;
    setLoading(true);
    setError(null);
    try {
      const { symbols } = await api.getMarketDataSymbols();
      setDefaultSymbols(symbols.map((s) => s.toUpperCase()));

      if (symbols.length > 0) {
        const quoteList = await api.getMarketQuotes(symbols);
        const quoteMap = new Map<string, MarketQuote>();
        for (const q of quoteList) {
          quoteMap.set(q.symbol.toUpperCase(), q);
        }
        setQuotes(quoteMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stocks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDefaultStocks();
  }, [loadDefaultStocks]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    const term = search.trim();
    if (!term || term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const response = await api.searchSymbols(term);
        setSearchResults(response.results);

        // Fetch quotes for search results
        if (response.results.length > 0) {
          const symbols = response.results.map((r) => r.symbol);
          const quoteList = await api.getMarketQuotes(symbols);
          setQuotes((prev) => {
            const newMap = new Map(prev);
            for (const q of quoteList) {
              newMap.set(q.symbol.toUpperCase(), q);
            }
            return newMap;
          });
        }
      } catch {
        // Silently handle search errors
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [search]);

  const handleRowClick = (symbol: string) => {
    const quote = quotes.get(symbol.toUpperCase());
    onSelectStock(symbol.toUpperCase(), quote?.price ?? 0);
  };

  const handleGoClick = async () => {
    const term = search.trim().toUpperCase();
    if (!term) return;

    // Try to get a quote for the entered symbol
    try {
      const quoteList = await api.getMarketQuotes([term]);
      if (quoteList.length > 0) {
        const quote = quoteList[0];
        setQuotes((prev) => {
          const newMap = new Map(prev);
          newMap.set(quote.symbol.toUpperCase(), quote);
          return newMap;
        });
        onSelectStock(quote.symbol, quote.price);
      } else {
        // No quote found - still allow selection with 0 price
        onSelectStock(term, 0);
      }
    } catch {
      onSelectStock(term, 0);
    }
  };

  // Determine what to display
  const isSearching = search.trim().length > 0;
  const displayStocks: DisplayStock[] = isSearching
    ? searchResults.map((r) => {
        const quote = quotes.get(r.symbol.toUpperCase());
        return {
          symbol: r.symbol,
          name: r.name,
          price: quote?.price ?? 0,
          change_percent: quote?.change_percent ?? 0
        };
      })
    : defaultSymbols.map((symbol) => {
        const quote = quotes.get(symbol);
        return {
          symbol,
          price: quote?.price ?? 0,
          change_percent: quote?.change_percent ?? 0
        };
      });

  const showLoading = loading || (searching && searchResults.length === 0);

  return (
    <section className="card stack" style={{ gap: "0.75rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "0.95rem" }}>Explore Stocks</strong>
        <span className="muted" style={{ fontSize: "0.75rem" }}>
          {isSearching ? `${searchResults.length} results` : `${defaultSymbols.length} popular`}
        </span>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <input
          type="text"
          placeholder="Search any stock (e.g. META, Apple)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleGoClick();
          }}
          style={searchInputStyle}
        />
        <button
          type="button"
          onClick={() => void handleGoClick()}
          disabled={!search.trim() || searching}
          style={{
            padding: "0.6rem 1rem",
            fontSize: "0.85rem",
            whiteSpace: "nowrap"
          }}
        >
          Go
        </button>
      </div>

      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

      {showLoading ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          {searching ? "Searching..." : "Loading stocks..."}
        </p>
      ) : (
        <div
          style={{
            maxHeight: 280,
            overflowY: "auto",
            margin: "0 -0.5rem",
            padding: "0 0.5rem"
          }}
        >
          {displayStocks.length === 0 ? (
            <p className="muted" style={{ margin: "0.5rem 0", fontSize: "0.85rem" }}>
              {isSearching ? "No stocks found. Try a different search or press Go to trade directly." : "No stocks available"}
            </p>
          ) : (
            displayStocks.map((stock) => {
              const isUp = stock.change_percent > 0;
              const isDown = stock.change_percent < 0;
              const changeColor = isUp ? "var(--success)" : isDown ? "var(--danger)" : "var(--muted)";

              return (
                <div
                  key={stock.symbol}
                  style={stockRowStyle}
                  onClick={() => handleRowClick(stock.symbol)}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "rgba(99, 216, 255, 0.08)";
                    el.style.borderColor = "rgba(99, 216, 255, 0.25)";
                    el.style.boxShadow = "0 0 12px rgba(99, 216, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "transparent";
                    el.style.borderColor = "transparent";
                    el.style.boxShadow = "none";
                  }}
                >
                  <div className="stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{stock.symbol}</span>
                    {stock.name && (
                      <span className="muted" style={{ fontSize: "0.75rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {stock.name}
                      </span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
                    {stock.price > 0 ? (
                      <>
                        <span style={{ fontSize: "0.9rem" }}>
                          ${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 500, color: changeColor, minWidth: 55, textAlign: "right" }}>
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
    </section>
  );
}
