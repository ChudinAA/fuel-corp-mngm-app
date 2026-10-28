---
name: Mass-unit DB target validation
description: Verify a database dump is from the same development database the app actually uses before profiling mass-unit migration.
---

Before profiling or rehearsing a mass-unit migration, confirm which database is the intended target and which one the app/schema tooling actually uses. Secret names alone do not prove this; an export helper may prefer a separate Neon URL while the runtime uses `DATABASE_URL`.

**Why:** A confirmed dev Neon dump did not contain multiple tables declared by the current app schema, and the app and export paths use different environment-variable names. Profiling an intended target is useful, but it does not validate app behavior when runtime points elsewhere.

**How to apply:** Compare target identity without printing credentials. Restore the selected source into disposable local PostgreSQL. If the intended target differs from runtime, profile it as a data source but do not call that an app-level migration test; reconcile the runtime target before cutover.
