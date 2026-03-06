#!/bin/bash

read -p 'Enter site identifier (e.g., spca): ' SITE
SITE=${SITE,,}
read -p 'Enter hostname (e.g., spca.sccsa-projects.org): ' HOSTNAME
HOSTNAME=${HOSTNAME,,}
read -p 'Enter local port (e.g., 8000): ' PORT
read -p 'Changes will now be made to the system. Do you want to continue? [Y/n] ' CONFIRM
CONFIRM=${CONFIRM:-Y}

if [[ ! "${CONFIRM}" =~ ^[Yy]$ ]]; then exit; fi

PROJECT_DIR="${HOME}/${SITE}-kiosk"
TUNNEL_NAME="${SITE}-kiosk"
KIOSK_USER=$(whoami)

# Clone repository
git clone https://github.com/jacobarychuk/kiosk "${PROJECT_DIR}"

# Create virtual environment
cd "${PROJECT_DIR}/raspi"
python -m venv venv

# Install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install .

# Generate and store API key
API_KEY=$(openssl rand -base64 32)
cat <<EOF | sudo tee "/etc/default/${SITE}-kiosk-app"
API_KEY=${API_KEY}
EOF
sudo chmod 600 "/etc/default/${SITE}-kiosk-app"

# Install server-side daemon for Cloudflare (https://pkg.cloudflare.com/index.html)
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

# Log in to Cloudflare and create tunnel
cloudflared login

TUNNEL_ID="$(
  cloudflared tunnel create "${TUNNEL_NAME}" 2>&1 \
  | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
  | head -n 1
)"

cat <<EOF > "${HOME}/.cloudflared/${SITE}-config.yml"
tunnel: ${TUNNEL_ID}
credentials-file: ${HOME}/.cloudflared/${TUNNEL_ID}.json
ingress:
  - hostname: ${HOSTNAME}
    service: http://localhost:${PORT}
  - service: http_status:404
EOF

# Link tunnel to hostname
cloudflared tunnel route dns "${TUNNEL_NAME}" "${HOSTNAME}"

# Create systemd service for Flask app
cat <<EOF | sudo tee "/etc/systemd/system/${SITE}-kiosk-app.service"
[Unit]
Description=Flask App
After=network.target

[Service]
User=${KIOSK_USER}
WorkingDirectory=${PROJECT_DIR}/raspi
EnvironmentFile=/etc/default/${SITE}-kiosk-app
ExecStart=${PROJECT_DIR}/raspi/venv/bin/gunicorn app:app --bind 127.0.0.1:${PORT}
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for Cloudflare tunnel
cat <<EOF | sudo tee "/etc/systemd/system/${SITE}-kiosk-tunnel.service"
[Unit]
Description=Cloudflare Tunnel
Wants=network-online.target
After=network-online.target

[Service]
User=${KIOSK_USER}
ExecStart=/usr/local/bin/cloudflared --config ${HOME}/.cloudflared/${SITE}-config.yml tunnel run
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start systemd services
sudo systemctl daemon-reload
sudo systemctl enable "${SITE}-kiosk-app.service"
sudo systemctl enable "${SITE}-kiosk-tunnel.service"
sudo systemctl start "${SITE}-kiosk-app.service"
sudo systemctl start "${SITE}-kiosk-tunnel.service"
