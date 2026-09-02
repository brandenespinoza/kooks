#!/usr/bin/env bash
#
# Wipe all application data in production and return to a clean bootstrap.
#
#   ./deploy/reset-prod-data.sh
#
# Deletes every user, Break, crew connection, check-in, session and push
# subscription, then restarts the app so the seed recreates the primary user.
# Your existing invite link keeps working — the seed token does not change.
#
# Deliberately a TRUNCATE and not `docker compose down -v`. `down -v` would also
# destroy:
#   - the Caddy volume, and with it your TLS certificate. Certificate authorities
#     rate-limit repeat issuance for a hostname, so a couple of careless cycles
#     can leave the site without HTTPS for hours.
#   - the pgboss schema, and with it the four registered cron schedules.
# This script leaves the schema, the migration history, pg-boss and the
# certificate all intact, and removes only application rows.
set -euo pipefail

HOST="${KOOKS_SSH_HOST:-kooks-deploy}"
APP_DIR="/opt/kooks"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-$HOME/kooks-backups}"

# `_prisma_migrations` is deliberately NOT in this list. Truncating it makes
# Prisma believe no migration has ever run, so the next boot tries to reapply
# all of them against a schema that already exists, and the deploy fails.
TABLES="users, breaks, check_ins, crew_members, sessions, push_subscriptions, notification_prefs, user_saved_breaks"

red()  { printf '\033[1;31m%s\033[0m\n' "$*"; }
cyan() { printf '\033[1;36m%s\033[0m\n' "$*"; }

cyan "==> Target: $HOST ($APP_DIR)"

DOMAIN=$(ssh -n -o BatchMode=yes "$HOST" \
  "grep '^KOOKS_DOMAIN=' $APP_DIR/.env | cut -d'\"' -f2" 2>/dev/null || true)
[ -n "$DOMAIN" ] || { red "Could not read KOOKS_DOMAIN from $APP_DIR/.env — is $HOST right?"; exit 1; }

cyan "==> What is about to be destroyed"
ssh -n -o BatchMode=yes "$HOST" "docker exec kooks-db-1 psql -U postgres -d kooks -tAc \"
  select '    users              : ' || (select count(*) from users)
  union all select '    breaks             : ' || (select count(*) from breaks)
  union all select '    crew connections   : ' || (select count(*) from crew_members)
  union all select '    check-ins          : ' || (select count(*) from check_ins)
  union all select '    sessions           : ' || (select count(*) from sessions)
  union all select '    push subscriptions : ' || (select count(*) from push_subscriptions);\""

echo
red "This permanently deletes all application data on $DOMAIN."
echo "Everyone is signed out, and because this app has no sign-in path, each"
echo "person must re-join via an invite link and will get a NEW account."
echo
if [ ! -t 0 ] && [ ! -r /dev/tty ]; then
  red "Refusing to run non-interactively — this needs a typed confirmation."
  exit 1
fi

printf 'Type the domain to confirm (%s): ' "$DOMAIN"
# From /dev/tty, not stdin: it must be the person at the keyboard, and it must
# work even if the script itself was piped something.
if ! read -r answer < /dev/tty 2>/dev/null; then
  echo
  echo "Aborted (no input) — nothing was changed."
  exit 1
fi
if [ "$answer" != "$DOMAIN" ]; then
  echo "Aborted — nothing was changed."
  exit 1
fi

# ---------------------------------------------------------------------------
# Back up first, always. A reset is exactly when you discover the one row you
# wanted. The dump is pulled to the laptop because a backup that only exists on
# the box you are about to experiment with is not a backup.
# ---------------------------------------------------------------------------
STAMP=$(date +%F-%H%M%S)
REMOTE_DUMP="/tmp/kooks-pre-reset-$STAMP.sql.gz"
mkdir -p "$BACKUP_DIR"

cyan "==> Backing up to $BACKUP_DIR/kooks-pre-reset-$STAMP.sql.gz"
ssh -n -o BatchMode=yes "$HOST" "cd $APP_DIR && $COMPOSE exec -T db pg_dump -U postgres kooks | gzip > $REMOTE_DUMP"
scp -q "$HOST:$REMOTE_DUMP" "$BACKUP_DIR/kooks-pre-reset-$STAMP.sql.gz"
ssh -n -o BatchMode=yes "$HOST" "rm -f $REMOTE_DUMP"
ls -lh "$BACKUP_DIR/kooks-pre-reset-$STAMP.sql.gz" | awk '{print "    saved " $9 " (" $5 ")"}'

cyan "==> Truncating application tables"
ssh -n -o BatchMode=yes "$HOST" \
  "docker exec kooks-db-1 psql -U postgres -d kooks -c 'TRUNCATE $TABLES RESTART IDENTITY CASCADE;'"

cyan "==> Restarting the app so the seed recreates the primary user"
ssh -n -o BatchMode=yes "$HOST" "cd $APP_DIR && $COMPOSE restart app" >/dev/null

cyan "==> Waiting for the app to come back"
PROBE='fetch("http://127.0.0.1:3000/join-required").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
for i in $(seq 1 24); do
  if ssh -n -o BatchMode=yes "$HOST" "cd $APP_DIR && $COMPOSE exec -T app node -e '$PROBE'" 2>/dev/null; then
    echo "    healthy after ${i} attempt(s)"
    break
  fi
  [ "$i" -eq 24 ] && { red "App did not come back within 120s. Check: ssh $HOST 'cd $APP_DIR && $COMPOSE logs --tail=60 app'"; exit 1; }
  sleep 5
done

cyan "==> Verifying"
ssh -n -o BatchMode=yes "$HOST" "docker exec kooks-db-1 psql -U postgres -d kooks -tAc \"
  select '    users=' || (select count(*) from users)
      || ' breaks=' || (select count(*) from breaks)
      || ' checkins=' || (select count(*) from check_ins)
      || '   (users=1 is the reseeded primary user)';\""

TOKEN=$(ssh -n -o BatchMode=yes "$HOST" "docker exec kooks-db-1 psql -U postgres -d kooks -tAc 'select invite_token from users limit 1;'")
echo
cyan "==> Done. Your way back in:"
echo "    https://$DOMAIN/join/$TOKEN"
echo
echo "    Restore this backup with:"
echo "      gunzip -c $BACKUP_DIR/kooks-pre-reset-$STAMP.sql.gz | ssh $HOST 'docker exec -i kooks-db-1 psql -U postgres -d kooks'"
