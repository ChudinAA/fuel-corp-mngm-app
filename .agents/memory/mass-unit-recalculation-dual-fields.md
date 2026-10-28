---
name: Tonne-authoritative recalculation writes
description: Keep tonne pricing fields synchronized across indirect recalculation and cascade paths.
---

When a recalculation updates a legacy per-kilogram price mirror, it must also update the corresponding per-tonne field. API readers prefer the tonne field, so a stale tonne value overrides a freshly recalculated kg mirror. Direct insert/update paths that bypass the main API adapters need the same dual-write audit.

**Why:** Warehouse cascades, equipment transfers, and related-deal recalculation can change costs after the original API write; the initial migration adapters do not cover those later updates.

**How to apply:** For each stock recalculation or linked-deal cascade, identify whether the source rate is per kg or per tonne, update both representations from one authoritative value, and assert their 1,000:1 relationship in an integration test. Keep the existing total-cost and balance semantics unchanged.
