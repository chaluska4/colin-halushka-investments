from fastapi import HTTPException

from .. import schemas
from .analytics import analytics_router, get_portfolio_analytics
from .auth import auth_router
from .holdings import create_holding, get_holdings, holdings_router
from .news import news_router
from .portfolios import create_portfolio, get_portfolios, get_portfolio_or_404, portfolios_router
from .trades import trades_router
from .transactions import create_transaction, get_transactions, transactions_router
from .watchlist import watchlist_router

__all__ = [
    "HTTPException",
    "analytics_router",
    "auth_router",
    "create_holding",
    "create_portfolio",
    "create_transaction",
    "get_holdings",
    "get_portfolio_analytics",
    "get_portfolio_or_404",
    "get_portfolios",
    "get_transactions",
    "holdings_router",
    "news_router",
    "portfolios_router",
    "schemas",
    "trades_router",
    "transactions_router",
    "watchlist_router",
]
