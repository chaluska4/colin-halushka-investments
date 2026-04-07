import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app
from backend import models
from backend.services.auth import hash_password


class TradingTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        cls.temp_db.close()
        cls.engine = create_engine(
            f"sqlite:///{cls.temp_db.name}",
            connect_args={"check_same_thread": False},
        )
        cls.TestingSessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=cls.engine,
        )
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        cls.engine.dispose()
        os.unlink(cls.temp_db.name)

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        
        # Register and verify user
        self.client.post(
            "/auth/register",
            json={"email": "trader@test.com", "password": "secret123"},
        )
        db = self.TestingSessionLocal()
        try:
            vt = db.query(models.VerificationToken).first()
            token = vt.token
        finally:
            db.close()
        self.client.get(f"/auth/verify?token={token}")
        
        # Login
        r = self.client.post(
            "/auth/login",
            json={"email": "trader@test.com", "password": "secret123"},
        )
        self.access_token = r.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.access_token}"}
        
        # Create portfolio
        r = self.client.post(
            "/portfolios",
            json={"name": "Trading Portfolio"},
            headers=self.headers,
        )
        self.portfolio_id = r.json()["id"]

    def test_buy_reduces_cash(self):
        """Test that buying stock reduces user cash balance."""
        # Get initial cash
        db = self.TestingSessionLocal()
        try:
            user = db.query(models.User).filter(models.User.email == "trader@test.com").first()
            initial_cash = float(user.cash_balance)
        finally:
            db.close()
        
        # Buy 10 shares of AAPL at $185.50
        r = self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "AAPL",
                "side": "BUY",
                "shares": 10.0,
            },
            headers=self.headers,
        )
        
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["symbol"], "AAPL")
        self.assertEqual(data["side"], "BUY")
        self.assertEqual(data["shares"], 10.0)
        self.assertEqual(data["price"], 185.50)
        
        expected_cash = initial_cash - (10.0 * 185.50)
        self.assertAlmostEqual(data["remaining_cash_balance"], expected_cash, places=2)

    def test_sell_increases_cash(self):
        """Test that selling stock increases user cash balance."""
        # Buy first
        self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "MSFT",
                "side": "BUY",
                "shares": 5.0,
            },
            headers=self.headers,
        )
        
        db = self.TestingSessionLocal()
        try:
            user = db.query(models.User).filter(models.User.email == "trader@test.com").first()
            cash_after_buy = float(user.cash_balance)
        finally:
            db.close()
        
        # Sell 3 shares
        r = self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "MSFT",
                "side": "SELL",
                "shares": 3.0,
            },
            headers=self.headers,
        )
        
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["side"], "SELL")
        
        expected_cash = cash_after_buy + (3.0 * 410.25)
        self.assertAlmostEqual(data["remaining_cash_balance"], expected_cash, places=2)

    def test_cannot_buy_without_cash(self):
        """Test that buying without sufficient cash returns error."""
        # Try to buy too much (10000 cash, AAPL is $185.50)
        r = self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "AAPL",
                "side": "BUY",
                "shares": 100.0,  # Would cost $18,550
            },
            headers=self.headers,
        )
        
        self.assertEqual(r.status_code, 400)
        self.assertIn("Insufficient cash", r.json()["detail"])

    def test_cannot_sell_more_than_owned(self):
        """Test that selling more shares than owned returns error."""
        # Buy 5 shares
        self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "GOOG",
                "side": "BUY",
                "shares": 5.0,
            },
            headers=self.headers,
        )
        
        # Try to sell 10 shares
        r = self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "GOOG",
                "side": "SELL",
                "shares": 10.0,
            },
            headers=self.headers,
        )
        
        self.assertEqual(r.status_code, 400)
        self.assertIn("Insufficient shares", r.json()["detail"])

    def test_holdings_derived_from_transactions(self):
        """Test that holdings appear in analytics based on transactions."""
        # Buy stocks
        self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "AAPL",
                "side": "BUY",
                "shares": 10.0,
            },
            headers=self.headers,
        )
        
        self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "MSFT",
                "side": "BUY",
                "shares": 5.0,
            },
            headers=self.headers,
        )
        
        # Check analytics
        r = self.client.get(
            f"/portfolios/{self.portfolio_id}/analytics",
            headers=self.headers,
        )
        
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(len(data["holdings"]), 2)
        
        # Check AAPL holding
        aapl = next(h for h in data["holdings"] if h["symbol"] == "AAPL")
        self.assertEqual(aapl["shares"], 10.0)
        self.assertEqual(aapl["avg_cost"], 185.50)
        
        # Check MSFT holding
        msft = next(h for h in data["holdings"] if h["symbol"] == "MSFT")
        self.assertEqual(msft["shares"], 5.0)
        self.assertEqual(msft["avg_cost"], 410.25)

    def test_trade_requires_auth(self):
        """Test that trade endpoint requires authentication."""
        r = self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "AAPL",
                "side": "BUY",
                "shares": 1.0,
            },
        )
        
        self.assertEqual(r.status_code, 401)

    def test_market_data_quote_returns_symbol_price_mode(self):
        r = self.client.get("/market-data/quote/AAPL", headers=self.headers)
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["symbol"], "AAPL")
        self.assertIn("price", data)
        self.assertIn("mode", data)

    def test_trade_with_unsupported_symbol_returns_400(self):
        r = self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "INVALID",
                "side": "BUY",
                "shares": 1.0,
            },
            headers=self.headers,
        )
        self.assertEqual(r.status_code, 400)

    def test_user_cannot_trade_another_users_portfolio(self):
        """Test that users cannot trade in portfolios they don't own."""
        # Create second user
        self.client.post(
            "/auth/register",
            json={"email": "other@test.com", "password": "secret123"},
        )
        db = self.TestingSessionLocal()
        try:
            vt = (
                db.query(models.VerificationToken)
                .filter(models.VerificationToken.user_id != 1)
                .first()
            )
            token = vt.token
        finally:
            db.close()
        self.client.get(f"/auth/verify?token={token}")
        
        r = self.client.post(
            "/auth/login",
            json={"email": "other@test.com", "password": "secret123"},
        )
        other_token = r.json()["access_token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}
        
        # Try to trade in first user's portfolio
        r = self.client.post(
            "/trade",
            json={
                "portfolio_id": self.portfolio_id,
                "symbol": "AAPL",
                "side": "BUY",
                "shares": 1.0,
            },
            headers=other_headers,
        )
        
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
