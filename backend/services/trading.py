import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from .. import models
from ..services.pricing import get_price

if TYPE_CHECKING:
    from ..models import User, Portfolio

logger = logging.getLogger("trading")


def _find_duplicate_trade(
    user_id: int,
    portfolio_id: int,
    symbol: str,
    side: "models.TradeSide",
    shares: float,
    price: Decimal,
    db: Session,
) -> Optional[models.Transaction]:
    cutoff = datetime.utcnow() - timedelta(seconds=3)
    return (
        db.query(models.Transaction)
        .filter(
            models.Transaction.user_id == user_id,
            models.Transaction.portfolio_id == portfolio_id,
            models.Transaction.symbol == symbol,
            models.Transaction.side == side,
            models.Transaction.shares == shares,
            models.Transaction.price == price,
            models.Transaction.timestamp >= cutoff,
        )
        .first()
    )


def get_shares_owned(portfolio_id: int, symbol: str, db: Session) -> float:
    """Compute net shares owned for a symbol in a portfolio from transaction history."""
    transactions = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.portfolio_id == portfolio_id,
            models.Transaction.symbol == symbol.upper(),
        )
        .all()
    )
    
    total_shares = 0.0
    for txn in transactions:
        if txn.side == models.TradeSide.BUY:
            total_shares += txn.shares
        elif txn.side == models.TradeSide.SELL:
            total_shares -= txn.shares
    
    return total_shares


def execute_trade(
    user: "User",
    portfolio: "Portfolio",
    symbol: str,
    side: models.TradeSide,
    shares: float,
    db: Session,
) -> models.Transaction:
    """
    Execute a trade (BUY or SELL) and update user cash balance.
    
    Args:
        user: The user executing the trade
        portfolio: The portfolio for the trade
        symbol: Stock symbol (e.g., "AAPL")
        side: TradeSide.BUY or TradeSide.SELL
        shares: Number of shares to trade (must be > 0)
        db: Database session
    
    Returns:
        The created Transaction record
    
    Raises:
        HTTPException: If insufficient cash (BUY) or shares (SELL)
    """
    if shares <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shares must be greater than 0",
        )

    import re
    if not re.match(r"^[A-Z0-9]{1,10}$", symbol.upper()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid symbol: must be 1-10 alphanumeric characters",
        )

    # Get current price
    price = Decimal(str(get_price(symbol)))
    trade_value = price * Decimal(str(shares))

    symbol_upper = symbol.upper()

    duplicate = _find_duplicate_trade(user.id, portfolio.id, symbol_upper, side, shares, price, db)
    if duplicate:
        logger.info("DUPLICATE_TRADE skipped user_id=%s portfolio_id=%s symbol=%s", user.id, portfolio.id, symbol_upper)
        return duplicate
    
    if side == models.TradeSide.BUY:
        # Check sufficient cash
        if user.cash_balance < trade_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient cash. Need ${float(trade_value):.2f}, available ${float(user.cash_balance):.2f}",
            )
        
        # Deduct cash
        user.cash_balance -= trade_value
    
    elif side == models.TradeSide.SELL:
        # Check sufficient shares
        current_shares = get_shares_owned(portfolio.id, symbol_upper, db)
        
        if current_shares < shares:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient shares. Own {current_shares:.4f}, tried to sell {shares:.4f}",
            )
        
        # Add cash
        user.cash_balance += trade_value
    
    # Create transaction record
    transaction = models.Transaction(
        user_id=user.id,
        portfolio_id=portfolio.id,
        symbol=symbol_upper,
        side=side,
        shares=shares,
        price=price,
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    db.refresh(user)

    logger.info(
        "TRADE user_id=%s portfolio_id=%s symbol=%s side=%s shares=%s price=%s",
        user.id, portfolio.id, symbol_upper, side.value, shares, float(price),
    )
    return transaction
