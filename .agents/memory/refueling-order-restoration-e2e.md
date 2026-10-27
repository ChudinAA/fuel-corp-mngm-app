---
name: Refueling order restoration and E2E invariants
description: Safe group restore semantics and realistic inventory setup for refueling flow tests.
---

When restoring a multi-product refueling order, restore only the rows removed by that specific order deletion. A shared order ID also includes products that may have been soft-deleted in earlier edits; those historical rows must remain deleted. The delete timestamp is shared by rows updated inside one database transaction and can identify the deletion batch unless the persistence model changes.

**Why:** restoring every row with the same order ID revived an old product that had already been removed before the order itself was deleted.

**How to apply:** cover remove-product → add-product → delete-order → restore-order, and assert both active rows and stock. Seed starting stock with receipt transactions, not just current balance fields, because backdated recalculation rebuilds balances from transaction history.
