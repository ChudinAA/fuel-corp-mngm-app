---
name: Local PostgreSQL test cluster
description: Starting a temporary PostgreSQL instance in Replit for safe integration-test verification.
---

When starting an isolated local PostgreSQL cluster, use a writable temporary directory for the Unix socket with `pg_ctl -o "-k <temp-dir>"`. The default `/run/postgresql` directory may not exist in the Replit container. Bind TCP to `127.0.0.1` on a free port, use a throwaway data directory, and stop and remove the cluster after the test.

**Why:** PostgreSQL startup failed because it could not create its default socket lock file under the missing `/run/postgresql` directory.

**How to apply:** Use this only for disposable local test clusters; never point it at the app’s managed or external database.
