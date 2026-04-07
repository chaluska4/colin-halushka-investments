"""
Market data service with pluggable providers.

Supports live quotes and symbol search via external APIs.
Falls back to stub data when no API key is configured.
"""

import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import httpx


@dataclass
class Quote:
    """Normalized quote response."""
    symbol: str
    price: float
    change: float
    change_percent: float
    previous_close: float
    timestamp: float


@dataclass
class SymbolInfo:
    """Normalized symbol search result."""
    symbol: str
    name: str
    type: str  # "Stock", "ETF", etc.


class MarketDataProvider(ABC):
    """Abstract base class for market data providers."""

    @abstractmethod
    def get_quote(self, symbol: str) -> Optional[Quote]:
        """Get a quote for a single symbol."""
        pass

    @abstractmethod
    def get_quotes(self, symbols: list[str]) -> dict[str, Quote]:
        """Get quotes for multiple symbols."""
        pass

    @abstractmethod
    def search_symbols(self, query: str) -> list[SymbolInfo]:
        """Search for symbols matching a query."""
        pass

    @abstractmethod
    def is_valid_symbol(self, symbol: str) -> bool:
        """Check if a symbol is valid/tradeable."""
        pass


class FinnhubProvider(MarketDataProvider):
    """
    Finnhub market data provider.

    Free tier: 60 API calls/minute
    Docs: https://finnhub.io/docs/api
    """

    BASE_URL = "https://finnhub.io/api/v1"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._quote_cache: dict[str, tuple[Quote, float]] = {}
        self._valid_symbol_cache: dict[str, tuple[bool, float]] = {}
        self._cache_ttl = 15  # seconds
        self._valid_cache_ttl = 300  # 5 minutes for symbol validity

    def _get(self, endpoint: str, params: dict = None) -> Optional[dict]:
        """Make authenticated GET request."""
        params = params or {}
        params["token"] = self.api_key
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(f"{self.BASE_URL}{endpoint}", params=params)
                if resp.status_code == 200:
                    return resp.json()
                return None
        except Exception:
            return None

    def get_quote(self, symbol: str) -> Optional[Quote]:
        symbol = symbol.upper()

        # Check cache
        now = time.time()
        if symbol in self._quote_cache:
            cached, cached_at = self._quote_cache[symbol]
            if now - cached_at < self._cache_ttl:
                return cached

        data = self._get("/quote", {"symbol": symbol})
        if not data or data.get("c") is None or data.get("c") == 0:
            return None

        quote = Quote(
            symbol=symbol,
            price=float(data.get("c", 0)),
            change=float(data.get("d", 0) or 0),
            change_percent=float(data.get("dp", 0) or 0),
            previous_close=float(data.get("pc", 0) or 0),
            timestamp=float(data.get("t", now)),
        )
        self._quote_cache[symbol] = (quote, now)
        return quote

    def get_quotes(self, symbols: list[str]) -> dict[str, Quote]:
        """Get quotes for multiple symbols (sequential calls due to Finnhub API)."""
        results = {}
        for symbol in symbols:
            quote = self.get_quote(symbol)
            if quote:
                results[symbol.upper()] = quote
        return results

    def search_symbols(self, query: str, limit: int = 50) -> list[SymbolInfo]:
        """Search for symbols using Finnhub symbol search."""
        data = self._get("/search", {"q": query})
        if not data or "result" not in data:
            return []

        results = []
        for item in data.get("result", []):
            if len(results) >= limit:
                break
            symbol = item.get("symbol", "")
            if not symbol:
                continue
            # Include US stocks - allow common suffixes but skip foreign exchanges
            # Skip clearly foreign symbols (contain colon like "LSE:BP")
            if ":" in symbol:
                continue
            results.append(SymbolInfo(
                symbol=symbol,
                name=item.get("description", ""),
                type=item.get("type", "Stock"),
            ))
        return results

    def is_valid_symbol(self, symbol: str) -> bool:
        """Check if symbol returns a valid quote (with caching)."""
        symbol = symbol.upper()
        now = time.time()

        # Check cache first
        if symbol in self._valid_symbol_cache:
            is_valid, cached_at = self._valid_symbol_cache[symbol]
            if now - cached_at < self._valid_cache_ttl:
                return is_valid

        quote = self.get_quote(symbol)
        is_valid = quote is not None and quote.price > 0
        self._valid_symbol_cache[symbol] = (is_valid, now)
        return is_valid


class StubProvider(MarketDataProvider):
    """
    Stub provider for development/testing.
    Returns fake prices for common symbols.
    """

    STUB_DATA = {
        "AAPL": ("Apple Inc.", 185.50),
        "MSFT": ("Microsoft Corporation", 410.25),
        "GOOG": ("Alphabet Inc.", 140.10),
        "GOOGL": ("Alphabet Inc.", 139.80),
        "AMZN": ("Amazon.com Inc.", 155.75),
        "TSLA": ("Tesla Inc.", 220.00),
        "META": ("Meta Platforms Inc.", 485.50),
        "NVDA": ("NVIDIA Corporation", 875.25),
        "JPM": ("JPMorgan Chase & Co.", 195.50),
        "V": ("Visa Inc.", 275.30),
        "JNJ": ("Johnson & Johnson", 155.80),
        "WMT": ("Walmart Inc.", 165.20),
        "PG": ("Procter & Gamble Co.", 158.40),
        "MA": ("Mastercard Inc.", 445.60),
        "HD": ("Home Depot Inc.", 345.80),
        "DIS": ("Walt Disney Co.", 112.30),
        "NFLX": ("Netflix Inc.", 605.50),
        "PYPL": ("PayPal Holdings Inc.", 62.40),
        "ADBE": ("Adobe Inc.", 525.75),
        "CRM": ("Salesforce Inc.", 265.30),
    }

    def get_quote(self, symbol: str) -> Optional[Quote]:
        symbol = symbol.upper()
        if symbol not in self.STUB_DATA:
            return None

        _, price = self.STUB_DATA[symbol]
        return Quote(
            symbol=symbol,
            price=price,
            change=0.0,
            change_percent=0.0,
            previous_close=price,
            timestamp=time.time(),
        )

    def get_quotes(self, symbols: list[str]) -> dict[str, Quote]:
        results = {}
        for symbol in symbols:
            quote = self.get_quote(symbol)
            if quote:
                results[symbol.upper()] = quote
        return results

    def search_symbols(self, query: str) -> list[SymbolInfo]:
        query = query.upper()
        results = []
        for symbol, (name, _) in self.STUB_DATA.items():
            if query in symbol or query.lower() in name.lower():
                results.append(SymbolInfo(symbol=symbol, name=name, type="Stock"))
        return results

    def is_valid_symbol(self, symbol: str) -> bool:
        return symbol.upper() in self.STUB_DATA


# Singleton provider instance
_provider: Optional[MarketDataProvider] = None


def get_provider() -> MarketDataProvider:
    """Get the configured market data provider."""
    global _provider
    if _provider is None:
        api_key = os.getenv("FINNHUB_API_KEY") or os.getenv("MARKET_DATA_API_KEY")
        if api_key:
            _provider = FinnhubProvider(api_key)
        else:
            _provider = StubProvider()
    return _provider


def reset_provider():
    """Reset provider (useful for testing)."""
    global _provider
    _provider = None


# Convenience functions that use the singleton provider
def get_quote(symbol: str) -> Optional[Quote]:
    """Get a quote for a symbol."""
    return get_provider().get_quote(symbol)


def get_quotes(symbols: list[str]) -> dict[str, Quote]:
    """Get quotes for multiple symbols."""
    return get_provider().get_quotes(symbols)


def search_symbols(query: str) -> list[SymbolInfo]:
    """Search for symbols."""
    return get_provider().search_symbols(query)


def is_valid_symbol(symbol: str) -> bool:
    """Check if a symbol is valid."""
    return get_provider().is_valid_symbol(symbol)


def get_price(symbol: str) -> float:
    """Get just the price for a symbol (backwards compatible)."""
    quote = get_quote(symbol)
    if quote:
        return quote.price
    # Fallback for unknown symbols
    return 0.0


def get_market_data_mode() -> str:
    """Get the current market data mode."""
    provider = get_provider()
    if isinstance(provider, FinnhubProvider):
        return "live"
    return "stub"
