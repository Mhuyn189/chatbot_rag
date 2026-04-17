# Chatbot RAG 
Chatbot AI sử dụng RAG (Retrieval-Augmented Generation) để trả lời câu hỏi dựa trên tài liệu có sẵn 

## Tính năng
- Chat đa session: tạo, đổi tên, xóa cuộc hội thoại
- RAG: tìm kiếm thông tin từ tài liệu PDF
- Tự động đặt tên session theo nội dung
- Quản lý tài liệu: upload/xóa PDF qua trang /documents
- Lưu lịch sử chat bằng SQLite

## Công nghệ
- **Backend:** FastAPI, Google Gemini API (gemini-2.5-flash), Qdrant Cloud, sentence-transformers, SQLite
- **Frontend:** Next.js, React, Tailwind CSS

## Cấu trúc thư mục
```
intern/
├── chatbot_backend/
│   └── backend/
│       ├── main.py
│       ├── gemini_service.py
│       ├── rag_service.py
│       ├── database.py
│       ├── requirements.txt
│       └── .env  # Biến môi trường (không commit)

├── chatbot_frontend/
│   └── frontend/
│       ├── app/
│       │   ├── page.js
│       │   └── documents/
│       │       └── page.js
│       └── components/
```      

## Cài đặt

### Yêu cầu
- Python >= 3.10
- Node.js >= 18
- Tài khoản [Google AI Studio] (https://aistudio.google.com/) để lấy Gemini API key
- Tài khoản [Qdrant Cloud](https://cloud.qdrant.io/) để lấy URL và API key

### 1. Clone repository

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

### 2. Cài đặt Backend

```bash
cd chatbot_backend/backend
pip install -r requirements.txt
```

Tạo file `.env` trong thư mục `chatbot_backend/backend/`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
QDRANT_URL=your_qdrant_url_here
QDRANT_API_KEY=your_qdrant_api_key_here
```

Chạy server:

```bash
uvicorn main:app --reload
```

> Backend chạy tại: `http://localhost:8000`

### 3. Cài đặt Frontend

```bash
cd chatbot_frontend/frontend
npm install
npm run dev
```

> Frontend chạy tại: `http://localhost:3000`

## Cách sử dụng

1. Mở trình duyệt vào `http://localhost:3000`
2. Vào trang **Documents** (`/documents`) -> upload file PDF
3. Quay lại trang **Chat** -> đặt câu hỏi liên quan đến tài liệu
4. Chatbot trả lời dựa trên nội dung PDF đã upload
5. Có thể tạo nhiều session chat, đổi tên hoặc xóa tùy ý


## Lưu ý
- Không commit file `.env` lên GitHub — file này chứa API key bí mật
- File `.env` đã được thêm vào `.gitignore`
