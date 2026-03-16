#!/usr/bin/env bash
# TAP Protocol: Policy > Authority > Truth
# Helper: prints gh CLI commands with placeholders for creating GitHub Secrets.
# Secrets must be supplied via GitHub Secrets — never committed to the repository.
#
# Usage:
#   ./scripts/export_github_secret_commands.sh
#
# The script will prompt you for each secret value interactively.
# Values are only used to construct the gh CLI commands shown on screen —
# they are NEVER written to any file or logged.

set -euo pipefail

REPO="${GH_REPO:-InfinityXOneSystems/xps-lead-intelligence}"

echo ""
echo "══════════════════════════════════════════════════════════════════════════════"
echo "  XPS Lead Intelligence — GitHub Secrets Setup Helper"
echo "  TAP Protocol: secrets supplied at runtime, never committed."
echo "══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  This script will guide you through creating the required GitHub Secrets."
echo "  You will be prompted for each value. Values are not stored anywhere."
echo "  Requires: gh CLI authenticated with repo:admin scope."
echo ""
echo "  Repository: ${REPO}"
echo ""

# Check gh CLI is available
if ! command -v gh &>/dev/null; then
  echo "[error] gh CLI not found. Install from: https://cli.github.com"
  exit 1
fi

# Prompt helper — reads silently for secrets
read_secret() {
  local name="$1"
  local description="$2"
  local value=""
  echo "  ┌──────────────────────────────────────────────────────────────────────"
  echo "  │ Secret: ${name}"
  echo "  │ Purpose: ${description}"
  echo "  └──────────────────────────────────────────────────────────────────────"
  read -r -s -p "  Enter value (hidden): " value
  echo ""
  if [[ -z "${value}" ]]; then
    echo "  [skip] No value entered — skipping ${name}"
    return 0
  fi
  echo "  [setting] gh secret set ${name} ..."
  echo "${value}" | gh secret set "${name}" --repo "${REPO}" --body -
  echo "  [ok] ${name} set."
  echo ""
}

# ── Required secrets ──────────────────────────────────────────────────────────────

read_secret "RAILWAY_TOKEN" \
  "Railway API token. Obtain from: https://railway.app/account/tokens"

read_secret "RAILWAY_PROJECT_ID" \
  "Railway project ID (UUID). Found in Railway dashboard URL or provisioning script output."

read_secret "VALIDATOR_DATABASE_URL" \
  "Full PostgreSQL connection string for CI Validator job. Format: postgresql://user:pass@host:5432/db. Obtain from Railway: \${Postgres-rF1T.DATABASE_URL}"

read_secret "VALIDATOR_REDIS_URL" \
  "Full Redis connection string for CI Validator job. Format: redis://:pass@host:6379. Obtain from Railway: \${Redis-rF1T.REDIS_URL}"

read_secret "BACKEND_URL" \
  "Public HTTPS URL of the deployed backend service on Railway. E.g. https://backend-xxxx.up.railway.app"

read_secret "FRONTEND_URL" \
  "Public HTTPS URL of the deployed frontend service on Railway. E.g. https://frontend-xxxx.up.railway.app"

read_secret "NEXT_PUBLIC_API_URL" \
  "Public API base URL used by the Next.js frontend. Usually same as BACKEND_URL."

read_secret "JWT_SECRET" \
  "JWT signing secret. Generate with: openssl rand -base64 32"

read_secret "GROQ_API_KEY" \
  "Groq API key for AI inference. Obtain from: https://console.groq.com"

echo ""
echo "══════════════════════════════════════════════════════════════════════════════"
echo "  Done! Secrets have been set in: ${REPO}"
echo ""
echo "  Verify in GitHub: Settings → Secrets and variables → Actions"
echo "  See docs/RAILWAY_SETUP.md for next steps."
echo "══════════════════════════════════════════════════════════════════════════════"
echo ""

# ── Print equivalent gh CLI commands with placeholders (for documentation) ───────
echo "  Equivalent gh CLI commands (with placeholders — do NOT paste real values):"
echo ""
cat <<'COMMANDS'
  gh secret set RAILWAY_TOKEN        --repo InfinityXOneSystems/xps-lead-intelligence --body '<your-railway-token>'
  gh secret set RAILWAY_PROJECT_ID   --repo InfinityXOneSystems/xps-lead-intelligence --body '<your-railway-project-id>'
  gh secret set VALIDATOR_DATABASE_URL --repo InfinityXOneSystems/xps-lead-intelligence --body '<postgresql://user:pass@host:5432/db>'
  gh secret set VALIDATOR_REDIS_URL  --repo InfinityXOneSystems/xps-lead-intelligence --body '<redis://:pass@host:6379>'
  gh secret set BACKEND_URL          --repo InfinityXOneSystems/xps-lead-intelligence --body '<https://your-backend.up.railway.app>'
  gh secret set FRONTEND_URL         --repo InfinityXOneSystems/xps-lead-intelligence --body '<https://your-frontend.up.railway.app>'
  gh secret set NEXT_PUBLIC_API_URL  --repo InfinityXOneSystems/xps-lead-intelligence --body '<https://your-backend.up.railway.app>'
  gh secret set JWT_SECRET           --repo InfinityXOneSystems/xps-lead-intelligence --body '<openssl rand -base64 32 output>'
  gh secret set GROQ_API_KEY         --repo InfinityXOneSystems/xps-lead-intelligence --body '<your-groq-api-key>'
COMMANDS
echo ""
