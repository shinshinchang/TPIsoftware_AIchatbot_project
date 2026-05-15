from __future__ import annotations

from fastapi import FastAPI, HTTPException
from dotenv import load_dotenv

# Load environment variables from .env (if present)
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse

from .schemas import ChatMessageRequest, RecommendationRequest, SessionCreateResponse
from .services import (
    SESSION_STORE,
    advance_session,
    create_session,
    load_cards,
    next_question_for_stage,
    recommend_once,
    render_guest_page,
)
from .schemas import ClearFieldRequest
from .services import clear_collected_field


app = FastAPI(title="Credit Card Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "chatbot-backend"}


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Credit card chatbot backend is ready.",
        "guest_entry": "/guest",
        "session_start": "/api/sessions",
        "recommendation": "/api/recommend",
    }


@app.post("/api/sessions", response_model=SessionCreateResponse)
def start_session() -> SessionCreateResponse:
    session, assistant_message, next_question = create_session()
    return SessionCreateResponse(
        session_id=session.session_id,
        stage=session.stage,
        assistant_message=assistant_message,
        next_question=next_question,
    )


@app.post("/api/sessions/{session_id}/message")
def send_message(session_id: str, payload: ChatMessageRequest):
    try:
        return advance_session(session_id, payload.message)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="session not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/recommend")
def recommend(payload: RecommendationRequest):
    return recommend_once(payload)


@app.get("/api/cards")
def cards():
    return {"cards": [card.model_dump(by_alias=True) for card in load_cards()]}


@app.get("/guest", response_class=HTMLResponse)
def guest_mode() -> HTMLResponse:
    return HTMLResponse(render_guest_page())


@app.get("/continue-as-guest")
def continue_as_guest() -> RedirectResponse:
    return RedirectResponse(url="/guest", status_code=307)


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    session = SESSION_STORE.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")

    return {
        "session_id": session.session_id,
        "stage": session.stage,
        "next_question": next_question_for_stage(session.stage),
        "collected": {
            "platform": session.platform_raw,
            "platform_normalized": session.platform_normalized,
            "product": session.product,
            "price": session.price,
        },
        "recommendation": session.recommendation,
    }


@app.post("/api/sessions/{session_id}/clear-field")
def clear_field(session_id: str, payload: ClearFieldRequest):
    try:
        return clear_collected_field(session_id, payload.field)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
