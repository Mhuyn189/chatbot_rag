from database import db

print("Testing SQLite database...")

# Test 1: Tạo session
session_id = "test_123"
db.create_session(session_id, "Test Session")
print("Session created")

# Test 2: Thêm messages
db.add_message(session_id, "user", "Hello!", [])
db.add_message(session_id, "assistant", "Hi there!", ["test.txt"])
print("Messages added")

# Test 3: Lấy messages
messages = db.get_messages(session_id)
print(f"Retrieved {len(messages)} messages:")
for msg in messages:
    print(f"{msg['role']}: {msg['content']} (sources: {msg['sources']})")

# Test 4: Lấy all sessions
sessions = db.get_all_sessions()
print(f"Total sessions: {len(sessions)}")

# Test 5: Xóa session
db.delete_session(session_id)
print("Session deleted")

print("\nAll tests passed!")