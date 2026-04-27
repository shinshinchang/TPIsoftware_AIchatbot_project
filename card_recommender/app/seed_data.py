from app.database import SessionLocal, engine
from app.models import Base, CreditCard, RewardRule


def seed_data():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(CreditCard).count() > 0:
            print("Seed skipped: data already exists.")
            return

        cards = [
            CreditCard(bank_name="玉山銀行", card_name="玉山 Pi 拍錢包信用卡", is_active=True),
            CreditCard(bank_name="台新銀行", card_name="台新玫瑰卡", is_active=True),
            CreditCard(bank_name="國泰世華", card_name="CUBE 卡", is_active=True),
        ]
        db.add_all(cards)
        db.flush()

        rules = [
            RewardRule(
                card_id=cards[0].id,
                platform="shopee",
                category="online",
                reward_type="cashback",
                reward_rate=0.05,
                max_reward=300,
                min_spend=100,
                description="蝦皮指定消費 5% 回饋",
                extra_conditions={"day_limit": None, "new_user_only": False},
            ),
            RewardRule(
                card_id=cards[1].id,
                platform="momo",
                category="online",
                reward_type="cashback",
                reward_rate=0.04,
                max_reward=200,
                min_spend=0,
                description="momo 消費 4% 回饋",
                extra_conditions={"new_user_only": False},
            ),
            RewardRule(
                card_id=cards[2].id,
                platform="general",
                category="general",
                reward_type="cashback",
                reward_rate=0.02,
                max_reward=None,
                min_spend=0,
                description="一般消費 2% 回饋",
                extra_conditions={"channel": "all"},
            ),
        ]

        db.add_all(rules)
        db.commit()
        print("Seed completed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
