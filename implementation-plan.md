# Implementation Plan

Assumptions used to break this down (see Open Questions in project-scope.md — revisit if these change):
- Auto-reply is human-in-the-loop for v1 (AI drafts, agent approves/sends).
- Knowledge base starts as admin-authored FAQ/articles (simplest to build; mining past tickets can be added later).
- Tickets are submitted via an in-app form with name/email typed in (no submitter auth).
- Refund requests get AI classification/summary like any other ticket, but the AI does not attempt to auto-resolve them — they always require agent action.

## Phase 0 — Project Setup
- Scaffold ASP.NET Core Web API (.NET 8) solution
- Scaffold React + Vite + TypeScript frontend.
- Set up SQL Server.
- Set up EF Core, initial DbContext, connection string config
- Configure CORS between frontend and API
- Basic CI-friendly project structure (solution folders, .gitignore, README)

## Phase 1 — Core Data Model & Auth
- Define entities: `User` (email, display name, password hash, role `admin`/`agent`, active flag), `Ticket`, `Category` (enum), `Status` (enum), `Message`/`Reply`
- EF Core migrations for initial schema
- Seed a default admin account on first run/deploy (credentials from config, not hardcoded)
- Password hashing via ASP.NET Core `PasswordHasher<User>` (no plaintext storage)
- JWT auth: `POST /api/auth/login` verifies credentials and issues a signed access token (HMAC-SHA256, signing key from config) with `sub`, `email`, and `role` claims (`admin`, `agent`); short-ish expiry (e.g. 60 min)
- Backend: validate tokens via `Microsoft.AspNetCore.Authentication.JwtBearer` (issuer, audience, lifetime, signing key); role claim mapped so `[Authorize(Roles = "admin")]` / policies work
- Deactivated users can't log in (active flag checked at login); tokens they already hold stay valid until they expire
- Admin endpoints: create/list/deactivate agent accounts
- Frontend: login page, auth context/hook storing the token (in memory + `localStorage`), attach `Authorization: Bearer` header to API calls, logout clears the token, redirect to login on 401, protected routes via React Router

## Phase 2 — Ticket Core (No AI Yet)
- API: create ticket (public/no-auth form submission — name, email, subject, body)
- API: list tickets with filtering (status, category) and sorting
- API: get ticket detail (including message thread)
- API: update ticket status (open/resolved/closed), assign category manually
- API: agent adds a manual reply to a ticket
- Frontend: public "submit a ticket" form
- Frontend: ticket list view (filter/sort controls)
- Frontend: ticket detail view (thread + status/category controls + manual reply box)
- Frontend: dashboard shell (counts by status/category)
- Frontend data access: list/detail/dashboard data via TanStack Query `useQuery` (filters/sort in the query key); submit, status/category change and reply via `useMutation`, invalidating the affected ticket list/detail/dashboard queries on success

## Phase 3 — AI Integration
- `IAiService` abstraction (provider-agnostic: Claude or Gemini)
- Claude API client implementation (classification, summary, reply draft)
- Wire AI classification: auto-suggest category on ticket creation (agent can override)
- Wire AI summary: generate short summary shown in ticket list/detail
- Wire AI-suggested reply: generate draft reply on ticket detail view, agent edits/approves before sending
- Knowledge base v1: simple admin-authored FAQ table + basic retrieval (keyword or embedding-based) fed into the reply-draft prompt
- Error handling/fallback when AI call fails (ticket still usable without AI output)

## Phase 4 — Outbound Email
- Brevo (or SendGrid) API client for sending replies
- Wire "send reply" action on ticket detail to actually email the submitter
- Track sent-reply status/history on the ticket
- Handle send failures (retry/log, don't lose the reply content)

## Phase 5 — Admin & Dashboard Polish
- Admin user management UI (list/create/deactivate agents)
- Dashboard: ticket volume by category/status, basic charts
- Role-based UI gating (agent vs admin views)

## Phase 6 — Hardening & Deployment
- Input validation everywhere (ticket form, auth, admin endpoints)
- Dockerize full stack (API, frontend build, SQL Server) via docker-compose
- Environment/config management (API keys for AI + email, JWT signing key/issuer/audience, seeded admin credentials, connection strings)
- Auth hardening: strong signing key from secrets (not appsettings), login rate limiting / lockout on repeated failures
- Manual end-to-end test pass: submit ticket → AI classify/summarize/draft → agent edits → send email → status update
- README with setup/run instructions

## Deferred / Explicitly Out of Scope for v1
- Provider-specific email ingestion (Brevo/SendGrid inbound webhook adapter or IMAP polling) — the provider-agnostic `POST /api/inbound-email` endpoint already turns each received email into a new ticket; a real mailbox still has to be wired to it
- Threading customer replies onto existing tickets (every inbound email currently creates a new ticket)
- Storing email attachments (only their file names are kept)
- Auto-send without agent approval
- Multi-language reply support
- AI feedback loop (correcting classifications to improve future AI behavior)
- Ticket routing to specific agents (currently unassigned; any agent can pick up any ticket)
