# StockPortTrack Hardening & UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden security (JWT, rate limiting, audit logging, input validation), add UX improvements (modals, skeletons, error messages, P&L widget), and polish (mobile chart, transaction filters, portfolio rename).

**Architecture:** FastAPI backend + Next.js 14 frontend. Auth uses Bearer JWT stored in localStorage. Existing patterns: inline styles matching dark blue design system, Pydantic schemas, SQLAlchemy models, slowapi for rate limiting.

**Tech Stack:** Python/FastAPI, SQLAlchemy, python-jose, slowapi, Next.js 14, TypeScript, inline CSS.

---

## Current State Notes (read before implementing)

- `backend/services/auth.py`: `SECRET_KEY = "dev-secret-key-change-in-production"` — hardcoded
- `backend/.env`: only has `FINNHUB_API_KEY` — no SECRET_KEY yet
- No `.gitignore` exists at root or backend level
- `requirements.txt`: no `slowapi` entry
- `TradeRequest` schema: has `min_length=1, max_length=10` but **no regex** pattern
- Verification token expiry check **already exists** in `routes/auth.py` — no change needed
- `trading.py`: no logging
- Portfolio page already shows 3 metric cards (total_value, cash_balance, gain_loss) — task 2.4 adds a 4th explicit "Cash Available" card
- `DashboardSnapshot.total_realized_pl` is returned by API but **not displayed** in DashboardHeader
- Suggestions truncation at 30 chars is in `DashboardWatchlist.tsx` line with `s.name.length > 30 ? s.name.slice(0, 30) + "…" : s.name`
- Tests use `VerificationToken` table — `register` currently marks user as `is_verified=True` directly, but tests still create a VerificationToken; check test setup before touching auth routes

---

## PRIORITY 1: SECURITY

### Task 1.1 — JWT Secret via Environment Variable

**Files:**
- Modify: `backend/services/auth.py`
- Modify: `backend/main.py`
- Modify: `backend/.env`
- Create: `backend/.gitignore`

**Step 1: Update `backend/services/auth.py`**

Replace the hardcoded SECRET_KEY line and add None-guard:

```python
import os

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # will become 30 in task 1.2
```

Update `create_access_token` and `decode_access_token` to guard against missing key:

```python
def create_access_token(data: dict) -> str:
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured")
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    if not SECRET_KEY:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
```

**Step 2: Add startup validation in `backend/main.py`**

Add this `@app.on_event("startup")` handler (before the existing one):

```python
@app.on_event("startup")
def validate_secret_key():
    secret = os.getenv("SECRET_KEY")
    if not secret:
        raise RuntimeError("SECRET_KEY environment variable is not set")
    if secret == "dev-secret-key-change-in-production":
        raise RuntimeError("SECRET_KEY must not use the default development value")
```

**Step 3: Add SECRET_KEY to `backend/.env`**

Append (use the generated hex key — regenerate a fresh one):
```
SECRET_KEY=70bf8b1675b1e3c0114fefe04ebd16df4127a0387b2ecd499a62a4a7ce0cd424
```

**Step 4: Create `backend/.gitignore`**

```
.env
*.env
stock_portfolio.db
__pycache__/
*.pyc
*.pyo
```

**Step 5: Run existing tests — must still pass**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v
```

**Step 6: Commit**
```bash
git add backend/services/auth.py backend/main.py backend/.gitignore
# Do NOT add backend/.env
git commit -m "security: load JWT secret from environment variable with startup validation"
```

---

### Task 1.2 — JWT Token Expiry + Refresh Flow

**Files:**
- Modify: `backend/services/auth.py`
- Modify: `backend/routes/auth.py`
- Modify: `frontend/lib/api/client.ts`

**Step 1: Reduce access token to 30 min, add refresh token helpers in `backend/services/auth.py`**

```python
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

def create_refresh_token(data: dict) -> str:
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured")
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_refresh_token(token: str) -> Optional[dict]:
    if not SECRET_KEY:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None
```

**Step 2: Update login response + add refresh endpoint in `backend/routes/auth.py`**

Add imports at top:
```python
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from ..services.auth import create_access_token, create_refresh_token, decode_refresh_token, hash_password, verify_password
from typing import Optional
```

Update login to set httpOnly cookie:
```python
@auth_router.post("/login", response_model=schemas.LoginResponse)
def login(body: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    return schemas.LoginResponse(access_token=access_token)
```

Add refresh endpoint:
```python
@auth_router.post("/refresh", response_model=schemas.LoginResponse)
def refresh_access_token(
    refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    payload = decode_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user_id = payload.get("sub")
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access_token = create_access_token(data={"sub": str(user.id)})
    return schemas.LoginResponse(access_token=access_token)
```

**Step 3: Auto-refresh in `frontend/lib/api/client.ts`**

Replace the `request` function to add 401 refresh logic:

```typescript
let isRefreshing = false;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",  // needed for httpOnly cookie
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  // Attempt token refresh on 401 (once)
  if (res.status === 401 && options.auth && !isRefreshing && path !== "/auth/refresh") {
    isRefreshing = true;
    try {
      const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json() as { access_token: string };
        setToken(data.access_token);
        isRefreshing = false;
        return request<T>(path, options);  // retry with new token
      }
    } catch {
      // refresh failed
    }
    isRefreshing = false;
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }

  let payload: unknown = null;
  try { payload = await res.json(); } catch { payload = null; }
  if (!res.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed: ${res.status}`;
    throw new Error(detail);
  }
  return payload as T;
}
```

Also update the CORSMiddleware in `backend/main.py` — `allow_credentials=True` is already set and `allow_origins=["*"]` needs to change to specific origins for cookies to work in browsers:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Step 4: Run tests**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v
```

**Step 5: Commit**
```bash
git add backend/services/auth.py backend/routes/auth.py backend/main.py frontend/lib/api/client.ts
git commit -m "security: 30-min access tokens with httpOnly refresh token cookie and auto-retry"
```

---

### Task 1.3 — Rate Limiting on Auth and Trade Endpoints

**Files:**
- Modify: `requirements.txt`
- Modify: `backend/main.py`
- Modify: `backend/routes/auth.py`
- Modify: `backend/routes/trades.py`

**Step 1: Add slowapi to `requirements.txt`**

Append:
```
slowapi
```

**Step 2: Install it**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && pip install slowapi
```

**Step 3: Configure Limiter in `backend/main.py`**

Add near the top (after imports):
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
```

After `app = FastAPI(...)`:
```python
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Export `limiter` so routes can import it:
```python
# At module level, after limiter = Limiter(...)
# routes import limiter from backend.main
```

**Step 4: Apply limits in `backend/routes/auth.py`**

Import and apply:
```python
from fastapi import Request
from backend.main import limiter

@auth_router.post("/login", response_model=schemas.LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, body: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    ...

@auth_router.post("/register", response_model=schemas.RegisterResponse)
@limiter.limit("10/minute")
def register(request: Request, body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    ...
```

**Important:** slowapi requires `request: Request` as first positional parameter on rate-limited routes.

**Step 5: Apply limits in `backend/routes/trades.py`**

```python
from fastapi import Request
from backend.main import limiter

@trades_router.post("", response_model=schemas.TradeResponse)
@limiter.limit("30/minute")
def create_trade(
    request: Request,
    body: schemas.TradeRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    ...

@trades_router.post("/preview", response_model=schemas.TradePreviewResponse)
@limiter.limit("30/minute")
def preview_trade(
    request: Request,
    body: schemas.TradePreviewRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    ...
```

**Step 6: Run tests**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v
```

**Step 7: Commit**
```bash
git add requirements.txt backend/main.py backend/routes/auth.py backend/routes/trades.py
git commit -m "security: rate limit auth (10/min) and trade (30/min) endpoints via slowapi"
```

---

### Task 1.4 — Email Verification Token Expiry (VERIFY ONLY)

**File:** `backend/routes/auth.py`

**Step 1: Verify the check is already in place**

Open `backend/routes/auth.py` and confirm the `GET /auth/verify` handler contains:
```python
from datetime import datetime
if vt.expires_at < datetime.utcnow():
    db.delete(vt)
    db.commit()
    raise HTTPException(status_code=400, detail="Token expired")
```

This check IS already present. Also confirm `backend/services/auth.py` has:
```python
VERIFICATION_TOKEN_EXPIRE_HOURS = 24
def verification_token_expires_at() -> datetime:
    return datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)
```

If both are present — no code changes needed. This task is already implemented.

**Step 2: Run tests to confirm**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v
```

---

### Task 1.5 — Trade Audit Logging

**Files:**
- Modify: `backend/services/trading.py`
- Modify: `backend/main.py`

**Step 1: Add logging to `backend/services/trading.py`**

At top of file, after imports:
```python
import logging
logger = logging.getLogger("trading")
```

In `execute_trade()`, after `db.refresh(transaction)` and `db.refresh(user)`:
```python
    logger.info(
        "TRADE user_id=%s portfolio_id=%s symbol=%s side=%s shares=%s price=%s",
        user.id, portfolio.id, symbol_upper, side.value, shares, float(price),
    )
    return transaction
```

**Step 2: Configure logging in `backend/main.py`**

Add at the very top after imports, before `app = FastAPI(...)`:
```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
```

**Step 3: Run tests**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v
```

**Step 4: Commit**
```bash
git add backend/services/trading.py backend/main.py
git commit -m "security: audit log all executed trades with user/portfolio/symbol/price"
```

---

### Task 1.6 — Input Sanitization on Symbol

**Files:**
- Modify: `backend/schemas/trade.py`
- Modify: `backend/services/trading.py`

**Step 1: Add regex to `TradeRequest` and `TradePreviewRequest` in `backend/schemas/trade.py`**

```python
from pydantic import BaseModel, Field
from typing import Optional

class TradeRequest(BaseModel):
    portfolio_id: int
    symbol: str = Field(..., pattern=r"^[A-Z0-9]{1,10}$")
    side: str = Field(..., pattern="^(BUY|SELL)$")
    shares: float = Field(..., gt=0)

class TradePreviewRequest(BaseModel):
    portfolio_id: int
    symbol: str = Field(..., pattern=r"^[A-Z0-9]{1,10}$")
    type: str = Field(..., pattern="^(BUY|SELL)$")
    shares: float = Field(..., gt=0)
```

Note: The symbol arrives already `.upper()`-ed in the routes, but the schema validates the raw input. Since routes do `symbol = body.symbol.upper()` before using it, the schema should actually accept lowercase too and we uppercase in-route. However, the spec says "reject if not alphanumeric 1-10 chars" — use a case-insensitive pattern: `^[A-Za-z0-9]{1,10}$` to avoid breaking lowercase input from clients.

Final schema decision — accept mixed case (routes uppercase it):
```python
symbol: str = Field(..., pattern=r"^[A-Za-z0-9]{1,10}$")
```

**Step 2: Add guard in `execute_trade()` in `backend/services/trading.py`**

At top of `execute_trade()`, after `if shares <= 0`:
```python
    import re
    if not re.match(r"^[A-Z0-9]{1,10}$", symbol.upper()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid symbol: must be 1-10 alphanumeric characters",
        )
```

**Step 3: Run tests**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v
```

**Step 4: Commit**
```bash
git add backend/schemas/trade.py backend/services/trading.py
git commit -m "security: enforce alphanumeric 1-10 char symbol validation in schema and service"
```

---

### Task 1.7 — Ensure .env is Gitignored

**Files:**
- Create: `.gitignore` (project root)

**Step 1: Create `StockPortTrack/.gitignore`**

```gitignore
# Environment
.env
*.env

# Database
stock_portfolio.db
*.db

# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
venv/
.venv/

# Next.js
.next/
out/

# Node
node_modules/

# OS
.DS_Store
```

**Step 2: Verify backend/.gitignore exists** (created in task 1.1)

**Step 3: Confirm `git status` does not show .env**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && git status
```
(If not a git repo yet, init: `git init && git add .gitignore backend/.gitignore && git commit -m "chore: add gitignore"`)

**Step 4: Commit**
```bash
git add .gitignore
git commit -m "chore: add root .gitignore covering .env, db, pycache, next, node_modules"
```

---

## PRIORITY 2: UX IMPROVEMENTS

### Task 2.1 — Trade Confirmation Modal

**Files:**
- Modify: `frontend/components/dashboard/StockTradePanel.tsx`
- Modify: `frontend/components/portfolio/TradePreviewTicket.tsx`

**Step 1: Update `StockTradePanel.tsx`**

Add `showModal` state:
```typescript
const [showModal, setShowModal] = useState(false);
```

In `onSubmit`, after setting `setPreview(res)`, add nothing — preview is set. The modal should appear when `preview && preview.can_execute`.

Replace the inline "Confirm BUY/SELL" button section with:
1. Show `<TradeConfirmModal>` (defined below) when `showModal` is true
2. Change the inline confirm button to `onClick={() => setShowModal(true)}`

Add modal component inline or at top of file:

```typescript
function TradeConfirmModal({
  preview,
  tradeType,
  executing,
  executeError,
  onConfirm,
  onCancel,
}: {
  preview: TradePreviewResponse;
  tradeType: "BUY" | "SELL";
  executing: boolean;
  executeError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(4, 12, 26, 0.85)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "linear-gradient(165deg, rgba(13, 28, 53, 0.98) 0%, rgba(8, 26, 51, 0.99) 100%)",
          border: "1px solid rgba(99, 216, 255, 0.35)",
          borderRadius: 14,
          padding: "1.5rem",
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 0 40px rgba(99, 216, 255, 0.15), 0 8px 32px rgba(0, 0, 0, 0.6)",
        }}
      >
        <div className="stack" style={{ gap: "0.75rem" }}>
          <span style={{ fontSize: "1rem", fontWeight: 700, color: "#9EEBFF" }}>
            Confirm {preview.type}
          </span>
          <PreviewRow label="Symbol" value={preview.symbol} />
          <PreviewRow label="Shares" value={String(preview.shares)} />
          <PreviewRow label="Price" value={`$${preview.price.toFixed(2)}`} />
          <PreviewRow label="Total cost" value={`$${preview.estimated_total_cost.toFixed(2)}`} />
          <PreviewRow label="Cash after" value={`$${preview.estimated_cash_after.toFixed(2)}`} />
          {executeError && (
            <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{executeError}</p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={executing}
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                borderRadius: 8,
                padding: "0.6rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={executing}
              style={{
                flex: 1,
                background: tradeType === "BUY" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: tradeType === "BUY" ? "var(--success)" : "var(--danger)",
                border: `1px solid ${tradeType === "BUY" ? "var(--success)" : "var(--danger)"}`,
                borderRadius: 8,
                padding: "0.6rem",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {executing ? "Executing..." : `Confirm ${tradeType}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

In the render section, replace the existing `preview.can_execute` button with:
```tsx
{preview.can_execute && (
  <button type="button" onClick={() => setShowModal(true)} style={{ marginTop: 4 }}>
    Review Confirmation
  </button>
)}
{showModal && preview.can_execute && (
  <TradeConfirmModal
    preview={preview}
    tradeType={type}
    executing={executing}
    executeError={executeError}
    onConfirm={() => void handleExecute()}
    onCancel={() => setShowModal(false)}
  />
)}
```

Update `handleExecute` to close modal on success:
```typescript
setShowModal(false);
setPreview(null);
```

**Step 2: Apply same pattern to `TradePreviewTicket.tsx`**

Same `showModal` state, same `TradeConfirmModal` component (can be extracted to a shared file later, but inline is fine per YAGNI).

**Step 3: Build check**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build
```

**Step 4: Commit**
```bash
git add frontend/components/dashboard/StockTradePanel.tsx frontend/components/portfolio/TradePreviewTicket.tsx
git commit -m "ux: trade confirmation modal overlay before executing buy/sell"
```

---

### Task 2.2 — Skeleton Loading Screens

**Files:**
- Create: `frontend/components/ui/SkeletonBlock.tsx`
- Modify: `frontend/components/dashboard/DashboardHeader.tsx`
- Modify: `frontend/components/dashboard/DashboardWatchlist.tsx`
- Modify: `frontend/components/dashboard/DashboardTransactions.tsx`

**Step 1: Create `frontend/components/ui/SkeletonBlock.tsx`**

```typescript
"use client";

import type { CSSProperties } from "react";

type Props = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: CSSProperties;
};

export function SkeletonBlock({ width = "100%", height = 16, borderRadius = 6, style }: Props) {
  return (
    <>
      <style>{`
        @keyframes skeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div
        style={{
          width,
          height,
          borderRadius,
          background: "linear-gradient(90deg, rgba(47,174,255,0.08) 25%, rgba(99,216,255,0.15) 50%, rgba(47,174,255,0.08) 75%)",
          backgroundSize: "200% 100%",
          animation: "skeletonShimmer 1.6s ease-in-out infinite",
          ...style,
        }}
      />
    </>
  );
}
```

**Step 2: Update `DashboardHeader.tsx`**

Import:
```typescript
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
```

Replace:
```tsx
{loading && !snapshot ? (
  <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>Loading…</p>
) : ...}
```

With:
```tsx
{loading && !snapshot ? (
  <div className="stack" style={{ gap: "0.4rem" }}>
    <SkeletonBlock height={32} width={180} />
    <SkeletonBlock height={16} width={120} />
  </div>
) : ...}
```

**Step 3: Update `DashboardWatchlist.tsx`**

Find any "Loading…" text (the component receives `loading` prop). Replace:
```tsx
{loading && <p className="muted" style={{ margin: "0.75rem 1rem" }}>Loading…</p>}
```
With:
```tsx
{loading && (
  <div className="stack" style={{ gap: "0.5rem", padding: "0.75rem 1rem" }}>
    <SkeletonBlock height={18} />
    <SkeletonBlock height={18} />
    <SkeletonBlock height={18} width="60%" />
  </div>
)}
```

**Step 4: Update `DashboardTransactions.tsx`**

Replace:
```tsx
{loading && <p className="muted" style={{ margin: "0.5rem 0 0" }}>Loading…</p>}
```
With:
```tsx
{loading && (
  <div className="stack" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
    <SkeletonBlock height={14} />
    <SkeletonBlock height={14} width="80%" />
    <SkeletonBlock height={14} width="90%" />
  </div>
)}
```

**Step 5: Build check**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build
```

**Step 6: Commit**
```bash
git add frontend/components/ui/SkeletonBlock.tsx frontend/components/dashboard/DashboardHeader.tsx frontend/components/dashboard/DashboardWatchlist.tsx frontend/components/dashboard/DashboardTransactions.tsx
git commit -m "ux: shimmer skeleton loading states replacing Loading text in dashboard components"
```

---

### Task 2.3 — Contextual Error Messages

**Files:**
- Modify: `backend/services/trading.py`
- Modify: `frontend/components/dashboard/StockTradePanel.tsx`
- Modify: `frontend/components/portfolio/TradePreviewTicket.tsx`

**Step 1: Verify/update error messages in `backend/services/trading.py`**

Current BUY error:
```python
detail=f"Insufficient cash. Required: ${trade_value:.2f}, Available: ${user.cash_balance:.2f}",
```

Required format:
```python
detail=f"Insufficient cash. Need ${float(trade_value):.2f}, available ${float(user.cash_balance):.2f}",
```

Current SELL error:
```python
detail=f"Insufficient shares. Owned: {current_shares}, Attempted to sell: {shares}",
```

Required format:
```python
detail=f"Insufficient shares. Own {current_shares:.4f}, tried to sell {shares:.4f}",
```

Update both in `execute_trade()`.

**Step 2: Verify frontend surfaces full error detail**

In `StockTradePanel.tsx`, the error catch:
```typescript
setError(err instanceof Error ? err.message : "Preview failed");
setExecuteError(err instanceof Error ? err.message : "Trade failed");
```

The `request()` function already extracts `detail` from the response and sets it as the Error message. This is already correct — no change needed.

Verify the error display elements exist and are styled:
```tsx
{error && <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{error}</p>}
{executeError && <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{executeError}</p>}
```

Same for `TradePreviewTicket.tsx`.

**Step 3: Run tests**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v
```

**Step 4: Commit**
```bash
git add backend/services/trading.py
git commit -m "ux: contextual error messages for insufficient cash/shares in trade execution"
```

---

### Task 2.4 — Portfolio Cash Balance on Detail Page

**File:** `frontend/app/portfolios/[id]/page.tsx`

**Step 1: Check current state**

The page currently shows 3 cards: Total value, Cash balance, Gain/loss. The task asks to add a 4th explicit "Cash Available" card. Since cash_balance is already displayed, add a 4th card showing the same data under the label "Cash Available" to make the grid display 4 items with a more prominent label.

Actually: re-read the task. It says "Add a 4th card: 'Cash Available' showing overview.cash_balance formatted as currency." The current card is labeled "Cash balance". Change that to "Cash Available" OR keep it and add a genuinely new 4th card. Since the task says "4th card", add one.

The existing grid already has 3 cards. Add the 4th after `Gain/loss`:

```tsx
<div className="card stack">
  <span className="metric-label">Cash Available</span>
  <span className="metric-value">
    ${overview.cash_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </span>
</div>
```

**Step 2: Build check**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build
```

**Step 3: Commit**
```bash
git add "frontend/app/portfolios/[id]/page.tsx"
git commit -m "ux: add Cash Available metric card to portfolio detail page"
```

---

### Task 2.5 — Full Company Names in Watchlist Suggestions

**File:** `frontend/components/dashboard/DashboardWatchlist.tsx`

**Step 1: Find the truncation**

Search for: `s.name.length > 30 ? s.name.slice(0, 30) + "…" : s.name`

Replace with CSS-based truncation (no JS truncation):
```tsx
<span
  className="muted"
  style={{
    marginLeft: "0.5rem",
    fontSize: "0.8rem",
    maxWidth: 200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "inline-block",
    verticalAlign: "bottom",
  }}
  title={s.name}
>
  {s.name}
</span>
```

**Step 2: Build check**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build
```

**Step 3: Commit**
```bash
git add frontend/components/dashboard/DashboardWatchlist.tsx
git commit -m "ux: show full company names in watchlist suggestions via CSS ellipsis"
```

---

### Task 2.6 — Realized P&L Dashboard Widget

**Files:**
- Modify: `frontend/components/dashboard/DashboardHeader.tsx`

**Step 1: Verify `total_realized_pl` is in `DashboardSnapshot` type**

In `frontend/lib/api/client.ts`:
```typescript
export type DashboardSnapshot = {
  total_cash: number;
  total_portfolio_value: number;
  total_account_value: number;
  total_unrealized_pl: number;
  total_realized_pl: number;  // ✓ already present
  portfolio_count: number;
};
```

**Step 2: Add realized P&L row in `DashboardHeader.tsx`**

After the existing `dollarChange` row (the `<div className="row">` with `changeColor`), add:

```tsx
{snapshot.total_realized_pl !== undefined && (
  <div
    className="row"
    style={{ gap: 4, alignItems: "baseline", marginTop: 1 }}
  >
    <span
      className="muted"
      style={{ fontSize: "0.78rem" }}
    >
      Realized P&L:
    </span>
    <span
      style={{
        fontSize: "0.82rem",
        fontWeight: 600,
        color:
          snapshot.total_realized_pl > 0
            ? "var(--success)"
            : snapshot.total_realized_pl < 0
            ? "var(--danger)"
            : "var(--muted)",
      }}
    >
      {snapshot.total_realized_pl >= 0 ? "+" : ""}$
      {Math.abs(snapshot.total_realized_pl).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  </div>
)}
```

**Step 3: Build check**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build
```

**Step 4: Commit**
```bash
git add frontend/components/dashboard/DashboardHeader.tsx
git commit -m "ux: display realized P&L in dashboard header below period change"
```

---

## PRIORITY 3: POLISH

### Task 3.1 — Mobile Hero Chart

**File:** `frontend/components/dashboard/DashboardHeroChart.tsx`

**Step 1: Find the SVG element**

Look for `<svg` in the file. Wrap it in a responsive container:

```tsx
<div style={{ width: "100%", overflow: "hidden", minWidth: 0 }}>
  <svg
    viewBox={`0 0 ${VB_W} ${VB_H}`}
    preserveAspectRatio="none"
    style={{ width: "100%", height: "auto", display: "block" }}
    // ... existing props
  >
```

Ensure the SVG uses `viewBox` (it already does based on constants `VB_W=100, VB_H=52`). The key additions are:
- Wrapper div with `overflow: hidden` and `minWidth: 0`
- SVG `style={{ width: "100%", height: "auto", display: "block" }}`
- SVG `preserveAspectRatio="none"` (maintains the chart shape on narrow screens)

**Step 2: Verify PAD values don't clip**

Current: `PAD_L = 0.5, PAD_R = 0.5, PAD_T = 4, PAD_B = 1.5` — these are in viewBox units (0-100 wide, 0-52 tall), so they will not clip when scaling.

**Step 3: Build check**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build
```

**Step 4: Commit**
```bash
git add frontend/components/dashboard/DashboardHeroChart.tsx
git commit -m "polish: wrap hero chart SVG in overflow-hidden container for mobile scaling"
```

---

### Task 3.2 — Transaction Filtering

**File:** `frontend/app/portfolios/[id]/page.tsx`

**Step 1: Add filter state**

In the `PortfolioPage` component, add:
```typescript
const [symbolFilter, setSymbolFilter] = useState("");
const [sideFilter, setSideFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
```

**Step 2: Add filtered transactions memo**

After `transactionsNewestFirst`:
```typescript
const filteredTransactions = useMemo(() => {
  return transactionsNewestFirst.filter((tx) => {
    const matchesSymbol = symbolFilter === "" || tx.symbol.toUpperCase().includes(symbolFilter.toUpperCase());
    const matchesSide = sideFilter === "ALL" || tx.side === sideFilter;
    return matchesSymbol && matchesSide;
  });
}, [transactionsNewestFirst, symbolFilter, sideFilter]);
```

**Step 3: Add filter controls above `<TransactionsTable>`**

```tsx
<div className="card stack">
  <strong style={{ fontSize: "0.95rem" }}>Recent transactions</strong>
  <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
    <input
      type="text"
      placeholder="Filter by symbol"
      value={symbolFilter}
      onChange={(e) => setSymbolFilter(e.target.value)}
      style={{
        flex: 1,
        minWidth: 120,
        padding: "0.45rem 0.75rem",
        background: "rgba(47, 174, 255, 0.06)",
        border: "1px solid rgba(47, 174, 255, 0.2)",
        borderRadius: 6,
        color: "inherit",
        fontSize: "0.85rem",
      }}
    />
    <select
      value={sideFilter}
      onChange={(e) => setSideFilter(e.target.value as "ALL" | "BUY" | "SELL")}
      style={{
        padding: "0.45rem 0.75rem",
        background: "rgba(8, 26, 51, 0.8)",
        border: "1px solid rgba(47, 174, 255, 0.2)",
        borderRadius: 6,
        color: "inherit",
        fontSize: "0.85rem",
      }}
    >
      <option value="ALL">All</option>
      <option value="BUY">BUY</option>
      <option value="SELL">SELL</option>
    </select>
  </div>
  <TransactionsTable rows={filteredTransactions} />
</div>
```

**Step 4: Build check**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build
```

**Step 5: Commit**
```bash
git add "frontend/app/portfolios/[id]/page.tsx"
git commit -m "polish: client-side symbol and type filter on portfolio transactions table"
```

---

### Task 3.3 — Portfolio Rename UI

**File:** `frontend/app/portfolios/[id]/page.tsx`

**Step 1: Add rename state**

```typescript
const [isRenaming, setIsRenaming] = useState(false);
const [renameValue, setRenameValue] = useState("");
const [renameSaving, setRenameSaving] = useState(false);
const [renameError, setRenameError] = useState<string | null>(null);
```

**Step 2: Verify backend PATCH endpoint exists**

Check `backend/routes/portfolios.py` for `PATCH /portfolios/{id}`. If it doesn't exist, add it:

```python
@portfolios_router.patch("/{portfolio_id}", response_model=PortfolioSchema)
def rename_portfolio(
    portfolio_id: int,
    body: RenamePortfolioRequest,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    portfolio = db.query(models.Portfolio).filter(
        models.Portfolio.id == portfolio_id,
        models.Portfolio.user_id == current_user.id,
    ).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    portfolio.name = body.name.strip()
    db.commit()
    db.refresh(portfolio)
    return portfolio
```

Add `RenamePortfolioRequest` schema to `backend/schemas/portfolio.py`:
```python
class RenamePortfolioRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
```

Add `renamePortfolio` to `frontend/lib/api/client.ts`:
```typescript
renamePortfolio: (portfolioId: string, name: string) =>
  request<PortfolioDetail>(`/portfolios/${portfolioId}`, {
    method: "PATCH",
    body: { name },
    auth: true,
  }),
```

**Step 3: Add inline rename UI in `PortfolioPage`**

Replace the static `<h1>Portfolio</h1>` with:

```tsx
<div className="row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
  {isRenaming ? (
    <>
      <input
        autoFocus
        value={renameValue}
        onChange={(e) => setRenameValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleRenameSave();
          if (e.key === "Escape") setIsRenaming(false);
        }}
        style={{
          fontSize: "1.4rem",
          fontWeight: 700,
          padding: "0.2rem 0.5rem",
          background: "rgba(47, 174, 255, 0.08)",
          border: "1px solid rgba(99, 216, 255, 0.4)",
          borderRadius: 6,
          color: "inherit",
          minWidth: 200,
        }}
        disabled={renameSaving}
      />
      <button
        type="button"
        onClick={() => void handleRenameSave()}
        disabled={renameSaving || !renameValue.trim()}
        style={{ fontSize: "0.85rem" }}
      >
        {renameSaving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setIsRenaming(false)}
        style={{ fontSize: "0.85rem", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)" }}
      >
        Cancel
      </button>
      {renameError && <p className="error" style={{ margin: 0, fontSize: "0.85rem" }}>{renameError}</p>}
    </>
  ) : (
    <>
      <h1 style={{ margin: 0 }}>{overview?.name ?? "Portfolio"}</h1>
      <button
        type="button"
        onClick={() => {
          setRenameValue(overview?.name ?? "");
          setRenameError(null);
          setIsRenaming(true);
        }}
        style={{
          fontSize: "0.78rem",
          padding: "0.25rem 0.6rem",
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          borderRadius: 5,
          cursor: "pointer",
        }}
      >
        Rename
      </button>
    </>
  )}
</div>
```

Add `handleRenameSave`:
```typescript
async function handleRenameSave() {
  if (!renameValue.trim()) return;
  setRenameSaving(true);
  setRenameError(null);
  try {
    await api.renamePortfolio(params.id, renameValue.trim());
    setIsRenaming(false);
    await loadPortfolioData();
  } catch (e) {
    setRenameError(e instanceof Error ? e.message : "Failed to rename");
  } finally {
    setRenameSaving(false);
  }
}
```

**Step 4: Build check**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build
```

**Step 5: Run all tests**
```bash
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v
```

**Step 6: Commit**
```bash
git add "frontend/app/portfolios/[id]/page.tsx" frontend/lib/api/client.ts backend/routes/portfolios.py backend/schemas/portfolio.py
git commit -m "polish: inline portfolio rename with PATCH /portfolios/{id}"
```

---

## FINAL CHECKS

```bash
# 1. All backend tests pass
cd /Users/colinhaluska/Desktop/StockPortTrack && python -m pytest tests/ -v

# 2. Frontend builds cleanly
cd /Users/colinhaluska/Desktop/StockPortTrack/frontend && npm run build

# 3. Confirm .env not tracked
cd /Users/colinhaluska/Desktop/StockPortTrack && git status | grep -v "^?" | grep ".env" || echo "✓ .env not tracked"

# 4. Verify startup fails without SECRET_KEY
cd /Users/colinhaluska/Desktop/StockPortTrack/backend && SECRET_KEY="" python -c "
import os; os.environ.pop('SECRET_KEY', None)
from backend.main import app
# startup event won't fire in import, but validate_secret_key() can be called directly
from backend.main import validate_secret_key
try:
    validate_secret_key()
    print('FAIL: should have raised')
except RuntimeError as e:
    print('✓ Startup validation works:', e)
"
```
