---
name: Equipment movement live cost
description: Freshness requirements for cost calculations when returning fuel from equipment.
---

Equipment-to-warehouse returns must calculate their cost from the equipment balance endpoint for the selected movement date, not only from the cached equipment directory.

**Why:** The application query cache uses an infinite default stale time; the equipment directory can retain an older average cost after stock recalculation, producing an incorrectly valued return.

**How to apply:** When a form's monetary value depends on current equipment stock, use the date-scoped equipment balance query with a fresh fetch on mount. Keep this freshness scoped to equipment movement calculations so unrelated refueling forms retain their existing cache behavior.
