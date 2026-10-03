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

### E2E tests (`frontend`, Playwright)
```
npx playwright install chromium   # one-time browser download
npm run test:e2e                  # starts the E2E backend + frontend, runs e2e/*.spec.ts
npm run test:e2e:ui               # Playwright UI mode
```

No test cases exist yet; only the Playwright setup.

## Architecture

Two-project full-stack layout, no shared package boundary:
- `backend/TicketManagement.Api` — ASP.NET Core Web API. `Program.cs` is minimal-API style (no `Startup.cs`); DbContext registration, CORS policy, and any minimal endpoints (e.g. `/api/health`) are wired directly there. `Data/TicketManagementDbContext.cs` is the EF Core context (SQL Server provider). Minimal-API endpoint groups live in `Endpoints/` as `Map*Endpoints` extension methods called from `Program.cs`.
- `frontend` — React + Vite + TypeScript. Vite config uses Rolldown (`vite` v8 / `rolldown-vite` toolchain), not the standard Rollup-based Vite. API base URL is read from `VITE_API_BASE_URL` (see `.env`), not hardcoded — always use this when calling the backend from new frontend code.

### Auth
- Self-issued JWT (HMAC-SHA256). `Auth/TokenService.cs` issues tokens with `sub`, `email`, `name`, `role` claims. `Program.cs` validates them with `MapInboundClaims = false` and `RoleClaimType = "role"`, so use `RequireAuthorization(p => p.RequireRole(Roles.Admin))` for role-gated endpoints.
- Endpoints: `POST /api/auth/login`, `GET /api/auth/me` (`Endpoints/AuthEndpoints.cs`).
- Login rate limiting (`Auth/LoginRateLimiting.cs`: 10 req/min per IP, plus failed-attempt caps per email+IP and per email) is enabled only when the host environment is Production (`AddLoginRateLimiting(enabled: builder.Environment.IsProduction())`), i.e. `ASPNETCORE_ENVIRONMENT=Production` or the variable unset, since ASP.NET Core defaults to Production. The local launch profiles set `Development` (`http`/`https`) or `Testing` (`e2e`), where the policy is a no-op and failed logins aren't counted, so don't expect 429s locally. Any other environment name (e.g. `Staging`) also runs without rate limiting.
- `Models/User.cs`: `Role` is a string holding a `Roles` constant (`Models/Roles.cs`), `"Admin"` or `"Agent"`, stored as-is in the DB, the JWT and API responses. Emails are stored normalized via `User.NormalizeEmail`. The user row holds no credentials.
- `Models/Account.cs`: a user's sign-in methods live in the `Accounts` table (`Id`, `UserId` → `Users`, `Provider`, `PasswordHash`), unique per `(UserId, Provider)`. `Provider` is an `AuthProviders` constant: `"credential"` holds a password hashed with `PasswordHasher<User>`, while external providers like `"google"` (planned) leave `PasswordHash` null. Login looks up the user's `credential` account.
- Config: `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpiryMinutes` are in `appsettings.json`. The dev-only `Jwt:SigningKey` is in `appsettings.Development.json`.
- Admin seeding is `Data/DbSeeder.cs`, called from `Program.cs` on every startup (there is no separate seed command): it applies pending migrations, then creates the admin from `SeedAdmin:*` if that email doesn't exist yet, and logs a warning and skips if unset. It never updates an existing user, so changing `SeedAdmin:Password` does not change an existing admin's password.
- Frontend: `src/lib/api.ts` exports `api`, an axios instance (base URL from `VITE_API_BASE_URL`) whose interceptors attach the Bearer token, sign the user out on a 401, and turn HTTP error responses into `ApiError` (message from the ProblemDetails `detail`/`title`). `src/auth/AuthProvider.tsx` + `useAuth()` (`src/auth/authContext.ts`) hold the session: the token is React state mirrored to `localStorage` under `auth.token`, the current user is the TanStack query `['auth', 'me']` (enabled only while a token exists), and `useAuth().login` is a `useMutation` result (`login.mutate({ email, password })`, `login.isPending`, `login.error`) that seeds `['auth', 'me']` on success. `logout()` clears the token and the whole query cache. `src/auth/LoginForm.tsx` is rendered by `pages/LoginPage.tsx`.

### Configuration and secrets
- Environments come from `ASPNETCORE_ENVIRONMENT`: `Development` (launch profiles `http`/`https`), `Testing` (launch profile `e2e`, Playwright only), and `Production` (deployed, or the variable unset). Environment-dependent behaviour: OpenAPI is mapped only in Development, the database is dropped and recreated on startup only in Testing, and login rate limiting runs only in Production.
- Committed config: `appsettings.json` (JWT issuer/audience/expiry, CORS origins), `appsettings.Development.json` (LocalDB connection string `TicketManagementDb`, dev JWT signing key) and `appsettings.Testing.json` (`TicketManagementDb_E2E` connection string, test-only JWT signing key, E2E CORS origin).
- Secrets that must not be committed (admin seed credentials) go in dotnet user-secrets (`secrets.json`, via `<UserSecretsId>` in the csproj), never in appsettings or a `.env` file. User-secrets load only in Development. The one deliberate exception is the E2E admin in `frontend/e2e/testUsers.ts`: it is committed because it only ever exists in the throwaway `TicketManagementDb_E2E`.
- `frontend/.env` is committed on purpose because it only holds the non-secret `VITE_API_BASE_URL`. Frontend secrets would go in a git-ignored `.env.local`. `frontend/.env.example` documents every variable; add new `VITE_*` variables there too.
- `.gitignore` also excludes `.claude/settings.local.json`.

### Cross-cutting conventions
- CORS in `Program.cs` is a single named policy whose origins come from `Cors:AllowedOrigins` (`appsettings.json`: the Vite dev origin `http://localhost:5173`; `appsettings.Testing.json`: `http://localhost:5174`). If a frontend port changes, update the matching setting, or the two won't be able to talk to each other.
- Server state goes through TanStack Query (`@tanstack/react-query` v5): read with `useQuery`, write with `useMutation`, and have every `queryFn`/`mutationFn` call the `api` axios instance (e.g. `api.get<T>(path).then((r) => r.data)`). Don't fetch in `useEffect`, and don't call `fetch` or plain `axios` directly. The single `QueryClient` (in `src/lib/queryClient.ts`, provided in `main.tsx` outside `BrowserRouter`/`AuthProvider`) sets a 30s `staleTime` and skips retries for 4xx `ApiError`s. After a mutation, invalidate or `setQueryData` on the affected query keys.
- Forms use React Hook Form (`react-hook-form` v7) with Zod (`zod` v4) schemas via `zodResolver` from `@hookform/resolvers/zod`: define a schema next to the form, type values with `z.infer<typeof schema>`, bind inputs with `register`, show `formState.errors` per field, and set `noValidate` on the `<form>` so Zod, not the browser, does the validation. The submit handler passes the parsed values to a `useMutation`. `src/auth/LoginForm.tsx` is the reference.
- Styling is Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no `tailwind.config.js`, no PostCSS config), with shadcn/ui (`components.json`: `base-nova` style, i.e. Base UI primitives, neutral base color, lucide icons). Add components with `npx shadcn@latest add <name>` (they land in `src/components/ui/`); `cn()` comes from `@/lib/utils`. Imports use the `@/` alias for `src/` (set in `tsconfig.json`, `tsconfig.app.json` and `vite.config.ts`). `src/index.css` holds the shadcn theme tokens (`--background`, `--primary`, ...) and base styles; prefer the semantic token utilities (`bg-background`, `text-muted-foreground`, `bg-primary`) over raw palette colors, style with utility classes in `className`, and don't add custom CSS files or class names. Dark mode follows the OS: the `dark` variant and the dark token set are both keyed to `prefers-color-scheme: dark` (not shadcn's default `.dark` class), and `<html>` has `scheme-light-dark` in `index.html`.
- Routing uses React Router v7 in declarative mode (imported from `react-router-dom`): `<BrowserRouter>` wraps `AuthProvider` in `main.tsx`, and the route tree lives in `App.tsx`. Protected routes nest under the `auth/RequireAuth.tsx` layout route (redirects to `/login` when there's no user, so `logout()` needs no explicit navigate), then `components/AppLayout.tsx` (nav bar + `<Outlet />`). Role-gated pages nest further under `<RequireRole role="Admin" />` (`auth/RequireRole.tsx`), which redirects users without that role to `/` (e.g. the admin-only `/users` page). This only hides UI; the matching backend endpoints must still enforce the role. Pages go in `src/pages/`.
- E2E (Playwright, `frontend/playwright.config.ts`, tests in `frontend/e2e/`) runs its own stack on separate ports so it never touches dev: the backend via the `e2e` launch profile (`http://localhost:5281`, `ASPNETCORE_ENVIRONMENT=Testing`, `appsettings.Testing.json`) and Vite in `--mode e2e` on `http://localhost:5174` (`.env.e2e` points it at 5281). The Testing environment uses the separate LocalDB database `TicketManagementDb_E2E`, which `DbSeeder` drops and re-migrates on every startup. The seeded admin comes from `e2e/testUsers.ts` (passed as `SeedAdmin__*` env vars); import it in tests to log in. The E2E backend builds into `bin/e2e/`, so it runs alongside a running dev backend. Tests run serially (`workers: 1`) since they share one database.
- Docker is deferred to a later phase; local dev currently runs both projects directly (no docker-compose yet), against SQL Server LocalDB (`(localdb)\mssqllocaldb`) on the host, not a container.
- A running backend locks `bin/Debug/.../TicketManagement.Api.exe`, so stop it before `dotnet build` / `dotnet run` or the build fails with MSB3027. (The E2E backend avoids this by building with `-p:OutDir=bin/e2e/`.)
- AI provider access (Claude/Gemini) is meant to sit behind an `IAiService`-style abstraction on the backend once Phase 3 starts — don't call a provider SDK directly from multiple call sites.

## Using Context7

Use the Context7 MCP tools to fetch current documentation whenever working with a library, framework, SDK, API, CLI tool, or cloud service in this repo (ASP.NET Core, EF Core, React, Vite, React Router, Brevo/SendGrid, Claude/Gemini APIs, etc.) — including for setup, config, version-specific API syntax, and migration questions. Prefer this over relying on training data or web search for library docs, since API surfaces (especially fast-moving ones like EF Core and ASP.NET Core minimal APIs) change between versions.

1. Call `resolve-library-id` with the library name first, unless an exact `/org/project` ID is already known.
2. Pick the best-matching library ID (exact name match, relevant description, higher snippet count, High/Medium source reputation, higher benchmark score).
3. Call `query-docs` with that library ID and a specific, single-concept question. Split multi-concept questions into separate calls.
4. Answer from the fetched docs rather than assuming API shape from memory.

Do not use Context7 for refactoring, debugging business logic, or general programming questions unrelated to a specific library's API.
