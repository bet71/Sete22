"""Seed a TEST user + listing for UI tests (prints ids/credentials)."""
import io
import os
import uuid

import requests
from PIL import Image

API = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/") + "/api"
email = f"test_ui_{uuid.uuid4().hex[:6]}@example.com"
r = requests.post(f"{API}/auth/register", json={"name": "TEST Vendedor UI", "email": email, "password": "pass1234",
                                               "city": "Curitiba", "state": "PR", "whatsapp": "41999998888"})
tok = r.json()["token"]
h = {"Authorization": f"Bearer {tok}"}
buf = io.BytesIO()
Image.new("RGB", (400, 300), (60, 120, 90)).save(buf, "JPEG")
up = requests.post(f"{API}/upload", files={"file": ("p.jpg", buf.getvalue(), "image/jpeg")}, headers=h).json()
ids = []
for t, cat, price in [("TEST Sofá retrátil 3 lugares", "moveis", 1250.5), ("TEST Galaxy S21 seminovo", "telefones", 1899)]:
    l = requests.post(f"{API}/listings", headers=h, json={
        "title": t, "description": "TEST descrição detalhada do produto em ótimo estado.", "price": price,
        "condition": "usado", "category": cat, "city": "Curitiba", "state": "PR", "delivers": True,
        "whatsapp": "41999998888", "photos": [up["path"]]}).json()
    ids.append(l["id"])
print(f"EMAIL={email}")
print(f"IDS={','.join(ids)}")
