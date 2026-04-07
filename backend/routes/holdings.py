from decimal import Decimal
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies.auth import get_owned_portfolio_or_404
from .portfolios import get_portfolio_or_404


holdings_router = APIRouter()


def _to_decimal(value) -> Decimal:
    return Decimal(str(value))


@holdings_router.post("/portfolios/{portfolio_id}/holdings", response_model=schemas.HoldingRead)
def create_holding(
    holding: schemas.HoldingCreate,
    db: Annotated[Session, Depends(get_db)],
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)],
):
    portfolio_id = portfolio.id

    shares = _to_decimal(holding.shares)
    avg_cost = _to_decimal(holding.avg_cost)
    symbol = holding.symbol.upper()

    if shares <= 0:
        raise HTTPException(status_code=400, detail="shares must be greater than 0")
    if avg_cost < 0:
        raise HTTPException(status_code=400, detail="avg_cost cannot be negative")

    existing_holding = (
        db.query(models.Holding)
        .filter(
            models.Holding.portfolio_id == portfolio_id,
            models.Holding.symbol == symbol,
        )
        .first()
    )

    if existing_holding:
        existing_shares = _to_decimal(existing_holding.shares)
        existing_avg_cost = _to_decimal(existing_holding.avg_cost)
        total_shares = existing_shares + shares

        new_avg_cost = (
            ((existing_shares * existing_avg_cost) + (shares * avg_cost)) / total_shares
            if total_shares != 0
            else Decimal("0")
        )

        existing_holding.shares = float(total_shares)
        existing_holding.avg_cost = float(new_avg_cost)
        db.commit()
        db.refresh(existing_holding)
        return schemas.HoldingRead.model_validate(existing_holding)

    new_holding = models.Holding(
        portfolio_id=portfolio_id,
        symbol=symbol,
        shares=float(shares),
        avg_cost=float(avg_cost),
    )
    db.add(new_holding)
    db.commit()
    db.refresh(new_holding)
    return schemas.HoldingRead.model_validate(new_holding)


@holdings_router.get("/portfolios/{portfolio_id}/holdings", response_model=List[schemas.HoldingRead])
def get_holdings(
    db: Annotated[Session, Depends(get_db)],
    portfolio: Annotated[models.Portfolio, Depends(get_owned_portfolio_or_404)],
):
    portfolio_id = portfolio.id
    holdings = (
        db.query(models.Holding)
        .filter(models.Holding.portfolio_id == portfolio_id)
        .order_by(models.Holding.symbol.asc())
        .all()
    )
    return [schemas.HoldingRead.model_validate(holding) for holding in holdings]
