from datetime import datetime
from typing import List

from pydantic import BaseModel, Field

from .holding import HoldingAnalytics, HoldingRead


class PortfolioCreate(BaseModel):
    name: str


class PortfolioRead(BaseModel):
    id: int
    name: str
    created_at: datetime
    holdings: List[HoldingRead] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PortfolioDetailResponse(BaseModel):
    id: int
    name: str
    cash_balance: float
    created_at: datetime

    class Config:
        from_attributes = True


class PortfolioAnalytics(BaseModel):
    portfolio_id: int
    total_market_value: float
    total_cost_basis: float
    total_unrealized_pl: float
    total_unrealized_pl_pct: float
    total_realized_pl: float = 0.0
    holdings: List[HoldingAnalytics] = Field(default_factory=list)


class QuoteResponse(BaseModel):
    symbol: str
    price: float
    mode: str


class PortfolioSummaryResponse(BaseModel):
    portfolio_id: int
    total_market_value: float
    total_cost_basis: float
    total_unrealized_pl: float
    total_unrealized_pl_pct: float
    total_realized_pl: float
    cash_balance: float


class PositionRowResponse(BaseModel):
    symbol: str
    shares: float
    avg_cost: float
    price: float
    market_value: float
    unrealized_pl: float
    unrealized_pl_pct: float
    realized_pl: float
    weight_pct: float


class TopPositionResponse(BaseModel):
    symbol: str
    market_value: float


class PortfolioOverviewResponse(BaseModel):
    portfolio_id: int
    name: str
    cash_balance: float
    total_value: float
    total_gain_loss: float
    total_gain_loss_percent: float
    number_of_positions: int
    top_3_positions: List[TopPositionResponse] = Field(default_factory=list)


class PortfolioPerformancePointResponse(BaseModel):
    timestamp: datetime
    portfolio_value: float


class MarketQuoteResponse(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    as_of: datetime


class DashboardSnapshotResponse(BaseModel):
    total_cash: float
    total_portfolio_value: float
    total_account_value: float
    total_unrealized_pl: float
    total_realized_pl: float
    portfolio_count: int


class SymbolSearchResult(BaseModel):
    symbol: str
    name: str
    type: str


class SymbolSearchResponse(BaseModel):
    results: List[SymbolSearchResult] = Field(default_factory=list)


class PortfolioDeleteResponse(BaseModel):
    success: bool


class PortfolioUpdateRequest(BaseModel):
    name: str


class PortfolioUpdateResponse(BaseModel):
    id: int
    name: str
    cash_balance: float
    created_at: datetime

    class Config:
        from_attributes = True
