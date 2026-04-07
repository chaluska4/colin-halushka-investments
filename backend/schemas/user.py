from datetime import datetime

from pydantic import BaseModel


class UserRead(BaseModel):
    id: int
    email: str
    is_verified: bool
    created_at: datetime
    cash_balance: float

    class Config:
        from_attributes = True


class UserMeResponse(BaseModel):
    id: int
    email: str
    is_verified: bool
    cash_balance: float

    class Config:
        from_attributes = True
