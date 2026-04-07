from sqlalchemy import Column, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from ..database import Base


class Holding(Base):
    __tablename__ = "holdings"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "symbol", name="uix_portfolio_symbol"),
    )

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, nullable=False)
    shares = Column(Float, nullable=False)
    avg_cost = Column(Float, nullable=False)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False, index=True)

    portfolio = relationship("Portfolio", back_populates="holdings")
