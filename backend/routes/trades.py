from decimal import Decimal
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies.auth import get_current_user
from ..limiter import limiter
from ..services.pricing import get_price, get_supported_symbols, is_valid_symbol
from ..services.trading import execute_trade, get_shares_owned

trades_router = APIRouter(prefix="/trade", tags=["trades"])


@trades_router.post("", response_model=schemas.TradeResponse)
@limiter.limit("30/minute")
def create_trade(
    request: Request,
    body: schemas.TradeRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Execute a trade (BUY or SELL) for a portfolio.
    
    Validates:
    - Portfolio belongs to current user
    - Sufficient cash for BUY
    - Sufficient shares for SELL
    
    Updates user cash balance and creates transaction record.
    """
    # Validate portfolio ownership
    portfolio = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.id == body.portfolio_id,
            models.Portfolio.user_id == current_user.id,
        )
        .first()
    )
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found",
        )
    
    # Parse side
    try:
        side = models.TradeSide[body.side]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid side: {body.side}. Must be BUY or SELL.",
        )

    symbol = body.symbol.upper()

    # Validate symbol has a valid quote (allows any tradeable symbol)
    if not is_valid_symbol(symbol):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or unsupported symbol: {symbol}",
        )

    # Execute trade
    transaction = execute_trade(
        user=current_user,
        portfolio=portfolio,
        symbol=symbol,
        side=side,
        shares=body.shares,
        db=db,
    )
    new_shares_owned = get_shares_owned(portfolio.id, symbol, db)
    
    return schemas.TradeResponse(
        transaction_id=transaction.id,
        symbol=transaction.symbol,
        type=transaction.side.value,
        shares=transaction.shares,
        price=float(transaction.price),
        total_value=float(transaction.shares * float(transaction.price)),
        new_cash_balance=float(current_user.cash_balance),
        new_shares_owned=float(new_shares_owned),
    )


@trades_router.post("/preview", response_model=schemas.TradePreviewResponse)
@limiter.limit("30/minute")
def preview_trade(
    request: Request,
    body: schemas.TradePreviewRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    portfolio = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.id == body.portfolio_id,
            models.Portfolio.user_id == current_user.id,
        )
        .first()
    )
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found",
        )

    symbol = body.symbol.upper()

    # Validate symbol has a valid quote (allows any tradeable symbol)
    if not is_valid_symbol(symbol):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or unsupported symbol: {symbol}",
        )

    trade_type = body.type.upper()
    shares = body.shares
    price = Decimal(str(get_price(symbol)))
    estimated_total_cost = price * Decimal(str(shares))
    current_cash = Decimal(str(current_user.cash_balance))
    current_shares = Decimal(str(get_shares_owned(portfolio.id, symbol, db)))

    if trade_type == "BUY":
        can_execute = current_cash >= estimated_total_cost
        error_message = None
        if not can_execute:
            error_message = (
                f"Insufficient cash. Required: ${estimated_total_cost:.2f}, "
                f"Available: ${current_cash:.2f}"
            )
        estimated_cash_after = current_cash - estimated_total_cost
        estimated_shares_after = current_shares + Decimal(str(shares))
    elif trade_type == "SELL":
        can_execute = current_shares >= Decimal(str(shares))
        error_message = None
        if not can_execute:
            error_message = (
                f"Insufficient shares. Owned: {float(current_shares)}, "
                f"Attempted to sell: {shares}"
            )
        estimated_cash_after = current_cash + estimated_total_cost
        estimated_shares_after = current_shares - Decimal(str(shares))
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid type: {body.type}. Must be BUY or SELL.",
        )

    return schemas.TradePreviewResponse(
        symbol=symbol,
        type=trade_type,
        shares=shares,
        price=float(price),
        estimated_total_cost=float(estimated_total_cost),
        estimated_cash_after=float(estimated_cash_after),
        estimated_shares_after=float(estimated_shares_after),
        can_execute=can_execute,
        error_message=error_message,
    )


@trades_router.get("/transactions", response_model=List[schemas.TransactionRead])
def get_transactions(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get all transactions for the authenticated user.
    """
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.timestamp.desc())
        .all()
    )
    return transactions


@trades_router.get(
    "/portfolios/{portfolio_id}/transactions",
    response_model=schemas.PortfolioTransactionsPageResponse,
)
def get_portfolio_transactions(
    portfolio_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
    offset: int = 0,
):
    """
    Get all transactions for a specific portfolio.
    """
    if limit > 100:
        limit = 100
    portfolio = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.id == portfolio_id,
            models.Portfolio.user_id == current_user.id,
        )
        .first()
    )
    
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found",
        )
    
    base_query = (
        db.query(models.Transaction)
        .filter(models.Transaction.portfolio_id == portfolio_id)
    )
    total = base_query.count()
    transactions = (
        base_query
        .order_by(models.Transaction.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = [
        schemas.PortfolioTransactionResponse(
            id=tx.id,
            symbol=tx.symbol,
            type=tx.side.value,
            shares=tx.shares,
            price=float(tx.price),
            total_value=float(tx.shares * float(tx.price)),
            timestamp=tx.timestamp,
        )
        for tx in transactions
    ]
    return schemas.PortfolioTransactionsPageResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )
