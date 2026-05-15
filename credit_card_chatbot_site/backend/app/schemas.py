from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CardRecord(BaseModel):
    id: str
    bank_name: str = Field(alias="bankName")
    card_name: str = Field(alias="cardName")
    reward_type: str = Field(alias="rewardType")
    reward_rate: float = Field(alias="rewardRate")
    max_reward: float | None = Field(default=None, alias="maxReward")
    min_spend: float = Field(default=0.0, alias="minSpend")
    platforms: list[str]
    categories: list[str]
    description: str = ""
    accent: str | None = None
    active: bool = True

    model_config = {"populate_by_name": True}


class SessionCreateResponse(BaseModel):
    session_id: str
    stage: Literal["platform", "product", "price", "done"]
    assistant_message: str
    next_question: str


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1)


class ClearFieldRequest(BaseModel):
    field: Literal["platform", "product", "price"]


class RecommendationRequest(BaseModel):
    platform: str = Field(min_length=1)
    product: str = Field(min_length=1)
    price: float = Field(gt=0)


class RecommendationCandidate(BaseModel):
    card_id: str
    bank_name: str
    card_name: str
    reward: float
    final_cost: float
    description: str
    reward_type: str
    reward_rate: float
    reward_cap: float | None
    matched_platform: str
    matched_category: str


class RecommendationResult(BaseModel):
    recommended_card: RecommendationCandidate | None
    alternatives: list[RecommendationCandidate]
    assistant_message: str
    gemini_text: str | None = None
    prompt: str | None = None
    normalized_platform: str
    inferred_category: str


class ChatMessageResponse(BaseModel):
    session_id: str
    stage: Literal["platform", "product", "price", "done"]
    assistant_message: str
    next_question: str | None = None
    recommendation: RecommendationResult | None = None
    collected: dict[str, Any]


class GuestPageContext(BaseModel):
    start_endpoint: str
    message_endpoint_template: str
    cards_endpoint: str
