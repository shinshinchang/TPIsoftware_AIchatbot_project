# TPIsoftware_AIchatbot_project

## Card Recommender Backend (FastAPI)

Project path: `card_recommender/`

### 1) Install dependencies

```bash
pip install -r card_recommender/requirements.txt
```

### 2) Start PostgreSQL + Redis

```bash
cd card_recommender
docker compose up -d
```

### 3) Seed demo data

```bash
python -m app.seed_data
```

### 4) Run API

```bash
uvicorn app.main:app --reload
```

Server: `http://localhost:8000`

### 5) Test recommend API

`POST /recommend`

```json
{
	"amount": 3000,
	"platform": "shopee",
	"category": "online",
	"user_card_ids": [1, 2, 3]
}
```

### 6) Test chat API

`POST /chat`

```json
{
	"amount": 3000,
	"platform": "shopee",
	"category": "online",
	"user_card_ids": [1, 2, 3]
}
```

## Chrome Extension MVP

Extension path: `chrome_extension/`

Includes:
- React + Tailwind popup UI
- Manifest V3 background worker
- content script floating recommendation widget
- local mock card library and recommendation rules

### Build

```bash
cd chrome_extension
npm install
npm run build
```

### Load unpacked

Open Chrome `chrome://extensions`, enable Developer Mode, and load the `chrome_extension/dist` folder.

### Test pages

- `https://shopee.tw/*`
- `https://www.momoshop.com.tw/*`
- `https://24h.pchome.com.tw/*`
- `https://www.ubereats.com/*`
- `https://www.books.com.tw/*`
- `http://127.0.0.1:5500/*`
- local files if Chrome has file access enabled
