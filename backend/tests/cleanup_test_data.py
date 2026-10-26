"""Remove TEST_ users (and their listings) created by test runs, via admin API."""
import os

import requests

API = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/") + "/api"
tok = requests.post(f"{API}/auth/login", json={"email": "admin@app.com", "password": "admin123"}).json()["token"]
h = {"Authorization": f"Bearer {tok}"}
n = 0
for u in requests.get(f"{API}/admin/users", headers=h).json():
    if u["email"].startswith("test_") and u["role"] == "user":
        requests.delete(f"{API}/admin/users/{u['id']}", headers=h)
        n += 1
print(f"removed {n} test users; remaining listings: {len(requests.get(f'{API}/listings').json())}")
