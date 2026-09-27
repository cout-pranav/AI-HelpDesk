# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

Read these before making product/architecture decisions:
- [project-scope.md](project-scope.md) — problem, features, ticket lifecycle/categories, roles, and open questions not yet decided
- [tech-stack.md](tech-stack.md) — chosen stack and rationale
- [implementation-plan.md](implementation-plan.md) — phased task breakdown; check which phase is in progress before adding scope from a later phase

## Commands

### Backend (`backend/TicketManagement.Api`)
```
dotnet build                       # build
dotnet run --launch-profile http   # run at http://localhost:5280 (applies migrations + seeds admin on startup)
dotnet ef migrations add <Name>    # new migration (dotnet-ef installed globally); applied automatically on next run

# Admin seed credentials (one-time setup), stored in the user-secrets secrets.json, read on startup.
# Env var equivalents outside Development: SeedAdmin__Email / SeedAdmin__Password / SeedAdmin__DisplayName.
dotnet user-secrets list                                    # show current values
dotnet user-secrets set "SeedAdmin:Email" "admin@example.com"
dotnet user-secrets set "SeedAdmin:Password" "<password>"
dotnet user-secrets set "SeedAdmin:DisplayName" "Administrator"   # optional
```

### Frontend (`frontend`)
```
npm install
npm run dev       # run at http://localhost:5173
npm run build     # tsc -b && vite build
npx tsc -b        # type-check only
npm run lint      # oxlint
```

No test suite exists yet in either project.

## Architecture

Two-project full-stack layout, no shared package boundary:
- `backend/TicketManagement.Api` — ASP.NET Core Web API. `Program.cs` is minimal-API style (no `Startup.cs`); DbContext registration, CORS policy, and any minimal endpoints (e.g. `/api/health`) are wired directly there. `Data/TicketManagementDbContext.cs` is the EF Core context (SQL Server provider). Minimal-API endpoint groups live in `Endpoints/` as `Map*Endpoints` extension methods called from `Program.cs`.
- `frontend` — React + Vite + TypeScript. Vite config uses Rolldown (`vite` v8 / `rolldown-vite` toolchain), not the standard Rollup-based Vite. API base URL is read from `VITE_API_BASE_URL` (see `.env`), not hardcoded — always use this when calling the backend from new frontend code.

### Auth
- Self-issued JWT (HMAC-SHA256). `Auth/TokenService.cs` issues tokens with `sub`, `email`, `name`, `role` claims. `Program.cs` validates them with `MapInboundClaims = false` and `RoleClaimType = "role"`, so use `RequireAuthorization(p => p.RequireRole(Roles.Admin))` for role-gated endpoints.
- Endpoints: `POST /api/auth/login`, `GET /api/auth/me` (`Endpoints/AuthEndpoints.cs`).
- `Models/User.cs`: `Role` is a string holding a `Roles` constant (`Models/Roles.cs`), `"Admin"` or `"Agent"`, stored as-is in the DB, the JWT and API responses. Emails are stored normalized via `User.NormalizeEmail`. The user row holds no credentials.
- `Models/Account.cs`: a user's sign-in methods live in the `Accounts` table (`Id`, `UserId` → `Users`, `Provider`, `PasswordHash`), unique per `(UserId, Provider)`. `Provider` is an `AuthProviders` constant: `"credential"` holds a password hashed with `PasswordHasher<User>`, while external providers like `"google"` (planned) leave `PasswordHash` null. Login looks up the user's `credential` account.
- Config: `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpiryMinutes` are in `appsettings.json`. The dev-only `Jwt:SigningKey` is in `appsettings.Development.json`.
- Admin seeding is `Data/DbSeeder.cs`, called from `Program.cs` on every startup (there is no separate seed command): it applies pending migrations, then creates the admin from `SeedAdmin:*` if that email doesn't exist yet, and logs a warning and skips if unset. It never updates an existing user, so changing `SeedAdmin:Password` does not change an existing admin's password.
- Frontend: `src/lib/api.ts` exports `api`, an axios instance (base URL from `VITE_API_BASE_URL`) whose interceptors attach the Bearer token, sign the user out on a 401, and turn HTTP error responses into `ApiError` (message from the ProblemDetails `detail`/`title`). `src/auth/AuthProvider.tsx` + `useAuth()` (`src/auth/authContext.ts`) hold the session: the token is React state mirrored to `localStorage` under `auth.token`, the current user is the TanStack query `['auth', 'me']` (enabled only while a token exists), and `useAuth().login` is a `useMutation` result (`login.mutate({ email, password })`, `login.isPending`, `login.error`) that seeds `['auth', 'me']` on success. `logout()` clears the token and the whole query cache. `src/auth/LoginForm.tsx` is rendered by `pages/LoginPage.tsx`.

### Configuration and secrets
- Committed config: `appsettings.json` (JWT issuer/audience/expiry) and `appsettings.Development.json` (LocalDB connection string `TicketManagementDb`, dev JWT signing key).
- Secrets that must not be committed (admin seed credentials) go in dotnet user-secrets (`secrets.json`, via `<UserSecretsId>` in the csproj), never in appsettings or a `.env` file.
- `frontend/.env` is committed on purpose because it only holds the non-secret `VITE_API_BASE_URL`. Frontend secrets would go in a git-ignored `.env.local`. `frontend/.env.example` documents every variable; add new `VITE_*` variables there too.
- `.gitignore` also excludes `.claude/settings.local.json`.

### Cross-cutting conventions
- CORS in `Program.cs` is locked to a single named policy allowing only the Vite dev origin (`http://localhost:5173`). If the frontend dev port changes, update `WithOrigins` to match, or the two won't be able to talk to each other.
- Server state goes through TanStack Query (`@tanstack/react-query` v5): read with `useQuery`, write with `useMutation`, and have every `queryFn`/`mutationFn` call the `api` axios instance (e.g. `api.get<T>(path).then((r) => r.data)`). Don't fetch in `useEffect`, and don't call `fetch` or plain `axios` directly. The single `QueryClient` (in `src/lib/queryClient.ts`, provided in `main.tsx` outside `BrowserRouter`/`AuthProvider`) sets a 30s `staleTime` and skips retries for 4xx `ApiError`s. After a mutation, invalidate or `setQueryData` on the affected query keys.
- Routing uses React Router v7 in declarative mode (imported from `react-router-dom`): `<BrowserRouter>` wraps `AuthProvider` in `main.tsx`, and the route tree lives in `App.tsx`. Protected routes nest under the `auth/RequireAuth.tsx` layout route (redirects to `/login` when there's no user, so `logout()` needs no explicit navigate), then `components/AppLayout.tsx` (nav bar + `<Outlet />`). Pages go in `src/pages/`.
- Docker is deferred to a later phase; local dev currently runs both projects directly (no docker-compose yet), against SQL Server LocalDB (`(localdb)\mssqllocaldb`) on the host, not a container.
- A running backend locks `bin/Debug/.../TicketManagement.Api.exe`, so stop it before `dotnet build` / `dotnet run` or the build fails with MSB3027.
- AI provider access (Claude/Gemini) is meant to sit behind an `IAiService`-style abstraction on the backend once Phase 3 starts — don't call a provider SDK directly from multiple call sites.

## Using Context7

Use the Context7 MCP tools to fetch current documentation whenever working with a library, framework, SDK, API, CLI tool, or cloud service in this repo (ASP.NET Core, EF Core, React, Vite, React Router, Brevo/SendGrid, Claude/Gemini APIs, etc.) — including for setup, config, version-specific API syntax, and migration questions. Prefer this over relying on training data or web search for library docs, since API surfaces (especially fast-moving ones like EF Core and ASP.NET Core minimal APIs) change between versions.

1. Call `resolve-library-id` with the library name first, unless an exact `/org/project` ID is already known.
2. Pick the best-matching library ID (exact name match, relevant description, higher snippet count, High/Medium source reputation, higher benchmark score).
3. Call `query-docs` with that library ID and a specific, single-concept question. Split multi-concept questions into separate calls.
4. Answer from the fetched docs rather than assuming API shape from memory.

Do not use Context7 for refactoring, debugging business logic, or general programming questions unrelated to a specific library's API.
