# VMP CRM - VPS Installation Guide

## Server Requirements

### Minimum Requirements
| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS (64-bit) |
| **RAM** | 1 GB | 2 GB |
| **CPU** | 1 vCPU | 2 vCPU |
| **Storage** | 20 GB SSD | 40 GB SSD |
| **Bandwidth** | 1 TB/month | Unlimited |

### Preferred OS
- **Ubuntu 22.04 LTS** (Recommended - Most stable and widely supported)
- Ubuntu 20.04 LTS (Alternative)
- Debian 11/12 (Alternative)

### Required Ports
| Port | Service | Required |
|------|---------|----------|
| 22 | SSH | Yes |
| 80 | HTTP | Yes |
| 443 | HTTPS | Yes |
| 27017 | MongoDB (internal only) | No (localhost) |

---

## Pre-Installation Checklist

Before starting, ensure you have:
- [ ] A VPS with root/sudo access
- [ ] A domain name pointed to your VPS IP (e.g., crm.yourdomain.com)
- [ ] SSH access to your server
- [ ] WhatsApp API credentials (BotMasterSender or similar)
- [ ] SMTP credentials for email sending

---

## Step 1: Initial Server Setup

### 1.1 Connect to your VPS
```bash
ssh root@your-server-ip
```

### 1.2 Update System
```bash
apt update && apt upgrade -y
```

### 1.3 Create a non-root user (recommended)
```bash
adduser vmpcrm
usermod -aG sudo vmpcrm
su - vmpcrm
```

### 1.4 Set Timezone
```bash
sudo timedatectl set-timezone Asia/Kolkata
```

---

## Step 2: Install Required Software

### 2.1 Install Node.js 18.x
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2.2 Install Yarn
```bash
sudo npm install -g yarn
```

### 2.3 Install Python 3.11
```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
```

### 2.4 Install MongoDB 7.0
```bash
# Import MongoDB GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 2.5 Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 2.6 Install Supervisor (Process Manager)
```bash
sudo apt install -y supervisor
sudo systemctl enable supervisor
```

### 2.7 Install Certbot (SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Step 3: Download and Setup Application

### 3.1 Create Application Directory
```bash
sudo mkdir -p /var/www/vmpcrm
sudo chown -R $USER:$USER /var/www/vmpcrm
cd /var/www/vmpcrm
```

### 3.2 Download Application Files
**Option A: From Emergent Platform**
- Download the project ZIP from Emergent Platform
- Upload to server using SCP:
```bash
scp vmpcrm.zip vmpcrm@your-server-ip:/var/www/vmpcrm/
unzip vmpcrm.zip
```

**Option B: From GitHub (if saved)**
```bash
git clone https://github.com/yourusername/vmpcrm.git .
```

### 3.3 Project Structure
After extraction, your directory should look like:
```
/var/www/vmpcrm/
├── backend/
│   ├── server.py
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   ├── package.json
│   └── .env
└── memory/
    └── PRD.md
```

---

## Step 4: Configure Backend

### 4.1 Create Python Virtual Environment
```bash
cd /var/www/vmpcrm/backend
python3 -m venv venv
source venv/bin/activate
```

### 4.2 Install Python Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4.3 Create Backend Environment File
```bash
nano /var/www/vmpcrm/backend/.env
```

Add the following content:
```env
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=vmpcrm

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-this-in-production

# CORS Origins (your domain)
CORS_ORIGINS=https://crm.yourdomain.com,http://localhost:3000
```

**Important:** Replace `your-super-secret-key-change-this-in-production` with a strong random string. Generate one with:
```bash
openssl rand -hex 32
```

---

## Step 5: Configure Frontend

### 5.1 Install Frontend Dependencies
```bash
cd /var/www/vmpcrm/frontend
yarn install
```

### 5.2 Create Frontend Environment File
```bash
nano /var/www/vmpcrm/frontend/.env
```

Add the following content:
```env
REACT_APP_BACKEND_URL=https://crm.yourdomain.com
```

### 5.3 Build Frontend for Production
```bash
yarn build
```

This creates a `build/` folder with optimized production files.

---

## Step 6: Configure Supervisor (Process Manager)

### 6.1 Create Backend Service Configuration
```bash
sudo nano /etc/supervisor/conf.d/vmpcrm-backend.conf
```

Add the following content:
```ini
[program:vmpcrm-backend]
directory=/var/www/vmpcrm/backend
command=/var/www/vmpcrm/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
user=vmpcrm
autostart=true
autorestart=true
stderr_logfile=/var/log/vmpcrm/backend.err.log
stdout_logfile=/var/log/vmpcrm/backend.out.log
environment=PATH="/var/www/vmpcrm/backend/venv/bin"
```

### 6.2 Create Log Directory
```bash
sudo mkdir -p /var/log/vmpcrm
sudo chown -R vmpcrm:vmpcrm /var/log/vmpcrm
```

### 6.3 Reload Supervisor
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start vmpcrm-backend
```

### 6.4 Check Backend Status
```bash
sudo supervisorctl status vmpcrm-backend
```

---

## Step 7: Configure Nginx

### 7.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/vmpcrm
```

Add the following content:
```nginx
server {
    listen 80;
    server_name crm.yourdomain.com;

    # Frontend (React build)
    root /var/www/vmpcrm/frontend/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Backend API proxy
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # File upload size (adjust as needed)
        client_max_body_size 10M;
    }

    # React Router support
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 7.2 Enable the Site
```bash
sudo ln -s /etc/nginx/sites-available/vmpcrm /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

---

## Step 8: Setup SSL Certificate (HTTPS)

### 8.1 Obtain SSL Certificate
```bash
sudo certbot --nginx -d crm.yourdomain.com
```

Follow the prompts:
- Enter your email address
- Agree to terms
- Choose to redirect HTTP to HTTPS (recommended)

### 8.2 Auto-Renewal (Already configured by Certbot)
Test auto-renewal:
```bash
sudo certbot renew --dry-run
```

---

## Step 9: Create Admin User

### 9.1 Access the Application
Open your browser and go to: `https://crm.yourdomain.com`

### 9.2 Register Admin User
1. Click "Register" tab on login page
2. Fill in:
   - Full Name: Admin User
   - Email: admin@yourdomain.com
   - Password: (strong password)
   - Role: Admin
3. Click "Create Account"

---

## Step 10: Configure Application Settings

### 10.1 WhatsApp Configuration
1. Login to CRM
2. Go to Settings (sidebar)
3. Add WhatsApp API credentials:
   - API URL: Your BotMasterSender API URL
   - Auth Token: Your API token
   - Sender ID: Your WhatsApp sender ID

### 10.2 SMTP Configuration
1. Go to SMTP Settings
2. Configure:
   - SMTP Server: smtp.gmail.com (or your provider)
   - SMTP Port: 587
   - Username: your-email@gmail.com
   - Password: App password (not regular password)
   - From Email: your-email@gmail.com
   - From Name: VMP CRM

### 10.3 Company Settings
1. Go to Company Settings
2. Upload logo
3. Fill in company details
4. Add Terms & Conditions for public showcase

---

## Maintenance Commands

### Service Management
```bash
# Backend
sudo supervisorctl status vmpcrm-backend
sudo supervisorctl restart vmpcrm-backend
sudo supervisorctl stop vmpcrm-backend
sudo supervisorctl start vmpcrm-backend

# View logs
tail -f /var/log/vmpcrm/backend.out.log
tail -f /var/log/vmpcrm/backend.err.log

# Nginx
sudo systemctl status nginx
sudo systemctl restart nginx
sudo nginx -t  # Test config

# MongoDB
sudo systemctl status mongod
sudo systemctl restart mongod
```

### Database Backup
```bash
# Create backup
mongodump --db vmpcrm --out /var/backups/mongodb/$(date +%Y%m%d)

# Restore backup
mongorestore --db vmpcrm /var/backups/mongodb/20260204/vmpcrm/

# Automated daily backup (add to crontab)
crontab -e
# Add: 0 2 * * * mongodump --db vmpcrm --out /var/backups/mongodb/$(date +\%Y\%m\%d)
```

### Update Application
```bash
cd /var/www/vmpcrm

# Pull latest code (if using Git)
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo supervisorctl restart vmpcrm-backend

# Update frontend
cd ../frontend
yarn install
yarn build
```

---

## Troubleshooting

### Backend not starting
```bash
# Check logs
tail -100 /var/log/vmpcrm/backend.err.log

# Check if port 8001 is in use
sudo lsof -i :8001

# Test manually
cd /var/www/vmpcrm/backend
source venv/bin/activate
python -c "from server import app; print('OK')"
```

### MongoDB connection issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -100 /var/log/mongodb/mongod.log

# Test connection
mongosh --eval "db.adminCommand('ping')"
```

### Nginx errors
```bash
# Test configuration
sudo nginx -t

# Check error log
sudo tail -100 /var/log/nginx/error.log
```

### SSL Certificate issues
```bash
# Renew manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

---

## Security Recommendations

1. **Firewall Setup**
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

2. **Fail2Ban (Brute force protection)**
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

3. **Regular Updates**
```bash
sudo apt update && sudo apt upgrade -y
```

4. **MongoDB Security**
- MongoDB is bound to localhost by default (secure)
- For additional security, enable authentication:
```bash
mongosh
use admin
db.createUser({user: "vmpcrm", pwd: "strong-password", roles: [{role: "readWrite", db: "vmpcrm"}]})
```
Then update MONGO_URL:
```
MONGO_URL=mongodb://vmpcrm:strong-password@localhost:27017/vmpcrm?authSource=admin
```

---

## Support

For issues or questions:
1. Check logs first (`/var/log/vmpcrm/`)
2. Verify all environment variables are set correctly
3. Ensure all services are running (`supervisorctl status`, `systemctl status`)

---

## Quick Reference

| Item | Value |
|------|-------|
| Application URL | https://crm.yourdomain.com |
| Backend Port | 8001 (internal) |
| MongoDB Port | 27017 (localhost) |
| Log Directory | /var/log/vmpcrm/ |
| Application Directory | /var/www/vmpcrm/ |
| Supervisor Config | /etc/supervisor/conf.d/vmpcrm-backend.conf |
| Nginx Config | /etc/nginx/sites-available/vmpcrm |
