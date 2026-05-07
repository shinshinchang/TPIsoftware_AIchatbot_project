from fastapi import FastAPI

app = FastAPI(title="Credit Card Chatbot API")


@app.get("/health")
def health():
    return {"status": "ok", "service": "chatbot-backend"}


@app.get("/")
def root():
    return {
        "message": "Chatbot backend scaffold is ready.",
        "todo": "Implement AI Q&A flow and card recommendation logic."
    }
