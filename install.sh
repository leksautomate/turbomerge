#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
#  TurboBatch — One-Click VPS Installer
#  Supports: Ubuntu 20.04 / 22.04 / 24.04
# ─────────────────────────────────────────────

REPO_URL="https://github.com/leksautomate/turbomerge"
INSTALL_DIR="/opt/turbobatch"
APP_PORT=3000
NODE_VERSION=20

BOLD="\033[1m"
GREEN="\033[0;32m"
GOLD="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

banner() {
  echo ""
  echo -e "${GOLD}${BOLD}"
  echo "  ████████╗██╗   ██╗██████╗ ██████╗  ██████╗ ██████╗  █████╗ ████████╗ ██████╗██╗  ██╗"
  echo "     ██╔══╝██║   ██║██╔══██╗██╔══██╗██╔═══██╗██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██║  ██║"
  echo "     ██║   ██║   ██║██████╔╝██████╔╝██║   ██║██████╔╝███████║   ██║   ██║     ███████║"
  echo "     ██║   ██║   ██║██╔══██╗██╔══██╗██║   ██║██╔══██╗██╔══██║   ██║   ██║     ██╔══██║"
  echo "     ██║   ╚██████╔╝██║  ██║██████╔╝╚██████╔╝██████╔╝██║  ██║   ██║   ╚██████╗██║  ██║"
  echo "     ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝"
  echo -e "${RESET}"
  echo -e "  ${GOLD}Bulk AI Image & Video Generator${RESET}"
  echo ""
}

step() { echo -e "\n${GOLD}${BOLD}▶ $1${RESET}"; }
ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
err()  { echo -e "${RED}✗ $1${RESET}"; exit 1; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Run this script as root: sudo bash install.sh"
  fi
}

detect_os() {
  if [[ ! -f /etc/os-release ]]; then
    err "Cannot detect OS. This script supports Ubuntu 20.04/22.04/24.04."
  fi
  . /etc/os-release
  if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    err "Unsupported OS: $ID. This script supports Ubuntu/Debian."
  fi
  ok "Detected OS: $PRETTY_NAME"
}

update_npm_path() {
  if command -v npm &>/dev/null; then
    local npm_prefix
    npm_prefix=$(npm config get prefix 2>/dev/null || true)
    if [[ -n "$npm_prefix" ]]; then
      export PATH="$npm_prefix/bin:$PATH"
    fi
  fi
}

install_system_deps() {
  step "Installing system dependencies"
  apt-get update -qq
  apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw build-essential
  ok "System dependencies installed"
}

install_node() {
  step "Installing Node.js $NODE_VERSION"
  if command -v node &>/dev/null && [[ "$(node -v)" == v${NODE_VERSION}* ]]; then
    ok "Node.js $(node -v) already installed"
    return
  fi
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - &>/dev/null
  apt-get install -y -qq nodejs
  ok "Node.js $(node -v) installed"
}

install_postgres() {
  step "Installing PostgreSQL"
  if command -v psql &>/dev/null; then
    ok "PostgreSQL already installed"
  else
    apt-get install -y -qq postgresql postgresql-contrib
    systemctl enable postgresql --now
    ok "PostgreSQL installed and started"
  fi

  # Create DB and user (always sync password so DATABASE_URL stays valid on re-runs)
  DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)
  if sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='turbobatch'" | grep -q 1; then
    sudo -u postgres psql -c "ALTER USER turbobatch WITH PASSWORD '$DB_PASS';" &>/dev/null
  else
    sudo -u postgres psql -c "CREATE USER turbobatch WITH PASSWORD '$DB_PASS';" &>/dev/null
  fi
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='turbobatch'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE turbobatch OWNER turbobatch;" &>/dev/null

  DATABASE_URL="postgresql://turbobatch:${DB_PASS}@localhost:5432/turbobatch"
  ok "Database 'turbobatch' ready"
}

install_pm2() {
  step "Installing PM2 (process manager)"
  if command -v pm2 &>/dev/null; then
    ok "PM2 already installed"
  else
    npm install -g pm2 --silent
    ok "PM2 installed"
  fi
}

clone_or_update() {
  step "Setting up application"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    echo "Updating existing installation..."
    git -C "$INSTALL_DIR" pull --ff-only
    ok "Repository updated"
  else
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "Repository cloned to $INSTALL_DIR"
  fi
}

collect_config() {
  step "Configuration"
  echo ""
  echo -e "${BOLD}Enter your API keys (press Enter to skip optional ones):${RESET}"
  echo ""

  # All reads use /dev/tty so they work when script is piped via curl | bash
  read -rp "  Runware API Key (for GPT Image 2)  [optional]: " RUNWARE_API_KEY </dev/tty
  read -rp "  Google Cloud Project ID (for Imagen/Veo) [optional]: " VERTEX_PROJECT_ID </dev/tty
  read -rp "  Vertex AI Location [default: europe-west4]: " VERTEX_LOCATION_ID </dev/tty
  VERTEX_LOCATION_ID=${VERTEX_LOCATION_ID:-europe-west4}
  read -rp "  Image Model [default: imagen-4.0-fast-generate-001]: " IMAGE_MODEL </dev/tty
  IMAGE_MODEL=${IMAGE_MODEL:-imagen-4.0-fast-generate-001}
  read -rp "  Default Aspect Ratio (16:9 / 1:1 / 9:16) [default: 16:9]: " IMAGE_ASPECT_RATIO </dev/tty
  IMAGE_ASPECT_RATIO=${IMAGE_ASPECT_RATIO:-16:9}
  read -rp "  Veo Model [default: veo-3.1-lite-generate-001]: " VEO_MODEL_ID </dev/tty
  VEO_MODEL_ID=${VEO_MODEL_ID:-veo-3.1-lite-generate-001}
  read -rp "  App Port [default: 3000]: " APP_PORT_INPUT </dev/tty
  APP_PORT=${APP_PORT_INPUT:-3000}
  read -rp "  Domain name (e.g. turbobatch.example.com, or leave blank for IP only): " DOMAIN </dev/tty
  echo ""
}

write_env() {
  step "Writing .env"
  cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="${DATABASE_URL}"
RUNWARE_API_KEY=${RUNWARE_API_KEY:-}
VERTEX_PROJECT_ID=${VERTEX_PROJECT_ID:-}
VERTEX_LOCATION_ID=${VERTEX_LOCATION_ID}
IMAGE_MODEL=${IMAGE_MODEL}
IMAGE_ASPECT_RATIO=${IMAGE_ASPECT_RATIO}
IMAGE_CONCURRENCY=2
VEO_MODEL_ID=${VEO_MODEL_ID}
VEO_LOCATION_ID=us-central1
NODE_ENV=production
PORT=${APP_PORT:-3000}
EOF
  ok ".env written"
}

install_app() {
  step "Installing npm dependencies"
  cd "$INSTALL_DIR"
  npm ci --silent
  ok "Dependencies installed"

  step "Generating Prisma client"
  npx prisma generate
  ok "Prisma client generated"

  step "Running database migrations"
  npx prisma db push --accept-data-loss
  ok "Migrations applied"

  step "Building Next.js app"
  npm run build
  ok "Build complete"
}

setup_pm2() {
  step "Setting up PM2 process manager"
  local port="${APP_PORT:-3000}"
  cat > "$INSTALL_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [
    {
      name: "turbobatch-web",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/opt/turbobatch",
      env: { NODE_ENV: "production", PORT: ${port} },
      restart_delay: 3000,
      max_restarts: 10,
    },
    {
      name: "turbobatch-worker",
      script: "node_modules/.bin/tsx",
      args: "worker/index.ts",
      cwd: "/opt/turbobatch",
      env: { NODE_ENV: "production" },
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
EOF

  pm2 delete turbobatch-web turbobatch-worker 2>/dev/null || true
  pm2 start "$INSTALL_DIR/ecosystem.config.js"
  pm2 save
  pm2 startup systemd -u root --hp /root 2>&1 | grep "^sudo " | bash || true
  ok "PM2 configured — app starts automatically on reboot"
}

setup_nginx() {
  step "Configuring nginx"

  if [[ -n "$DOMAIN" ]]; then
    SERVER_NAME="$DOMAIN"
    LISTEN_CONF="listen 80;
    listen [::]:80;"
  else
    SERVER_NAME="_"
    LISTEN_CONF="listen 80 default_server;
    listen [::]:80 default_server;"
  fi

  cat > /etc/nginx/sites-available/turbobatch <<EOF
server {
    ${LISTEN_CONF}
    server_name ${SERVER_NAME};
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
    }
}
EOF

  ln -sf /etc/nginx/sites-available/turbobatch /etc/nginx/sites-enabled/turbobatch
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  ok "nginx configured"

  if [[ -n "$DOMAIN" ]]; then
    echo ""
    echo -e "${GOLD}Setting up SSL certificate for $DOMAIN...${RESET}"
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN" || \
      echo -e "${RED}SSL setup failed — run: certbot --nginx -d $DOMAIN${RESET}"
  fi
}

setup_firewall() {
  step "Configuring firewall"
  ufw --force enable
  ufw allow ssh
  ufw allow 80/tcp
  ufw allow 443/tcp
  ok "Firewall: SSH, HTTP, HTTPS allowed"
}

print_summary() {
  echo ""
  echo -e "${GOLD}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${GREEN}${BOLD}  ✓ TurboBatch installed successfully!${RESET}"
  echo -e "${GOLD}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  if [[ -n "${DOMAIN:-}" ]]; then
    echo -e "  ${BOLD}URL:${RESET}       https://$DOMAIN"
  else
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    echo -e "  ${BOLD}URL:${RESET}       http://$PUBLIC_IP"
  fi
  echo -e "  ${BOLD}Install:${RESET}   $INSTALL_DIR"
  echo -e "  ${BOLD}Logs:${RESET}      pm2 logs"
  echo -e "  ${BOLD}Status:${RESET}    pm2 status"
  echo -e "  ${BOLD}Restart:${RESET}   pm2 restart all"
  echo ""
  echo -e "  ${GOLD}First time: open the app → Settings → enter your API keys.${RESET}"
  echo ""
  if [[ -n "${VERTEX_PROJECT_ID:-}" ]]; then
    echo -e "  ${BOLD}Vertex AI auth (run on server):${RESET}"
    echo -e "  gcloud auth login --no-browser"
    echo -e "  gcloud auth application-default login --no-browser"
    echo ""
  fi
}

# ── main ──────────────────────────────────────────────────────────
banner
require_root
detect_os
update_npm_path
install_system_deps
install_node
update_npm_path
install_postgres
install_pm2
clone_or_update
collect_config
write_env
install_app
setup_pm2
setup_nginx
setup_firewall
print_summary
