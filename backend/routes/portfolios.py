from decimal import Decimal
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies.auth import get_current_user


portfolios_router = APIRouter()


def get_portfolio_or_404(portfolio_id: int, db: Session) -> models.Portfolio:
    from fastapi import HTTPException
    portfolio = db.query(models.Portfolio).filter(models.Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio


@portfolios_router.post("/portfolios", response_model=schemas.PortfolioRead)
def create_portfolio(
    portfolio: schemas.PortfolioCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    new_portfolio = models.Portfolio(
        name=portfolio.name.strip(),
        cash_balance=Decimal("0.00"),
        user_id=current_user.id,
    )
    db.add(new_portfolio)
    db.commit()
    db.refresh(new_portfolio)
    return schemas.PortfolioRead.model_validate(new_portfolio)


@portfolios_router.get("/portfolios", response_model=List[schemas.PortfolioRead])
def get_portfolios(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    portfolios = (
        db.query(models.Portfolio)
        .filter(models.Portfolio.user_id == current_user.id)
        .order_by(models.Portfolio.created_at.desc())
        .all()
    )
    return [schemas.PortfolioRead.model_validate(portfolio) for portfolio in portfolios]


@portfolios_router.get("/portfolios/{portfolio_id}", response_model=schemas.PortfolioDetailResponse)
def get_portfolio(
    portfolio_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    portfolio = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.id == portfolio_id,
            models.Portfolio.user_id == current_user.id,
        )
        .first()
    )
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return schemas.PortfolioDetailResponse.model_validate(portfolio)


@portfolios_router.delete("/portfolios/{portfolio_id}", response_model=schemas.PortfolioDeleteResponse)
def delete_portfolio(
    portfolio_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    portfolio = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.id == portfolio_id,
            models.Portfolio.user_id == current_user.id,
        )
        .first()
    )
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    has_transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.portfolio_id == portfolio_id)
        .first()
        is not None
    )
    if has_transactions:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete portfolio with existing transactions",
        )

    db.delete(portfolio)
    db.commit()
    return schemas.PortfolioDeleteResponse(success=True)


@portfolios_router.patch("/portfolios/{portfolio_id}", response_model=schemas.PortfolioUpdateResponse)
def update_portfolio(
    portfolio_id: int,
    body: schemas.PortfolioUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    portfolio = (
        db.query(models.Portfolio)
        .filter(
            models.Portfolio.id == portfolio_id,
            models.Portfolio.user_id == current_user.id,
        )
        .first()
    )
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Portfolio name cannot be empty")

    portfolio.name = name
    db.commit()
    db.refresh(portfolio)
    return schemas.PortfolioUpdateResponse.model_validate(portfolio)
