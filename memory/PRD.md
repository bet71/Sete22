# MercadoLocal — PRD

## Original problem statement
App (PT-BR) with admin panel (user + password); user login and register screens; users post items for sale with photos, description, price, city/state, delivers or not, new/used, category (carros, telefones, móveis, acessórios), WhatsApp number redirecting to WhatsApp. Admin wants to see who sells what and the price.
Later requests: Emergent push notifications, Claude AI, SendGrid, admin credentials only in the database (not exposed in code).

## Architecture
- Expo Router (tabs: Início, Anunciar, Assistente, Conta) + screens login, register, listing/[id], admin, change-password
- FastAPI + MongoDB; JWT (bcrypt) auth; Emergent Object Storage for photos; Claude claude-sonnet-5-5 via emergentintegrations; Emergent push relay; SendGrid (optional, skipped without keys)

## Implemented (2026-06)
- Register/login/me, JWT Bearer, roles user/admin
- Admin is seeded ONCE from ADMIN_EMAIL + ADMIN_PASSWORD_HASH (bcrypt hash only) when no admin exists; never overwritten. Passwords live only in the DB as bcrypt hashes. Change-password endpoint and screen
- Listings CRUD: up to 5 photos, category, condition, price, city/state, delivery, WhatsApp; feed with category chips + search; detail with seller info and WhatsApp CTA
- Admin panel: stats (users, listings, total value, by category), list/remove listings (seller+price), list/remove users; confirmation dialogs
- AI: generate title/description, fair price suggestion, streaming chat assistant with history
- Push: register-push + notifications on publish, admin removal, new listing broadcast (works only in a real build after Publish; Android needs google-services.json)
- Emails (welcome, published, removed) via SendGrid when SENDGRID_API_KEY + SENDER_EMAIL are set

## Backlog
- P1: Provide google-services.json for Android push; add SendGrid keys
- P1: Edit listing, mark as sold
- P2: Favorites, seller public profile, listing views count, image compression

## Update (2026-06) — categories + partners
- 10 categories: carros, telefones, moveis, eletrodomesticos, roupas, acessorios, casas, terrenos, aluguel, outros
- Empresas parceiras: users submit service profile -> admin approves/rejects (Parceiros tab) -> public Serviços tab with WhatsApp
- Tabs: Início, Serviços, Anunciar, Conta; Assistente IA opened from home header
- Pending minor: disable chat send until session ready, return to partner form after login, stricter WhatsApp validation on backend, debounce search
