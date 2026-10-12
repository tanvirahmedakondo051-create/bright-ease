#!/usr/bin/env bash
# Hexa AI deploy agent installer (Ubuntu/Debian).
# Usage: curl -fsSL https://YOUR-APP/install-agent.sh | sudo bash -s -- <TOKEN> <AGENT_HOST> [EMAIL] [PORT] [NS1] [NS2] [SERVER_IP]
set -euo pipefail
TOKEN="${1:?token required}"; AGENT_HOST="${2:?agent host required, e.g. deploy.example.com}"; EMAIL="${3:-}"; PORT="${4:-8443}"
NS1="${5:-}"; NS2="${6:-}"; SERVER_IP="${7:-}"
SRC="$(dirname "${BASH_SOURCE[0]:-/}")"
APP_URL="${HEXA_APP_URL:-}"

apt-get update -y
apt-get install -y nginx certbot curl ca-certificates

# ---- Automatic DNS (PowerDNS, bind-zone backend) ----
if [ -n "$NS1" ] && [ -n "$NS2" ]; then
  [ -n "$SERVER_IP" ] || SERVER_IP="$(curl -fsS4 https://api.ipify.org || true)"
  # Free port 53 from the systemd-resolved stub listener
  if [ -f /etc/systemd/resolved.conf ]; then
    sed -i 's/^#\?DNSStubListener=.*/DNSStubListener=no/' /etc/systemd/resolved.conf
    systemctl restart systemd-resolved || true
    ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf
  fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y pdns-server pdns-backend-bind
  mkdir -p /etc/hexa /etc/powerdns/zones
  touch /etc/powerdns/named.conf
  printf 'NS1=%s\nNS2=%s\nSERVER_IP=%s\n' "$NS1" "$NS2" "$SERVER_IP" >/etc/hexa/dns.env
  cat >/etc/powerdns/pdns.d/hexa.conf <<'EOF'
launch=bind
bind-config=/etc/powerdns/named.conf
EOF
  rm -f /etc/powerdns/pdns.d/bind.conf /etc/powerdns/pdns.d/pdns.simplebind.conf
  cat >/usr/local/bin/hexa-dns-add <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
D="${1:?domain}"
[[ "$D" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || { echo "invalid domain"; exit 1; }
. /etc/hexa/dns.env
F="/etc/powerdns/zones/db.$D"
cat >"$F" <<Z
\$TTL 300
@   IN SOA $NS1. hostmaster.$D. ( $(date +%s) 3600 600 604800 300 )
@   IN NS  $NS1.
@   IN NS  $NS2.
@   IN A   $SERVER_IP
www IN A   $SERVER_IP
Z
grep -q "\"$D\"" /etc/powerdns/named.conf || echo "zone \"$D\" { type master; file \"$F\"; };" >>/etc/powerdns/named.conf
systemctl reload pdns 2>/dev/null || systemctl restart pdns
EOF
  cat >/usr/local/bin/hexa-dns-remove <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
D="${1:?domain}"
[[ "$D" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || { echo "invalid domain"; exit 1; }
rm -f "/etc/powerdns/zones/db.$D"
grep -vF "zone \"$D\" " /etc/powerdns/named.conf >/etc/powerdns/named.conf.tmp || true
mv /etc/powerdns/named.conf.tmp /etc/powerdns/named.conf
systemctl reload pdns 2>/dev/null || systemctl restart pdns
EOF
  chmod 755 /usr/local/bin/hexa-dns-add /usr/local/bin/hexa-dns-remove
  systemctl enable --now pdns
  systemctl restart pdns
  command -v ufw >/dev/null && ufw allow 53/tcp && ufw allow 53/udp || true
fi
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
mkdir -p /opt/hexa-agent /var/www/sites /var/www/certbot /var/hexa/projects
# Unprivileged user for React builds (AI-generated code never runs as root)
id hexabuild >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin hexabuild
chown -R hexabuild:hexabuild /var/hexa/projects
if [ -n "$APP_URL" ]; then curl -fsSL "$APP_URL/deploy-agent.js" -o /opt/hexa-agent/deploy-agent.js; fi
[ -f /opt/hexa-agent/deploy-agent.js ] || { echo "Set HEXA_APP_URL so the agent can be downloaded"; exit 1; }
# Headless Chromium for screenshot QA (optional; failures do not stop the install)
(cd /opt/hexa-agent && { [ -f package.json ] || echo '{"private":true}' > package.json; } && npm i --no-audit --no-fund playwright@1 && npx playwright install --with-deps chromium) || echo "Screenshot QA setup skipped"

# Certificate for the agent itself (DNS of AGENT_HOST must point to this server)
if [ ! -f "/etc/letsencrypt/live/$AGENT_HOST/fullchain.pem" ]; then
  systemctl stop nginx || true
  certbot certonly --standalone -d "$AGENT_HOST" --non-interactive --agree-tos ${EMAIL:+-m "$EMAIL"} ${EMAIL:---register-unsafely-without-email}
  systemctl start nginx
fi

cat >/etc/systemd/system/hexa-agent.service <<EOF
[Unit]
Description=Hexa AI deploy agent
After=network.target nginx.service
[Service]
Environment=HEXA_TOKEN=$TOKEN
Environment=HEXA_AGENT_HOST=$AGENT_HOST
Environment=HEXA_PORT=$PORT
Environment=HEXA_EMAIL=$EMAIL
Environment=HEXA_BUILD_UID=$(id -u hexabuild)
Environment=HEXA_BUILD_GID=$(id -g hexabuild)
ExecStart=/usr/bin/node /opt/hexa-agent/deploy-agent.js
Restart=always
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now hexa-agent
command -v ufw >/dev/null && ufw allow "$PORT"/tcp && ufw allow 80/tcp && ufw allow 443/tcp || true
echo "✅ Hexa deploy agent running on https://$AGENT_HOST:$PORT"
