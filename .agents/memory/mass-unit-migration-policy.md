---
name: Mass units and precision
description: Product decisions for converting mass, prices, and litre-based rates to tonnes.
---

- Masses are represented in tonnes and shown with five decimal places. This preserves the legacy precision of 0.01 kg as 0.00001 t.
- Prices per tonne are shown with two decimal places. Keep calculation/storage precision sufficient to preserve existing transaction totals; do not round unit rates early.
- Convert rates per kilogram to rates per tonne by multiplying by 1,000.
- Convert a per-litre rate to an equivalent per-tonne rate using the density recorded for that specific deal. Preserve the transaction amount as litres × the source per-litre rate.
- Monetary totals and the signs/directions of stock movements must not change during unit conversion.
- During staged rollout, keep legacy kg and per-kg API/DB contracts behind explicit, tested conversion adapters; never write tonne values into legacy columns.

**Why:** The user requires mass precision to remain at five decimal places after conversion, while prices display two decimals. Per-litre rates cannot be converted to a universal per-tonne value without the deal's density. Staged modules must remain compatible until the coordinated schema/data cutover.

**How to apply:** Keep each module's calculations and UI in tonnes/₽ per tonne, convert only at its legacy API/storage boundary, and remove adapters only during the coordinated cutover. Follow these rules in database migrations, forms, stock and cost calculations, reports, audit displays, and exports. Reconcile totals and balances before production cutover.
