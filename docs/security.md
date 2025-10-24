# Security Guide

## Overview

The platform applies defense-in-depth across auth, CSRF, CORS, headers, and internal service trust.

## Highlights

- JWT auth with refresh rotation and RBAC
- CSRF protections on admin routes: token + Origin/Referer checks + allowed Content-Types
- Strict security headers (Helmet) with environment toggles
- CORS allowlist via environment variables, consistent across services
- Internal service authentication via shared gateway token in production
- Docker network isolation: internal services are not exposed publicly

## Admin CSRF Requirements

All admin POST/PUT/PATCH/DELETE requests require:
- Valid CSRF token (double-submit cookie)
- Valid Origin or Referer matching current host
- Allowed Content-Type (form-urlencoded, JSON, or multipart)
- Authenticated session

## Recommendations

- Use Redis or DB-backed sessions in multi-instance deployments
- Enforce HTTPS in production; `SameSite=None` requires `Secure` cookies
- Rotate secrets regularly and store securely

See `docs/maintainers/pending-fixes.md` for open security/code-quality items.

