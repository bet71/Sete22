"""Iteration 2: new listing categories + partner (service providers) flow."""
import io
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
JPEG_BYTES = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707" "0709090808" + "0a" * 100 + "ffd9")
NEW_CATS = ["carros", "telefones", "moveis", "eletrodomesticos", "roupas", "acessorios", "casas", "terrenos", "aluguel", "outros"]


def _reg(name):
    email = f"TEST_{name}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"name": f"TEST {name}", "email": email, "password": "pass1234",
                                                    "city": "Campinas", "state": "SP", "whatsapp": "19999990000"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def user():
    return _reg("puser")


@pytest.fixture(scope="module")
def user2():
    return _reg("puser2")


@pytest.fixture(scope="module")
def admin_h():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@app.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def photo(user):
    r = requests.post(f"{API}/upload", headers=user["h"], files={"file": ("l.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")})
    assert r.status_code == 200
    return r.json()["path"]


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_h, user, user2):
    yield
    for u in (user, user2):
        requests.delete(f"{API}/admin/users/{u['user']['id']}", headers=admin_h)


def _listing(cat, photo):
    return {"title": f"TEST item {cat}", "description": "TEST descricao do item ok", "price": 100.0,
            "condition": "usado", "category": cat, "city": "Campinas", "state": "SP", "delivers": False,
            "whatsapp": "19999990000", "photos": [photo]}


# -------- categories --------
class TestCategories:
    @pytest.mark.parametrize("cat", ["eletrodomesticos", "aluguel", "terrenos", "outros", "casas", "acessorios"])
    def test_create_new_category(self, user, photo, cat):
        r = requests.post(f"{API}/listings", json=_listing(cat, photo), headers=user["h"])
        assert r.status_code == 200, r.text
        assert r.json()["category"] == cat

    def test_invalid_category(self, user, photo):
        r = requests.post(f"{API}/listings", json=_listing("imoveis", photo), headers=user["h"])
        assert r.status_code == 422

    def test_filter_aluguel(self):
        r = requests.get(f"{API}/listings", params={"category": "aluguel"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1 and all(i["category"] == "aluguel" for i in items)

    def test_stats_has_10_categories(self, admin_h):
        r = requests.get(f"{API}/admin/stats", headers=admin_h)
        assert r.status_code == 200, r.text
        d = r.json()
        print("STATS:", d)
        assert "partners_pending" in d and "partners_approved" in d
        bc = d.get("by_category") or d.get("categories") or {}
        keys = set(bc.keys()) if isinstance(bc, dict) else {x.get("category") or x.get("key") for x in bc}
        assert set(NEW_CATS) <= keys, keys


# -------- partners --------
PARTNER = {"business_name": "TEST Eletrica Silva", "service": "eletricista",
           "description": "TEST instalacoes eletricas residenciais", "city": "Campinas", "state": "SP",
           "whatsapp": "19988887777"}


class TestPartners:
    def test_my_partner_requires_auth(self):
        assert requests.get(f"{API}/my/partner").status_code in (401, 403)
        assert requests.post(f"{API}/my/partner", json=PARTNER).status_code in (401, 403)

    def test_my_partner_empty(self, user):
        r = requests.get(f"{API}/my/partner", headers=user["h"])
        assert r.status_code == 200 and r.json() is None

    def test_invalid_service(self, user):
        r = requests.post(f"{API}/my/partner", json={**PARTNER, "service": "astronauta"}, headers=user["h"])
        assert r.status_code == 422

    def test_invalid_photo(self, user):
        r = requests.post(f"{API}/my/partner", json={**PARTNER, "photo": "fake/path.jpg"}, headers=user["h"])
        assert r.status_code == 400

    def test_create_pending_not_public(self, user):
        r = requests.post(f"{API}/my/partner", json=PARTNER, headers=user["h"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending" and d["owner_id"] == user["user"]["id"]
        pytest.partner_id = d["id"]
        g = requests.get(f"{API}/my/partner", headers=user["h"]).json()
        assert g["id"] == d["id"] and g["status"] == "pending"
        pub = requests.get(f"{API}/partners").json()
        assert d["id"] not in [p["id"] for p in pub]

    def test_admin_forbidden_for_user(self, user):
        assert requests.get(f"{API}/admin/partners", headers=user["h"]).status_code == 403
        r = requests.post(f"{API}/admin/partners/{pytest.partner_id}/status", json={"status": "approved"}, headers=user["h"])
        assert r.status_code == 403
        assert requests.delete(f"{API}/admin/partners/{pytest.partner_id}", headers=user["h"]).status_code == 403

    def test_admin_list_pending_first(self, admin_h):
        r = requests.get(f"{API}/admin/partners", headers=admin_h)
        assert r.status_code == 200
        lst = r.json()
        assert pytest.partner_id in [p["id"] for p in lst]
        order = {"pending": 0, "approved": 1, "rejected": 2}
        assert [order[p["status"]] for p in lst] == sorted(order[p["status"]] for p in lst)

    def test_admin_invalid_status(self, admin_h):
        r = requests.post(f"{API}/admin/partners/{pytest.partner_id}/status", json={"status": "pending"}, headers=admin_h)
        assert r.status_code == 422

    def test_admin_status_404(self, admin_h):
        r = requests.post(f"{API}/admin/partners/nope/status", json={"status": "approved"}, headers=admin_h)
        assert r.status_code == 404

    def test_approve_then_public_and_filters(self, admin_h):
        r = requests.post(f"{API}/admin/partners/{pytest.partner_id}/status", json={"status": "approved"}, headers=admin_h)
        assert r.status_code == 200 and r.json()["status"] == "approved"
        ids = [p["id"] for p in requests.get(f"{API}/partners").json()]
        assert pytest.partner_id in ids
        f1 = requests.get(f"{API}/partners", params={"service": "eletricista"}).json()
        assert pytest.partner_id in [p["id"] for p in f1] and all(p["service"] == "eletricista" for p in f1)
        f2 = requests.get(f"{API}/partners", params={"service": "pintor"}).json()
        assert pytest.partner_id not in [p["id"] for p in f2]
        q = requests.get(f"{API}/partners", params={"q": "eletrica silva"}).json()
        assert pytest.partner_id in [p["id"] for p in q]
        q2 = requests.get(f"{API}/partners", params={"q": "campinas"}).json()
        assert pytest.partner_id in [p["id"] for p in q2]
        q3 = requests.get(f"{API}/partners", params={"q": "zzznotfoundzzz"}).json()
        assert q3 == []
        assert all("_id" not in p for p in f1)

    def test_stats_counts(self, admin_h):
        d = requests.get(f"{API}/admin/stats", headers=admin_h).json()
        assert d["partners_approved"] >= 1

    def test_upsert_resets_to_pending(self, user):
        r = requests.post(f"{API}/my/partner", json={**PARTNER, "business_name": "TEST Eletrica Silva 2"}, headers=user["h"])
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == pytest.partner_id and d["status"] == "pending" and d["business_name"].endswith("2")
        assert pytest.partner_id not in [p["id"] for p in requests.get(f"{API}/partners").json()]

    def test_reject(self, admin_h, user):
        r = requests.post(f"{API}/admin/partners/{pytest.partner_id}/status", json={"status": "rejected"}, headers=admin_h)
        assert r.status_code == 200 and r.json()["status"] == "rejected"
        assert requests.get(f"{API}/my/partner", headers=user["h"]).json()["status"] == "rejected"
        assert pytest.partner_id not in [p["id"] for p in requests.get(f"{API}/partners").json()]

    def test_user_delete_my_partner(self, user):
        r = requests.delete(f"{API}/my/partner", headers=user["h"])
        assert r.status_code == 200
        assert requests.get(f"{API}/my/partner", headers=user["h"]).json() is None

    def test_admin_delete_partner(self, admin_h, user2):
        c = requests.post(f"{API}/my/partner", json={**PARTNER, "service": "pintor"}, headers=user2["h"]).json()
        r = requests.delete(f"{API}/admin/partners/{c['id']}", headers=admin_h)
        assert r.status_code == 200
        assert requests.get(f"{API}/my/partner", headers=user2["h"]).json() is None
        assert requests.delete(f"{API}/admin/partners/{c['id']}", headers=admin_h).status_code == 404
