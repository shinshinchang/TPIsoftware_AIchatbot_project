from app.database import SessionLocal, engine
from app.models import Base, CreditCard, RewardRule


def seed_data():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(CreditCard).count() > 0:
            print("Seed skipped: data already exists.")
            return
        # Create a wider variety of demo cards
        cards = [
            CreditCard(bank_name="玉山銀行", card_name="玉山 Pi 拍錢包信用卡", is_active=True),
            CreditCard(bank_name="台新銀行", card_name="台新玫瑰卡", is_active=True),
            CreditCard(bank_name="國泰世華", card_name="CUBE 卡", is_active=True),
            CreditCard(bank_name="中信銀行", card_name="中信 Line Pay 卡", is_active=True),
            CreditCard(bank_name="永豐銀行", card_name="永豐大戶卡", is_active=True),
            CreditCard(bank_name="花旗銀行", card_name="花旗現金回饋卡", is_active=True),
            CreditCard(bank_name="台灣大哥大", card_name="台灣大聯名卡", is_active=True),
            CreditCard(bank_name="台灣銀行", card_name="台銀一般卡", is_active=True),
            CreditCard(bank_name="渣打銀行", card_name="渣打現金回饋卡", is_active=True),
            CreditCard(bank_name="王道銀行", card_name="王道旅遊卡", is_active=True),
        ]

        db.add_all(cards)
        db.flush()

        # Reward rules: map cards to platforms/categories with varied caps and min spend
        rules = [
            # Shopee-focused cards
            RewardRule(
                card_id=cards[0].id,
                platform="shopee",
                category="online",
                reward_type="cashback",
                reward_rate=0.05,
                max_reward=300,
                min_spend=100,
                description="蝦皮指定消費 5% 回饋（上限 300，低消 100）",
                extra_conditions={"new_user_only": False},
            ),
            RewardRule(
                card_id=cards[3].id,
                platform="shopee",
                category="online",
                reward_type="cashback",
                reward_rate=0.06,
                max_reward=250,
                min_spend=200,
                description="中信 Line Pay 蝦皮 6% 回饋（需綁定 LINE Pay）",
                extra_conditions={"requires_wallet": "LINE Pay"},
            ),

            # momo-focused
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
                card_id=cards[5].id,
                platform="momo",
                category="online",
                reward_type="points",
                reward_rate=0.06,
                max_reward=500,
                min_spend=500,
                description="花旗 momo 聯名點數 6%（高額低消）",
                extra_conditions={"points_ratio": "1:1"},
            ),

            # PChome
            RewardRule(
                card_id=cards[2].id,
                platform="pchome",
                category="online",
                reward_type="cashback",
                reward_rate=0.03,
                max_reward=None,
                min_spend=0,
                description="PChome 一般 3% 回饋",
                extra_conditions={},
            ),

            # UberEats / food
            RewardRule(
                card_id=cards[4].id,
                platform="ubereats",
                category="food",
                reward_type="cashback",
                reward_rate=0.08,
                max_reward=150,
                min_spend=0,
                description="永豐 大戶外送 8% 回饋（限指定通路）",
                extra_conditions={"channel": "delivery"},
            ),
            RewardRule(
                card_id=cards[8].id,
                platform="ubereats",
                category="food",
                reward_type="cashback",
                reward_rate=0.05,
                max_reward=100,
                min_spend=0,
                description="渣打外送 5% 回饋",
                extra_conditions={},
            ),

            # Books / reading
            RewardRule(
                card_id=cards[6].id,
                platform="books",
                category="books",
                reward_type="cashback",
                reward_rate=0.07,
                max_reward=200,
                min_spend=100,
                description="聯名卡 書籍 7% 回饋",
                extra_conditions={},
            ),

            # General catch-all rules
            RewardRule(
                card_id=cards[7].id,
                platform="general",
                category="general",
                reward_type="cashback",
                reward_rate=0.02,
                max_reward=None,
                min_spend=0,
                description="台銀 一般消費 2% 回饋",
                extra_conditions={"channel": "all"},
            ),
            RewardRule(
                card_id=cards[2].id,
                platform="general",
                category="general",
                reward_type="cashback",
                reward_rate=0.015,
                max_reward=None,
                min_spend=0,
                description="CUBE 卡 一般 1.5% 回饋",
                extra_conditions={},
            ),

            # Electronics category
            RewardRule(
                card_id=cards[0].id,
                platform="general",
                category="electronics",
                reward_type="cashback",
                reward_rate=0.04,
                max_reward=500,
                min_spend=1000,
                description="大型 3C 購物 4% 回饋 (玉山)",
                extra_conditions={"merchant_category": "electronics"},
            ),

            # Travel / tourism
            RewardRule(
                card_id=cards[9].id,
                platform="general",
                category="travel",
                reward_type="points",
                reward_rate=0.03,
                max_reward=None,
                min_spend=0,
                description="王道旅遊卡 3% 旅遊點數",
                extra_conditions={"travel_related": True},
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
