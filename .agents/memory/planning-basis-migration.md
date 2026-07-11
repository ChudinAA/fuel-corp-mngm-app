---
name: Planning basisId migration
description: basisId columns added to plan_entries and planning_resources; drizzle-kit push is interactive — use executeSql instead.
---

`drizzle-kit push` prompts interactively when it detects schema changes that could truncate data (e.g. adding a unique constraint). This blocks automated migrations.

**Rule:** For any planning schema migration, apply the SQL directly via `executeSql` in the code_execution sandbox rather than running `drizzle-kit push`.

**Why:** `drizzle-kit push` hung on an interactive "truncate?" prompt, blocking the migration. `executeSql` with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is safe and non-interactive.

**How to apply:** Run migrations with `executeSql({ sqlQuery: "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ..." })` for additive schema changes.
