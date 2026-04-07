import os
import subprocess
import sys
import tempfile
import unittest

from fastapi.encoders import jsonable_encoder
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.main import app
from backend.pricing import get_price
from backend import models, routes
from backend.services.auth import hash_password


class PhaseATestCase(unittest.TestCase):
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

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        os.unlink(cls.temp_db.name)

    def setUp(self):
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.TestingSessionLocal()
        self._user = models.User(
            email="test@test.com",
            hashed_password=hash_password("test"),
            is_verified=True,
        )
        self.db.add(self._user)
        self.db.commit()
        self.db.refresh(self._user)

    def tearDown(self):
        self.db.close()

    def test_required_routes_are_registered(self):
        route_paths = {route.path for route in app.routes}
        self.assertIn("/portfolios", route_paths)
        self.assertIn("/portfolios/{portfolio_id}/holdings", route_paths)
        self.assertIn("/portfolios/{portfolio_id}/analytics", route_paths)

    def test_create_and_list_portfolios(self):
        created_model = routes.create_portfolio(
            routes.schemas.PortfolioCreate(name="Main"),
            db=self.db,
            current_user=self._user,
        )
        created = jsonable_encoder(created_model)
        self.assertEqual(created["name"], "Main")
        self.assertEqual(created["holdings"], [])

        portfolios = jsonable_encoder(routes.get_portfolios(db=self.db, current_user=self._user))
        self.assertEqual(len(portfolios), 1)
        self.assertEqual(portfolios[0]["name"], "Main")

    def test_add_holding_updates_weighted_average_without_duplicates(self):
        portfolio = routes.create_portfolio(
            routes.schemas.PortfolioCreate(name="Core"),
            db=self.db,
            current_user=self._user,
        )
        portfolio_id = portfolio.id

        routes.create_holding(
            holding=routes.schemas.HoldingCreate(symbol="AAPL", shares=10, avg_cost=100),
            db=self.db,
            portfolio=portfolio,
        )
        routes.create_holding(
            holding=routes.schemas.HoldingCreate(symbol="AAPL", shares=5, avg_cost=160),
            db=self.db,
            portfolio=portfolio,
        )

        holdings = jsonable_encoder(routes.get_holdings(db=self.db, portfolio=portfolio))
        self.assertEqual(len(holdings), 1)
        self.assertEqual(holdings[0]["symbol"], "AAPL")
        self.assertEqual(holdings[0]["shares"], 15.0)
        self.assertAlmostEqual(holdings[0]["avg_cost"], 120.0)

    def test_missing_portfolio_returns_404_for_holdings_routes(self):
        from backend.dependencies.auth import get_owned_portfolio_or_404

        with self.assertRaises(routes.HTTPException) as err:
            get_owned_portfolio_or_404(
                portfolio_id=999,
                db=self.db,
                current_user=self._user,
            )
        self.assertEqual(err.exception.status_code, 404)

    def test_analytics_returns_valid_totals(self):
        portfolio = routes.create_portfolio(
            routes.schemas.PortfolioCreate(name="Growth"),
            db=self.db,
            current_user=self._user,
        )
        portfolio_id = portfolio.id

        routes.create_holding(
            holding=routes.schemas.HoldingCreate(symbol="AAPL", shares=10, avg_cost=100),
            db=self.db,
            portfolio=portfolio,
        )
        routes.create_holding(
            holding=routes.schemas.HoldingCreate(symbol="MSFT", shares=2, avg_cost=400),
            db=self.db,
            portfolio=portfolio,
        )

        payload = jsonable_encoder(
            routes.get_portfolio_analytics(db=self.db, portfolio=portfolio)
        )
        self.assertEqual(payload["portfolio_id"], portfolio_id)
        self.assertAlmostEqual(payload["total_market_value"], 2675.5)
        self.assertAlmostEqual(payload["total_cost_basis"], 1800.0)
        self.assertAlmostEqual(payload["total_unrealized_pl"], 875.5)
        self.assertAlmostEqual(payload["total_unrealized_pl_pct"], 875.5 / 1800.0)
        self.assertEqual(len(payload["holdings"]), 2)

    def test_analytics_returns_clean_zero_state_for_empty_portfolio(self):
        portfolio = routes.create_portfolio(
            routes.schemas.PortfolioCreate(name="Empty"),
            db=self.db,
            current_user=self._user,
        )
        portfolio_id = portfolio.id

        payload = jsonable_encoder(
            routes.get_portfolio_analytics(db=self.db, portfolio=portfolio)
        )
        self.assertEqual(payload["portfolio_id"], portfolio_id)
        self.assertEqual(payload["holdings"], [])
        self.assertEqual(payload["total_market_value"], 0.0)
        self.assertEqual(payload["total_cost_basis"], 0.0)
        self.assertEqual(payload["total_unrealized_pl"], 0.0)
        self.assertEqual(payload["total_unrealized_pl_pct"], 0.0)

    def test_pricing_stub_is_safe(self):
        self.assertEqual(get_price("AAPL"), 185.50)
        self.assertEqual(get_price("msft"), 410.25)
        self.assertEqual(get_price("unknown"), 100.00)

    def test_main_does_not_reset_database_on_import(self):
        """Verify backend.main does not call reset_database on import (Task 5)."""
        workspace_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        script = """
import os
import sqlite3
import sys

os.chdir(sys.argv[1])
db_path = "stock_portfolio.db"
if os.path.exists(db_path):
    os.remove(db_path)

conn = sqlite3.connect(db_path)
conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)")
conn.execute("INSERT INTO users (id, email) VALUES (1, 'persist@test.com')")
conn.commit()
conn.close()

import backend.main
conn = sqlite3.connect(db_path)
row = conn.execute("SELECT email FROM users WHERE id=1").fetchone()
conn.close()
assert row is not None, "User data was wiped - main may have called reset_database"
assert row[0] == "persist@test.com"
"""
        result = subprocess.run(
            [sys.executable, "-c", script, workspace_path],
            cwd=workspace_path,
            env={**os.environ, "PYTHONPATH": workspace_path},
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
        if os.path.exists(os.path.join(workspace_path, "stock_portfolio.db")):
            os.remove(os.path.join(workspace_path, "stock_portfolio.db"))

    def test_reset_database_recreates_portfolios_with_cash_balance(self):
        workspace_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

        with tempfile.TemporaryDirectory() as temp_dir:
            script = """
import sqlite3

db_path = "stock_portfolio.db"
conn = sqlite3.connect(db_path)
conn.execute(
    "CREATE TABLE portfolios (id INTEGER PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)"
)
conn.commit()
conn.close()

from backend.database import reset_database

reset_database()

conn = sqlite3.connect(db_path)
columns = [row[1] for row in conn.execute("PRAGMA table_info(portfolios)").fetchall()]
conn.close()

assert "cash_balance" in columns, columns
"""
            result = subprocess.run(
                [sys.executable, "-c", script],
                cwd=temp_dir,
                env={**os.environ, "PYTHONPATH": workspace_path},
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)


if __name__ == "__main__":
    unittest.main()
