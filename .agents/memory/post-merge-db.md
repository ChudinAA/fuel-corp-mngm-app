---
name: Post-merge database migration verification
description: Drizzle schema pushes can stop at interactive uniqueness prompts without applying later schema changes.
---

Do not treat a successful post-merge script exit as proof that the development schema is current. In this project, legacy unique-constraint names can differ from Drizzle-generated names; `drizzle-kit push --force` may still stop at a prompt about truncating a populated table, leaving later required columns unapplied. Never choose truncation to clear the prompt.

**Why:** A refueling-list query began selecting a newly modeled order-ID column that was absent from the development database. The configured post-merge script exited successfully, but its output showed a uniqueness prompt and the column remained missing.

**How to apply:** Inspect the complete post-merge stdout when schema changes are suspected, then verify required columns and indexes in `information_schema`/`pg_indexes`. If an existing unique constraint already enforces the required rule, reconcile its name without dropping the constraint or data; otherwise apply only the reviewed, non-destructive schema change.
