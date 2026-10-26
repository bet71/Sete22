from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header
from fastapi.responses import Response, StreamingResponse
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import asyncio
import logging
import uuid
from pathlib import Path
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import httpx
import requests
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone  # noqa: E402

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
CLAUDE_MODEL = "claude-sonnet-5-5"
APP_NAME = "mercadolocal"
CATEGORY_LABELS = {
    "carros": "Carros", "telefones": "Telefones", "moveis": "Móveis", "eletrodomesticos": "Eletrodomésticos",
    "roupas": "Roupas", "acessorios": "Acessórios", "casas": "Casas à venda", "terrenos": "Terrenos",
    "aluguel": "Aluguel / Locação", "outros": "Outros",
}
CATEGORIES = list(CATEGORY_LABELS)
CategoryT = Literal["carros", "telefones", "moveis", "eletrodomesticos", "roupas", "acessorios", "casas",
                    "terrenos", "aluguel", "outros"]
SERVICE_LABELS = {
    "eletricista": "Eletricista", "gesso": "Gesso / Drywall", "mecanico": "Mecânico", "encanador": "Encanador",
    "pedreiro": "Pedreiro", "pintor": "Pintor", "diarista": "Diarista / Limpeza", "marceneiro": "Marceneiro",
    "tecnico": "Técnico (eletrônicos/informática)", "outros": "Outros serviços",
}
ServiceT = Literal["eletricista", "gesso", "mecanico", "encanador", "pedreiro", "pintor", "diarista", "marceneiro",
                   "tecnico", "outros"]

app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------- Object storage ----------------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
storage_key = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------- Push ----------------
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(base_url="https://integrations.emergentagent.com",
                                 headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@api.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    return {"status": "registered"}


async def send_push(recipients: list, data: dict, idempotency_key: Optional[str] = None, _attempt: int = 0):
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per call")
    payload = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    code = resp.json().get("code", "") if resp.headers.get("content-type", "").startswith("application/json") else ""
    if code == "idempotency_key_in_progress" and idempotency_key and _attempt < 3:
        await asyncio.sleep(3)
        return await send_push(recipients, data, idempotency_key, _attempt + 1)
    if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
        logger.warning(f"Push paused: {code}")
        return
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def safe_push(recipients: list, data: dict):
    for i in range(0, len(recipients), 100):
        try:
            await send_push(recipients[i:i + 100], data)
        except Exception as e:
            logger.warning(f"Push failed (non-blocking): {e}")


# ---------------- Email (SendGrid) ----------------
def _send_email_sync(to: str, subject: str, html: str):
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail
    key, sender = os.environ.get("SENDGRID_API_KEY"), os.environ.get("SENDER_EMAIL")
    if not key or not sender:
        logger.info("SendGrid not configured; skipping email")
        return
    SendGridAPIClient(key).send(Mail(from_email=sender, to_emails=to, subject=subject, html_content=html))


async def send_email(to: str, subject: str, body: str):
    html = (f"<div style='font-family:Arial,sans-serif;max-width:520px;margin:auto'>"
            f"<h2 style='color:#2A4B3C'>MercadoLocal</h2>{body}"
            f"<p style='color:#6E7570;font-size:12px'>Você recebeu este e-mail porque tem uma conta no MercadoLocal.</p></div>")
    try:
        await run_in_threadpool(_send_email_sync, to, subject, html)
    except Exception as e:
        logger.warning(f"Email failed (non-blocking): {e}")


# ---------------- Models ----------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=40)
    whatsapp: str = Field(min_length=8, max_length=20)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    id: str
    name: str
    email: str
    role: str = "user"
    city: str = ""
    state: str = ""
    whatsapp: str = ""
    created_at: str


class ListingIn(BaseModel):
    title: str = Field(min_length=3, max_length=100)
    description: str = Field(min_length=5, max_length=3000)
    price: float = Field(gt=0)
    condition: Literal["novo", "usado"]
    category: CategoryT
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=40)
    delivers: bool
    whatsapp: str = Field(min_length=8, max_length=20)
    photos: List[str] = Field(min_length=1, max_length=5)


class Listing(ListingIn):
    id: str
    owner_id: str
    owner_name: str
    created_at: str


# ---------------- Auth ----------------
def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except ValueError:
        return False


def make_token(uid: str) -> str:
    n = datetime.now(timezone.utc)
    return jwt.encode({"sub": uid, "iat": n, "exp": n + timedelta(days=30)}, JWT_SECRET, algorithm="HS256")


def to_user(doc) -> User:
    return User(**{k: doc.get(k, "") for k in User.model_fields if k in doc})


async def optional_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"], options={"require": ["sub", "exp"]})
    except jwt.InvalidTokenError:
        return None
    return await db.users.find_one({"id": payload["sub"]}, {"_id": 0})


async def current_user(user=Depends(optional_user)):
    if not user:
        raise HTTPException(401, "Não autenticado")
    return user


async def admin_user(user=Depends(current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Acesso restrito ao administrador")
    return user


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "E-mail já cadastrado")
    doc = {"id": str(uuid.uuid4()), "name": body.name.strip(), "email": email, "password_hash": hash_pw(body.password),
           "role": "user", "city": body.city.strip(), "state": body.state.strip(), "whatsapp": body.whatsapp.strip(),
           "created_at": now_iso()}
    await db.users.insert_one(doc)
    asyncio.create_task(send_email(email, "Bem-vindo ao MercadoLocal!",
                                   f"<p>Olá, <b>{doc['name']}</b>! Sua conta foi criada. Agora você já pode anunciar "
                                   f"carros, telefones, móveis e acessórios e receber contatos pelo WhatsApp.</p>"))
    return {"token": make_token(doc["id"]), "user": to_user(doc).model_dump()}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.strip().lower()}, {"_id": 0})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha incorretos")
    return {"token": make_token(user["id"]), "user": to_user(user).model_dump()}


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=6, max_length=72)


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(current_user)):
    if not verify_pw(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Senha atual incorreta")
    if body.current_password == body.new_password:
        raise HTTPException(400, "A nova senha deve ser diferente da atual")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(body.new_password),
                                                           "password_changed_at": now_iso()}})
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return to_user(user).model_dump()


# ---------------- Upload / files ----------------
@api.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(current_user)):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "Imagem muito grande (máx 8MB)")
    ctype = file.content_type or "image/jpeg"
    if not ctype.startswith("image/"):
        raise HTTPException(400, "Apenas imagens")
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()[:5] or "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await run_in_threadpool(put_object, path, data, ctype)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 402:
            raise HTTPException(402, "Sem créditos de armazenamento")
        raise HTTPException(502, "Falha no upload")
    await db.files.insert_one({"id": str(uuid.uuid4()), "storage_path": result["path"], "owner_id": user["id"],
                               "content_type": ctype, "is_deleted": False, "created_at": now_iso()})
    return {"path": result["path"]}


@api.get("/files/{path:path}")
async def get_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Arquivo não encontrado")
    data, ctype = await run_in_threadpool(get_object, path)
    return Response(content=data, media_type=rec.get("content_type", ctype),
                    headers={"Cache-Control": "public, max-age=86400"})


# ---------------- Listings ----------------
@api.get("/listings", response_model=List[Listing])
async def list_listings(category: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if category in CATEGORIES:
        query["category"] = category
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"title": rx}, {"description": rx}, {"city": rx}]
    docs = await db.listings.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Listing(**d) for d in docs]


@api.get("/listings/{lid}", response_model=Listing)
async def get_listing(lid: str):
    d = await db.listings.find_one({"id": lid}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Anúncio não encontrado")
    return Listing(**d)


@api.post("/listings", response_model=Listing)
async def create_listing(body: ListingIn, user=Depends(current_user)):
    listing = Listing(**body.model_dump(), id=str(uuid.uuid4()), owner_id=user["id"], owner_name=user["name"],
                      created_at=now_iso())
    await db.listings.insert_one(listing.model_dump())
    price = f"R$ {listing.price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    asyncio.create_task(safe_push([user["id"]], {"title": "Anúncio publicado!",
                                                 "message": f"\"{listing.title}\" já está visível para compradores.",
                                                 "action_url": f"/listing/{listing.id}"}))
    asyncio.create_task(send_email(user["email"], "Seu anúncio foi publicado",
                                   f"<p>Seu anúncio <b>{listing.title}</b> ({price}) já está no ar em "
                                   f"{listing.city}/{listing.state}. Boas vendas!</p>"))
    others = [u["id"] async for u in db.users.find({"id": {"$ne": user["id"]}}, {"_id": 0, "id": 1})]
    asyncio.create_task(safe_push(others, {"title": f"Novo em {CATEGORY_LABELS[listing.category]}",
                                           "message": f"{listing.title} por {price} em {listing.city}",
                                           "action_url": f"/listing/{listing.id}"}))
    return listing


@api.get("/my/listings", response_model=List[Listing])
async def my_listings(user=Depends(current_user)):
    docs = await db.listings.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Listing(**d) for d in docs]


@api.delete("/listings/{lid}")
async def delete_listing(lid: str, user=Depends(current_user)):
    d = await db.listings.find_one({"id": lid}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Anúncio não encontrado")
    is_admin = user.get("role") == "admin"
    if d["owner_id"] != user["id"] and not is_admin:
        raise HTTPException(403, "Sem permissão")
    await db.listings.delete_one({"id": lid})
    if is_admin and d["owner_id"] != user["id"]:
        asyncio.create_task(safe_push([d["owner_id"]], {"title": "Anúncio removido",
                                                        "message": f"Seu anúncio \"{d['title']}\" foi removido pelo administrador."}))
        owner = await db.users.find_one({"id": d["owner_id"]}, {"_id": 0, "email": 1})
        if owner:
            asyncio.create_task(send_email(owner["email"], "Seu anúncio foi removido",
                                           f"<p>O anúncio <b>{d['title']}</b> foi removido pela moderação do MercadoLocal.</p>"))
    return {"ok": True}


# ---------------- Admin ----------------
@api.get("/admin/stats")
async def admin_stats(_=Depends(admin_user)):
    by_cat = {c: await db.listings.count_documents({"category": c}) for c in CATEGORIES}
    total_value = 0.0
    async for d in db.listings.find({}, {"_id": 0, "price": 1}):
        total_value += d.get("price", 0)
    return {"users": await db.users.count_documents({"role": "user"}),
            "listings": await db.listings.count_documents({}),
            "partners_pending": await db.partners.count_documents({"status": "pending"}),
            "partners_approved": await db.partners.count_documents({"status": "approved"}),
            "by_category": by_cat, "total_value": total_value}


@api.get("/admin/users")
async def admin_users(_=Depends(admin_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    counts = {}
    async for d in db.listings.find({}, {"_id": 0, "owner_id": 1}):
        counts[d["owner_id"]] = counts.get(d["owner_id"], 0) + 1
    return [{**to_user(u).model_dump(), "listings_count": counts.get(u["id"], 0)} for u in users]


@api.get("/admin/listings", response_model=List[Listing])
async def admin_listings(_=Depends(admin_user)):
    docs = await db.listings.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Listing(**d) for d in docs]


@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, admin=Depends(admin_user)):
    if uid == admin["id"]:
        raise HTTPException(400, "Não é possível remover a si mesmo")
    res = await db.users.delete_one({"id": uid, "role": "user"})
    if not res.deleted_count:
        raise HTTPException(404, "Usuário não encontrado")
    await db.listings.delete_many({"owner_id": uid})
    await db.partners.delete_many({"owner_id": uid})
    return {"ok": True}


# ---------------- Partner businesses (services) ----------------
class PartnerIn(BaseModel):
    business_name: str = Field(min_length=2, max_length=80)
    service: ServiceT
    description: str = Field(min_length=10, max_length=1500)
    city: str = Field(min_length=2, max_length=80)
    state: str = Field(min_length=2, max_length=40)
    whatsapp: str = Field(min_length=8, max_length=20)
    photo: Optional[str] = None


class Partner(PartnerIn):
    id: str
    owner_id: str
    owner_name: str
    status: Literal["pending", "approved", "rejected"]
    created_at: str
    updated_at: str


class PartnerStatusIn(BaseModel):
    status: Literal["approved", "rejected"]


@api.get("/partners", response_model=List[Partner])
async def list_partners(service: Optional[str] = None, q: Optional[str] = None):
    query = {"status": "approved"}
    if service in SERVICE_LABELS:
        query["service"] = service
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"business_name": rx}, {"description": rx}, {"city": rx}]
    docs = await db.partners.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    return [Partner(**d) for d in docs]


@api.get("/my/partner")
async def my_partner(user=Depends(current_user)):
    d = await db.partners.find_one({"owner_id": user["id"]}, {"_id": 0})
    return Partner(**d).model_dump() if d else None


@api.post("/my/partner", response_model=Partner)
async def upsert_my_partner(body: PartnerIn, user=Depends(current_user)):
    if body.photo and not await db.files.find_one({"storage_path": body.photo, "owner_id": user["id"]}):
        raise HTTPException(400, "Foto inválida")
    existing = await db.partners.find_one({"owner_id": user["id"]}, {"_id": 0})
    ts = now_iso()
    p = Partner(**body.model_dump(), id=existing["id"] if existing else str(uuid.uuid4()), owner_id=user["id"],
                owner_name=user["name"], status="pending", created_at=existing["created_at"] if existing else ts,
                updated_at=ts)
    await db.partners.replace_one({"owner_id": user["id"]}, p.model_dump(), upsert=True)
    return p


@api.delete("/my/partner")
async def delete_my_partner(user=Depends(current_user)):
    await db.partners.delete_one({"owner_id": user["id"]})
    return {"ok": True}


@api.get("/admin/partners", response_model=List[Partner])
async def admin_partners(_=Depends(admin_user)):
    docs = await db.partners.find({}, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    order = {"pending": 0, "approved": 1, "rejected": 2}
    return sorted([Partner(**d) for d in docs], key=lambda p: order[p.status])


@api.post("/admin/partners/{pid}/status", response_model=Partner)
async def admin_partner_status(pid: str, body: PartnerStatusIn, _=Depends(admin_user)):
    d = await db.partners.find_one_and_update({"id": pid}, {"$set": {"status": body.status}},
                                              projection={"_id": 0}, return_document=True)
    if not d:
        raise HTTPException(404, "Parceiro não encontrado")
    approved = body.status == "approved"
    msg = (f"Seu serviço \"{d['business_name']}\" foi aprovado e já aparece em Serviços." if approved
           else f"Seu cadastro \"{d['business_name']}\" não foi aprovado. Revise as informações e envie novamente.")
    asyncio.create_task(safe_push([d["owner_id"]], {"title": "Cadastro aprovado!" if approved else "Cadastro não aprovado",
                                                    "message": msg, "action_url": "/(tabs)/services"}))
    owner = await db.users.find_one({"id": d["owner_id"]}, {"_id": 0, "email": 1})
    if owner:
        asyncio.create_task(send_email(owner["email"], "Atualização do seu cadastro de parceiro", f"<p>{msg}</p>"))
    return Partner(**d)


@api.delete("/admin/partners/{pid}")
async def admin_delete_partner(pid: str, _=Depends(admin_user)):
    res = await db.partners.delete_one({"id": pid})
    if not res.deleted_count:
        raise HTTPException(404, "Parceiro não encontrado")
    return {"ok": True}


# ---------------- AI (Claude) ----------------
class AIGenIn(BaseModel):
    hint: str = Field(min_length=2, max_length=500)
    category: Optional[str] = None
    condition: Optional[str] = None


class AIPriceIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    category: Optional[str] = None
    condition: Optional[str] = None
    city: Optional[str] = None


class ChatIn(BaseModel):
    session_id: str = Field(min_length=4, max_length=80)
    message: str = Field(min_length=1, max_length=2000)


def llm(system: str) -> LlmChat:
    return LlmChat(api_key=EMERGENT_KEY, session_id=str(uuid.uuid4()), system_message=system).with_model(
        "anthropic", CLAUDE_MODEL)


async def ask_json(system: str, prompt: str) -> dict:
    text = ""
    async for ev in llm(system).stream_message(UserMessage(text=prompt)):
        if isinstance(ev, TextDelta):
            text += ev.content
        elif isinstance(ev, StreamDone):
            break
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise HTTPException(502, "Resposta inválida da IA")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        raise HTTPException(502, "Resposta inválida da IA")


@api.post("/ai/generate")
async def ai_generate(body: AIGenIn, _=Depends(current_user)):
    sys = ("Você é um especialista em anúncios de classificados no Brasil. Responda SOMENTE com JSON válido no formato "
           '{"title": "...", "description": "..."}. Título com até 70 caracteres, descrição atrativa e honesta com '
           "3 a 6 frases, em português do Brasil, sem emojis.")
    prompt = f"Produto: {body.hint}\nCategoria: {body.category or 'não informada'}\nEstado: {body.condition or 'não informado'}"
    data = await ask_json(sys, prompt)
    return {"title": str(data.get("title", ""))[:100], "description": str(data.get("description", ""))}


@api.post("/ai/price")
async def ai_price(body: AIPriceIn, _=Depends(current_user)):
    sys = ("Você é um avaliador de preços de produtos usados e novos no mercado brasileiro. Responda SOMENTE com JSON "
           'válido: {"min": number, "max": number, "suggested": number, "reasoning": "explicação curta em pt-BR"}. '
           "Valores em reais, números sem formatação.")
    prompt = (f"Produto: {body.title}\nDescrição: {body.description}\nCategoria: {body.category}\n"
              f"Estado: {body.condition}\nCidade: {body.city}")
    data = await ask_json(sys, prompt)
    try:
        return {"min": float(data["min"]), "max": float(data["max"]), "suggested": float(data["suggested"]),
                "reasoning": str(data.get("reasoning", ""))}
    except (KeyError, TypeError, ValueError):
        raise HTTPException(502, "Resposta inválida da IA")


@api.get("/ai/chat/{session_id}")
async def chat_history(session_id: str):
    return await db.ai_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(200)


@api.post("/ai/chat")
async def ai_chat(body: ChatIn):
    history = await db.ai_messages.find({"session_id": body.session_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    await db.ai_messages.insert_one({"id": str(uuid.uuid4()), "session_id": body.session_id, "role": "user",
                                     "content": body.message, "created_at": now_iso()})
    convo = "\n".join(f"{'Usuário' if h['role'] == 'user' else 'Assistente'}: {h['content']}" for h in history[-12:])
    prompt = (f"Conversa anterior:\n{convo}\n\nNova mensagem do usuário: {body.message}" if convo else body.message)
    sys = ("Você é o assistente do MercadoLocal, um app de classificados (carros, telefones, móveis e acessórios). "
           "Ajude compradores e vendedores: dicas de anúncio, preço, segurança em negociações pelo WhatsApp, "
           "como usar o app. Responda em português do Brasil, de forma curta e amigável, sem markdown pesado.")

    async def gen():
        full = ""
        try:
            async for ev in llm(sys).stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            logger.error(f"AI chat error: {e}")
            yield f"data: {json.dumps({'error': 'Falha na IA'})}\n\n"
        if full:
            await db.ai_messages.insert_one({"id": str(uuid.uuid4()), "session_id": body.session_id,
                                             "role": "assistant", "content": full, "created_at": now_iso()})
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


app.include_router(api)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.listings.create_index("id", unique=True)
    # Seed the first admin ONCE (only when no admin exists). Only a bcrypt hash is kept in the
    # environment; after creation the account lives solely in the database and is never overwritten.
    if not await db.users.find_one({"role": "admin"}, {"_id": 1}):
        email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        pw_hash = os.environ.get("ADMIN_PASSWORD_HASH", "")
        if email and pw_hash.startswith("$2"):
            try:
                await db.users.insert_one({"id": str(uuid.uuid4()), "name": "Administrador", "email": email,
                                           "password_hash": pw_hash, "role": "admin", "city": "", "state": "",
                                           "whatsapp": "", "created_at": now_iso()})
            except Exception as e:
                logger.warning(f"Admin seed skipped: {e}")
        else:
            logger.warning("No admin in database and no valid ADMIN_PASSWORD_HASH configured")
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
