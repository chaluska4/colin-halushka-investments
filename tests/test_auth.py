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


class AuthTestCase(unittest.TestCase):
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

    def test_register_returns_success(self):
        r = self.client.post(
            "/auth/register",
            json={"email": "user@example.com", "password": "secret123"},
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("Verification email sent", r.json().get("message", ""))

    def test_register_duplicate_email_returns_400(self):
        self.client.post(
            "/auth/register",
            json={"email": "dup@example.com", "password": "secret123"},
        )
        r = self.client.post(
            "/auth/register",
            json={"email": "dup@example.com", "password": "other"},
        )
        self.assertEqual(r.status_code, 400)

    def test_verify_grants_balance_and_success(self):
        r = self.client.post(
            "/auth/register",
            json={"email": "verify@example.com", "password": "secret123"},
        )
        self.assertEqual(r.status_code, 200)
        db = self.TestingSessionLocal()
        try:
            vt = db.query(models.VerificationToken).first()
            self.assertIsNotNone(vt)
            token = vt.token
        finally:
            db.close()

        r = self.client.get(f"/auth/verify?token={token}")
        self.assertEqual(r.status_code, 200)
        self.assertIn("10,000", r.json().get("message", ""))

        db = self.TestingSessionLocal()
        try:
            user = db.query(models.User).filter(models.User.email == "verify@example.com").first()
            self.assertTrue(user.is_verified)
            self.assertEqual(float(user.cash_balance), 10000.0)
        finally:
            db.close()

    def test_verify_invalid_token_returns_400(self):
        r = self.client.get("/auth/verify?token=invalid-token-12345")
        self.assertEqual(r.status_code, 400)

    def test_login_after_verify_returns_token(self):
        self.client.post(
            "/auth/register",
            json={"email": "login@example.com", "password": "secret123"},
        )
        db = self.TestingSessionLocal()
        try:
            vt = db.query(models.VerificationToken).first()
            token = vt.token
        finally:
            db.close()
        self.client.get(f"/auth/verify?token={token}")

        r = self.client.post(
            "/auth/login",
            json={"email": "login@example.com", "password": "secret123"},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("access_token", data)
        self.assertEqual(data.get("token_type"), "bearer")

    def test_login_before_verify_returns_403(self):
        self.client.post(
            "/auth/register",
            json={"email": "unverified@example.com", "password": "secret123"},
        )
        r = self.client.post(
            "/auth/login",
            json={"email": "unverified@example.com", "password": "secret123"},
        )
        self.assertEqual(r.status_code, 403)

    def test_protected_routes_require_token(self):
        r = self.client.get("/portfolios")
        self.assertEqual(r.status_code, 401)

        r = self.client.post("/portfolios", json={"name": "Test"})
        self.assertEqual(r.status_code, 401)

    def test_authenticated_user_can_create_and_list_portfolios(self):
        self.client.post(
            "/auth/register",
            json={"email": "owner@example.com", "password": "secret123"},
        )
        db = self.TestingSessionLocal()
        try:
            vt = db.query(models.VerificationToken).first()
            token = vt.token
        finally:
            db.close()
        self.client.get(f"/auth/verify?token={token}")

        r = self.client.post(
            "/auth/login",
            json={"email": "owner@example.com", "password": "secret123"},
        )
        access_token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        r = self.client.post("/portfolios", json={"name": "My Portfolio"}, headers=headers)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["name"], "My Portfolio")

        r = self.client.get("/portfolios", headers=headers)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 1)

    def test_user_cannot_access_another_users_portfolio(self):
        self.client.post(
            "/auth/register",
            json={"email": "alice@example.com", "password": "secret123"},
        )
        db = self.TestingSessionLocal()
        try:
            vt = db.query(models.VerificationToken).first()
            token_a = vt.token
        finally:
            db.close()
        self.client.get(f"/auth/verify?token={token_a}")

        r = self.client.post(
            "/auth/login",
            json={"email": "alice@example.com", "password": "secret123"},
        )
        alice_token = r.json()["access_token"]
        alice_headers = {"Authorization": f"Bearer {alice_token}"}

        r = self.client.post(
            "/portfolios", json={"name": "Alice Portfolio"}, headers=alice_headers
        )
        self.assertEqual(r.status_code, 200)
        portfolio_id = r.json()["id"]

        self.client.post(
            "/auth/register",
            json={"email": "bob@example.com", "password": "secret123"},
        )
        db = self.TestingSessionLocal()
        try:
            bob = db.query(models.User).filter(models.User.email == "bob@example.com").first()
            vt = db.query(models.VerificationToken).filter(
                models.VerificationToken.user_id == bob.id
            ).first()
            token_b = vt.token
        finally:
            db.close()
        self.client.get(f"/auth/verify?token={token_b}")

        r = self.client.post(
            "/auth/login",
            json={"email": "bob@example.com", "password": "secret123"},
        )
        bob_token = r.json()["access_token"]
        bob_headers = {"Authorization": f"Bearer {bob_token}"}

        r = self.client.get(
            f"/portfolios/{portfolio_id}/holdings", headers=bob_headers
        )
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
