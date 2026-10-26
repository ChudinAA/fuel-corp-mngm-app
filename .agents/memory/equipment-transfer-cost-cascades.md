---
name: Equipment transfer cost cascades
description: Cost-source rules when recalculating transfers between warehouses and fuel equipment.
---

When an equipment-originating transfer is recalculated, its movement record can hold the new cost before the outgoing equipment transaction is persisted. Downstream warehouse receipts should therefore use the movement record's recalculated cost, not the potentially stale outgoing transaction. A receiving equipment recalculation must not replace the movement's source cost with the receiver's blended average.

**Why:** Cascading recalculation runs within the source transaction's processing, before its final transaction update, and the receiving asset may have a different average cost from the transferred fuel.

**How to apply:** When changing transfer recalculation order or source-cost lookups, verify equipment → warehouse and warehouse → equipment chains, including both the movement cost and the recipient's resulting average cost.
