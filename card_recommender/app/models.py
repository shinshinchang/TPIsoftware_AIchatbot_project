from sqlalchemy import JSON, Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id = Column(Integer, primary_key=True)
    bank_name = Column(String, nullable=False)
    card_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    reward_rules = relationship("RewardRule", back_populates="card")


class RewardRule(Base):
    __tablename__ = "reward_rules"

    id = Column(Integer, primary_key=True)
    card_id = Column(Integer, ForeignKey("credit_cards.id"), nullable=False)

    platform = Column(String, nullable=False)  # shopee, momo, pchome, general
    category = Column(String, nullable=False)  # online, food, travel, general
    reward_type = Column(String, nullable=False)  # cashback, points, discount
    reward_rate = Column(Float, nullable=False)  # 0.05 = 5%
    max_reward = Column(Float)  # reward cap
    min_spend = Column(Float, default=0)  # minimum spend threshold

    description = Column(String)
    extra_conditions = Column(JSON().with_variant(JSONB, "postgresql"))

    card = relationship("CreditCard", back_populates="reward_rules")
