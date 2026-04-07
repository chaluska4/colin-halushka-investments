import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies.auth import get_current_user, get_owned_portfolio_or_404
from ..services.analytics import (
    calculate_realized_pl,
    compute_equity_curve_from_transactions,
    compute_portfolio_analytics,
    compute_portfolio_analytics_from_transactions,
)
from ..services.pricing import (
    get_market_data_mode,
    get_price,
    get_supported_symbols,
    get_quote,
    get_quotes,
    search_symbols,
)
from ..schemas.portfolio import (
    DashboardSnapshotResponse,
    MarketQuoteResponse,
    PortfolioPerformancePointResponse,
    PortfolioOverviewResponse,
    PortfolioSummaryResponse,
    PositionRowResponse,
    QuoteResponse,
    SymbolSearchResult,
    SymbolSearchResponse,
)


analytics_router = APIRouter()


@analytics_router.get(
    "/portfolios/{portfolio_id}/analytics",
    response_model=schemas.PortfolioAnalytics,
)
def get_portfolio_analytics(
    db: Annotated[Session, Depends(get_db)],
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)],
):
    """
    Compute portfolio analytics.
    
    Prefers transaction-based holdings if transactions exist,
    otherwise falls back to direct holdings table for backward compatibility.
    
    Returns:
    - Total market value
    - Total cost basis
    - Total unrealized P/L
    - Per-holding breakdown with shares, avg cost, current price, P/L, allocation %
    """
    portfolio_id = portfolio.id

    # Check for transactions first (new trading system)
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.portfolio_id == portfolio_id)
        .order_by(models.Transaction.timestamp.asc())
        .all()
    )

    if transactions:
        # Use transaction-based analytics
        analytics = compute_portfolio_analytics_from_transactions(transactions, get_price)

        def _tx_time(tx):
            return tx.timestamp

        symbols = {tx.symbol.upper() for tx in transactions}
        realized_by_symbol = {
            sym: calculate_realized_pl(
                sorted([tx for tx in transactions if tx.symbol.upper() == sym], key=_tx_time)
            )
            for sym in symbols
        }
        total_realized_pl = sum(realized_by_symbol.values())

        for holding in analytics["holdings"]:
            holding["realized_pl"] = realized_by_symbol.get(holding["symbol"], 0.0)

        return schemas.PortfolioAnalytics(
            portfolio_id=portfolio_id,
            total_market_value=analytics["total_market_value"],
            total_cost_basis=analytics["total_cost_basis"],
            total_unrealized_pl=analytics["total_unrealized_pl"],
            total_unrealized_pl_pct=analytics["total_unrealized_pl_pct"],
            total_realized_pl=total_realized_pl,
            holdings=analytics["holdings"],
        )
    
    # Fall back to direct holdings table (backward compatibility)
    holdings = (
        db.query(models.Holding)
        .filter(models.Holding.portfolio_id == portfolio_id)
        .order_by(models.Holding.symbol.asc())
        .all()
    )

    if not holdings:
        return schemas.PortfolioAnalytics(
            portfolio_id=portfolio_id,
            total_market_value=Decimal("0"),
            total_cost_basis=Decimal("0"),
            total_unrealized_pl=Decimal("0"),
            total_unrealized_pl_pct=Decimal("0"),
            total_realized_pl=0.0,
            holdings=[],
        )

    prices = {holding.symbol.upper(): get_price(holding.symbol) for holding in holdings}
    analytics = compute_portfolio_analytics(holdings, prices)

    return schemas.PortfolioAnalytics(
        portfolio_id=portfolio_id,
        total_market_value=analytics["total_market_value"],
        total_cost_basis=analytics["total_cost_basis"],
        total_unrealized_pl=analytics["total_unrealized_pl"],
        total_unrealized_pl_pct=analytics["total_unrealized_pl_pct"],
        total_realized_pl=0.0,
        holdings=analytics["holdings"],
    )


@analytics_router.get("/market-data/status")
def get_market_data_status(
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    api_key_configured = bool(
        os.getenv("FINNHUB_API_KEY") or os.getenv("MARKET_DATA_API_KEY")
    )
    return {
        "mode": get_market_data_mode(),
        "api_key_configured": api_key_configured,
    }


@analytics_router.get("/market-data/symbols")
def get_market_data_symbols(
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    return {"symbols": get_supported_symbols()}


@analytics_router.get("/market-data/search", response_model=SymbolSearchResponse)
def search_market_symbols(
    q: str,
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    """
    Search for stock symbols by name or ticker.

    Args:
        q: Search query (e.g., "META", "Apple", "TSLA")

    Returns:
        List of matching symbols with name and type
    """
    if not q or len(q.strip()) < 1:
        return SymbolSearchResponse(results=[])

    results = search_symbols(q.strip())
    return SymbolSearchResponse(
        results=[
            SymbolSearchResult(symbol=r.symbol, name=r.name, type=r.type)
            for r in results
        ]
    )


@analytics_router.get("/market-data/quote/{symbol}", response_model=QuoteResponse)
def get_market_data_quote(
    symbol: str,
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    normalized_symbol = symbol.upper()
    return QuoteResponse(
        symbol=normalized_symbol,
        price=get_price(normalized_symbol),
        mode=get_market_data_mode(),
    )


@analytics_router.get("/market-data/quotes", response_model=List[MarketQuoteResponse])
def get_market_data_quotes(
    symbols: str,
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    """
    Get quotes for multiple symbols.

    Args:
        symbols: Comma-separated list of stock symbols

    Returns:
        List of quotes with price and change data
    """
    normalized_symbols: list[str] = []

    for raw in symbols.split(","):
        symbol = raw.strip().upper()
        if symbol and symbol not in normalized_symbols:
            normalized_symbols.append(symbol)

    if not normalized_symbols:
        return []

    # Fetch quotes using the market data provider
    quotes_map = get_quotes(normalized_symbols)
    as_of = datetime.utcnow()

    results = []
    for symbol in normalized_symbols:
        quote = quotes_map.get(symbol)
        if quote:
            results.append(MarketQuoteResponse(
                symbol=quote.symbol,
                price=quote.price,
                change=quote.change,
                change_percent=quote.change_percent,
                as_of=as_of,
            ))
        else:
            # Symbol not found - skip or return zero price
            price = get_price(symbol)
            if price > 0:
                results.append(MarketQuoteResponse(
                    symbol=symbol,
                    price=price,
                    change=0.0,
                    change_percent=0.0,
                    as_of=as_of,
                ))

    return results


@analytics_router.get(
    "/portfolios/{portfolio_id}/summary",
    response_model=PortfolioSummaryResponse,
)
def get_portfolio_summary(
    db: Annotated[Session, Depends(get_db)],
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)],
):
    analytics = get_portfolio_analytics(db=db, portfolio=portfolio)
    return PortfolioSummaryResponse(
        portfolio_id=analytics.portfolio_id,
        total_market_value=analytics.total_market_value,
        total_cost_basis=analytics.total_cost_basis,
        total_unrealized_pl=analytics.total_unrealized_pl,
        total_unrealized_pl_pct=analytics.total_unrealized_pl_pct,
        total_realized_pl=analytics.total_realized_pl,
        cash_balance=float(portfolio.user.cash_balance),
    )


@analytics_router.get(
    "/portfolios/{portfolio_id}/positions",
    response_model=List[PositionRowResponse],
)
def get_portfolio_positions(
    db: Annotated[Session, Depends(get_db)],
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)],
):
    analytics = get_portfolio_analytics(db=db, portfolio=portfolio)
    return analytics.holdings


@analytics_router.get(
    "/portfolios/{portfolio_id}/performance",
    response_model=List[PortfolioPerformancePointResponse],
)
def get_portfolio_performance(
    portfolio_id: int,
    range: str = "1M",
    db: Annotated[Session, Depends(get_db)] = None,
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)] = None,
):
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.portfolio_id == portfolio_id)
        .order_by(models.Transaction.timestamp.asc())
        .all()
    )

    points = compute_equity_curve_from_transactions(
        transactions=transactions,
        initial_cash_balance=float(portfolio.user.cash_balance),
        get_price_func=get_price,
    )

    if range == "ALL":
        return points

    now = datetime.utcnow()
    cutoffs = {
        "1D": now - timedelta(days=1),
        "1W": now - timedelta(weeks=1),
        "1M": now - timedelta(days=30),
        "3M": now - timedelta(days=90),
        "1Y": now - timedelta(days=365),
    }
    cutoff = cutoffs.get(range, cutoffs["1M"])
    return [point for point in points if point["timestamp"] >= cutoff]


@analytics_router.get(
    "/portfolios/{portfolio_id}/overview",
    response_model=PortfolioOverviewResponse,
)
def get_portfolio_overview(
    db: Annotated[Session, Depends(get_db)],
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)],
):
    analytics = get_portfolio_analytics(db=db, portfolio=portfolio)
    cash_balance = float(portfolio.user.cash_balance)
    total_market_value = float(analytics.total_market_value)
    total_cost_basis = float(analytics.total_cost_basis)
    total_gain_loss = float(analytics.total_unrealized_pl) + float(analytics.total_realized_pl)
    total_gain_loss_percent = (total_gain_loss / total_cost_basis) if total_cost_basis else 0.0
    top_3_positions = sorted(
        [
            {"symbol": h.symbol, "market_value": float(h.market_value)}
            for h in analytics.holdings
        ],
        key=lambda p: p["market_value"],
        reverse=True,
    )[:3]

    return PortfolioOverviewResponse(
        portfolio_id=portfolio.id,
        name=portfolio.name,
        cash_balance=cash_balance,
        total_value=cash_balance + total_market_value,
        total_gain_loss=total_gain_loss,
        total_gain_loss_percent=total_gain_loss_percent,
        number_of_positions=len(analytics.holdings),
        top_3_positions=top_3_positions,
    )


@analytics_router.get(
    "/dashboard/snapshot",
    response_model=DashboardSnapshotResponse,
)
def get_dashboard_snapshot(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    portfolios = (
        db.query(models.Portfolio)
        .filter(models.Portfolio.user_id == current_user.id)
        .all()
    )

    total_portfolio_value = 0.0
    total_unrealized_pl = 0.0
    total_realized_pl = 0.0

    for portfolio in portfolios:
        analytics = get_portfolio_analytics(db=db, portfolio=portfolio)
        total_portfolio_value += float(analytics.total_market_value)
        total_unrealized_pl += float(analytics.total_unrealized_pl)
        total_realized_pl += float(analytics.total_realized_pl)

    total_cash = float(current_user.cash_balance)
    return DashboardSnapshotResponse(
        total_cash=total_cash,
        total_portfolio_value=total_portfolio_value,
        total_account_value=total_cash + total_portfolio_value,
        total_unrealized_pl=total_unrealized_pl,
        total_realized_pl=total_realized_pl,
        portfolio_count=len(portfolios),
    )
