"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardHeader, TimeRange } from "@/components/dashboard/DashboardHeader";
import { DashboardTransactions } from "@/components/dashboard/DashboardTransactions";
import { DashboardWatchlist } from "@/components/dashboard/DashboardWatchlist";
import { StockExplorer } from "@/components/dashboard/StockExplorer";
import { StockTradePanel } from "@/components/dashboard/StockTradePanel";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { getToken } from "@/lib/auth/token";
import {
  api,
  DashboardSnapshot,
  MarketQuote,
  Portfolio,
  PortfolioPerformancePoint,
  PortfolioTransaction,
  SymbolSuggestion
} from "@/lib/api/client";


type TxRow = PortfolioTransaction & { portfolio_id: number };

function mapHeroApiRange(r: TimeRange): string {
  if (r === "1H") return "1D";
  return r;
}

function flatHeroPoints(value: number): PortfolioPerformancePoint[] {
  const now = Date.now();
  return [
    { timestamp: new Date(now - 864e5).toISOString(), portfolio_value: value },
    { timestamp: new Date(now).toISOString(), portfolio_value: value }
  ];
}

function aggregatePerformancePoints(
  batches: PortfolioPerformancePoint[][]
): PortfolioPerformancePoint[] {
  if (batches.length === 0) return [];
  if (batches.length === 1) return batches[0];

  // Collect all unique timestamps and sum values at each
  const valuesByTime = new Map<string, number>();
  for (const batch of batches) {
    for (const pt of batch) {
      const key = pt.timestamp;
      valuesByTime.set(key, (valuesByTime.get(key) ?? 0) + pt.portfolio_value);
    }
  }

  // Sort by timestamp
  return Array.from(valuesByTime.entries())
    .map(([timestamp, portfolio_value]) => ({ timestamp, portfolio_value }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function computeRangeChange(points: PortfolioPerformancePoint[]): {
  dollarChange: number;
  percentChange: number;
} {
  if (points.length < 2) {
    return { dollarChange: 0, percentChange: 0 };
  }
  const startValue = points[0].portfolio_value;
  const endValue = points[points.length - 1].portfolio_value;
  const dollarChange = endValue - startValue;
  const percentChange = startValue > 0 ? (dollarChange / startValue) * 100 : 0;
  return { dollarChange, percentChange };
}

export default function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [headerLoading, setHeaderLoading] = useState(true);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [watchlistAddError, setWatchlistAddError] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [heroPerfPoints, setHeroPerfPoints] = useState<PortfolioPerformancePoint[]>([]);
  const [heroPerfLoading, setHeroPerfLoading] = useState(false);
  const [rangeChange, setRangeChange] = useState<{ dollarChange: number; percentChange: number }>({
    dollarChange: 0,
    percentChange: 0
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const lastLoadTime = useRef(0);

  // Stock explorer state
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; price: number } | null>(null);

  // Default portfolio (first one, or create if none)
  const defaultPortfolio = portfolios[0] ?? null;

  const loadCore = useCallback(async () => {
    if (!getToken()) return;
    setHeaderLoading(true);
    setHeaderError(null);
    try {
      const [snap, portfolioList] = await Promise.all([
        api.getDashboardSnapshot(),
        api.getPortfolios()
      ]);
      setSnapshot(snap);

      // Auto-create default portfolio if none exists
      if (portfolioList.length === 0) {
        const created = await api.createPortfolio("My Portfolio");
        setPortfolios([created]);
      } else {
        setPortfolios(portfolioList);
      }
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setHeaderLoading(false);
    }
  }, []);

  const loadWatchlist = useCallback(async () => {
    if (!getToken()) return;
    setWatchlistLoading(true);
    setWatchlistError(null);
    setWatchlistAddError(null);
    try {
      const symbols = await api.getWatchlistSymbols();
      const q = symbols.length > 0 ? await api.getMarketQuotes(symbols) : [];
      setQuotes(q);
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : "Failed to load watchlist");
      setQuotes([]);
    } finally {
      setWatchlistLoading(false);
    }
  }, []);

  const handleResolveAndAdd = useCallback(async (query: string): Promise<{ added: boolean; suggestions?: SymbolSuggestion[] }> => {
    setWatchlistAddError(null);
    try {
      const result = await api.resolveSymbol(query);

      if (result.error) {
        setWatchlistAddError(result.error);
        return { added: false };
      }

      if (result.resolved_symbol) {
        // High confidence match - add directly
        await api.addToWatchlist(result.resolved_symbol);
        try {
          const [newQuote] = await api.getMarketQuotes([result.resolved_symbol]);
          if (newQuote) {
            setQuotes((prev) => [...prev, newQuote]);
          }
        } catch {
          void loadWatchlist();
        }
        return { added: true };
      }

      if (result.suggestions && result.suggestions.length > 0) {
        return { added: false, suggestions: result.suggestions };
      }

      setWatchlistAddError("No matching symbols found");
      return { added: false };
    } catch (err) {
      setWatchlistAddError(err instanceof Error ? err.message : "Failed to resolve symbol");
      return { added: false };
    }
  }, [loadWatchlist]);

  const handleAddToWatchlist = useCallback(async (symbol: string) => {
    setWatchlistAddError(null);
    try {
      await api.addToWatchlist(symbol);
      // Fetch the new quote and add to state
      try {
        const [newQuote] = await api.getMarketQuotes([symbol]);
        if (newQuote) {
          setQuotes((prev) => [...prev, newQuote]);
        }
      } catch {
        // Quote fetch failed but symbol was added - refresh full list
        void loadWatchlist();
      }
    } catch (err) {
      setWatchlistAddError(err instanceof Error ? err.message : "Failed to add symbol");
      throw err; // Re-throw so the component can handle its loading state
    }
  }, [loadWatchlist]);

  const handleRemoveFromWatchlist = useCallback(async (symbol: string) => {
    try {
      await api.removeFromWatchlist(symbol);
      // Optimistically remove from local state
      const upperSymbol = symbol.toUpperCase();
      setQuotes((prev) => prev.filter((q) => q.symbol !== upperSymbol));
    } catch (err) {
      // Refresh to get correct state on error
      void loadWatchlist();
      throw err;
    }
  }, [loadWatchlist]);

  const loadTransactions = useCallback(async (portfolioList: Portfolio[]) => {
    if (!getToken()) return;
    setTxLoading(true);
    setTxError(null);
    try {
      if (portfolioList.length === 0) {
        setTransactions([]);
        return;
      }
      const batches = await Promise.all(
        portfolioList.map((p) => api.getPortfolioTransactions(String(p.id), 50, 0))
      );
      const merged: TxRow[] = [];
      batches.forEach((batch, i) => {
        const pid = portfolioList[i].id;
        batch.items.forEach((tx) => merged.push({ ...tx, portfolio_id: pid }));
      });
      merged.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setTransactions(merged.slice(0, 30));
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCore();
    void loadWatchlist();
  }, [loadCore, loadWatchlist]);

  useEffect(() => {
    if (!getToken()) return;
    if (headerLoading) return;
    let cancelled = false;
    (async () => {
      setHeroPerfLoading(true);
      try {
        if (portfolios.length > 0) {
          // Fetch performance for all portfolios and aggregate
          const batches = await Promise.all(
            portfolios.map((p) =>
              api.getPortfolioPerformance(String(p.id), mapHeroApiRange(timeRange))
            )
          );
          if (cancelled) return;
          lastLoadTime.current = Date.now();

          const aggregated = aggregatePerformancePoints(batches);
          const change = computeRangeChange(aggregated);
          setRangeChange(change);

          if (aggregated.length >= 2) {
            setHeroPerfPoints(aggregated);
          } else if (snapshot) {
            setHeroPerfPoints(flatHeroPoints(snapshot.total_account_value));
            setRangeChange({ dollarChange: 0, percentChange: 0 });
          } else {
            setHeroPerfPoints([]);
            setRangeChange({ dollarChange: 0, percentChange: 0 });
          }
        } else if (snapshot) {
          setHeroPerfPoints(flatHeroPoints(snapshot.total_account_value));
          setRangeChange({ dollarChange: 0, percentChange: 0 });
        } else {
          setHeroPerfPoints([]);
          setRangeChange({ dollarChange: 0, percentChange: 0 });
        }
      } catch {
        if (!cancelled && snapshot) {
          setHeroPerfPoints(flatHeroPoints(snapshot.total_account_value));
        }
        setRangeChange({ dollarChange: 0, percentChange: 0 });
      } finally {
        if (!cancelled) setHeroPerfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [portfolios, timeRange, headerLoading, snapshot, refreshKey]);

  useEffect(() => {
    if (!getToken()) return;
    if (headerLoading) return;
    if (portfolios.length === 0) {
      setTxLoading(false);
      setTransactions([]);
      return;
    }
    void loadTransactions(portfolios);
  }, [portfolios, headerLoading, loadTransactions]);

  // Refresh dashboard data when page becomes visible (e.g., after navigating back from trade)
  useEffect(() => {
    function handleRefresh() {
      const now = Date.now();
      // Throttle: only refresh if at least 2 seconds since last load
      if (now - lastLoadTime.current > 2000) {
        void loadCore();
        setRefreshKey((k) => k + 1);
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        handleRefresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleRefresh);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [loadCore]);

  const handleSelectStock = useCallback((symbol: string, price: number) => {
    setSelectedStock({ symbol, price });
  }, []);

  const handleCloseTradePanel = useCallback(() => {
    setSelectedStock(null);
  }, []);

  const handleTradeComplete = useCallback(() => {
    // Refresh all data after trade
    void loadCore();
    setRefreshKey((k) => k + 1);
  }, [loadCore]);

  return (
    <ProtectedRoute>
      <div className="stack" style={{ gap: "1.1rem", paddingBottom: "1.5rem" }}>
        {headerError && <p className="error">{headerError}</p>}

        <ErrorBoundary sectionName="Chart">
          <DashboardHeader
            snapshot={snapshot}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            loading={headerLoading}
            performancePoints={heroPerfPoints}
            performanceLoading={heroPerfLoading}
            dollarChange={rangeChange.dollarChange}
            percentChange={rangeChange.percentChange}
          />
        </ErrorBoundary>

        <ErrorBoundary sectionName="Watchlist">
          <DashboardWatchlist
            quotes={quotes}
            loading={watchlistLoading}
            error={watchlistError}
            onSymbolPress={(symbol) => {
              const quote = quotes.find((q) => q.symbol === symbol);
              handleSelectStock(symbol, quote?.price ?? 0);
            }}
            onResolveAndAdd={handleResolveAndAdd}
            onAddSymbol={handleAddToWatchlist}
            onRemoveSymbol={handleRemoveFromWatchlist}
            addError={watchlistAddError}
          />
        </ErrorBoundary>

        <ErrorBoundary sectionName="Transactions">
          <DashboardTransactions rows={transactions} loading={txLoading} error={txError} />
        </ErrorBoundary>

        {selectedStock && defaultPortfolio && (
          <ErrorBoundary sectionName="Trade Panel">
            <StockTradePanel
            portfolioId={defaultPortfolio.id}
            symbol={selectedStock.symbol}
            currentPrice={selectedStock.price}
            onClose={handleCloseTradePanel}
            onTradeComplete={handleTradeComplete}
          />
          </ErrorBoundary>
        )}

        <ErrorBoundary sectionName="Stock Explorer">
          <StockExplorer onSelectStock={handleSelectStock} />
        </ErrorBoundary>
      </div>
    </ProtectedRoute>
  );
}
