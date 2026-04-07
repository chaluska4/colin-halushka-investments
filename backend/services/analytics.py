from decimal import Decimal, ROUND_HALF_UP
from typing import List


MONEY_PLACES = Decimal("0.01")


def _to_decimal(value) -> Decimal:
    return Decimal(str(value))


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def compute_portfolio_analytics(holdings, prices: dict):
    holdings_data = []
    total_market_value = Decimal("0")
    total_cost_basis = Decimal("0")

    for holding in holdings:
        symbol = holding.symbol.upper()
        shares = _to_decimal(holding.shares)
        avg_cost = _to_decimal(holding.avg_cost)
        price = _to_decimal(prices.get(symbol, 0))

        market_value = shares * price
        cost_basis = shares * avg_cost
        unrealized_pl = market_value - cost_basis
        unrealized_pl_pct = (
            unrealized_pl / cost_basis if cost_basis != 0 else Decimal("0")
        )

        holdings_data.append(
            {
                "symbol": symbol,
                "shares": shares,
                "avg_cost": _money(avg_cost),
                "price": _money(price),
                "market_value": _money(market_value),
                "cost_basis": _money(cost_basis),
                "unrealized_pl": _money(unrealized_pl),
                "unrealized_pl_pct": unrealized_pl_pct,
            }
        )

        total_market_value += market_value
        total_cost_basis += cost_basis

    for holding in holdings_data:
        market_value = _to_decimal(holding["market_value"])
        holding["weight_pct"] = (
            market_value / total_market_value if total_market_value != 0 else Decimal("0")
        )

    total_unrealized_pl = total_market_value - total_cost_basis
    total_unrealized_pl_pct = (
        total_unrealized_pl / total_cost_basis if total_cost_basis != 0 else Decimal("0")
    )

    return {
        "total_market_value": _money(total_market_value),
        "total_cost_basis": _money(total_cost_basis),
        "total_unrealized_pl": _money(total_unrealized_pl),
        "total_unrealized_pl_pct": total_unrealized_pl_pct,
        "holdings": holdings_data,
    }


def derive_holdings_from_transactions(transactions):
    """
    Derive holdings from transaction history.
    
    For each symbol:
    - Compute net shares (BUY adds, SELL subtracts)
    - Track cost basis: BUY adds shares*price; SELL reduces basis by shares*sold_at_avg_cost
    
    Returns list of holdings with shares > 0.
    """
    holdings = {}

    for tx in transactions:
        symbol = tx.symbol.upper()
        shares = _to_decimal(tx.shares)
        price = _to_decimal(tx.price)

        if symbol not in holdings:
            holdings[symbol] = {
                "symbol": symbol,
                "shares": Decimal("0"),
                "total_cost": Decimal("0"),
            }

        # Handle BUY and SELL using TradeSide enum
        if hasattr(tx, 'side'):
            # New transaction model with side enum
            from ..models import TradeSide
            if tx.side == TradeSide.BUY:
                holdings[symbol]["shares"] += shares
                holdings[symbol]["total_cost"] += shares * price
            elif tx.side == TradeSide.SELL:
                sb = holdings[symbol]["shares"]
                if sb > 0:
                    avg = holdings[symbol]["total_cost"] / sb
                    holdings[symbol]["total_cost"] -= shares * avg
                holdings[symbol]["shares"] -= shares
        else:
            # Legacy transaction_type string field
            if tx.transaction_type == "BUY":
                holdings[symbol]["shares"] += shares
                holdings[symbol]["total_cost"] += shares * price
            elif tx.transaction_type == "SELL":
                sb = holdings[symbol]["shares"]
                if sb > 0:
                    avg = holdings[symbol]["total_cost"] / sb
                    holdings[symbol]["total_cost"] -= shares * avg
                holdings[symbol]["shares"] -= shares

    # Compute avg_cost and filter out zero/negative shares
    result = []
    for symbol, data in holdings.items():
        if data["shares"] > 0:
            avg_cost = data["total_cost"] / data["shares"] if data["shares"] > 0 else Decimal("0")
            result.append(
                {
                    "symbol": symbol,
                    "shares": data["shares"],
                    "avg_cost": avg_cost,
                }
            )
    
    return result


def compute_portfolio_analytics_from_transactions(transactions, get_price_func):
    """
    Compute portfolio analytics by deriving holdings from transactions.
    
    Args:
        transactions: List of Transaction model objects
        get_price_func: Function to get current price for a symbol
    
    Returns:
        Dict with total_market_value, total_cost_basis, total_unrealized_pl,
        total_unrealized_pl_pct, and holdings list
    """
    # Derive holdings from transactions
    derived_holdings = derive_holdings_from_transactions(transactions)
    
    if not derived_holdings:
        return {
            "total_market_value": Decimal("0"),
            "total_cost_basis": Decimal("0"),
            "total_unrealized_pl": Decimal("0"),
            "total_unrealized_pl_pct": Decimal("0"),
            "holdings": [],
        }
    
    # Build prices dict
    prices = {h["symbol"]: get_price_func(h["symbol"]) for h in derived_holdings}
    
    # Use existing compute logic with derived holdings as dict objects
    holdings_data = []
    total_market_value = Decimal("0")
    total_cost_basis = Decimal("0")

    for holding in derived_holdings:
        symbol = holding["symbol"]
        shares = _to_decimal(holding["shares"])
        avg_cost = _to_decimal(holding["avg_cost"])
        price = _to_decimal(prices.get(symbol, 0))

        market_value = shares * price
        cost_basis = shares * avg_cost
        unrealized_pl = market_value - cost_basis
        unrealized_pl_pct = (
            unrealized_pl / cost_basis if cost_basis != 0 else Decimal("0")
        )

        holdings_data.append(
            {
                "symbol": symbol,
                "shares": shares,
                "avg_cost": _money(avg_cost),
                "price": _money(price),
                "market_value": _money(market_value),
                "cost_basis": _money(cost_basis),
                "unrealized_pl": _money(unrealized_pl),
                "unrealized_pl_pct": unrealized_pl_pct,
            }
        )

        total_market_value += market_value
        total_cost_basis += cost_basis

    # Compute weight percentages
    for holding in holdings_data:
        market_value = _to_decimal(holding["market_value"])
        holding["weight_pct"] = (
            market_value / total_market_value if total_market_value != 0 else Decimal("0")
        )

    total_unrealized_pl = total_market_value - total_cost_basis
    total_unrealized_pl_pct = (
        total_unrealized_pl / total_cost_basis if total_cost_basis != 0 else Decimal("0")
    )

    return {
        "total_market_value": _money(total_market_value),
        "total_cost_basis": _money(total_cost_basis),
        "total_unrealized_pl": _money(total_unrealized_pl),
        "total_unrealized_pl_pct": total_unrealized_pl_pct,
        "holdings": holdings_data,
    }


def calculate_realized_pl(transactions) -> float:
    """
    Calculate realized profit/loss for a single symbol using average-cost method.
    
    Args:
        transactions: List of transactions for a single symbol, sorted oldest to newest
    
    Returns:
        Float realized profit/loss (0.0 if no SELL transactions)
    """
    from ..models import TradeSide
    
    avg_cost = Decimal("0")
    total_shares = Decimal("0")
    realized_pl = Decimal("0")
    
    for tx in transactions:
        shares = _to_decimal(tx.shares)
        price = _to_decimal(tx.price)
        
        # Determine side
        if hasattr(tx, 'side'):
            side = tx.side
        else:
            side = TradeSide.BUY if tx.transaction_type == "BUY" else TradeSide.SELL
        
        if side == TradeSide.BUY:
            # Update average cost
            if total_shares > 0:
                avg_cost = ((total_shares * avg_cost) + (shares * price)) / (total_shares + shares)
            else:
                avg_cost = price
            total_shares += shares
        elif side == TradeSide.SELL:
            # Realized P/L = (sale price - average cost basis) * shares sold (not net of full proceeds vs 0)
            if total_shares > 0:
                realized_pl += (price - avg_cost) * shares
            total_shares -= shares
    
    return float(realized_pl)


def compute_equity_curve_from_transactions(
    transactions,
    initial_cash_balance: float,
    get_price_func,
) -> List[dict]:
    cash = Decimal(str(initial_cash_balance))
    positions: dict[str, Decimal] = {}
    points: List[dict] = []

    for tx in transactions:
        symbol = tx.symbol.upper()
        shares = _to_decimal(tx.shares)
        price = _to_decimal(tx.price)
        side = tx.side.value if hasattr(tx.side, "value") else str(tx.side)

        if side == "BUY":
            cash -= shares * price
            positions[symbol] = positions.get(symbol, Decimal("0")) + shares
        elif side == "SELL":
            cash += shares * price
            positions[symbol] = positions.get(symbol, Decimal("0")) - shares

        holdings_value = Decimal("0")
        for held_symbol, held_shares in positions.items():
            if held_shares > 0:
                holdings_value += held_shares * _to_decimal(get_price_func(held_symbol))

        points.append(
            {
                "timestamp": tx.timestamp,
                "portfolio_value": float(_money(cash + holdings_value)),
            }
        )

    return points
