import sqlite3
import json
from datetime import datetime, timezone

class Database:
    def __init__(self, db_path='chatbot.db'):
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # BẢNG SESSIONS
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                session_name TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # BẢNG MESSAGES
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session
            ON messages(session_id)
        """)

        cursor.execute("PRAGMA foreign_keys = ON")

        conn.commit()
        conn.close()
        print("Database initialized")

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _utc_now(self) -> str:
        """Trả về timestamp UTC dạng ISO 8601 chuẩn, có Z suffix"""
        return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    def create_session(self, session_id: str, session_name: str):
        conn = self.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(
                "INSERT INTO sessions (session_id, session_name) VALUES (?, ?)",
                (session_id, session_name)
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            # Session đã tồn tại
            return False
        finally:
            conn.close()

    def session_exists(self, session_id: str):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT 1 FROM sessions WHERE session_id = ?",
            (session_id,)
        )
        exists = cursor.fetchone() is not None
        conn.close()
        return exists

    def get_all_sessions(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT s.session_id, s.session_name, COUNT(m.id) as message_count
            FROM sessions s
            LEFT JOIN messages m ON s.session_id = m.session_id
            GROUP BY s.session_id, s.session_name
            ORDER BY s.updated_at DESC
        """)
        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                "session_id": row["session_id"],
                "session_name": row["session_name"],
                "message_count": row["message_count"]
            })

        conn.close()
        return sessions

    def delete_session(self, session_id: str):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "DELETE FROM sessions WHERE session_id = ?",
            (session_id,)
        )
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
        return deleted

    def update_session_name(self, session_id: str, new_name: str):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE sessions SET session_name = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
            (new_name, session_id)
        )
        conn.commit()
        conn.close()
        return True

    def add_message(self, session_id: str, role: str, content: str, sources: list = None):
        conn = self.get_connection()
        cursor = conn.cursor()
        sources_json = json.dumps(sources) if sources else None

        cursor.execute(
            "INSERT INTO messages (session_id, role, content, sources) VALUES (?, ?, ?, ?)",
            (session_id, role, content, sources_json)
        )

        cursor.execute(
            "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
            (session_id,)
        )

        conn.commit()
        conn.close()
        return True

    def get_messages(self, session_id: str):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT role, content, sources, timestamp FROM messages WHERE session_id = ?",
            (session_id,)
        )

        messages = []
        for row in cursor.fetchall():
            sources = json.loads(row["sources"]) if row["sources"] else []
            ts = row["timestamp"] or ''
            if ts and 'Z' not in ts and '+' not in ts:
                ts = ts.replace(' ', 'T') + 'Z'
            messages.append({
                "role": row["role"],
                "content": row["content"],
                "sources": sources,
                "timestamp": ts
            })

        conn.close()
        return messages

db = Database()














