from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..dependencies.auth import get_current_user
from ..limiter import limiter
from ..services.auth import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/register", response_model=schemas.RegisterResponse)
@limiter.limit("10/minute")
def register(
    request: Request,
    body: schemas.RegisterRequest,
    db: Session = Depends(get_db),
):
    existing = db.query(models.User).filter(models.User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = models.User(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        is_verified=True,
        cash_balance=Decimal("10000.00"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.RegisterResponse(message="Registration successful.")


@auth_router.get("/verify", response_model=schemas.VerifyResponse)
def verify(token: str, db: Session = Depends(get_db)):
    vt = db.query(models.VerificationToken).filter(models.VerificationToken.token == token).first()
    if not vt:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    from datetime import datetime

    if vt.expires_at < datetime.utcnow():
        db.delete(vt)
        db.commit()
        raise HTTPException(status_code=400, detail="Token expired")

    user = db.query(models.User).filter(models.User.id == vt.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.is_verified = True
    user.cash_balance = Decimal("10000.00")
    db.delete(vt)
    db.commit()
    db.refresh(user)

    return schemas.VerifyResponse(message="Account verified. You have been granted $10,000 paper balance.")


@auth_router.post("/login", response_model=schemas.LoginResponse)
@limiter.limit("10/minute")
def login(request: Request, body: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
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


@auth_router.get("/me", response_model=schemas.UserMeResponse)
def get_current_authenticated_user(
    current_user: models.User = Depends(get_current_user),
):
    return current_user
