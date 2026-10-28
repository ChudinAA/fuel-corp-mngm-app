---
name: Migration rehearsal transactions
description: Transaction boundaries when replaying PostgreSQL migrations inside isolated mass-unit rehearsals.
---

Run migration scripts containing `BEGIN`/`COMMIT` outside any outer probe transaction. In PostgreSQL, a nested `BEGIN` does not create a savepoint; the migration's `COMMIT` commits the active outer transaction too.

**Why:** A rehearsal may appear to roll back its temporary probes while a migration `COMMIT` already ended the transaction, so later `ROLLBACK` cannot restore the expected isolation.

**How to apply:** In disposable database rehearsals, run schema/data migrations first, then open a separate transaction for temporary columns and comparisons; rollback only that probe transaction.
