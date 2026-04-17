from google import genai
import os
from dotenv import load_dotenv
from rag_service import RAGService
from database import db

load_dotenv()

#Quản lý việc gọi Gemini API và chat sessions
class GeminiService:
    def __init__(self):
        #Cấu hình API key
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY không được tìm thấy trong biến môi trường")
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash"


        #Khởi tạo Rag service
        self.rag_service = RAGService()

    #Lấy history của 1 session. Nếu chưa có thì tạo mới
    def get_history(self, session_id: str):
        if not db.session_exists(session_id):
            # Tạo session mới nếu chưa có
            existing_count = len(db.get_all_sessions())
            session_name = f"Cuộc hội thoại {existing_count + 1}"
            db.create_session(session_id, session_name)

        return db.get_messages(session_id)

    #Chuyển history thành prompt dạng text
    def build_prompt(self, history: list) -> str:
        prompt1 = ""
        for msg in history:
            prompt1 += f"{msg['role']}: {msg['content']}\n"
        return prompt1

    #Tạo context từ RAG
    def build_rag_context(self, user_message: str) -> tuple:
        try:
            #Tìm kiếm top 3 tài liệu liên quan nhất
            relevant_docs = self.rag_service.search(user_message, limit=3)
            filtered_docs = [doc for doc in relevant_docs if doc['score'] > 0.6]
            if not filtered_docs:
                return "", []

            #Xây dựng context
            context_parts = []
            sources = []

            for i, doc in enumerate(filtered_docs, 1):
                context_parts.append(f"[Nguồn {i}: {doc['source']}]\n{doc['text']}")
                sources.append(doc['source'])
            context_text = "\n\n".join(context_parts)
            return context_text, sources
        except Exception as e:
            print(f"Rag search error: {e}")
            return "", []

    #Gửi request của user đến Gemini và response
    def send_message(self, session_id: str, message: str) -> dict:
        history = self.get_history(session_id)

        # Tìm kiếm context từ RAG
        rag_context, sources = self.build_rag_context(message)

        # Nếu không tìm được context, thử search lại bằng tin nhắn trước
        if not rag_context and len(history) > 1:
            prev_user_msgs = [m["content"] for m in history[:-1] if m["role"] == "user"]
            if prev_user_msgs:
                combined_query = prev_user_msgs[-1] + " " + message
                rag_context, sources = self.build_rag_context(combined_query)

        # Nếu có context từ RAG, thêm vào message
        if rag_context:
            history_text = ""
            if len(history) > 1:
                recent_history = history[:-1][-10:]  # chỉ lấy 10 tin nhắn gần nhất
                history_text = "\nLỊCH SỬ HỘI THOẠI TRƯỚC:\n"
                for msg in recent_history:
                    role_label = "Người dùng" if msg["role"] == "user" else "Trợ lý"
                    history_text += f"{role_label}: {msg['content']}\n"
                history_text += "\n"
            enhanced_message = f"""Bạn là trợ lý AI.
                                    {history_text}
                                    NGUYÊN TẮC TRẢ LỜI:
                                    1. Chỉ sử dụng thông tin trong tài liệu dưới đây để trả lời
                                    2. Nếu tài liệu có số liệu cụ thể, hãy dùng đúng số liệu đó để tính toán và đưa ra kết quả cuối cùng
                                    3. Trả lời ngắn gọn, trực tiếp vào câu hỏi - không dài dòng, không lặp lại thông tin không cần thiết
                                    4. Nếu câu hỏi cần suy luận nhiều bước, hãy trình bày từng bước rõ ràng
                                    5. Nếu câu hỏi liên quan đến lịch sử hội thoại, hãy dựa vào đó để trả lời liền mạch
                                    6. Nếu tài liệu không có thông tin để trả lời, chỉ cần nói "Tài liệu hiện tại không có thông tin về vấn đề này"
                                    
                                    TÀI LIỆU THAM KHẢO:
                                    {rag_context}
                                    
                                    CÂU HỎI HIỆN TẠI: {message}
                                """
        else:
            history_text = ""
            if len(history) > 1:
                recent_history = history[:-1][-10:]  # chỉ lấy 10 tin nhắn gần nhất
                history_text = "\nLỊCH SỬ HỘI THOẠI TRƯỚC:\n"
                for msg in recent_history:
                    role_label = "Người dùng" if msg["role"] == "user" else "Trợ lý"
                    history_text += f"{role_label}: {msg['content']}\n"
                history_text += "\n"
            enhanced_message = f"""Bạn là trợ lý AI.
                                    {history_text}
                                    NGUYÊN TẮC TRẢ LỜI:
                                    1. Dựa vào lịch sử hội thoại ở trên để trả lời liền mạch nếu câu hỏi liên quan
                                    2. Trả lời ngắn gọn, trực tiếp, tính toán ra kết quả cụ thể nếu có thể
                                    3. Nếu thực sự không có thông tin, nói: "Tôi không có thông tin về vấn đề này"
                                    
                                    CÂU HỎI HIỆN TẠI: {message}
                                """

        # Lưu vào database
        db.add_message(session_id, "user", message, [])

        #Xây dựng prompt
        prompt1 = enhanced_message

        #Gọi Gemini API
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt1
        )
        bot_reply = response.text

        # Lưu respone vào database
        db.add_message(session_id, "assistant", bot_reply, sources)

        #Gửi response cho user
        result = {
            "bot_reply": bot_reply,
            "message_count": len(history) + 2,
            "sources": list(set(sources))
        }
        return result

    #Xóa lịch sử chat của 1 session
    def delete_session(self, session_id: str) -> bool:
        return db.delete_session(session_id)

    #Kiểm tra session có tồn tại kh
    def session_exists(self, session_id: str) -> bool:
        return db.session_exists(session_id)

    #Lấy danh sách tất cả các sessions
    def get_all_sessions(self) -> list:
        return db.get_all_sessions()

#Tạo instance toàn cục
gemini_service = GeminiService()