# colin-halushka-investments
Full-stack paper trading platform built with Next.js and FastAPI. Simulates real-world investing with live market data, secure JWT authentication, and a ledger-based trading system. Features portfolio analytics, transaction tracking, and a custom frontend UI.
# Colin Haluska Investments — Paper Trading Platform

## Overview
This platform allows users to create accounts, execute simulated trades, and track portfolio performance in real time — without risking capital.

Built to demonstrate end-to-end engineering across backend systems, frontend architecture, financial modeling, and application security.

---

## Core Features

- Secure user authentication (JWT + refresh token flow)
- Paper trading engine (buy/sell equities with real-time pricing)
- Portfolio analytics (realized + unrealized P&L)
- Transaction ledger (append-only, audit-friendly design)
- Watchlist + market data integration (Finnhub API)
- Dashboard with performance visualization
- Paginated transaction history
- Error-resilient UI (React error boundaries)

---

## Tech Stack

**Frontend**
- Next.js 14 (App Router)
- TypeScript
- Custom design system (no component libraries)
- SVG-based charts + canvas animations

**Backend**
- FastAPI (Python, ASGI async framework)
- REST API architecture

**Database**
- SQLite (via SQLAlchemy ORM)

---

## Architecture Highlights

### Ledger-Based Trading System
Instead of storing positions directly, all trades are recorded as immutable transactions. Portfolio holdings are derived dynamically using aggregation logic, mirroring real brokerage systems.

### Authentication & Security
- JWT access tokens (short-lived)
- Refresh tokens stored in httpOnly cookies
- Full OWASP Top 10 considerations applied:
  - Input validation
  - Access control enforcement
  - Rate limiting
  - Secure secret management via environment variables

### Market Data Integration
- Finnhub API for real-time quotes
- Fallback stub provider for development without API key exposure
- Batched quote fetching for efficiency

### Performance Considerations
- Pagination on transaction endpoints
- Indexed database queries (portfolio_id, timestamp, user_id)
- Frontend caching strategies for read-heavy endpoints
- Error boundaries to isolate UI failures

---

## Key Engineering Decisions

**SQLite over PostgreSQL**
Chosen for simplicity and zero infrastructure overhead during development. The architecture is fully portable to PostgreSQL with minimal changes.

**FastAPI**
Selected for async I/O performance and built-in validation via Pydantic, reducing runtime errors in financial calculations.

**Custom Frontend System**
No third-party UI libraries used — all components built from scratch to demonstrate understanding of rendering, layout, and performance.

---

## Author

Colin Haluska  
  
