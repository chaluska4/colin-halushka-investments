from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend directory
_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")

import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.limiter import limiter

# Ensure local `uvicorn main:app` works from the backend directory.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend import models
from backend.database import engine
from backend.routes import (
    analytics_router,
    auth_router,
    holdings_router,
    news_router,
    portfolios_router,
    trades_router,
    transactions_router,
    watchlist_router,
)

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Stock Market & Portfolio Tracker",
    description="Finance-first market data and portfolio analytics platform",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(portfolios_router)
app.include_router(holdings_router)
app.include_router(analytics_router)
app.include_router(trades_router)
app.include_router(transactions_router)
app.include_router(news_router)
app.include_router(watchlist_router)


@app.on_event("startup")
def validate_frontend_url():
    if not os.getenv("FRONTEND_URL"):
        logging.warning("FRONTEND_URL is not set — defaulting to http://localhost:3000. Set this explicitly in production.")


@app.on_event("startup")
def validate_secret_key():
    secret = os.getenv("SECRET_KEY")
    if not secret:
        raise RuntimeError("SECRET_KEY environment variable is not set")
    if secret == "dev-secret-key-change-in-production":
        raise RuntimeError("SECRET_KEY must not use the default development value")


@app.on_event("startup")
def log_market_data_config():
    from backend.services.market_data import get_provider, FinnhubProvider
    api_key_present = bool(os.getenv("FINNHUB_API_KEY"))
    provider = get_provider()
    provider_name = "FinnhubProvider" if isinstance(provider, FinnhubProvider) else "StubProvider"
    print(f"[Market Data] FINNHUB_API_KEY present: {api_key_present}")
    print(f"[Market Data] Active provider: {provider_name}")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "detail": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "RequestValidationError",
            "detail": exc.errors(),
            "status_code": 422,
        },
    )


@app.get("/")
def health_check():
    return {"status": "ok"}
