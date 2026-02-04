# VMP CRM - Quick Requirements Summary

## Server Requirements (Minimum)
- **OS**: Ubuntu 22.04 LTS (64-bit) - RECOMMENDED
- **RAM**: 1 GB minimum, 2 GB recommended
- **CPU**: 1 vCPU minimum, 2 vCPU recommended
- **Storage**: 20 GB SSD minimum
- **Ports**: 22 (SSH), 80 (HTTP), 443 (HTTPS)

## Software Stack
| Component | Version | Purpose |
|-----------|---------|---------|
| Ubuntu | 22.04 LTS | Operating System |
| Node.js | 18.x | Frontend build |
| Yarn | Latest | Package manager |
| Python | 3.11 | Backend runtime |
| MongoDB | 7.0 | Database |
| Nginx | Latest | Web server/Reverse proxy |
| Supervisor | Latest | Process manager |
| Certbot | Latest | SSL certificates |

## Application Stack
| Component | Technology |
|-----------|------------|
| Backend | FastAPI (Python) |
| Frontend | React 19 |
| Database | MongoDB |
| Auth | JWT tokens |
| UI | Tailwind CSS + Shadcn/UI |

## Installation Time
- Fresh server setup: ~30-45 minutes
- With experience: ~15-20 minutes

## Monthly Cost Estimate (VPS)
| Provider | Plan | Price/Month |
|----------|------|-------------|
| DigitalOcean | Basic 1GB | $6 |
| Vultr | Cloud Compute | $6 |
| Linode | Nanode 1GB | $5 |
| AWS Lightsail | 1GB | $5 |
| Hetzner | CX11 | €4.15 |

## Required External Services
1. **Domain Name** - Point to VPS IP
2. **WhatsApp API** - BotMasterSender or similar
3. **SMTP** - Gmail, SendGrid, or your email provider

## Files to Download
From Emergent Platform, download your project which includes:
- `/backend/` - Python FastAPI application
- `/frontend/` - React application
- `/memory/PRD.md` - Documentation

## Quick Install Commands (Ubuntu 22.04)
```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Yarn
sudo npm install -g yarn

# 4. Install Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# 5. Install MongoDB 7.0
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod

# 6. Install Nginx & Supervisor
sudo apt install -y nginx supervisor certbot python3-certbot-nginx
sudo systemctl enable nginx supervisor
```

## Environment Variables

### Backend (.env)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=vmpcrm
JWT_SECRET=generate-random-string-here
CORS_ORIGINS=https://yourdomain.com
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=https://yourdomain.com
```

## Post-Installation Checklist
- [ ] Backend running (`supervisorctl status`)
- [ ] Frontend built (`yarn build`)
- [ ] Nginx configured and running
- [ ] SSL certificate installed
- [ ] Admin user created
- [ ] WhatsApp API configured
- [ ] SMTP configured
- [ ] Company settings filled
- [ ] Firewall enabled (UFW)
- [ ] Backup script setup

## Support Commands
```bash
# Check backend status
sudo supervisorctl status vmpcrm-backend

# View backend logs
tail -f /var/log/vmpcrm/backend.out.log

# Restart backend
sudo supervisorctl restart vmpcrm-backend

# Test Nginx config
sudo nginx -t

# Renew SSL
sudo certbot renew
```
