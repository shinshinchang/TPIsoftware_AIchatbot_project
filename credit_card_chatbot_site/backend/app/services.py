from __future__ import annotations

import json
import os
import re
import threading
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from .schemas import (
    CardRecord,
    ChatMessageResponse,
    GuestPageContext,
    RecommendationCandidate,
    RecommendationRequest,
    RecommendationResult,
)


BASE_DIR = Path(__file__).resolve().parents[2]
CARDS_PATH = BASE_DIR / "shared" / "cards.json"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)
GEMINI_TEMPERATURE = 0.2
GEMINI_MAX_OUTPUT_TOKENS = 512

PLATFORM_ALIASES: dict[str, str] = {
    "蝦皮": "shopee",
    "shopee": "shopee",
    "蝦皮購物": "shopee",
    "momo": "momo",
    "momo購物": "momo",
    "pchome": "pchome",
    "pchome線上購物": "pchome",
    "外送": "ubereats",
    "ubereats": "ubereats",
    "foodpanda": "ubereats",
    "網購": "online",
    "線上": "online",
    "online": "online",
    "一般": "general",
    "通用": "general",
}

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "food": ("外送", "餐", "飲料", "午餐", "晚餐", "宵夜", "food", "吃", "ubereats", "foodpanda"),
    "travel": ("旅遊", "旅行", "機票", "飯店", "住宿", "出國", "旅館"),
    "online": ("網購", "線上", "電商", "蝦皮", "momo", "pchome", "購物", "商城", "下單"),
    "general": tuple(),
}

GUIDED_QUESTIONS: dict[str, str] = {
    "platform": "請輸入販售平台（例如：蝦皮）",
    "product": "請輸入商品名稱或描述（文字）",
    "price": "請輸入價格（數字）",
}


@dataclass
class ConversationSession:
    session_id: str
    stage: str = "platform"
    platform_raw: str | None = None
    platform_normalized: str | None = None
    product: str | None = None
    price: float | None = None
    recommendation: RecommendationResult | None = None


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, ConversationSession] = {}
        self._lock = threading.Lock()

    def create(self) -> ConversationSession:
        session = ConversationSession(session_id=str(uuid.uuid4()))
        with self._lock:
            self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> ConversationSession | None:
        with self._lock:
            return self._sessions.get(session_id)


SESSION_STORE = SessionStore()


def next_question_for_stage(stage: str) -> str:
    return GUIDED_QUESTIONS.get(stage, "已完成條件蒐集，正在整理最適合的信用卡。")


def normalize_platform(text: str) -> str:
    cleaned = text.strip().lower()
    if cleaned in PLATFORM_ALIASES:
        return PLATFORM_ALIASES[cleaned]

    for key, value in PLATFORM_ALIASES.items():
        if key in cleaned:
            return value

    return "general"


def infer_category(platform: str, product: str) -> str:
    normalized_platform = normalize_platform(platform)
    if normalized_platform == "ubereats":
        return "food"
    if normalized_platform in {"shopee", "momo", "pchome", "online"}:
        return "online"

    lowered = product.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if category == "general":
            continue
        if any(keyword.lower() in lowered for keyword in keywords):
            return category

    return "general"


def parse_price(message: str) -> float | None:
    cleaned = message.replace(",", "").strip()
    match = re.search(r"\d+(?:\.\d+)?", cleaned)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


@lru_cache(maxsize=1)
def load_cards() -> list[CardRecord]:
    raw_cards = json.loads(CARDS_PATH.read_text(encoding="utf-8"))
    return [CardRecord.model_validate(card) for card in raw_cards]


def platform_matches(card_platforms: list[str], platform: str) -> tuple[bool, str]:
    candidates = [platform, "general"]
    for candidate in candidates:
        if candidate in card_platforms:
            return True, candidate
    if platform == "online" and "general" in card_platforms:
        return True, "general"
    return False, ""


def category_matches(card_categories: list[str], category: str) -> tuple[bool, str]:
    candidates = [category, "general"]
    for candidate in candidates:
        if candidate in card_categories:
            return True, candidate
    return False, ""


def calculate_reward(amount: float, card: CardRecord) -> float:
    if amount < card.min_spend:
        return 0.0

    reward = amount * card.reward_rate
    if card.max_reward is not None:
        reward = min(reward, card.max_reward)
    return round(reward, 2)


def rank_cards(amount: float, platform: str, product: str) -> list[RecommendationCandidate]:
    category = infer_category(platform, product)
    normalized_platform = normalize_platform(platform)
    cards = load_cards()
    ranked: list[RecommendationCandidate] = []

    for card in cards:
        if not card.active:
            continue

        platform_ok, matched_platform = platform_matches(card.platforms, normalized_platform)
        category_ok, matched_category = category_matches(card.categories, category)

        if not platform_ok or not category_ok:
            continue

        reward = calculate_reward(amount, card)
        ranked.append(
            RecommendationCandidate(
                card_id=card.id,
                bank_name=card.bank_name,
                card_name=card.card_name,
                reward=reward,
                final_cost=round(amount - reward, 2),
                description=card.description,
                reward_type=card.reward_type,
                reward_rate=card.reward_rate,
                reward_cap=card.max_reward,
                matched_platform=matched_platform or normalized_platform,
                matched_category=matched_category or category,
            )
        )

    ranked.sort(key=lambda item: (item.reward, -item.final_cost), reverse=True)
    return ranked


def build_prompt(
    platform: str,
    product: str,
    price: float,
    recommendations: list[RecommendationCandidate],
) -> str:
    cards_summary = [candidate.model_dump() for candidate in recommendations]
    payload = {
        "user_input": {
            "platform": platform,
            "product": product,
            "price": price,
            "normalized_platform": normalize_platform(platform),
            "inferred_category": infer_category(platform, product),
        },
        "candidate_cards": cards_summary,
    }

    return (
        "你是信用卡推薦助手。請根據使用者的購買平台、商品、價格，以及候選卡片資料，"
        "用繁體中文輸出最終推薦。"
        "請遵守："
        "1. 先說明最推薦哪一張卡。"
        "2. 再說明原因，包含回饋率、可能回饋金額、門檻或上限。"
        "3. 若有次佳選項，簡短列出 1-2 張。"
        "4. 不要捏造卡片庫沒有的資訊。"
        "以下是 JSON 資料：\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def call_gemini(prompt: str) -> str | None:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    api_key = api_key.strip()

    model = os.getenv("GEMINI_MODEL", GEMINI_MODEL)
    base_url = os.getenv(
        "GEMINI_BASE_URL",
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    )

    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": float(os.getenv("GEMINI_TEMPERATURE", str(GEMINI_TEMPERATURE))),
            "maxOutputTokens": int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", str(GEMINI_MAX_OUTPUT_TOKENS))),
        },
    }

    request = urllib.request.Request(
        f"{base_url}?key={api_key}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None

    candidates = payload.get("candidates", [])
    if not candidates:
        return None

    parts = candidates[0].get("content", {}).get("parts", [])
    texts = [part.get("text", "") for part in parts if part.get("text")]
    text = "\n".join(texts).strip()
    return text or None


def compose_assistant_message(
    recommendations: list[RecommendationCandidate],
    gemini_text: str | None,
) -> str:
    if recommendations:
        best = recommendations[0]
        fallback_lines = [
            f"最推薦：{best.bank_name} {best.card_name}",
            f"估計回饋：NT${best.reward:.2f}",
            f"結帳後約：NT${best.final_cost:.2f}",
            f"原因：{best.description or '這張卡在目前條件下回饋最高。'}",
        ]
        if len(recommendations) > 1:
            others = "；".join(
                f"{candidate.bank_name} {candidate.card_name}（回饋 NT${candidate.reward:.2f}）"
                for candidate in recommendations[1:3]
            )
            fallback_lines.append("")  # blank line for spacing
            fallback_lines.append(f"次佳選項：{others}")
    else:
        fallback_lines = ["目前卡片庫中沒有完全符合的專屬方案，已改用通用卡做備援推薦。"]

    fallback_text = "\n".join(fallback_lines)
    if gemini_text:
        # Clean up Gemini text formatting
        cleaned_gemini_text = gemini_text.strip()
        # Remove numbered list markers (e.g., "1. ", "2. ")
        cleaned_gemini_text = re.sub(r"^\d+\.\s*\*?\*?", "", cleaned_gemini_text, flags=re.MULTILINE)
        # Remove markdown bold (**text**)
        cleaned_gemini_text = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned_gemini_text)
        # Remove remaining asterisks and clean excess spaces
        cleaned_gemini_text = re.sub(r"\*+", "", cleaned_gemini_text)
        cleaned_gemini_text = re.sub(r"[ \t]+", " ", cleaned_gemini_text)
        # Normalize multiple newlines to double newlines
        cleaned_gemini_text = re.sub(r"\n{3,}", "\n\n", cleaned_gemini_text)
        # Remove leading/trailing whitespace on each line
        cleaned_gemini_text = "\n".join(line.strip() for line in cleaned_gemini_text.split("\n"))
        return f"{cleaned_gemini_text}\n\n{fallback_text}"
    return fallback_text


def build_recommendation(platform: str, product: str, price: float) -> RecommendationResult:
    ranked = rank_cards(price, platform, product)
    prompt = build_prompt(platform, product, price, ranked)
    gemini_text = call_gemini(prompt)
    assistant_message = compose_assistant_message(ranked, gemini_text)

    category = infer_category(platform, product)
    normalized_platform = normalize_platform(platform)

    return RecommendationResult(
        recommended_card=ranked[0] if ranked else None,
        alternatives=ranked[1:],
        assistant_message=assistant_message,
        gemini_text=gemini_text,
        prompt=prompt,
        normalized_platform=normalized_platform,
        inferred_category=category,
    )


def format_collected(session: ConversationSession) -> dict[str, Any]:
    return {
        "platform": session.platform_raw,
        "platform_normalized": session.platform_normalized,
        "product": session.product,
        "price": session.price,
    }


def advance_session(session_id: str, message: str) -> ChatMessageResponse:
    session = SESSION_STORE.get(session_id)
    if session is None:
        raise KeyError(session_id)

    cleaned = message.strip()
    if not cleaned:
        raise ValueError("message cannot be empty")

    if session.stage == "platform":
        session.platform_raw = cleaned
        session.platform_normalized = normalize_platform(cleaned)
        session.stage = "product"
        return ChatMessageResponse(
            session_id=session.session_id,
            stage="product",
            assistant_message=f"已記錄販售平台：{session.platform_raw}",
            next_question=next_question_for_stage("product"),
            recommendation=None,
            collected=format_collected(session),
        )

    if session.stage == "product":
        session.product = cleaned
        session.stage = "price"
        return ChatMessageResponse(
            session_id=session.session_id,
            stage="price",
            assistant_message=f"已記錄商品：{session.product}",
            next_question=next_question_for_stage("price"),
            recommendation=None,
            collected=format_collected(session),
        )

    if session.stage == "price":
        price = parse_price(cleaned)
        if price is None:
            return ChatMessageResponse(
                session_id=session.session_id,
                stage="price",
                assistant_message="價格需要是數字，請再輸入一次。",
                next_question=next_question_for_stage("price"),
                recommendation=None,
                collected=format_collected(session),
            )

        session.price = price
        session.stage = "done"
        recommendation = build_recommendation(
            session.platform_raw or "",
            session.product or "",
            session.price,
        )
        session.recommendation = recommendation
        # Return a short assistant message here; the full recommendation
        # is included in the `recommendation` field so the frontend can
        # render it once (avoid duplicate display).
        return ChatMessageResponse(
            session_id=session.session_id,
            stage="done",
            assistant_message="已為您整理出推薦結果，請參考下方：",
            next_question=None,
            recommendation=recommendation,
            collected=format_collected(session),
        )

    recommendation = session.recommendation
    return ChatMessageResponse(
        session_id=session.session_id,
        stage="done",
        assistant_message=recommendation.assistant_message if recommendation else "此會話已完成。",
        next_question=None,
        recommendation=recommendation,
        collected=format_collected(session),
    )


def create_session() -> tuple[ConversationSession, str, str]:
    session = SESSION_STORE.create()
    assistant_message = "歡迎使用信用卡推薦助理，請先輸入販售平台。"
    next_question = next_question_for_stage(session.stage)
    return session, assistant_message, next_question


def clear_collected_field(session_id: str, field: str) -> ChatMessageResponse:
    session = SESSION_STORE.get(session_id)
    if session is None:
        raise KeyError(session_id)

    if field not in {"platform", "product", "price"}:
        raise ValueError("invalid field")

    # Clear the requested field and set the session stage to collect it again
    if field == "platform":
        session.platform_raw = None
        session.platform_normalized = None
    elif field == "product":
        session.product = None
    else:
        session.price = None

    session.stage = field
    return ChatMessageResponse(
        session_id=session.session_id,
        stage=session.stage,
        assistant_message=f"已刪除 {field} 的資料，請重新輸入。",
        next_question=next_question_for_stage(session.stage),
        recommendation=None,
        collected=format_collected(session),
    )


def recommend_once(request: RecommendationRequest) -> RecommendationResult:
    return build_recommendation(request.platform, request.product, request.price)


def guest_page_context() -> GuestPageContext:
    return GuestPageContext(
        start_endpoint="/api/sessions",
        message_endpoint_template="/api/sessions/{session_id}/message",
        cards_endpoint="/api/cards",
    )


def render_guest_page() -> str:
    context = guest_page_context().model_dump()
    template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Cashback Assistant</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'main': '#c0d6eb',
                        'sub': '#ffffff',
                    }
                }
            }
        }
    </script>
    <style>
        .page { display: none; }
        .page.active { display: flex; }
        .theme-transition { transition: all 0.4s ease-in-out; }
        .btn-hover:active { transform: scale(0.98); }
    </style>
</head>
<body id="mainBody" class="min-h-screen flex flex-col font-sans theme-transition bg-sub">

    <div class="fixed top-4 right-4 z-50 flex gap-2 bg-white p-3 rounded-xl shadow-2xl border border-gray-100">
        <div class="flex flex-col">
            <label class="text-[10px] font-bold text-gray-400 mb-1">PRIMARY</label>
            <select id="primarySelect" class="text-sm p-1 border rounded bg-gray-50 outline-none text-black" onchange="updateTheme()">
                <option value="#c0d6eb">Blue</option>
                <option value="#d0ded8">Green</option>
                <option value="#facaca">Pink</option>
                <option value="#ffe269">Yellow</option>
                <option value="#d8dde0">Gray</option>
            </select>
        </div>
        <div class="flex flex-col">
            <label class="text-[10px] font-bold text-gray-400 mb-1">SECONDARY</label>
            <select id="secondarySelect" class="text-sm p-1 border rounded bg-gray-50 outline-none text-black" onchange="updateTheme()">
                <option value="#ffffff">White</option>
                <option value="#000000">Black</option>
            </select>
        </div>
    </div>

    <div class="flex-1 flex items-center justify-center p-6">
        <div id="authCard" class="w-full max-w-md theme-transition rounded-[3rem] shadow-2xl overflow-hidden border-4 border-main bg-sub">

            <div id="welcomePage" class="page active flex-col p-12 text-center content-area">
                <h1 class="text-3xl font-bold text-main mb-4">AI Cashback Assistant</h1>
                <p class="text-lg-10 mb-12">Find the best card reward for every purchase</p>

                <div class="flex flex-col gap-4">
                    <button onclick="showPage('loginPage')" class="w-full bg-main text-gray-800 font-bold py-4 rounded-2xl btn-hover shadow-lg">Log in</button>
                    <button onclick="showPage('registerPage')" class="w-full bg-main text-gray-800 font-bold py-4 rounded-2xl btn-hover shadow-lg">Sign up</button>
                    <button onclick="startGuestFlow()" class="mt-8 text-gray-400 hover:underline">continue as Guest</button>
                </div>
            </div>

            <div id="registerPage" class="page flex-col p-12 content-area">
                <h2 class="text-3xl font-bold mb-8">Create an account</h2>
                <div class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium mb-2">Email</label>
                        <input type="email" class="custom-input w-full px-5 py-3 border-2 border-gray-100 rounded-xl outline-none focus:border-main" placeholder="email@example.com">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Password</label>
                        <input type="password" class="custom-input w-full px-5 py-3 border-2 border-gray-100 rounded-xl outline-none focus:border-main" placeholder="****************">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Confirm Password</label>
                        <input type="password" class="custom-input w-full px-5 py-3 border-2 border-gray-100 rounded-xl outline-none focus:border-main" placeholder="****************">
                    </div>
                    <button onclick="showPage('statusPage')" class="w-full bg-main text-gray-800 font-bold py-4 rounded-2xl shadow-lg mt-4">Create an account</button>
                    <div class="text-center pt-4">
                        <p class="text-sm text-gray-400 mb-2">Already have an account?</p>
                        <button onclick="showPage('loginPage')" class="text-main font-bold border-b-2 border-main">Login</button>
                    </div>
                </div>
            </div>

            <div id="loginPage" class="page flex-col p-12 content-area">
                <h2 class="text-3xl font-bold mb-8">Login</h2>
                <div class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium mb-2">Email</label>
                        <input type="email" class="custom-input w-full px-5 py-3 border-2 border-gray-100 rounded-xl outline-none focus:border-main" placeholder="email@example.com">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Password</label>
                        <input type="password" class="custom-input w-full px-5 py-3 border-2 border-gray-100 rounded-xl outline-none focus:border-main" placeholder="****************">
                    </div>
                    <button onclick="showPage('statusPage')" class="w-full bg-main text-gray-800 font-bold py-4 rounded-2xl shadow-lg">Login</button>
                    <button class="w-full text-sm text-gray-400 hover:text-main text-left">Forgot Password?</button>
                    <p class="text-sm pt-4">Don't have an account? <button onclick="showPage('registerPage')" class="text-main font-bold">Sign up</button></p>
                </div>
            </div>

            <div id="statusPage" class="page flex-col p-12 text-center content-area">
                <div class="mb-12">
                    <h2 class="text-2xl font-bold mb-8">Login success</h2>
                    <p class="text-xl">Has credit card?</p>
                </div>
                <div class="flex justify-center gap-6">
                    <button onclick="showPage('chatbotPage'); startGuestFlow();" class="px-10 py-3 bg-main text-gray-800 font-bold rounded-xl shadow-md border-2 border-transparent hover:border-gray-400 transition-all">Yes</button>
                    <span class="text-2xl self-center">/</span>
                    <button onclick="showPage('addCardPage')" class="px-10 py-3 bg-main text-gray-800 font-bold rounded-xl shadow-md border-2 border-transparent hover:border-gray-400 transition-all">No</button>
                </div>
            </div>

            <div id="addCardPage" class="page flex-col p-10 content-area">
              <h2 class="text-2xl font-bold mb-6">Add your Credit card</h2>

              <div class="space-y-4 mb-8">
                  <div>
                      <label class="block text-xs font-bold text-gray-400 mb-1">- Bank</label>
                      <select class="custom-input w-full px-4 py-2 border-2 border-gray-100 rounded-xl outline-none focus:border-main text-black">
                          <option disabled selected>select bank</option>
                          <option>Cathay Bank</option>
                          <option>E.SUN Bank</option>
                      </select>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-gray-400 mb-1">- Card Name</label>
                    <select class="custom-input w-full px-4 py-2 border-2 border-gray-100 rounded-xl outline-none focus:border-main text-black">
                        <option disabled selected>select card</option>
                        <option>Cube Card</option>
                        <option>U Bear Card</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-bold text-gray-400 mb-1">- Reward Plan</label>
                    <select class="custom-input w-full px-4 py-2 border-2 border-gray-100 rounded-xl outline-none focus:border-main text-black">
                        <option disabled selected>select plan</option>
                        <option>Travel Plan</option>
                        <option>Shopping Plan</option>
                    </select>
                </div>

                <button class="w-full bg-main text-gray-800 font-bold py-2 rounded-xl shadow-md btn-hover mt-2">Add card</button>
              </div>

              <div class="border-t-2 border-gray-100 pt-6">
                <h3 class="text-lg font-bold mb-3 text-main">Your Card</h3>
                <ul class="space-y-3 mb-6 text-sm">
                  <li class="card-item flex justify-between items-center p-3 rounded-lg border-2 border-gray-100 theme-transition">
                      <span>Cathay Cube Card [Travel Plan]</span>
                      <div class="flex gap-2">
                          <button class="text-xs text-red-400 font-bold">[Remove]</button>
                          <button class="text-xs text-gray-400 font-bold">[Edit]</button>
                      </div>
                  </li>
                </ul>
                <button onclick="showPage('chatbotPage'); startGuestFlow();" class="w-full border-2 border-main text-main font-bold py-3 rounded-xl btn-hover">continue to Chatbot</button>
              </div>
            </div>

            <div id="chatbotPage" class="page flex-col h-[500px] content-area">
              <div class="bg-main p-4 text-center theme-transition">
                  <h2 class="text-sm font-bold text-gray-800">AI Cashback Assistant</h2>
              </div>

              <div id="chatMessages" class="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
                  <div class="flex flex-col items-start">
                      <div class="bg-gray-100 rounded-2xl p-3 max-w-[80%] card-item">
                          <p id="chatPrompt">請輸入販售平台（例如：蝦皮）</p>
                      </div>
                  </div>
              </div>

              <div class="p-4 border-t border-gray-100 bg-sub theme-transition">
                  <div class="flex gap-2">
                      <input id="chatInput" type="text" class="custom-input flex-1 px-4 py-2 border-2 border-gray-100 rounded-xl outline-none focus:border-main" placeholder="先輸入販售平台，例如蝦皮">
                      <button onclick="sendChat()" class="bg-main text-gray-800 px-4 py-2 rounded-xl font-bold btn-hover shadow-md">Send</button>
                  </div>
              </div>
          </div>

        </div>
    </div>

    <script>
        const CONFIG = __CONTEXT__;
        let sessionId = null;
        let chatStarted = false;

        function showPage(pageId) {
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
        }

        function updateTheme() {
            const primary = document.getElementById('primarySelect').value;
            const secondary = document.getElementById('secondarySelect').value;
            const isDark = secondary === "#000000";

            document.getElementById('mainBody').style.backgroundColor = secondary;
            document.getElementById('authCard').style.backgroundColor = secondary;

            document.querySelectorAll('.bg-main').forEach(el => el.style.backgroundColor = primary);
            document.querySelectorAll('.border-main').forEach(el => el.style.borderColor = primary);
            document.querySelectorAll('.text-main').forEach(el => el.style.color = primary);

            const contentAreas = document.querySelectorAll('.content-area');
            const inputs = document.querySelectorAll('.custom-input');

            if (isDark) {
              contentAreas.forEach(area => area.style.color = "#ffffff");
              inputs.forEach(input => {
                  input.style.backgroundColor = "#1a1a1a";
                  input.style.color = "#ffffff";
                  input.style.borderColor = "#333333";
              });

              document.querySelectorAll('.card-item').forEach(item => {
                  item.style.backgroundColor = "#1a1a1a";
                  item.style.color = "#ffffff";
                  item.style.borderColor = "#333333";
              });
            } else {
              contentAreas.forEach(area => area.style.color = "#1f2937");
              inputs.forEach(input => {
                  input.style.backgroundColor = "#ffffff";
                  input.style.color = "#000000";
                  input.style.borderColor = "#f3f4f6";
              });

              document.querySelectorAll('.card-item').forEach(item => {
                  item.style.backgroundColor = "#f9fafb";
                  item.style.color = "#1f2937";
                  item.style.borderColor = "#f3f4f6";
              });
            }
        }

        function appendChatMessage(text, isUser = false) {
            const chatMessages = document.getElementById('chatMessages');
            const wrapper = document.createElement('div');
            wrapper.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'}`;

            const bubble = document.createElement('div');
            bubble.className = `${isUser ? 'bg-main' : 'bg-gray-100'} rounded-2xl p-3 max-w-[80%] card-item`;

            const p = document.createElement('p');
            p.textContent = text;
            bubble.appendChild(p);
            wrapper.appendChild(bubble);
            chatMessages.appendChild(wrapper);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        async function startGuestFlow() {
            showPage('chatbotPage');
            if (chatStarted) {
                return;
            }
            const response = await fetch(CONFIG.start_endpoint, { method: 'POST' });
            const data = await response.json();
            sessionId = data.session_id;
            chatStarted = true;

            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';
            appendChatMessage(data.assistant_message, false);
            appendChatMessage(data.next_question, false);
            document.getElementById('chatPrompt').textContent = data.next_question;
            document.getElementById('chatInput').placeholder = data.next_question;
            updateTheme();
        }

        async function sendChat() {
            const input = document.getElementById('chatInput');
            const message = input.value.trim();
            if (!message || !sessionId) {
                return;
            }

            appendChatMessage(message, true);
            input.value = '';

            const response = await fetch(CONFIG.message_endpoint_template.replace('{session_id}', sessionId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            appendChatMessage(data.assistant_message, false);

            if (data.next_question) {
                appendChatMessage(data.next_question, false);
                document.getElementById('chatPrompt').textContent = data.next_question;
                input.placeholder = data.next_question;
            }

            if (data.recommendation && data.recommendation.assistant_message) {
                appendChatMessage(data.recommendation.assistant_message, false);
            }

            updateTheme();
        }

        updateTheme();
    </script>
</body>
</html>"""
    return (
        template.replace("__CONTEXT__", json.dumps(context, ensure_ascii=False))
        .replace("__START_ENDPOINT__", context["start_endpoint"])
        .replace("__MESSAGE_ENDPOINT_TEMPLATE__", context["message_endpoint_template"])
        .replace("__CARDS_ENDPOINT__", context["cards_endpoint"])
    )
