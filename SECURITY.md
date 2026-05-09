# Security

## Reporting Vulnerabilities

If you find a security issue, please email security@stellar-guardian.org instead of creating a public issue.

## Security Considerations

### Input Validation
- All blockchain data is treated as untrusted
- Event data from RPC calls is validated before processing
- Plugin code runs with limited permissions

### Database Security
- Use parameterized queries to prevent SQL injection
- Database credentials stored in environment variables
- Connection encryption enabled in production

### Webhook Security
- Webhook signatures verified using HMAC-SHA256
- Rate limiting on API endpoints
- Input size limits enforced

### Plugin Security
- Plugins run in isolated contexts
- No direct database access from plugins
- Resource usage monitoring

## Deployment Security

### Production Checklist
- [ ] Use environment variables for secrets
- [ ] Enable database encryption at rest
- [ ] Configure firewall rules
- [ ] Regular security updates
- [ ] HTTPS enforced

### Container Security
- Use official base images
- Run as non-root user
- Minimal attack surface
- Regular image updates

## Best Practices

### For Users
```bash
# Use strong database passwords
DATABASE_URL="postgresql://user:strong_password@localhost:5432/db"

# Secure webhook secrets
WEBHOOK_SECRET="use-a-strong-random-secret-key"

# Enable HTTPS in production
FORCE_HTTPS=true
```

### For Developers
- Validate all inputs
- Use parameterized queries
- Handle errors gracefully
- Follow OWASP guidelines

### For Plugin Developers
- Validate event data
- Handle errors gracefully
- Avoid external code execution
- Use minimal permissions

## Contact

- Security issues: security@stellar-guardian.org
- General contact: hello@stellar-guardian.org