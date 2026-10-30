---
name: Equipment stock after deletion
description: Expected equipment valuation when a stock transaction is deleted or restored.
---

An equipment record can have zero tonnes while retaining its last average cost per tonne. Do not treat zero quantity as proof that valuation should also be zero.

**Why:** UI testing of equipment-transfer deletion showed the recalculated quantity at zero while average cost remained at 15,000 ₽/т; this is the system's current valuation behavior.

**How to apply:** When testing equipment movement deletion or restoration, assert stock quantity and average cost independently. Require one active ledger row on each side after restore, and allow no recalculation-queue task when the balance change is applied synchronously.
