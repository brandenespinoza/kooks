#!/usr/bin/env bash
#
# Generates the production .env for the Linode. Run from the repo root:
#
#   ./deploy/make-env.sh
#
# Writes ./.env.production (gitignored). Nothing is sent anywhere — you copy it
# up yourself, so no secret is ever pasted into a remote shell or a CI log.
#
# Re-running generates NEW secrets. Do not re-run against a live deployment
# without reading the warning next to each one below.
set -euo pipefail

OUT=".env.production"

if [[ ! -f package.json ]]; then
  echo "Run this from the repo root." >&2
  exit 1
fi

if [[ -f "$OUT" ]]; then
  echo "$OUT already exists. Move it aside first — overwriting it would rotate"
  echo "every secret, which invalidates live sessions, push subscriptions and the"
  echo "invite links you have already handed out."
  exit 1
fi

ask() {
  local prompt="$1" default="${2:-}" value
  if [[ -n "$default" ]]; then
    read -rp "$prompt [$default]: " value
    printf '%s' "${value:-$default}"
  else
    read -rp "$prompt: " value
    while [[ -z "$value" ]]; do
      read -rp "  (required) $prompt: " value
    done
    printf '%s' "$value"
  fi
}

echo "Kooks production environment"
echo "----------------------------"
DOMAIN=$(ask "Domain (e.g. kooks.example.com)")
ACME_EMAIL=$(ask "Email for Let's Encrypt expiry notices")
GHCR_IMAGE=$(ask "Image tag" "ghcr.io/brandenespinoza/kooks:latest")
TIMEZONE=$(ask "Crew timezone (IANA)" "America/New_York")
OPENAI_KEY=$(ask "OPENAI_API_KEY")
PUSH_EMAIL=$(ask "Contact mailto: for push (VAPID subject)" "mailto:${ACME_EMAIL}")

echo
echo "Generating secrets..."

# 32 random bytes each. Not cuid: these are bearer secrets and want real entropy.
PGPASS=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)
SEED_TOKEN=$(uuidgen | tr '[:upper:]' '[:lower:]')

# VAPID keypair, from the web-push package already in node_modules.
# Rotating these later silently breaks every existing push subscription —
# the browser's endpoint stays valid but the signature no longer verifies.
#
# Deliberately NOT `read ... < <(...)`: `read` returns non-zero when it reaches
# EOF without a trailing newline, which under `set -e` kills this script after
# it has printed "Generating secrets..." and before it writes anything — a
# silent failure with no file and no error.
VAPID_PAIR=$(node -e "const k=require('web-push').generateVAPIDKeys();console.log(k.publicKey+' '+k.privateKey)")
VAPID_PUBLIC=${VAPID_PAIR%% *}
VAPID_PRIVATE=${VAPID_PAIR##* }

if [[ -z "$VAPID_PUBLIC" || -z "$VAPID_PRIVATE" || "$VAPID_PUBLIC" == "$VAPID_PRIVATE" ]]; then
  echo "Failed to generate VAPID keys — is node_modules installed? Run npm install." >&2
  exit 1
fi

umask 077
cat > "$OUT" <<ENV
# Kooks — production. Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) by deploy/make-env.sh
# Lives at /opt/kooks/.env on the server. Never commit this file.

# --- deployment ---
KOOKS_IMAGE="${GHCR_IMAGE}"
KOOKS_DOMAIN="${DOMAIN}"
ACME_EMAIL="${ACME_EMAIL}"

# --- database ---
# Consumed by docker-compose.yml for both the postgres container and DATABASE_URL.
# DATABASE_URL itself is set by compose, not here — compose's \`environment:\` block
# overrides env_file, so a value here would be ignored and misleading.
POSTGRES_PASSWORD="${PGPASS}"
DATABASE_URL="postgresql://postgres:${PGPASS}@db:5432/kooks"

# --- auth ---
# The bootstrap invite. prisma/seed.mjs upserts the primary user on this token at
# every container start, so it is how you get into a fresh deployment:
#   https://${DOMAIN}/join/${SEED_TOKEN}
SEED_INVITE_TOKEN="${SEED_TOKEN}"

# --- conditions ---
# SwellCloud has never completed a connection (tabled 2026-09-01; Open-Meteo Marine is the
# leading replacement). Until one lands this runs on synthetic conditions, so the poll, the
# FR-8 model-run gate and the LLM verdict are all exercised instead of sitting dark behind a
# dead upstream. Owner's call 2026-09-02, overriding the earlier "real source or nothing".
#
# The numbers are INVENTED, so the VerdictBand labels them "Simulated — not a forecast" on
# every screen that shows them. If that label is ever removed, put this back to "swellcloud"
# in the same commit. SWELLCLOUD_API_KEY is unread while this is "mock", but src/env.js
# still requires it to be non-empty.
SWELLCLOUD_API_KEY="placeholder"
CONDITIONS_SOURCE="mock"
OPENAI_API_KEY="${OPENAI_KEY}"

# --- app ---
APP_TIMEZONE="${TIMEZONE}"
WEBCAM_URLS_JSON="{}"

# --- web push ---
WEB_PUSH_PUBLIC_KEY="${VAPID_PUBLIC}"
WEB_PUSH_PRIVATE_KEY="${VAPID_PRIVATE}"
WEB_PUSH_EMAIL="${PUSH_EMAIL}"
ENV

chmod 600 "$OUT"

cat <<SUMMARY

Wrote ${OUT} (mode 600, gitignored).

  Domain       : ${DOMAIN}
  Image        : ${GHCR_IMAGE}
  Your way in  : https://${DOMAIN}/join/${SEED_TOKEN}

Copy it up once the Linode exists:

  scp ${OUT} deploy@<ip>:/opt/kooks/.env

Keep a copy somewhere safe. The VAPID keys are not recoverable from the
server if you lose the box, and regenerating the pair unsubscribes everyone.

SUMMARY
