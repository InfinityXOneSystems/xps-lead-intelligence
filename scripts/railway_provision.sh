#!/usr/bin/env bash
# TAP Protocol: Policy > Authority > Truth
# This script provisions Railway infrastructure for xps-lead-intelligence.
# Secrets must be supplied via GitHub Secrets or environment variables — never committed.
#
# Usage:
#   RAILWAY_TOKEN=<token> ./scripts/railway_provision.sh
#
# All required values must be injected as environment variables.
# See docs/RAILWAY_SETUP.md for full instructions.

set -euo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────────
RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-}"
PROJECT_NAME="${PROJECT_NAME:-Lead Intelligence}"
BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-backend}"
FRONTEND_SERVICE_NAME="${FRONTEND_SERVICE_NAME:-frontend}"
POSTGRES_SERVICE_NAME="${POSTGRES_SERVICE_NAME:-Postgres-rF1T}"
REDIS_SERVICE_NAME="${REDIS_SERVICE_NAME:-Redis-rF1T}"

# ── Helpers ──────────────────────────────────────────────────────────────────────

log()  { echo "[provision] $*"; }
warn() { echo "[provision][WARN] $*" >&2; }
die()  { echo "[provision][ERROR] $*" >&2; exit 1; }

# Print a masked representation of a value (never print actual secret)
mask() { echo "***masked***"; }

# ── Preflight ────────────────────────────────────────────────────────────────────
log "Starting Railway provisioning for project: ${PROJECT_NAME}"

[[ -z "${RAILWAY_TOKEN:-}" ]] && die "RAILWAY_TOKEN is required but not set. Supply it via environment variable or GitHub Secrets."

# ── Ensure railway CLI is available ─────────────────────────────────────────────
if ! command -v railway &>/dev/null; then
  log "railway CLI not found — installing temporarily via npm..."
  npm install -g @railway/cli --silent || die "Failed to install @railway/cli"
fi

RAILWAY_VERSION=$(railway --version 2>/dev/null || echo "unknown")
log "Using railway CLI version: ${RAILWAY_VERSION}"

# ── Authenticate ─────────────────────────────────────────────────────────────────
# railway CLI picks up RAILWAY_TOKEN automatically from the environment.
log "Authenticating with Railway using RAILWAY_TOKEN ($(mask))"

# ── Project: create or connect ────────────────────────────────────────────────────
if [[ -n "${RAILWAY_PROJECT_ID}" ]]; then
  log "Using existing RAILWAY_PROJECT_ID: ${RAILWAY_PROJECT_ID}"
  export RAILWAY_PROJECT_ID
else
  log "RAILWAY_PROJECT_ID not set — attempting to list projects and find '${PROJECT_NAME}'..."
  # List projects; try to find by name using JSON output
  PROJECTS_JSON=$(railway project list --json 2>/dev/null || echo "[]")
  FOUND_ID=$(echo "${PROJECTS_JSON}" | PROJECT_NAME="${PROJECT_NAME}" python3 -c "
import sys, json, os
target = os.environ.get('PROJECT_NAME', '').lower()
projects = json.load(sys.stdin)
for p in projects:
    if p.get('name','').lower() == target:
        print(p.get('id',''))
        break
" 2>/dev/null || true)

  if [[ -n "${FOUND_ID}" ]]; then
    log "Found existing project '${PROJECT_NAME}' with ID: ${FOUND_ID}"
    RAILWAY_PROJECT_ID="${FOUND_ID}"
    export RAILWAY_PROJECT_ID
  else
    log "Project '${PROJECT_NAME}' not found — creating..."
    CREATE_OUT=$(railway project create --name "${PROJECT_NAME}" --json 2>/dev/null || echo "{}")
    RAILWAY_PROJECT_ID=$(echo "${CREATE_OUT}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || true)
    [[ -z "${RAILWAY_PROJECT_ID}" ]] && die "Failed to create or obtain project ID for '${PROJECT_NAME}'"
    log "Created project '${PROJECT_NAME}' with ID: ${RAILWAY_PROJECT_ID}"
    export RAILWAY_PROJECT_ID
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  RAILWAY_PROJECT_ID = ${RAILWAY_PROJECT_ID}"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── Helper: check if a service exists in the project ────────────────────────────
service_exists() {
  local name="$1"
  railway service list --project "${RAILWAY_PROJECT_ID}" --json 2>/dev/null \
    | SERVICE_NAME="${name}" python3 -c "
import sys, json, os
target = os.environ.get('SERVICE_NAME', '').lower()
services = json.load(sys.stdin)
for s in services:
    if s.get('name','').lower() == target:
        print('yes')
        break
" 2>/dev/null || true
}

# ── Postgres service ──────────────────────────────────────────────────────────────
log "Checking for Postgres service '${POSTGRES_SERVICE_NAME}'..."
POSTGRES_EXISTS=$(service_exists "${POSTGRES_SERVICE_NAME}" || true)
if [[ "${POSTGRES_EXISTS}" == "yes" ]]; then
  log "Postgres service '${POSTGRES_SERVICE_NAME}' already exists — skipping creation."
else
  log "Creating Postgres service '${POSTGRES_SERVICE_NAME}'..."
  railway add --plugin postgresql --name "${POSTGRES_SERVICE_NAME}" \
    --project "${RAILWAY_PROJECT_ID}" \
    || warn "Could not create Postgres service (may already exist under a different name — verify in Railway dashboard)"
fi
log "Postgres Railway variable reference: \${${POSTGRES_SERVICE_NAME}.DATABASE_URL}"

# ── Redis service ─────────────────────────────────────────────────────────────────
log "Checking for Redis service '${REDIS_SERVICE_NAME}'..."
REDIS_EXISTS=$(service_exists "${REDIS_SERVICE_NAME}" || true)
if [[ "${REDIS_EXISTS}" == "yes" ]]; then
  log "Redis service '${REDIS_SERVICE_NAME}' already exists — skipping creation."
else
  log "Creating Redis service '${REDIS_SERVICE_NAME}'..."
  railway add --plugin redis --name "${REDIS_SERVICE_NAME}" \
    --project "${RAILWAY_PROJECT_ID}" \
    || warn "Could not create Redis service (may already exist — verify in Railway dashboard)"
fi
log "Redis Railway variable reference: \${${REDIS_SERVICE_NAME}.REDIS_URL}"

# ── Backend service ───────────────────────────────────────────────────────────────
log "Checking for backend service '${BACKEND_SERVICE_NAME}'..."
BACKEND_EXISTS=$(service_exists "${BACKEND_SERVICE_NAME}" || true)
if [[ "${BACKEND_EXISTS}" == "yes" ]]; then
  log "Backend service '${BACKEND_SERVICE_NAME}' already exists — skipping creation."
else
  log "Creating backend service '${BACKEND_SERVICE_NAME}' (source root: backend/)..."
  railway add --service "${BACKEND_SERVICE_NAME}" \
    --project "${RAILWAY_PROJECT_ID}" \
    || warn "Could not create backend service — verify in Railway dashboard"
fi

# ── Frontend service ──────────────────────────────────────────────────────────────
log "Checking for frontend service '${FRONTEND_SERVICE_NAME}'..."
FRONTEND_EXISTS=$(service_exists "${FRONTEND_SERVICE_NAME}" || true)
if [[ "${FRONTEND_EXISTS}" == "yes" ]]; then
  log "Frontend service '${FRONTEND_SERVICE_NAME}' already exists — skipping creation."
else
  log "Creating frontend service '${FRONTEND_SERVICE_NAME}' (source root: frontend/)..."
  railway add --service "${FRONTEND_SERVICE_NAME}" \
    --project "${RAILWAY_PROJECT_ID}" \
    || warn "Could not create frontend service — verify in Railway dashboard"
fi

# ── Link Postgres + Redis to backend ─────────────────────────────────────────────
log "Linking Postgres and Redis to backend service..."
log "  (Set Railway variable DATABASE_URL=\${${POSTGRES_SERVICE_NAME}.DATABASE_URL} on service '${BACKEND_SERVICE_NAME}')"
log "  (Set Railway variable REDIS_URL=\${${REDIS_SERVICE_NAME}.REDIS_URL} on service '${BACKEND_SERVICE_NAME}')"

# Set Railway variables on the backend service (placeholders for operator to fill in)
# DATABASE_URL and REDIS_URL use Railway's internal variable reference syntax.
railway variables set \
  "DATABASE_URL=\${${POSTGRES_SERVICE_NAME}.DATABASE_URL}" \
  "REDIS_URL=\${${REDIS_SERVICE_NAME}.REDIS_URL}" \
  "NODE_ENV=production" \
  --service "${BACKEND_SERVICE_NAME}" \
  --project "${RAILWAY_PROJECT_ID}" \
  2>/dev/null || warn "Could not set Railway variables automatically — set them manually in the Railway dashboard per docs/RAILWAY_SETUP.md"

# ── Print GitHub Secrets to create ───────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════════════════"
echo "  PROVISIONING COMPLETE — REQUIRED GITHUB SECRETS"
echo "══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Create the following secrets in GitHub → Settings → Secrets and variables → Actions:"
echo ""
echo "  Secret name              | Value / source"
echo "  ─────────────────────────|────────────────────────────────────────────────"
echo "  RAILWAY_TOKEN            | Your Railway API token (already needed to run this script)"
echo "  RAILWAY_PROJECT_ID       | ${RAILWAY_PROJECT_ID}"
echo "  VALIDATOR_DATABASE_URL   | Obtain from Railway: \${${POSTGRES_SERVICE_NAME}.DATABASE_URL}"
echo "  VALIDATOR_REDIS_URL      | Obtain from Railway: \${${REDIS_SERVICE_NAME}.REDIS_URL}"
echo "  BACKEND_URL              | https://<your-backend-service>.up.railway.app"
echo "  FRONTEND_URL             | https://<your-frontend-service>.up.railway.app"
echo "  NEXT_PUBLIC_API_URL      | Same as BACKEND_URL"
echo "  JWT_SECRET               | Generate: openssl rand -base64 32"
echo "  GROQ_API_KEY             | Obtain from https://console.groq.com"
echo ""
echo "  IMPORTANT: Never commit real secrets to this repository."
echo "  See docs/RAILWAY_SETUP.md for full instructions."
echo "══════════════════════════════════════════════════════════════════════════════"
echo ""

# Write summary to GITHUB_STEP_SUMMARY if available (Actions context)
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat >> "${GITHUB_STEP_SUMMARY}" <<SUMMARY
## Railway Provisioning Summary

| Resource | Status |
|----------|--------|
| Project ID | \`${RAILWAY_PROJECT_ID}\` |
| Postgres service | \`${POSTGRES_SERVICE_NAME}\` |
| Redis service | \`${REDIS_SERVICE_NAME}\` |
| Backend service | \`${BACKEND_SERVICE_NAME}\` |
| Frontend service | \`${FRONTEND_SERVICE_NAME}\` |

### GitHub Secrets to create

| Secret Name | Notes |
|-------------|-------|
| \`RAILWAY_TOKEN\` | Your Railway API token |
| \`RAILWAY_PROJECT_ID\` | \`${RAILWAY_PROJECT_ID}\` |
| \`VALIDATOR_DATABASE_URL\` | Copy from Railway: \`\${${POSTGRES_SERVICE_NAME}.DATABASE_URL}\` |
| \`VALIDATOR_REDIS_URL\` | Copy from Railway: \`\${${REDIS_SERVICE_NAME}.REDIS_URL}\` |
| \`BACKEND_URL\` | Your Railway backend public URL |
| \`FRONTEND_URL\` | Your Railway frontend public URL |
| \`NEXT_PUBLIC_API_URL\` | Same as BACKEND_URL |
| \`JWT_SECRET\` | Run: \`openssl rand -base64 32\` |
| \`GROQ_API_KEY\` | From https://console.groq.com |

See [docs/RAILWAY_SETUP.md](docs/RAILWAY_SETUP.md) for full setup instructions.
SUMMARY
fi

log "Provisioning script completed successfully."
