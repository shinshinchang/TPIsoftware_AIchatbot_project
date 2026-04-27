from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload

from app.chatbot import router as chatbot_router
from app.database import engine, get_db
from app.models import Base, RewardRule
from app.rule_engine import recommend_best_card
from app.schemas import RecommendRequest, RecommendResponse

app = FastAPI(title="Card Recommender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
app.include_router(chatbot_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/recommend", response_model=RecommendResponse)
def recommend_card(request: RecommendRequest, db: Session = Depends(get_db)):
    rules = db.query(RewardRule).options(joinedload(RewardRule.card)).all()

    results = recommend_best_card(
        amount=request.amount,
        platform=request.platform,
        category=request.category,
        user_card_ids=request.user_card_ids,
        rules=rules,
    )

    if not results:
        mock_result = [
            {
                "card_id": 1,
                "card_name": "玉山 Pi 拍錢包信用卡",
                "bank_name": "玉山銀行",
                "reward": round(request.amount * 0.05, 2),
                "final_cost": round(request.amount * 0.95, 2),
                "description": "此卡在指定電商平台有 5% 回饋",
            }
        ]
        return {
            "amount": request.amount,
            "platform": request.platform,
            "category": request.category,
            "best": mock_result[0],
            "ranking": mock_result,
        }

    return {
        "amount": request.amount,
        "platform": request.platform,
        "category": request.category,
        "best": results[0],
        "ranking": results,
    }
