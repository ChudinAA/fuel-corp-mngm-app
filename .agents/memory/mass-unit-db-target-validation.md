---
name: Mass-unit DB target validation
description: Verify a database dump is from the same development database the app actually uses before profiling mass-unit migration.
---

Before profiling or rehearsing a mass-unit migration, confirm which database is the intended target and which one the app/schema tooling actually uses. Secret names alone do not prove this; an export helper may prefer a separate Neon URL while the runtime uses `DATABASE_URL`.

**Why:** A confirmed dev Neon dump did not contain multiple tables declared by the current app schema, while the active runtime database had the full schema. The active dev data also contains live rows where `quantity_kg` differs from `quantity_liters × density` by up to 130 kg.

**How to apply:** Compare target identity without printing credentials. Restore the selected source into disposable local PostgreSQL. If the intended target differs from runtime, profile it as a data source but do not call that an app-level migration test. For historical mass backfill, convert the saved kg value to tonnes; do not replace it with `liters × density` automatically. Use deal density for per-liter price equivalents and preserve stored monetary sums; route mismatches for review.
