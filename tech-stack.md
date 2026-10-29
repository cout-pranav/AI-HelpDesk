# Tech Stack

## Backend
- ASP.NET Core Web API (.NET 8)
- EF Core (ORM) + SQL Server

## Frontend
- React (Vite + TypeScript)
- React Router for client-side routing
- TanStack Query (`@tanstack/react-query`) for server state (fetching, caching, mutations, invalidation) on top of a thin `fetch` wrapper

## Auth
- Self-issued JWT auth for admin/agent accounts only — the API owns the user table, hashes passwords, and issues signed access tokens on login
- Role claims (`admin`, `agent`) in the token drive `[Authorize(Roles = ...)]` policies
- Backend: `Microsoft.AspNetCore.Authentication.JwtBearer` for token validation; `System.IdentityModel.Tokens.Jwt` / `JsonWebTokenHandler` for issuance; `PasswordHasher<T>` for password hashing
- Frontend: custom login form + auth context; token sent as `Authorization: Bearer` header
- Ticket submitters do not authenticate (auth out of scope for v1 — see project-scope.md)

## AI
- Anthropic Claude API (preferred) or Google Gemini API (free-tier alternative) for ticket classification, summaries, and suggested replies
- Called via a thin service abstraction (e.g. `IAiService`) using plain `HttpClient`, so the provider can be swapped without touching calling code

## Email (send and receive)
- SendGrid is the single provider for both directions
- Outbound: SendGrid Mail Send API, via the official `SendGrid` NuGet package or `HttpClient`, behind a thin service abstraction so the provider stays swappable
- Inbound: SendGrid Inbound Parse webhook posts each received email to the API, where an adapter maps it onto the provider-agnostic `POST /api/inbound-email` shape

## Containerization
- Docker — separate containers for API and SQL Server, `docker-compose` for local dev
- No orchestration (Kubernetes) needed for current scope

## Explicitly out of scope for v1
- Real-time updates (SignalR) — polling/refresh is sufficient
- Message queue / background job infra
