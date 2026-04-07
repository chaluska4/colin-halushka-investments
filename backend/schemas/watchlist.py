from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class WatchlistAddRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=16)


class WatchlistItemResponse(BaseModel):
    id: int
    symbol: str
    created_at: datetime

    class Config:
        from_attributes = True


class WatchlistResponse(BaseModel):
    items: List[WatchlistItemResponse]


class SymbolSuggestion(BaseModel):
    symbol: str
    name: str
    type: str


class ResolveSymbolRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=64)


class ResolveSymbolResponse(BaseModel):
    resolved_symbol: Optional[str] = None
    suggestions: List[SymbolSuggestion] = []
    error: Optional[str] = None
