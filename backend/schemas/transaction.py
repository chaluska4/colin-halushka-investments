from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class TransactionBase(BaseModel):
    symbol: str
    transaction_type: str
    shares: float
    price: float


class TransactionCreate(TransactionBase):
    pass


class TradeRequest(BaseModel):
    portfolio_id: int
    symbol: str = Field(..., min_length=1, max_length=10)
    side: str = Field(..., pattern="^(BUY|SELL)$")
    shares: float = Field(..., gt=0)


class TradeResponse(BaseModel):
    id: int
    portfolio_id: int
    symbol: str
    side: str
    shares: float
    price: float
    remaining_cash_balance: float
    timestamp: datetime

    class Config:
        from_attributes = True


class TransactionRead(BaseModel):
    id: int
    portfolio_id: int
    symbol: str
    side: str
    shares: float
    price: float
    timestamp: datetime

    class Config:
        from_attributes = True


class PortfolioTransactionResponse(BaseModel):
    id: int
    symbol: str
    type: str
    shares: float
    price: float
    total_value: float
    timestamp: datetime


class PortfolioTransactionsPageResponse(BaseModel):
    items: List[PortfolioTransactionResponse]
    total: int
    limit: int
    offset: int


class TransactionPageResponse(BaseModel):
    items: List[TransactionRead]
    total: int
    limit: int
    offset: int