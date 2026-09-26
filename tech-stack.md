# Tech Stack

## Backend
- ASP.NET Core Web API (.NET 8)
- EF Core (ORM) + SQL Server

## Frontend
- React (Vite + TypeScript)
- React Router for client-side routing

## Auth
- Auth0 as the identity provider for admin/agent accounts only — hosted Universal Login, so no passwords or token issuance in our code
- Roles (`admin`, `agent`) managed via Auth0 RBAC and added to the access token by a post-login Action
- Frontend: `@auth0/auth0-react` SDK (login redirect, access token for API calls)
- Backend: validates Auth0-issued JWT access tokens via `Microsoft.AspNetCore.Authentication.JwtBearer`; agent account management via the Auth0 Management API
- Ticket submitters do not authenticate (auth out of scope for v1 — see project-scope.md)

## AI
- Anthropic Claude API (preferred) or Google Gemini API (free-tier alternative) for ticket classification, summaries, and suggested replies
- Called via a thin service abstraction (e.g. `IAiService`) using plain `HttpClient`, so the provider can be swapped without touching calling code

## Outbound Email
- Brevo (preferred) — REST API, 300 emails/day free tier, called via `HttpClient`
- SendGrid (alternative) — 100 emails/day free tier, official `SendGrid.CSharp` NuGet package available if a typed client is preferred over raw HTTP

## Containerization
- Docker — separate containers for API and SQL Server, `docker-compose` for local dev
- No orchestration (Kubernetes) needed for current scope

## Explicitly out of scope for v1
- Real-time updates (SignalR) — polling/refresh is sufficient
- Message queue / background job infra
