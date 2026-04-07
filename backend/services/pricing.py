"""
Pricing service - backwards compatible wrapper around market_data.

This module maintains the original API while delegating to the new
market_data service for actual price fetching.
"""

from .market_data import (
    get_price,
    get_market_data_mode,
    get_quote,
    get_quotes,
    search_symbols,
    is_valid_symbol,
)


def get_supported_symbols() -> list[str]:
    """
    Get list of supported symbols.

    Note: With live market data, this returns a sample list of popular symbols.
    The app now supports any valid ticker via search.
    """
    # Return popular symbols for initial display
    return [
        "AAPL", "MSFT", "GOOG", "GOOGL", "AMZN", "TSLA", "META", "NVDA",
        "JPM", "V", "JNJ", "WMT", "PG", "MA", "HD", "DIS", "NFLX", "PYPL",
        "ADBE", "CRM",
    ]


__all__ = [
    "get_price",
    "get_market_data_mode",
    "get_supported_symbols",
    "get_quote",
    "get_quotes",
    "search_symbols",
    "is_valid_symbol",
]
