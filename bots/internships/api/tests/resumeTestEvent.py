import json
import socket

HOST = "127.0.0.1"
PORT = 8000

event = {
    "event": "RESUME_UPLOAD",
    "request_id": "test-001",
    "data": {
        "discord_id": "123456789012345678",
        "name": "John Smith",
        "filename": "resume.pdf",
        "pdf_base64": "TEST_BASE64_DATA"
    }
}

with socket.create_connection((HOST, PORT), timeout=5) as sock:
    message = json.dumps(event) + "\n"
    sock.sendall(message.encode("utf-8"))

print("Test event sent")