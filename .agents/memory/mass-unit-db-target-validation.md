---
name: Mass-unit DB target validation
description: Verify a database dump is from the same development database the app actually uses before profiling mass-unit migration.
---

Before profiling or rehearsing a mass-unit migration, distinguish the runtime database from any export/source database. In Replit the same `DATABASE_URL` name points to separate development and production databases; the shell value typically targets development. This app's runtime and confirmed dev data source use `DATABASE_URL`; production remains a separate database.

The user verified the production connection host as `neon.tech`, identifying the app's production target as external Neon. The Replit-managed production database exposed by `executeSql(environment="production")` is not the app's Neon production database.

**Why:** Schema size and row counts do not prove two databases contain equivalent records. Some shared rows had conflicting mass/price values; timestamps favored the runtime DB where available, but several conflicts had no usable timestamp. A production host check showed `neon.tech`, so Replit-managed production SQL would profile a different database.

**How to apply:** Confirm the runtime URL from code and the target from the user's decision without printing credentials. Restore alternate sources into disposable local PostgreSQL and compare overlapping records before retiring them. Do not use `updated_at` as the sole authority when it is absent; inspect audit/business history or ask the user to choose a winner. Treat production as separate from the shell's dev `DATABASE_URL`. Replit's `executeSql(environment="production")` only queries Replit-managed PostgreSQL; this project's confirmed external Neon production must be backed up through the actual Neon project/branch, using a direct unpooled connection, not that callback. Verify the dump matches the deployed target before profiling. For historical mass backfill, convert saved kg values to tonnes; do not replace them with `liters × density`. Use deal density for per-liter price equivalents, preserve stored sums, and route mismatches for review.
