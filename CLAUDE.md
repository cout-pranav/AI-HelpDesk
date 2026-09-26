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
dotnet run --launch-profile http   # run at http://localhost:5280
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
- `backend/TicketManagement.Api` — ASP.NET Core Web API. `Program.cs` is minimal-API style (no `Startup.cs`); DbContext registration, CORS policy, and any minimal endpoints (e.g. `/api/health`) are wired directly there. `Data/TicketManagementDbContext.cs` is the EF Core context (SQL Server provider), currently empty pending Phase 1 entities.
- `frontend` — React + Vite + TypeScript. Vite config uses Rolldown (`vite` v8 / `rolldown-vite` toolchain), not the standard Rollup-based Vite. API base URL is read from `VITE_API_BASE_URL` (see `.env`), not hardcoded — always use this when calling the backend from new frontend code.

### Cross-cutting conventions
- CORS in `Program.cs` is locked to a single named policy allowing only the Vite dev origin (`http://localhost:5173`). If the frontend dev port changes, update `WithOrigins` to match, or the two won't be able to talk to each other.
- `react-router-dom` is installed but intentionally not wired up yet — routing is deferred to Phase 1 (auth + protected routes) per implementation-plan.md.
- Docker is deferred to a later phase; local dev currently runs both projects directly (no docker-compose yet), against a locally-installed SQL Server (not LocalDB-in-container).
- AI provider access (Claude/Gemini) is meant to sit behind an `IAiService`-style abstraction on the backend once Phase 3 starts — don't call a provider SDK directly from multiple call sites.

## Using Context7

Use the Context7 MCP tools to fetch current documentation whenever working with a library, framework, SDK, API, CLI tool, or cloud service in this repo (ASP.NET Core, EF Core, React, Vite, React Router, Brevo/SendGrid, Claude/Gemini APIs, etc.) — including for setup, config, version-specific API syntax, and migration questions. Prefer this over relying on training data or web search for library docs, since API surfaces (especially fast-moving ones like EF Core and ASP.NET Core minimal APIs) change between versions.

1. Call `resolve-library-id` with the library name first, unless an exact `/org/project` ID is already known.
2. Pick the best-matching library ID (exact name match, relevant description, higher snippet count, High/Medium source reputation, higher benchmark score).
3. Call `query-docs` with that library ID and a specific, single-concept question. Split multi-concept questions into separate calls.
4. Answer from the fetched docs rather than assuming API shape from memory.

Do not use Context7 for refactoring, debugging business logic, or general programming questions unrelated to a specific library's API.
