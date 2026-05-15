# Backend (Chatbot API)

這裡只放網站版 Chatbot 的後端，不和 Chrome 插件共用程式碼。

## 目前狀態
- 已實作三步驟對話流程：販售平台 -> 商品 -> 價格
- 已從 `../shared/cards.json` 讀取卡片資料
- 已加入 Gemini 呼叫空位，透過環境變數設定 API
- 已提供 guest 入口 `/guest`，不需要修改前端檔案

## 環境變數
- `GEMINI_API_KEY`：Gemini API Key
- `GEMINI_MODEL`：模型名稱，預設 `gemini-2.5-flash`
- `GEMINI_BASE_URL`：Gemini API URL，預設官方 generateContent endpoint
- `GEMINI_TEMPERATURE`：生成溫度，預設 `0.2`
- `GEMINI_MAX_OUTPUT_TOKENS`：輸出長度上限，預設 `512`

如果你想直接把 API 寫進程式，請改 `app/services.py` 最上方的這幾個常數：
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_BASE_URL`

## 主要 API
- `POST /api/sessions`：建立 guest 對話，回傳第一個問題
- `POST /api/sessions/{session_id}/message`：依序回答平台、商品、價格
- `POST /api/recommend`：一次帶入三個欄位直接推薦
- `GET /api/cards`：查看卡片庫
- `GET /guest`：backend 提供的 guest 聊天頁面

## 啟動
在 `credit_card_chatbot_site/backend/` 目錄執行：

```powershell
uvicorn app.main:app --reload --port 8000
```

然後打開：`http://127.0.0.1:8000/guest`

## 前端怎麼看
這個網站版聊天頁目前由後端直接提供，不用另外啟動前端專案。只要後端跑起來，開 `/guest` 就能用。
