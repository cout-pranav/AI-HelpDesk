# One image: the ASP.NET Core API, serving the built React frontend from wwwroot on the same origin.

# --- Frontend build ---
FROM node:24-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Empty base URL: the app calls relative /api/... on the origin that served it. Variables already in
# the environment win over the .env files. The optional keys end up in the public JS bundle; the
# Gemini one powers the local-demo Polish/Summarize buttons.
ARG VITE_GEMINI_API_KEY=""
ARG VITE_SENTRY_DSN=""
ENV VITE_API_BASE_URL="" \
    VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build

# --- Backend build ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY backend/TicketManagement.Api/TicketManagement.Api.csproj backend/TicketManagement.Api/
RUN dotnet restore backend/TicketManagement.Api/TicketManagement.Api.csproj
COPY backend/ backend/
RUN dotnet publish backend/TicketManagement.Api/TicketManagement.Api.csproj -c Release -o /app --no-restore

# --- Runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=backend /app ./
COPY --from=frontend /src/frontend/dist ./wwwroot
# The base image listens on 8080 (ASPNETCORE_HTTP_PORTS); run as its non-root "app" user.
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "TicketManagement.Api.dll"]
