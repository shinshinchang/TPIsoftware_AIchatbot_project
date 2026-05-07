# Credit Card Recommender Chatbot Site

這個資料夾是獨立網站專案（前後端分離），和 Chrome 插件分開開發。

## 目標
- 做出「信用卡推薦 Chatbot」網站
- 串接 AI 問答
- 依問題與卡片清單回覆建議

## 邊界
- 只共用同一份信用卡清單：`shared/cards.json`
- 不要修改 `chrome_extension/` 任何檔案

## 結構
- `frontend/`: 網站前端（UI）
- `backend/`: API 與 AI 串接
- `shared/`: 前後端共用資料（卡片清單）

## 建議共編方式
- 同學只在這個資料夾內工作
- 開新分支，例如：`feature/chatbot-site`
- PR 僅包含 `credit_card_chatbot_site/` 變更
