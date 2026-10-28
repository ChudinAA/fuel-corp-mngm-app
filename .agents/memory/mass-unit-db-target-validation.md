---
name: Mass-unit DB target validation
description: Verify a database dump is from the same development database the app actually uses before profiling mass-unit migration.
---

Before profiling or rehearsing a mass-unit migration, distinguish the runtime database from any export/source database. In Replit the same `DATABASE_URL` name points to separate development and production databases; the shell value typically targets development. This app's runtime uses `DATABASE_URL`, while the legacy Neon exporter prefers `NEON_DATABASE_URL` if both are set.

**Why:** Schema size and row counts do not prove two databases contain equivalent records. A comparison found shared IDs with different mass, price, amount, and balance values, so deleting the alternate connection before reconciliation could hide data needed to resolve conflicts.

**How to apply:** Confirm the runtime URL from code and the target from the user's decision without printing credentials. Restore each source into disposable local PostgreSQL and compare overlapping records before retiring an alternate URL. Treat production as a separate database; use Replit Database Settings for production dumps, not the shell's `DATABASE_URL`. For historical mass backfill, convert saved kg values to tonnes; do not replace them with `liters × density`. Use deal density for per-liter price equivalents, preserve stored sums, and route mismatches for review.
