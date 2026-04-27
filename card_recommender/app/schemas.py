from typing import Any, List, Optional

from pydantic import BaseModel


class RecommendRequest(BaseModel):
    amount: float
    platform: str
    category: str
    user_card_ids: List[int]


class RecommendationItem(BaseModel):
    card_id: int
    bank_name: str
    card_name: str
    reward: float
    final_cost: float
    description: Optional[str] = None


class RecommendResponse(BaseModel):
    amount: float
    platform: str
    category: str
    best: Optional[RecommendationItem] = None
    ranking: List[RecommendationItem]


class ChatResponse(BaseModel):
    answer: str
    debug: Optional[dict[str, Any]] = None
