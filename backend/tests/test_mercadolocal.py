"""Backend tests for MercadoLocal classifieds app."""
import io
import json
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

# Minimal 1x1 JPEG
JPEG_BYTES = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707"
    "0709090808"
    + "0a" * 100
    + "ffd9"
)


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_a(session):
    email = f"TEST_user_a_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{API}/auth/register", json={
        "name": "TEST User A", "email": email, "password": "pass1234",
        "city": "Sao Paulo", "state": "SP", "whatsapp": "11999990000"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    return {"email": email, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def user_b(session):
    email = f"TEST_user_b_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{API}/auth/register", json={
        "name": "TEST User B", "email": email, "password": "pass1234",
        "city": "Rio", "state": "RJ", "whatsapp": "21888880000"
    })
    assert r.status_code == 200
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": "admin@app.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# -------- auth --------
class TestAuth:
    def test_register_duplicate(self, session, user_a):
        r = session.post(f"{API}/auth/register", json={
            "name": "dup", "email": user_a["email"], "password": "pass1234",
            "city": "xx", "state": "SP", "whatsapp": "12345678"
        })
        assert r.status_code == 409

    def test_login_success(self, session, user_a):
        r = session.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "pass1234"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_bad_password(self, session, user_a):
        r = session.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, session, user_a):
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        assert r.json()["email"] == user_a["email"].lower()

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# -------- upload --------
class TestUpload:
    def test_upload_image(self, user_a):
        r = requests.post(f"{API}/upload",
                          headers={"Authorization": f"Bearer {user_a['token']}"},
                          files={"file": ("t.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")})
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        assert path
        # verify file retrieval
        g = requests.get(f"{API}/files/{path}")
        assert g.status_code == 200
        assert g.headers["content-type"].startswith("image/")

    def test_upload_no_auth(self):
        r = requests.post(f"{API}/upload",
                          files={"file": ("t.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")})
        assert r.status_code == 401

    def test_upload_non_image(self, user_a):
        r = requests.post(f"{API}/upload",
                          headers={"Authorization": f"Bearer {user_a['token']}"},
                          files={"file": ("t.txt", io.BytesIO(b"hello"), "text/plain")})
        assert r.status_code == 400


# -------- listings --------
@pytest.fixture(scope="module")
def photo_path(user_a):
    r = requests.post(f"{API}/upload",
                      headers={"Authorization": f"Bearer {user_a['token']}"},
                      files={"file": ("l.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")})
    assert r.status_code == 200
    return r.json()["path"]


class TestListings:
    def test_create_listing(self, session, user_a, photo_path):
        payload = {
            "title": "TEST iPhone 12 128GB",
            "description": "TEST aparelho em bom estado, bateria 90%",
            "price": 2500.0, "condition": "usado", "category": "telefones",
            "city": "Sao Paulo", "state": "SP", "delivers": True,
            "whatsapp": "11999990000", "photos": [photo_path],
        }
        r = session.post(f"{API}/listings", json=payload,
                         headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"] and data["owner_id"] == user_a["user"]["id"]
        pytest.listing_id = data["id"]

        # verify GET
        g = session.get(f"{API}/listings/{data['id']}")
        assert g.status_code == 200
        assert g.json()["title"] == payload["title"]

    def test_create_invalid_category(self, session, user_a, photo_path):
        r = session.post(f"{API}/listings", json={
            "title": "x bad", "description": "desc here", "price": 10,
            "condition": "usado", "category": "invalid",
            "city": "SP", "state": "SP", "delivers": False,
            "whatsapp": "11999990000", "photos": [photo_path]
        }, headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 422

    def test_create_no_photos(self, session, user_a):
        r = session.post(f"{API}/listings", json={
            "title": "x bad", "description": "desc here", "price": 10,
            "condition": "usado", "category": "telefones",
            "city": "SP", "state": "SP", "delivers": False,
            "whatsapp": "11999990000", "photos": []
        }, headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 422

    def test_list_and_filter(self, session):
        r = session.get(f"{API}/listings")
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1

        r2 = session.get(f"{API}/listings", params={"category": "telefones"})
        assert r2.status_code == 200
        assert all(x["category"] == "telefones" for x in r2.json())

        r3 = session.get(f"{API}/listings", params={"q": "iPhone"})
        assert r3.status_code == 200
        assert any("iPhone" in x["title"] for x in r3.json())

    def test_my_listings(self, session, user_a):
        r = session.get(f"{API}/my/listings", headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 200
        assert any(x["id"] == pytest.listing_id for x in r.json())

    def test_delete_other_user_forbidden(self, session, user_b):
        r = session.delete(f"{API}/listings/{pytest.listing_id}",
                           headers={"Authorization": f"Bearer {user_b['token']}"})
        assert r.status_code == 403

    def test_delete_owner(self, session, user_a, photo_path):
        # create a disposable one and delete
        c = session.post(f"{API}/listings", json={
            "title": "TEST to delete", "description": "x delete me", "price": 1,
            "condition": "novo", "category": "acessorios",
            "city": "SP", "state": "SP", "delivers": False,
            "whatsapp": "11999990000", "photos": [photo_path]
        }, headers={"Authorization": f"Bearer {user_a['token']}"})
        lid = c.json()["id"]
        d = session.delete(f"{API}/listings/{lid}",
                           headers={"Authorization": f"Bearer {user_a['token']}"})
        assert d.status_code == 200
        g = session.get(f"{API}/listings/{lid}")
        assert g.status_code == 404


# -------- admin --------
class TestAdmin:
    def test_stats(self, session, admin_token):
        r = session.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        d = r.json()
        assert "users" in d and "listings" in d and "by_category" in d and "total_value" in d
        assert set(d["by_category"].keys()) == {"carros", "telefones", "moveis", "acessorios"}

    def test_users(self, session, admin_token):
        r = session.get(f"{API}/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert any("listings_count" in u for u in r.json())

    def test_listings(self, session, admin_token):
        r = session.get(f"{API}/admin/listings", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200

    def test_admin_forbidden_for_user(self, session, user_a):
        r = session.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {user_a['token']}"})
        assert r.status_code == 403

    def test_admin_delete_user_and_listings(self, session, admin_token):
        # create disposable user + listing
        em = f"TEST_disp_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register", json={
            "name": "disp", "email": em, "password": "pass1234",
            "city": "SP", "state": "SP", "whatsapp": "11999990000"
        }).json()
        up = requests.post(f"{API}/upload",
                           headers={"Authorization": f"Bearer {reg['token']}"},
                           files={"file": ("d.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")}).json()
        lst = requests.post(f"{API}/listings", json={
            "title": "TEST disp", "description": "to be removed", "price": 10,
            "condition": "novo", "category": "moveis", "city": "SP", "state": "SP",
            "delivers": False, "whatsapp": "11999990000", "photos": [up["path"]]
        }, headers={"Authorization": f"Bearer {reg['token']}"}).json()

        r = requests.delete(f"{API}/admin/users/{reg['user']['id']}",
                            headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        # listing should be gone
        g = requests.get(f"{API}/listings/{lst['id']}")
        assert g.status_code == 404


# -------- AI --------
class TestAI:
    def test_price(self, session, user_a):
        r = session.post(f"{API}/ai/price", json={
            "title": "iPhone 12 128GB", "description": "usado em bom estado",
            "category": "telefones", "condition": "usado", "city": "Sao Paulo"
        }, headers={"Authorization": f"Bearer {user_a['token']}"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["min"], (int, float)) and d["min"] >= 0
        assert d["max"] >= d["min"]
        assert "reasoning" in d

    def test_generate(self, session, user_a):
        r = session.post(f"{API}/ai/generate", json={
            "hint": "sofá 3 lugares cinza em bom estado",
            "category": "moveis", "condition": "usado"
        }, headers={"Authorization": f"Bearer {user_a['token']}"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] and d["description"]

    def test_chat_sse_and_history(self):
        sid = f"TEST_sess_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/ai/chat", json={"session_id": sid, "message": "Olá"},
                          stream=True, timeout=90)
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        got_delta = False
        done = False
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("data: "):
                payload = line[6:]
                if payload == "[DONE]":
                    done = True
                    break
                try:
                    j = json.loads(payload)
                    if "delta" in j:
                        got_delta = True
                except Exception:
                    pass
        assert got_delta and done
        time.sleep(1)
        h = requests.get(f"{API}/ai/chat/{sid}")
        assert h.status_code == 200
        roles = [m["role"] for m in h.json()]
        assert "user" in roles and "assistant" in roles


# -------- change password --------
class TestChangePassword:
    def _reg(self, session):
        email = f"TEST_cp_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{API}/auth/register", json={
            "name": "TEST CP", "email": email, "password": "oldpass1",
            "city": "Rio", "state": "RJ", "whatsapp": "21999990000"})
        assert r.status_code == 200
        return email, r.json()["token"]

    def test_wrong_current(self, session):
        email, tok = self._reg(session)
        r = session.post(f"{API}/auth/change-password", json={"current_password": "nope123", "new_password": "newpass1"},
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 400

    def test_no_auth(self, session):
        r = requests.post(f"{API}/auth/change-password", json={"current_password": "a", "new_password": "newpass1"})
        assert r.status_code == 401

    def test_short_new(self, session):
        email, tok = self._reg(session)
        r = session.post(f"{API}/auth/change-password", json={"current_password": "oldpass1", "new_password": "12"},
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 422

    def test_change_ok_and_login(self, session):
        email, tok = self._reg(session)
        r = session.post(f"{API}/auth/change-password", json={"current_password": "oldpass1", "new_password": "newpass1"},
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200 and r.json().get("ok") is True
        assert session.post(f"{API}/auth/login", json={"email": email, "password": "oldpass1"}).status_code == 401
        assert session.post(f"{API}/auth/login", json={"email": email, "password": "newpass1"}).status_code == 200

    def test_admin_change_and_revert(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "admin@app.com", "password": "admin123"})
        assert r.status_code == 200
        tok = r.json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        try:
            r = session.post(f"{API}/auth/change-password", json={"current_password": "admin123", "new_password": "TEST_admin456"}, headers=h)
            assert r.status_code == 200
            assert session.post(f"{API}/auth/login", json={"email": "admin@app.com", "password": "admin123"}).status_code == 401
            assert session.post(f"{API}/auth/login", json={"email": "admin@app.com", "password": "TEST_admin456"}).status_code == 200
        finally:
            session.post(f"{API}/auth/change-password", json={"current_password": "TEST_admin456", "new_password": "admin123"}, headers=h)
        assert session.post(f"{API}/auth/login", json={"email": "admin@app.com", "password": "admin123"}).status_code == 200
