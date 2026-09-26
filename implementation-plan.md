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
- Define entities: `User` (local profile keyed by Auth0 `sub`, display name, email, active flag), `Ticket`, `Category` (enum), `Status` (enum), `Message`/`Reply`
- EF Core migrations for initial schema
- Auth0 tenant setup: SPA application (frontend), API resource with an audience identifier (backend), RBAC enabled with `admin` and `agent` roles
- Auth0 post-login Action that adds the user's roles to the access token as a namespaced custom claim
- Bootstrap the first admin by assigning the `admin` role to a user in the Auth0 dashboard (replaces seeding a local admin account)
- Backend: validate Auth0 access tokens via `Microsoft.AspNetCore.Authentication.JwtBearer` (Authority = Auth0 domain, Audience = API identifier); map the roles claim so `[Authorize(Roles = "admin")]` / policies work
- Backend: on first authenticated request, create/update the local `User` row from token claims (just-in-time provisioning)
- Admin endpoints: create/list/deactivate agent accounts via the Auth0 Management API (machine-to-machine app; deactivate = block user in Auth0 + mark inactive locally)
- Frontend: `@auth0/auth0-react` (Universal Login redirect, no custom login form), attach access token to API calls, protected routes via React Router

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
- Admin user management UI (list/create/deactivate agents, backed by the Auth0 Management API endpoints)
- Dashboard: ticket volume by category/status, basic charts
- Role-based UI gating (agent vs admin views)

## Phase 6 — Hardening & Deployment
- Input validation everywhere (ticket form, auth, admin endpoints)
- Dockerize full stack (API, frontend build, SQL Server) via docker-compose
- Environment/config management (API keys for AI + email, Auth0 domain/audience/client IDs and Management API client secret, connection strings)
- Auth0 production config: allowed callback/logout/web origin URLs for the deployed frontend
- Manual end-to-end test pass: submit ticket → AI classify/summarize/draft → agent edits → send email → status update
- README with setup/run instructions

## Deferred / Explicitly Out of Scope for v1
- Real email ingestion (inbound webhook/IMAP) — tickets created via in-app form only
- Auto-send without agent approval
- Multi-language reply support
- AI feedback loop (correcting classifications to improve future AI behavior)
- Ticket routing to specific agents (currently unassigned; any agent can pick up any ticket)
