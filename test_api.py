#!/usr/bin/env python3
"""Quick smoke test for backend API endpoints."""
import urllib.request
import json

BASE = "http://127.0.0.1:3000/api/v1"

def get(path):
    r = urllib.request.urlopen(f"{BASE}{path}")
    return json.loads(r.read())

def post(path, data):
    d = json.dumps(data).encode()
    req = urllib.request.Request(f"{BASE}{path}", data=d, headers={"Content-Type": "application/json"})
    r = urllib.request.urlopen(req)
    return json.loads(r.read())

def delete(path):
    req = urllib.request.Request(f"{BASE}{path}", method="DELETE")
    r = urllib.request.urlopen(req)
    return json.loads(r.read())

# Health
h = get("/health")
print(f"Health: {h['status']} v{h['version']}")

# Config
c = get("/config")
print(f"Config: gpu_layers={c['gpu_layers']}, ctx={c['context_size']}, port={c['llama_server_port']}")

# Server status
s = get("/server/status")
print(f"Server: {s['status']}, model={s['model']}")

# Presets
p = get("/presets")
print(f"Presets: {len(p['presets'])} loaded")

# Conversation CRUD
convo = post("/conversations", {"title": "Test Chat"})
cid = convo["id"]
print(f"Created conversation: {cid[:8]}...")

# Add messages
m1 = post(f"/conversations/{cid}/messages", {"role": "user", "content": "Hello!"})
print(f"Added user message: {m1['id'][:8]}...")

m2 = post(f"/conversations/{cid}/messages", {"role": "assistant", "content": "Hi there!"})
print(f"Added assistant message: {m2['id'][:8]}...")

# Get conversation with messages
full = get(f"/conversations/{cid}")
print(f"Conversation has {len(full['messages'])} messages")

# Delete
delete(f"/conversations/{cid}")
print("Deleted conversation")

print("\nAll tests passed!")
