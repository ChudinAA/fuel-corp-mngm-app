---
name: Equipment transfer cost cascades
description: Cost-source rules when recalculating transfers between warehouses and fuel equipment.
---

When an equipment-originating transfer is recalculated, its movement record can hold the new cost before the outgoing equipment transaction is persisted. Downstream warehouse receipts should therefore use the movement record's recalculated cost, not the potentially stale outgoing transaction. A receiving equipment recalculation must not replace the movement's source cost with the receiver's blended average.

**Why:** Cascading recalculation runs within the source transaction's processing, before its final transaction update, and the receiving asset may have a different average cost from the transferred fuel.

**How to apply:** When changing transfer recalculation order or source-cost lookups, verify equipment → warehouse and warehouse → equipment chains, including both the movement cost and the recipient's resulting average cost.

For transactions with the same business timestamp, process inventory checkpoints first, then receipts/transfer-ins, then outflows. Creation time and ID only break ties within that priority. This makes a simultaneous transfer receipt available to a refueling regardless of row insertion order.

**Why:** A refueling must use stock received at that same business time even if the transfer record was created later.

**How to apply:** Keep the same tie policy in warehouse and equipment recalculation and cover it with a fixture where the incoming transfer has a later `createdAt` than the sale.

Warehouse transfer cycles can update the cost of a receipt after its transaction was already processed. Defer recalculating active destination warehouses until the current cascade unwinds, then replay iteratively until the cycle stops changing rather than recursively re-entering an active warehouse.

**Why:** A single deferred pass can still change an upstream transfer cost and make the return receipt stale again; the cyclic stock averages need to settle together.

**How to apply:** For cycle fixes, test a receipt that is ordered before the transfer that changes its cost, assert the persisted receipt and final stock average, and keep a finite replay limit so a non-settling cycle fails clearly.
