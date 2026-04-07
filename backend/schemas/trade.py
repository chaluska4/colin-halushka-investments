from pydantic import BaseModel, Field
from typing import Optional


class TradeRequest(BaseModel):
    portfolio_id: int
    symbol: str = Field(..., pattern=r"^[A-Za-z0-9]{1,10}$")
    side: str = Field(..., pattern="^(BUY|SELL)$")
    shares: float = Field(..., gt=0)


class TradeResponse(BaseModel):
    transaction_id: int
    symbol: str
    type: str
    shares: float
    price: float
    total_value: float
    new_cash_balance: float
    new_shares_owned: float


class TradePreviewRequest(BaseModel):
    portfolio_id: int
    symbol: str = Field(..., pattern=r"^[A-Za-z0-9]{1,10}$")
    type: str = Field(..., pattern="^(BUY|SELL)$")
    shares: float = Field(..., gt=0)


class TradePreviewResponse(BaseModel):
    symbol: str
    type: str
    shares: float
    price: float
    estimated_total_cost: float
    estimated_cash_after: float
    estimated_shares_after: float
    can_execute: bool
    error_message: Optional[str] = None
