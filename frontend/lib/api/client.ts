import { z } from "zod";
import { clearToken, getToken, setToken } from "@/lib/auth/token";
import {
  DashboardSnapshotSchema,
  MarketQuoteSchema,
  PortfolioOverviewSchema,
  PortfolioPerformancePointSchema,
  PortfolioTransactionPageSchema,
  PositionRowSchema,
  TradeExecuteResponseSchema,
  TradePreviewResponseSchema,
} from "./schemas";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

let isRefreshing = false;

async function request<T>(path: string, options: RequestOptions = {}, schema?: z.ZodType<T>): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  if (res.status === 401 && options.auth && !isRefreshing && path !== "/auth/refresh") {
    isRefreshing = true;
    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json() as { access_token: string };
        setToken(data.access_token);
        isRefreshing = false;
        return request<T>(path, options);
      }
    } catch {
      // refresh failed
    }
    isRefreshing = false;
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }

  let payload: unknown = null;
  try { payload = await res.json(); } catch { payload = null; }
  if (!res.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed: ${res.status}`;
    throw new Error(detail);
  }
  if (schema) {
    try {
      return schema.parse(payload);
    } catch (e) {
      const msg = e instanceof z.ZodError
        ? e.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ")
        : String(e);
      throw new Error(`API response validation failed for ${path}: ${msg}`);
    }
  }
  return payload as T;
}

export type LoginResponse = { access_token: string; token_type: string };
export type Portfolio = { id: number; name: string; created_at: string; cash_balance?: number };
export type PortfolioDetail = {
  id: number;
  name: string;
  cash_balance: number;
  created_at: string;
};
export type DashboardSnapshot = {
  total_cash: number;
  total_portfolio_value: number;
  total_account_value: number;
  total_unrealized_pl: number;
  total_realized_pl: number;
  portfolio_count: number;
};
export type PortfolioOverview = {
  portfolio_id: number;
  name: string;
  cash_balance: number;
  total_value: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  number_of_positions: number;
  top_3_positions: Array<{ symbol: string; market_value: number }>;
};
export type PositionRow = {
  symbol: string;
  shares: number;
  avg_cost: number;
  price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_pl_pct: number;
  realized_pl: number;
  weight_pct: number;
};
export type PortfolioTransaction = {
  id: number;
  portfolio_id: number;
  symbol: string;
  side: string;
  shares: number;
  price: number;
  timestamp: string;
};

export type PortfolioTransactionItem = {
  id: number;
  symbol: string;
  type: string;
  shares: number;
  price: number;
  total_value: number;
  timestamp: string;
};

export type PortfolioTransactionPage = {
  items: PortfolioTransaction[];
  total: number;
  limit: number;
  offset: number;
};

export type PortfolioPerformancePoint = {
  timestamp: string;
  portfolio_value: number;
};

export type TradePreviewRequest = {
  portfolio_id: number;
  symbol: string;
  type: "BUY" | "SELL";
  shares: number;
};

export type TradePreviewResponse = {
  symbol: string;
  type: string;
  shares: number;
  price: number;
  estimated_total_cost: number;
  estimated_cash_after: number;
  estimated_shares_after: number;
  can_execute: boolean;
  error_message: string | null;
};

export type TradeExecuteRequest = {
  portfolio_id: number;
  symbol: string;
  side: "BUY" | "SELL";
  shares: number;
};

export type TradeExecuteResponse = {
  transaction_id: number;
  symbol: string;
  type: string;
  shares: number;
  price: number;
  total_value: number;
  new_cash_balance: number;
  new_shares_owned: number;
};

export type MarketQuote = {
  symbol: string;
  price: number;
  change: number;
  change_percent: number;
  as_of: string;
};

export type SymbolSearchResult = {
  symbol: string;
  name: string;
  type: string;
};

export type SymbolSearchResponse = {
  results: SymbolSearchResult[];
};

export type NewsArticle = {
  title: string;
  source: string;
  summary: string;
  url: string;
  published_at: string;
  category: string;
  image_url: string | null;
};

export type NewsCategory = {
  category: string;
  display_name: string;
  articles: NewsArticle[];
};

export type NewsResponse = {
  categories: NewsCategory[];
  last_updated: string;
};

export type WatchlistItem = {
  id: number;
  symbol: string;
  created_at: string;
};

export type WatchlistResponse = {
  items: WatchlistItem[];
};

export type SymbolSuggestion = {
  symbol: string;
  name: string;
  type: string;
};

export type ResolveSymbolResponse = {
  resolved_symbol: string | null;
  suggestions: SymbolSuggestion[];
  error: string | null;
};

export const api = {
  register: (email: string, password: string) =>
    request<{ message: string }>("/auth/register", {
      method: "POST",
      body: { email, password }
    }),
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password }
    }),
  me: () => request<{ id: number; email: string; is_verified: boolean; cash_balance: number }>("/auth/me", { auth: true }),
  getPortfolios: () => request<Portfolio[]>("/portfolios", { auth: true }),
  createPortfolio: (name: string) =>
    request<Portfolio>("/portfolios", {
      method: "POST",
      body: { name },
      auth: true
    }),
  getDashboardSnapshot: () =>
    request("/dashboard/snapshot", { auth: true }, DashboardSnapshotSchema),
  getMarketDataSymbols: () => request<{ symbols: string[] }>("/market-data/symbols", { auth: true }),
  getMarketQuotes: (symbols: string[]) => {
    if (symbols.length === 0) return Promise.resolve([] as MarketQuote[]);
    const q = symbols.map((s) => encodeURIComponent(s)).join(",");
    return request(`/market-data/quotes?symbols=${q}`, { auth: true }, z.array(MarketQuoteSchema));
  },
  searchSymbols: (query: string) =>
    request<SymbolSearchResponse>(`/market-data/search?q=${encodeURIComponent(query)}`, { auth: true }),
  getPortfolio: (portfolioId: string) =>
    request<PortfolioDetail>(`/portfolios/${portfolioId}`, { auth: true }),
  getPortfolioOverview: (portfolioId: string) =>
    request(`/portfolios/${portfolioId}/overview`, { auth: true }, PortfolioOverviewSchema),
  getPortfolioPositions: (portfolioId: string) =>
    request(`/portfolios/${portfolioId}/positions`, { auth: true }, z.array(PositionRowSchema)),
  getPortfolioTransactions: (portfolioId: string, limit = 50, offset = 0) =>
    request(
      `/portfolios/${portfolioId}/transactions?limit=${limit}&offset=${offset}`,
      { auth: true },
      PortfolioTransactionPageSchema
    ),
  getPortfolioPerformance: (portfolioId: string, range = "1M") =>
    request(
      `/portfolios/${portfolioId}/performance?range=${encodeURIComponent(range)}`,
      { auth: true },
      z.array(PortfolioPerformancePointSchema)
    ),
  previewTrade: (body: TradePreviewRequest) =>
    request("/trade/preview", { method: "POST", body, auth: true }, TradePreviewResponseSchema),
  executeTrade: (body: TradeExecuteRequest) =>
    request("/trade", { method: "POST", body, auth: true }, TradeExecuteResponseSchema),
  getNews: () => request<NewsResponse>("/news", { auth: true }),
  getWatchlist: () => request<WatchlistResponse>("/watchlist", { auth: true }),
  getWatchlistSymbols: () => request<string[]>("/watchlist/symbols", { auth: true }),
  resolveSymbol: (query: string) =>
    request<ResolveSymbolResponse>("/watchlist/resolve", {
      method: "POST",
      body: { query },
      auth: true
    }),
  addToWatchlist: (symbol: string) =>
    request<WatchlistItem>("/watchlist", {
      method: "POST",
      body: { symbol },
      auth: true
    }),
  removeFromWatchlist: (symbol: string) =>
    request<void>(`/watchlist/${encodeURIComponent(symbol)}`, {
      method: "DELETE",
      auth: true
    }),
  renamePortfolio: (portfolioId: string, name: string) =>
    request<{ id: number; name: string; cash_balance: number; created_at: string }>(
      `/portfolios/${portfolioId}`,
      { method: "PATCH", body: { name }, auth: true }
    ),
  deletePortfolio: (portfolioId: string) =>
    request<{ success: boolean }>(`/portfolios/${portfolioId}`, {
      method: "DELETE",
      auth: true
    })
};
