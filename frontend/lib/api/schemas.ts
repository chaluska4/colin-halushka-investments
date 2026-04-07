import { z } from "zod";

export const DashboardSnapshotSchema = z.object({
  total_cash: z.number(),
  total_portfolio_value: z.number(),
  total_account_value: z.number(),
  total_unrealized_pl: z.number(),
  total_realized_pl: z.number(),
  portfolio_count: z.number(),
});

export const PortfolioSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.string(),
  cash_balance: z.number().optional(),
});

export const PortfolioOverviewSchema = z.object({
  portfolio_id: z.number(),
  name: z.string(),
  cash_balance: z.number(),
  total_value: z.number(),
  total_gain_loss: z.number(),
  total_gain_loss_percent: z.number(),
  number_of_positions: z.number(),
  top_3_positions: z.array(
    z.object({ symbol: z.string(), market_value: z.number() })
  ),
});

export const PositionRowSchema = z.object({
  symbol: z.string(),
  shares: z.number(),
  avg_cost: z.number(),
  price: z.number(),
  market_value: z.number(),
  unrealized_pl: z.number(),
  unrealized_pl_pct: z.number(),
  realized_pl: z.number(),
  weight_pct: z.number(),
});

export const PortfolioTransactionSchema = z.object({
  id: z.number(),
  portfolio_id: z.number(),
  symbol: z.string(),
  side: z.string(),
  shares: z.number(),
  price: z.number(),
  timestamp: z.string(),
});

export const PortfolioTransactionPageSchema = z.object({
  items: z.array(PortfolioTransactionSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export const PortfolioPerformancePointSchema = z.object({
  timestamp: z.string(),
  portfolio_value: z.number(),
});

export const MarketQuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
  change_percent: z.number(),
  as_of: z.string(),
});

export const TradePreviewResponseSchema = z.object({
  symbol: z.string(),
  type: z.string(),
  shares: z.number(),
  price: z.number(),
  estimated_total_cost: z.number(),
  estimated_cash_after: z.number(),
  estimated_shares_after: z.number(),
  can_execute: z.boolean(),
  error_message: z.string().nullable(),
});

export const TradeExecuteResponseSchema = z.object({
  transaction_id: z.number(),
  symbol: z.string(),
  type: z.string(),
  shares: z.number(),
  price: z.number(),
  total_value: z.number(),
  new_cash_balance: z.number(),
  new_shares_owned: z.number(),
});
