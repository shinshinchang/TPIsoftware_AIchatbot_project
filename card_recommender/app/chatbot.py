from fastapi import APIRouter

from app.schemas import ChatResponse, RecommendRequest

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat_explain(request: RecommendRequest):
    answer = f"""
這筆消費金額為 {request.amount} 元，
平台是 {request.platform}，
系統判斷屬於 {request.category} 類別。

根據你目前擁有的信用卡，
最推薦使用回饋率最高且符合門檻的卡片。
如果有回饋上限，系統也會自動幫你計算實際可拿到的金額。
""".strip()

    return ChatResponse(
        answer=answer,
        debug={
            "user_card_ids": request.user_card_ids,
        },
    )
