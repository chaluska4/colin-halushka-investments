from decimal import Decimal
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies.auth import get_owned_portfolio_or_404
from ..services.analytics import derive_holdings_from_transactions
from .portfolios import get_portfolio_or_404


transactions_router = APIRouter()


def _to_decimal(value) -> Decimal:
    return Decimal(str(value))


@transactions_router.post(
    "/portfolios/{portfolio_id}/transactions",
    response_model=schemas.TransactionRead,
)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Annotated[Session, Depends(get_db)],
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)],
):
    portfolio_id = portfolio.id

    if transaction.transaction_type not in ["BUY", "SELL"]:
        raise HTTPException(status_code=400, detail="transaction_type must be BUY or SELL")

    shares = _to_decimal(transaction.shares)
    price = _to_decimal(transaction.price)
    trade_value = shares * price

    transactions = db.query(models.Transaction).filter(
        models.Transaction.portfolio_id == portfolio_id
    ).all()

    derived_holdings = derive_holdings_from_transactions(transactions)

    current_shares = Decimal("0")
    for holding in derived_holdings:
        if holding["symbol"] == transaction.symbol.upper():
            current_shares = holding["shares"]
            break

    if transaction.transaction_type == "BUY":
        if _to_decimal(portfolio.cash_balance) < trade_value:
            raise HTTPException(status_code=400, detail="Insufficient cash")

        portfolio.cash_balance = _to_decimal(portfolio.cash_balance) - trade_value

    if transaction.transaction_type == "SELL":
        if shares > current_shares:
            raise HTTPException(status_code=400, detail="Cannot sell more shares than owned")

        portfolio.cash_balance = _to_decimal(portfolio.cash_balance) + trade_value

    new_transaction = models.Transaction(
        portfolio_id=portfolio_id,
        symbol=transaction.symbol.upper(),
        transaction_type=transaction.transaction_type,
        shares=shares,
        price=price,
    )

    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)

    return schemas.TransactionRead.model_validate(new_transaction)


@transactions_router.get(
    "/portfolios/{portfolio_id}/transactions",
    response_model=schemas.TransactionPageResponse,
)
def get_transactions(
    db: Annotated[Session, Depends(get_db)],
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)],
    limit: int = 50,
    offset: int = 0,
):
    if limit > 100:
        limit = 100
    portfolio_id = portfolio.id
    base_query = db.query(models.Transaction).filter(
        models.Transaction.portfolio_id == portfolio_id
    )
    total = base_query.count()
    transactions = (
        base_query
        .order_by(models.Transaction.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return schemas.TransactionPageResponse(
        items=[schemas.TransactionRead.model_validate(tx) for tx in transactions],
        total=total,
        limit=limit,
        offset=offset,
    )
