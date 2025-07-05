# Deployment Guide

## Quick Start

### Development
```bash
# Start development environment
docker-compose --profile dev up -d

# Or run locally
npm install
pip3 install -r requirements.txt
npm run server:dev
```

### Production
```bash
# Start production environment
docker-compose --profile prod up -d

# With monitoring
docker-compose --profile prod --profile monitoring up -d
```

## Environment Variables

Create a `.env` file:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=https://yourdomain.com

# AI Configuration
OCR_LANGUAGE=eng+hin
OCR_DPI=300
ELA_QUALITY=90
PYTHON_TIMEOUT=60000

# Security
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=warn

# Redis (optional)
REDIS_URL=redis://redis:6379
```

## SSL Configuration

1. Generate SSL certificates:
```bash
# Self-signed for development
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem

# Or use Let's Encrypt for production
certbot certonly --webroot -w /var/www/html -d yourdomain.com
```

2. Update nginx.conf to enable HTTPS

## Monitoring Setup

### Prometheus Configuration
Create `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ai-document-validator'
    static_configs:
      - targets: ['ai-document-validator:3001']
    metrics_path: '/api/metrics'
```

### Grafana Dashboards
1. Access Grafana at http://localhost:3000
2. Login with admin/admin
3. Add Prometheus data source: http://prometheus:9090
4. Import dashboard for Node.js applications

## Performance Tuning

### Node.js Optimization
```bash
# Set Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=2048"

# Enable cluster mode for production
export NODE_ENV=production
export CLUSTER_MODE=true
```

### System Requirements
- **Minimum**: 2 CPU cores, 4GB RAM, 20GB storage
- **Recommended**: 4 CPU cores, 8GB RAM, 50GB storage
- **High Load**: 8+ CPU cores, 16GB+ RAM, SSD storage

## Security Checklist

- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure firewall to allow only necessary ports
- [ ] Set up rate limiting and DDoS protection
- [ ] Enable security headers in nginx
- [ ] Use non-root user in containers
- [ ] Regularly update dependencies
- [ ] Monitor logs for suspicious activity
- [ ] Implement backup strategy

## Backup Strategy

### Database Backup (if using)
```bash
# Backup Redis data
docker exec redis redis-cli BGSAVE
docker cp redis:/data/dump.rdb ./backups/
```

### File Backup
```bash
# Backup uploaded files and logs
tar -czf backup-$(date +%Y%m%d).tar.gz uploads/ logs/
```

## Troubleshooting

### Common Issues

1. **OCR Service fails to initialize**
   - Check Tesseract installation
   - Verify language packs are installed
   - Check file permissions

2. **High memory usage**
   - Monitor image processing operations
   - Implement cleanup for temporary files
   - Adjust Node.js memory limits

3. **Slow processing times**
   - Check system resources
   - Optimize image preprocessing
   - Consider horizontal scaling

### Log Analysis
```bash
# View application logs
docker-compose logs -f ai-document-validator

# Check nginx access logs
docker-compose logs nginx | grep "POST /api/validate"

# Monitor system resources
docker stats
```

## Scaling

### Horizontal Scaling
```yaml
# docker-compose.yml
services:
  ai-document-validator:
    deploy:
      replicas: 3
    # ... other configuration
```

### Load Balancing
Update nginx.conf:
```nginx
upstream app {
    server ai-document-validator_1:3001;
    server ai-document-validator_2:3001;
    server ai-document-validator_3:3001;
}
```

## Health Monitoring

### Health Check Endpoints
- `GET /api/health` - Basic health check
- `GET /api/stats` - System statistics
- `GET /api/metrics` - Prometheus metrics

### Alerting Rules
Set up alerts for:
- High error rates (>5%)
- Slow response times (>30s)
- High memory usage (>80%)
- Disk space usage (>90%)

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Clean up old temporary files
- Rotate logs
- Monitor disk usage
- Review security logs

### Update Process
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose --profile prod build
docker-compose --profile prod up -d
```