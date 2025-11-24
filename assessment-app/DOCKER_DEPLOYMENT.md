# Docker Deployment Guide - Integralis Assessment

This guide helps your team containerize and deploy the Integralis Assessment application on your local server infrastructure.

## 🐳 Quick Start

### 1. Prerequisites
- Docker and Docker Compose installed on your server
- SendGrid API key (for email delivery)
- Domain/subdomain configured (e.g., assessment.integralis.com.au)

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/kpellas/integralis-assessment.git
cd integralis-assessment

# Create environment file
cp .env.example .env
```

Edit `.env` with your actual values:
```env
SENDGRID_API_KEY=SG.your_actual_sendgrid_key
FROM_EMAIL=assessments@integralis.com.au
FROM_NAME=Integralis Assessment Team
NODE_ENV=production
PORT=8080
```

### 3. Deploy with Docker Compose
```bash
# Build and start the container
docker-compose up -d

# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

### 4. Verify Deployment
- Health check: `curl http://localhost:8080/health`
- Access app: `http://localhost:8080`
- Complete a test assessment to verify email delivery

## 🏗️ Architecture

### Container Components
- **Base Image**: Node.js 18 Alpine (lightweight)
- **Runtime**: Express.js server (replaces Netlify Functions)
- **PDF Generation**: Puppeteer with system Chromium
- **Email**: SendGrid integration
- **Port**: 8080 (configurable)

### File Structure
```
/app
├── server.js          # Express server (entry point)
├── public/            # Static files (HTML, CSS, JS)
├── netlify/functions/ # Business logic (converted to API routes)
├── package.json       # Dependencies
└── uploads/           # Temporary file storage
```

## 🔧 Advanced Configuration

### Custom Domain with Reverse Proxy
If using Nginx or Traefik, configure reverse proxy:

**Nginx example:**
```nginx
server {
    listen 80;
    server_name assessment.integralis.com.au;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Traefik labels** (included in docker-compose.yml):
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.assessment.rule=Host(`assessment.integralis.com.au`)"
  - "traefik.http.routers.assessment.tls=true"
```

### Environment Variables
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SENDGRID_API_KEY` | SendGrid API key for emails | - | Yes |
| `FROM_EMAIL` | Sender email address | assessments@integralis.com.au | No |
| `FROM_NAME` | Sender name | Integralis Assessment Team | No |
| `NODE_ENV` | Environment mode | production | No |
| `PORT` | Application port | 8080 | No |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | * | No |
| `TEAMS_WEBHOOK_URL` | Teams integration URL | - | No |

### Resource Requirements
- **Memory**: 512MB minimum, 1GB recommended
- **CPU**: 1 core minimum, 2 cores recommended  
- **Storage**: 1GB for container + logs
- **Network**: Outbound access for SendGrid API

## 📊 Monitoring & Operations

### Health Checks
The container includes built-in health checks:
- **Endpoint**: `GET /health`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

### Logging
```bash
# Container logs
docker-compose logs -f integralis-assessment

# Application logs
docker exec -it integralis-assessment tail -f /app/server.log
```

### Backup Strategy
**Important files to backup:**
- `.env` file (environment configuration)
- `uploads/` directory (temporary files - optional)
- Container logs for troubleshooting

### Updates and Maintenance
```bash
# Update to latest version
git pull origin main
docker-compose build --no-cache
docker-compose up -d

# Restart container
docker-compose restart

# Clean up old images
docker image prune -f
```

## 🚨 Troubleshooting

### Common Issues

**1. Email not sending**
```bash
# Check SendGrid API key
docker exec integralis-assessment env | grep SENDGRID

# Check logs for email errors
docker-compose logs | grep -i sendgrid
```

**2. PDF generation failing**
```bash
# Check Puppeteer/Chromium installation
docker exec integralis-assessment which chromium-browser

# Check memory usage
docker stats integralis-assessment
```

**3. Application not starting**
```bash
# Check port conflicts
netstat -tulpn | grep 8080

# Check container resources
docker-compose logs integralis-assessment
```

### Debug Mode
Run with debug logging:
```bash
# Set debug environment
echo "NODE_ENV=development" >> .env
docker-compose up -d
```

### Performance Tuning
For high traffic, consider:
- Multiple container instances with load balancer
- Redis session store (if adding user sessions)
- CDN for static assets
- Database for storing assessment results

## 🔒 Security Considerations

### Production Security Checklist
- [ ] Use environment variables for all secrets
- [ ] Configure HTTPS with valid SSL certificates
- [ ] Set up firewall rules (only expose necessary ports)
- [ ] Regular security updates for base image
- [ ] Monitor logs for suspicious activity
- [ ] Backup encryption keys securely
- [ ] Configure CORS for production domains only

### Network Security
- Container runs on internal network by default
- Only expose port 8080 via reverse proxy
- All secrets passed via environment variables
- No hardcoded credentials in code

## 📞 Support

For deployment issues:
- **Application logs**: Check container logs first
- **Email delivery**: Verify SendGrid configuration
- **Performance**: Monitor resource usage
- **Security**: Review access logs regularly

Contact: assessments@integralis.com.au

---

## Quick Commands Reference

```bash
# Build and start
docker-compose up -d

# Stop and remove
docker-compose down

# View logs
docker-compose logs -f

# Shell access
docker exec -it integralis-assessment sh

# Health check
curl http://localhost:8080/health

# Update application
git pull && docker-compose build --no-cache && docker-compose up -d
```