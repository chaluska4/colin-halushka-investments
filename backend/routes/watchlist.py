from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies.auth import get_current_user
from ..services.pricing import is_valid_symbol, search_symbols

watchlist_router = APIRouter(prefix="/watchlist", tags=["watchlist"])


def _is_likely_ticker(query: str) -> bool:
    """Check if query looks like a stock ticker (1-5 uppercase letters)."""
    clean = query.strip().upper()
    return 1 <= len(clean) <= 5 and clean.isalpha()


def _resolve_query_to_symbol(query: str) -> schemas.ResolveSymbolResponse:
    """
    Resolve a query (ticker or company name) to a symbol.
    Returns the best match if high confidence, otherwise suggestions.
    """
    query = query.strip()
    if not query:
        return schemas.ResolveSymbolResponse(error="Query cannot be empty")

    upper_query = query.upper()

    # If it looks like a ticker, try validating it directly first
    if _is_likely_ticker(query):
        if is_valid_symbol(upper_query):
            return schemas.ResolveSymbolResponse(resolved_symbol=upper_query)

    # Search for matches
    results = search_symbols(query)
    if not results:
        # Also try the upper version as a last resort validation
        if is_valid_symbol(upper_query):
            return schemas.ResolveSymbolResponse(resolved_symbol=upper_query)
        return schemas.ResolveSymbolResponse(error=f"No symbols found for '{query}'")

    # Convert to suggestions
    suggestions = [
        schemas.SymbolSuggestion(symbol=r.symbol, name=r.name, type=r.type)
        for r in results[:10]
    ]

    # Check for exact symbol match
    for s in suggestions:
        if s.symbol.upper() == upper_query:
            if is_valid_symbol(s.symbol):
                return schemas.ResolveSymbolResponse(resolved_symbol=s.symbol)

    # Check for exact name match (case-insensitive)
    query_lower = query.lower()
    for s in suggestions:
        if s.name.lower() == query_lower:
            if is_valid_symbol(s.symbol):
                return schemas.ResolveSymbolResponse(resolved_symbol=s.symbol)

    # If first result is very close match and valid, use it
    first = suggestions[0]
    first_name_lower = first.name.lower()
    # High confidence: query is contained in name or name starts with query
    if (
        query_lower in first_name_lower
        or first_name_lower.startswith(query_lower)
        or first.symbol.upper() == upper_query
    ):
        if is_valid_symbol(first.symbol):
            # If there's only one result or the match is very strong, resolve directly
            if len(suggestions) == 1:
                return schemas.ResolveSymbolResponse(resolved_symbol=first.symbol)
            # Check if the first result is significantly better than others
            if first.symbol.upper() == upper_query:
                return schemas.ResolveSymbolResponse(resolved_symbol=first.symbol)

    # Return suggestions for user to pick
    return schemas.ResolveSymbolResponse(suggestions=suggestions)


@watchlist_router.get("", response_model=schemas.WatchlistResponse)
def get_watchlist(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get the user's watchlist items."""
    items = (
        db.query(models.WatchlistItem)
        .filter(models.WatchlistItem.user_id == current_user.id)
        .order_by(models.WatchlistItem.created_at.asc())
        .all()
    )
    return schemas.WatchlistResponse(items=items)


@watchlist_router.get("/symbols", response_model=List[str])
def get_watchlist_symbols(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Get just the symbols in the user's watchlist."""
    items = (
        db.query(models.WatchlistItem.symbol)
        .filter(models.WatchlistItem.user_id == current_user.id)
        .order_by(models.WatchlistItem.created_at.asc())
        .all()
    )
    return [item.symbol for item in items]


@watchlist_router.post("/resolve", response_model=schemas.ResolveSymbolResponse)
def resolve_symbol(
    body: schemas.ResolveSymbolRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
):
    """
    Resolve a ticker or company name to a symbol.
    Returns resolved_symbol if high confidence match, otherwise suggestions.
    """
    return _resolve_query_to_symbol(body.query)


@watchlist_router.post("", response_model=schemas.WatchlistItemResponse, status_code=status.HTTP_201_CREATED)
def add_to_watchlist(
    body: schemas.WatchlistAddRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Add a symbol to the user's watchlist."""
    symbol = body.symbol.upper().strip()

    # Validate symbol
    if not symbol:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Symbol cannot be empty",
        )

    if not is_valid_symbol(symbol):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid symbol: {symbol}",
        )

    # Check for duplicate
    existing = (
        db.query(models.WatchlistItem)
        .filter(
            models.WatchlistItem.user_id == current_user.id,
            models.WatchlistItem.symbol == symbol,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{symbol} is already in your watchlist",
        )

    # Create new watchlist item
    item = models.WatchlistItem(user_id=current_user.id, symbol=symbol)
    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@watchlist_router.delete("/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_watchlist(
    symbol: str,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """Remove a symbol from the user's watchlist."""
    upper_symbol = symbol.upper().strip()

    item = (
        db.query(models.WatchlistItem)
        .filter(
            models.WatchlistItem.user_id == current_user.id,
            models.WatchlistItem.symbol == upper_symbol,
        )
        .first()
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{upper_symbol} not found in your watchlist",
        )

    db.delete(item)
    db.commit()
    return None
