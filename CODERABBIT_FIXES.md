# CodeRabbit Fix Log — Upgrade, Config, and Middleware Corrections

This document summarizes the concrete changes applied to address the reported issues so CodeRabbit can validate them.

---

- docker-compose.yml: Keep PostgreSQL 16 and add a clear breaking-change warning near the image line. Added explicit notes pointing to README instructions for migrating existing Postgres 15 volumes.
  - File: docker-compose.yml:3
  - Change: Documented major upgrade and required manual migration steps; retained image postgres:16-alpine for forward compatibility.

- PostgreSQL reload command in pg_hba.conf: Fixed incorrect reload example. Replaced pg_ctl without data dir with two correct options: SQL reload via SELECT pg_reload_conf(); and pg_ctl reload -D "$PGDATA". Updated example container name to kevinalthaus-postgres.
  - File: docker/postgres/pg_hba.conf: notes section
  - Change: Provide correct Docker exec commands for reloading config.

- Package metadata: Populate empty author field in API gateway package.json.
  - File: packages/api-gateway/package.json:19
  - Change: "author": "Kevin Althaus"

- Compression middleware header handling: Normalize Cache-Control header types before checking for no-transform (string | string[] | number | undefined). If no-transform present, skip compression; otherwise defer to compression.filter.
  - File: packages/api-gateway/src/middleware/performance.ts
  - Change: Normalize to string; perform case-insensitive check; preserve type safety.

- Database password file support: Add POSTGRES_PASSWORD_FILE support and precedence over POSTGRES_PASSWORD; trim file contents; throw clear error if file variable is set but unreadable or empty. Also update validation so non-connection-string mode requires POSTGRES_PASSWORD or POSTGRES_PASSWORD_FILE.
  - File: packages/main-app/src/db/index.ts
  - Change: resolveDbPassword() helper; stronger env validation.

- DATABASE_URL validation: When using connection string mode, ensure DATABASE_URL is set, non-empty and begins with postgres:// or postgresql://; otherwise throw a clear error.
  - File: packages/main-app/src/db/index.ts
  - Change: Early validation block mirroring existing password validation style.

- Upload middleware consistency and logging: Clarify that MIME_TO_EXTENSIONS includes optional MIME types (text/plain, application/json, text/csv) not enabled by default; these are intended for ALLOWED_FILE_TYPES env override. Also remove unnecessary dynamic import of defaultLogger in a catch path and use the already imported logger.
  - File: packages/main-app/src/middleware/upload.ts
  - Change: Added explanatory comment; replaced dynamic logger import with top-level logger usage.

- Documentation for breaking Postgres upgrade: Added a detailed README section with explicit migration steps using pg_dumpall, volume removal, container restart, and restore. Also augmented docs/deployment.md with a quick migration snippet in addition to the existing checklist.
  - Files: README.md, docs/deployment.md
  - Change: Clear operator guidance to avoid data loss during 15→16 migration.

---

Validation Notes for CodeRabbit:
- TypeScript changes compile with stricter type guards for header handling.
- DB config changes surface actionable errors early and support secret files.
- Docker and docs now warn explicitly about the PostgreSQL 16 breaking change and provide safe migration steps.

