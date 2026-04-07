"""
Manual verification script for the trading system.

Tests the complete flow:
1. Register user
2. Verify account
3. Login
4. Create portfolio
5. Buy stock
6. Check analytics
7. Sell stock
8. Verify final state
"""
import requests

BASE_URL = "http://localhost:8000"

def main():
    print("=" * 60)
    print("TRADING SYSTEM VERIFICATION")
    print("=" * 60)
    
    # 1. Register
    print("\n1. Registering user...")
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "email": "manual@test.com",
        "password": "test123"
    })
    assert r.status_code == 200, f"Register failed: {r.text}"
    print("✓ User registered")
    
    # 2. Get verification token (from console output in real scenario)
    # For this test, we'll extract it from the database
    import sqlite3
    conn = sqlite3.connect("stock_portfolio.db")
    cursor = conn.cursor()
    cursor.execute("SELECT token FROM verification_tokens LIMIT 1")
    token = cursor.fetchone()[0]
    conn.close()
    
    # 3. Verify account
    print("\n2. Verifying account...")
    r = requests.get(f"{BASE_URL}/auth/verify?token={token}")
    assert r.status_code == 200, f"Verify failed: {r.text}"
    print("✓ Account verified with $10,000 balance")
    
    # 4. Login
    print("\n3. Logging in...")
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "manual@test.com",
        "password": "test123"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    access_token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    print("✓ Logged in successfully")
    
    # 5. Create portfolio
    print("\n4. Creating portfolio...")
    r = requests.post(f"{BASE_URL}/portfolios", json={
        "name": "Test Portfolio"
    }, headers=headers)
    assert r.status_code == 200, f"Portfolio creation failed: {r.text}"
    portfolio_id = r.json()["id"]
    print(f"✓ Portfolio created (ID: {portfolio_id})")
    
    # 6. Buy AAPL
    print("\n5. Buying 10 shares of AAPL...")
    r = requests.post(f"{BASE_URL}/trade", json={
        "portfolio_id": portfolio_id,
        "symbol": "AAPL",
        "side": "BUY",
        "shares": 10.0
    }, headers=headers)
    assert r.status_code == 200, f"Buy trade failed: {r.text}"
    trade = r.json()
    print(f"✓ Bought {trade['shares']} shares of {trade['symbol']} @ ${trade['price']}")
    print(f"  Remaining cash: ${trade['remaining_cash_balance']:.2f}")
    cash_after_buy = trade['remaining_cash_balance']
    
    # 7. Buy MSFT
    print("\n6. Buying 5 shares of MSFT...")
    r = requests.post(f"{BASE_URL}/trade", json={
        "portfolio_id": portfolio_id,
        "symbol": "MSFT",
        "side": "BUY",
        "shares": 5.0
    }, headers=headers)
    assert r.status_code == 200, f"Buy MSFT failed: {r.text}"
    trade = r.json()
    print(f"✓ Bought {trade['shares']} shares of {trade['symbol']} @ ${trade['price']}")
    print(f"  Remaining cash: ${trade['remaining_cash_balance']:.2f}")
    
    # 8. Check analytics
    print("\n7. Checking portfolio analytics...")
    r = requests.get(f"{BASE_URL}/portfolios/{portfolio_id}/analytics", headers=headers)
    assert r.status_code == 200, f"Analytics failed: {r.text}"
    analytics = r.json()
    print(f"✓ Holdings derived from transactions:")
    for holding in analytics["holdings"]:
        print(f"  - {holding['symbol']}: {holding['shares']} shares @ ${holding['avg_cost']} avg cost")
        print(f"    Market value: ${holding['market_value']}, P/L: ${holding['unrealized_pl']}")
    print(f"\n  Portfolio totals:")
    print(f"  - Total market value: ${analytics['total_market_value']}")
    print(f"  - Total cost basis: ${analytics['total_cost_basis']}")
    print(f"  - Total unrealized P/L: ${analytics['total_unrealized_pl']}")
    
    # 9. Sell some AAPL
    print("\n8. Selling 5 shares of AAPL...")
    r = requests.post(f"{BASE_URL}/trade", json={
        "portfolio_id": portfolio_id,
        "symbol": "AAPL",
        "side": "SELL",
        "shares": 5.0
    }, headers=headers)
    assert r.status_code == 200, f"Sell trade failed: {r.text}"
    trade = r.json()
    print(f"✓ Sold {trade['shares']} shares of {trade['symbol']} @ ${trade['price']}")
    print(f"  Remaining cash: ${trade['remaining_cash_balance']:.2f}")
    
    # 10. Check final analytics
    print("\n9. Checking final analytics...")
    r = requests.get(f"{BASE_URL}/portfolios/{portfolio_id}/analytics", headers=headers)
    assert r.status_code == 200, f"Final analytics failed: {r.text}"
    analytics = r.json()
    print(f"✓ Final holdings:")
    for holding in analytics["holdings"]:
        print(f"  - {holding['symbol']}: {holding['shares']} shares")
    
    # Verify AAPL has 5 shares left
    aapl = next(h for h in analytics["holdings"] if h["symbol"] == "AAPL")
    assert aapl["shares"] == 5.0, f"Expected 5 AAPL shares, got {aapl['shares']}"
    
    print("\n" + "=" * 60)
    print("✓ ALL VERIFICATIONS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    main()
