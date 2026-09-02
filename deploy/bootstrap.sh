#!/usr/bin/env bash
#
# One-time provisioning for a fresh Debian or Ubuntu Linode.
#
# Run as root on the new box, once:
#   scp deploy/bootstrap.sh root@<ip>:/tmp/ && ssh root@<ip> 'bash /tmp/bootstrap.sh'
#
# Idempotent: safe to re-run. It installs Docker, creates the deploy user, opens only
# 22/80/443, adds swap, and creates /opt/kooks. It does NOT deploy the app — CI does that
# once the GitHub secrets point here.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="/opt/kooks"
SWAP_SIZE="${SWAP_SIZE:-2G}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn] %s\033[0m\n' "$*"; }

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run this as root on the Linode." >&2
  exit 1
fi

log "Setting hostname"
hostnamectl set-hostname "${HOSTNAME_SET:-kooks}"
grep -q "${HOSTNAME_SET:-kooks}" /etc/hosts || sed -i "1s/^/127.0.1.1 ${HOSTNAME_SET:-kooks}\n/" /etc/hosts

log "Updating base system"
export DEBIAN_FRONTEND=noninteractive
# Ubuntu 24.04 ships needrestart, which prompts mid-apt even when apt is silenced.
export NEEDRESTART_MODE=a
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl gnupg ufw fail2ban unattended-upgrades

# ---------------------------------------------------------------------------
# Swap. A Nanode has 1GB of RAM and no swap. Postgres, the Next.js server and a
# migration running at the same moment is the spike that kills a swapless box —
# and it happens at container start, so the failure looks like "deploy hangs".
# ---------------------------------------------------------------------------
if ! swapon --show | grep -q '/swapfile'; then
  log "Creating ${SWAP_SIZE} swapfile"
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Prefer RAM; swap is an overflow valve here, not a working surface.
  sysctl -qw vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  log "Swap already present — skipping"
fi

# ---------------------------------------------------------------------------
# Docker, from Docker's own repo. Debian's packaged docker.io lags badly and
# ships no compose plugin, which the deploy workflow calls as `docker compose`.
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  # Docker publishes a separate repo per distro. Pointing Ubuntu at the Debian
  # repo 404s on the release file and surfaces as an opaque apt failure.
  . /etc/os-release
  case "$ID" in
    debian|ubuntu) DOCKER_DISTRO="$ID" ;;
    *) echo "Unsupported distro: $ID (expected debian or ubuntu)" >&2; exit 1 ;;
  esac
  log "Installing Docker CE for ${ID} ${VERSION_CODENAME}"

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${DOCKER_DISTRO}/gpg" \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/${DOCKER_DISTRO} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker already installed — skipping"
fi

# Cap the journal and container logs. An SSE app with a 25s heartbeat and a job
# every 5 minutes writes steadily; the default is unbounded and fills a 25GB disk.
log "Bounding log growth"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl restart docker

# ---------------------------------------------------------------------------
# Deploy user. CI SSHes in as this account; it needs docker but not sudo.
# ---------------------------------------------------------------------------
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  log "Creating ${DEPLOY_USER} user"
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
else
  log "User ${DEPLOY_USER} already exists — skipping"
fi
usermod -aG docker "$DEPLOY_USER"

# Carry root's authorized_keys over, so the key you used to get here also works
# for the deploy user and you are never locked out mid-setup.
if [[ -f /root/.ssh/authorized_keys ]]; then
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/${DEPLOY_USER}/.ssh"
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
    /root/.ssh/authorized_keys "/home/${DEPLOY_USER}/.ssh/authorized_keys"
fi

log "Creating ${APP_DIR}"
mkdir -p "$APP_DIR"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$APP_DIR"

# ---------------------------------------------------------------------------
# Firewall. Postgres is reachable only on the compose network and the app is
# bound to loopback, so nothing but SSH and Caddy should ever be exposed.
# ---------------------------------------------------------------------------
log "Configuring firewall"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'ssh' >/dev/null
ufw allow 80/tcp comment 'http (acme + redirect)' >/dev/null
ufw allow 443/tcp comment 'https' >/dev/null
ufw --force enable >/dev/null
ufw status verbose

# ---------------------------------------------------------------------------
# SSH hardening — only once a key is actually installed. Disabling password
# auth on a box you can only reach by password locks you out permanently, and
# the Linode console is a poor place to discover that.
# ---------------------------------------------------------------------------
if [[ -s "/home/${DEPLOY_USER}/.ssh/authorized_keys" ]]; then
  log "Disabling SSH password auth (key found)"
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
  systemctl reload ssh || systemctl reload sshd
else
  warn "No authorized_keys for ${DEPLOY_USER} — leaving password auth ON."
  warn "Add your key, then re-run this script to harden SSH:"
  warn "  ssh-copy-id ${DEPLOY_USER}@<this-host>"
fi

systemctl enable --now fail2ban

log "Done."
cat <<SUMMARY

  Deploy user : ${DEPLOY_USER}
  App dir     : ${APP_DIR}
  Open ports  : 22, 80, 443
  Swap        : $(swapon --show=NAME,SIZE --noheadings | tr '\n' ' ')

  Next: copy the compose files and .env into ${APP_DIR}, then let CI deploy.
  See deploy/README.md in the repo.

SUMMARY
