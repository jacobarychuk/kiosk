# Raspberry Pi

## Automated setup
Run the script:
```bash
./setup_raspi.sh
```

Once the script ends, open any web browser and visit the hostname you provided at the start of the script (such as https://spca.sccsa-projects.org) and it should be displaying the app.

If the script fails at any point, you can refer to the steps below.

## Manual setup
In what follows, you should replace `spca` with a unique site identifier.

### 1. Clone repository
Start by cloning from the project repository. If you decide to create a new repository by forking the original, use its URL in place of the one below. Enter this command on the Raspberry Pi:
```bash
git clone https://github.com/jacobarychuk/kiosk ~/spca-kiosk
```

### 2. Create virtual environment
Enter the `raspi` directory:
```bash
cd spca-kiosk/raspi
```
Then create the virtual environment here:
```bash
python -m venv venv
```

### 3. Install dependencies
Enter the virtual environment:
```bash
source venv/bin/activate
```
Install or update pip just in case:
```bash
pip install --upgrade pip
```
Install the project dependencies:
```bash
pip install .
```

### 4. Generate and store API key
Come up with an API key or generate one automatically with this command:
```bash
openssl rand -base64 32
```
Copy that key and store it somewhere temporarily. Make a source file to store the API key
as an environment variable that we will use later. To create the source file, enter the
following command:
```bash
sudo nano /etc/default/spca-kiosk-app
```
Enter the text `API_KEY=` then paste in the key so that the file content looks like this:
```bash
API_KEY=yourkeyhere
```
Save and exit the file (`<Control> <X>`, `<Y>`, `<Enter>`).

We need to ensure that this file is inaccessible to regular users. By default, the
permissions allow anyone to read the file. Run the following command to ensure that only
the owner (root) can read and write:
```bash
sudo chmod 600 /etc/default/spca-kiosk-app
```

### 5. Install server-side daemon for Cloudflare
We will create a tunnel (using Cloudflare) between the app running on the Raspberry Pi and the internet. Visit the download and installation instructions (https://pkg.cloudflare.com/index.html) and run the recommended commands for Debian-based distributions. At the time of writing this, we are supposed to run the following commands:
```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

### 6. Log in to Cloudflare and create tunnel
Authorize the use of one of your domains in Cloudflare. If you want to use a domain registered outside of Cloudfare, you will need to step through the import process, which primarily requires changing the nameservers of the domain to the two provided by Cloudflare. Copy and paste the URL from the output of the following command into your web browser:
```bash
cloudflared login
```
After successful authorization, you should see confirmation in the command line window.

Create the tunnel:
```bash
cloudflared tunnel create spca-kiosk
```
Copy the ID from the output of the command and store it somewhere temporarily.

Create a configuration file:
```bash
nano ~/.cloudflared/spca-config.yml
```
Copy and paste the following content into the file. Replace `52ac5838-6833-4b0b-93e2-24072f115c6a` with the ID for the tunnel that was created in the previous step, replace `user` with your username, and replace the hostname with the domain that you authenticated in the previous step.
```
tunnel: 52ac5838-6833-4b0b-93e2-24072f115c6a
credentials-file: /home/user/.cloudflared/52ac5838-6833-4b0b-93e2-24072f115c6a.json
ingress:
  - hostname: spca.sccsa-projects.org
    service: http://localhost:8000
  - service: http_status:404
```

### 7. Link tunnel to hostname
Link the tunnel to the hostname you specified in the configuration file. Replace `spca.sccsa-projects.org` with the hostname you chose in the previous step.
```bash
cloudflared tunnel route dns spca spca.sccsa-projects.org
```

### 8. Create systemd service for Flask app
While the ESP32 automatically begins executing the loaded program after a power cycle, the Raspberry Pi will not resume the Flask app nor the Cloudflare tunnel by default. To improve the robustness of the system by ensuring everything returns to normal automatically after a power cycle, we need to create two systemd services. First create one that automatically starts the Flask app via Gunicorn server:
```bash
sudo nano /etc/systemd/system/spca-kiosk-app.service
```
Copy and paste the following content into the file (replace `spca` with your site identifier and replace `user` with your username):
```
[Unit]
Description=Flask App
After=network.target

[Service]
User=user
WorkingDirectory=/home/user/spca-kiosk/raspi
EnvironmentFile=/etc/default/spca-kiosk-app
ExecStart=/home/user/spca-kiosk/raspi/venv/bin/gunicorn app:app --bind 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

### 9. Create systemd service for Cloudflare tunnel
Create another systemd service that automatically starts the Cloudflare tunnel:
```bash
sudo nano /etc/systemd/system/spca-kiosk-tunnel.service
```
Copy and paste the following content into the file (replace `spca` with your site identifier and replace `user` with your username):
```
[Unit]
Description=Cloudflare Tunnel
Wants=network-online.target
After=network-online.target

[Service]
User=user
ExecStart=/usr/local/bin/cloudflared --config /home/user/.cloudflared/spca-config.yml tunnel run
Restart=always

[Install]
WantedBy=multi-user.target
```

### 10. Enable and start systemd services
Enable and start both:
```bash
sudo systemctl daemon-reload
sudo systemctl enable spca-kiosk-app.service
sudo systemctl enable spca-kiosk-tunnel.service
sudo systemctl start spca-kiosk-app.service
sudo systemctl start spca-kiosk-tunnel.service
```
Confirm that both the Flask app and Cloudflare tunnel are running by visiting the hostname
you chose earlier in any web browser. For example:
https://spca.sccsa-projects.org/
