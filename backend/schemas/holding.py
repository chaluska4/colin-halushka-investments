from pydantic import BaseModel


class HoldingBase(BaseModel):
    symbol: str
    shares: float
    avg_cost: float


class HoldingCreate(HoldingBase):
    pass


class HoldingRead(HoldingBase):
    id: int
    portfolio_id: int

    class Config:
        from_attributes = True


class HoldingAnalytics(BaseModel):
    symbol: str
    shares: float
    avg_cost: float
    price: float
    market_value: float
    cost_basis: float
    unrealized_pl: float
    unrealized_pl_pct: float
    weight_pct: float
    realized_pl: float = 0.0
