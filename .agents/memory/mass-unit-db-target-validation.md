---
name: Mass-unit DB target validation
description: Verify a database dump is from the same development database the app actually uses before profiling mass-unit migration.
---

Before profiling or rehearsing a mass-unit migration, confirm that the dump/export URL identifies the same development database used by the app and schema tooling. Secret names alone do not prove this; an export helper may prefer a separate Neon URL while the runtime uses `DATABASE_URL`.

**Why:** A confirmed dev Neon dump did not contain multiple tables declared by the current app schema, and the app and export paths use different environment-variable names. Profiling the wrong or stale database would give misleading migration results.

**How to apply:** Compare database identity without printing credentials. Restore the selected source into a disposable local PostgreSQL instance. If target identity or schema coverage differs, stop and reconcile before profiling data or drafting a backfill.
