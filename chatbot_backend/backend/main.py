from pydantic import BaseModel
import traceback
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, UploadFile, File
from database import db
import shutil
import os

from gemini_service import gemini_service


#Khởi tạo
app = FastAPI(
    title="Chatbot API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SCHEMAS
#Schema cho request
class ChatRequest(BaseModel):
    session_id: str
    message: str

#Schema cho response
class ChatResponse(BaseModel):
    session_id: str
    bot_reply: str
    message_count: int
    sources: list = []

class CreateSessionRequest(BaseModel):
    session_id: str
    session_name: str

class RenameSessionRequest(BaseModel):
    session_name: str

class GenerateTitleRequest(BaseModel):
    user_message: str
    bot_reply: str

# ENDPOINTS
@app.get("/")
def root():
    sessions = gemini_service.get_all_sessions()
    return {
        "status": "running",
        "total_sessions": len(sessions)
    }

@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message kh được để trống"
        )

    try:
        result = gemini_service.send_message(
            session_id=request.session_id,
            message=request.message
        )
        response = ChatResponse(
            session_id=request.session_id,
            bot_reply=result["bot_reply"],
            message_count=result["message_count"],
            sources=result.get("sources", [])
        )
        return response

    except Exception as ex:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail= f"Lỗi: {str(ex)}"
        )

@app.get("/history/{session_id}")
def get_history(session_id: str):
    if not gemini_service.session_exists(session_id):
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' kh tồn tại"
        )
    history = gemini_service.get_history(session_id)

    return {
        "session_id": session_id,
        "total_messages": len(history),
        "history": history
    }

@app.get("/sessions")
def list_sessions():
    sessions = gemini_service.get_all_sessions()

    return {
        "total_sessions": len(sessions),
        "sessions": sessions
    }

@app.post("/sessions")
def create_session(request: CreateSessionRequest):
    success = db.create_session(
        session_id=request.session_id,
        session_name=request.session_name
    )
    if success:
        return {
            "message": "Tạo session thành công",
            "session_id": request.session_id
        }
    else:
        raise HTTPException(status_code=409, detail="Session đã tồn tại")

@app.put("/sessions/{session_id}/name")
def rename_session(session_id: str, request: RenameSessionRequest):
    if not db.session_exists(session_id):
        raise HTTPException(status_code=404, detail="Session ko tồn tại")
    db.update_session_name(session_id, request.session_name)
    return {
        "message": "Đã cập nhật tên",
        "session_name": request.session_name
    }

@app.post("/generate-title")
def generate_title(request: GenerateTitleRequest):
    try:
        prompt2 = f"""Tóm tắt chủ đề cuộc trò chuyện sau thành 1 cụm từ ngắn gọn tối đa 5 từ tiếng việt.
                        Chỉ trả về cụm từ đó, không giải thích, không dấu chấm cuối.
                        User hỏi: {request.user_message}
                        Bot trả lời: {request.bot_reply[:200]}
                    """
        response = gemini_service.client.models.generate_content(
            model=gemini_service.model_name,
            contents=prompt2
        )

        title = response.text.strip() if response.text else ''
        if not title:
            title = "Cuộc hội thoại"
        return {"title": title}
        # return {"title": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    success = gemini_service.delete_session(session_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail= f"Session '{session_id}' kh tồn tại"
        )
    remaining = gemini_service.get_all_sessions()

    return {
        "message": f"Đã xóa '{session_id}' thành công",
        "remaining_sessions": len(remaining)
    }

@app.get("/documents")
def list_documents():
    """Lấy danh sách documents"""
    try:
        docs = gemini_service.rag_service.list_documents()

        return {
            "total documents": len(docs),
            "documents": docs
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi: {str(e)}"
        )

@app.post("/documents/upload")
async  def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith(('.pdf', '.txt')):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file PDF hoặc TXT")
    try:
        save_path = os.path.join("documents", file.filename)
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        chunk_count = gemini_service.rag_service.add_document(save_path)

        return {
            "message": f"Upload thành công '{file.filename}'",
            "filename": file.filename,
            "chunk_count": chunk_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi: {str(e)}")

@app.delete("/documents/{filename}")
def delete_document(filename: str):
    """Xóa document khỏi Qdrant"""
    try:
        deleted_count = gemini_service.rag_service.delete_document(filename)
        if deleted_count > 0:
            return {
                'message': f"Đã xóa {deleted_count} chunks của '{filename}'",
                "deleted_chunks": deleted_count
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Kh tìm thấy document '{filename}'"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi: {str(e)}"
        )

@app.get("/documents/stats")
def get_documents_stats():
    """Thống kê collection"""
    try:
        info = gemini_service.rag_service.get_collection_info()
        if info:
            return info
        else:
            raise HTTPException(
                status_code=500,
                detail = "Kh lấy được thông tin"
            )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi: {str(e)}"
        )










