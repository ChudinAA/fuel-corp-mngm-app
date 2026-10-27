---
name: Mass units and precision
description: Product decisions for converting mass, prices, and litre-based rates to tonnes.
---

- Masses are represented in tonnes and shown with five decimal places. This preserves the legacy precision of 0.01 kg as 0.00001 t.
- Prices per tonne are shown with two decimal places. Keep calculation/storage precision sufficient to preserve existing transaction totals; do not round unit rates early.
- Convert rates per kilogram to rates per tonne by multiplying by 1,000.
- Convert a per-litre rate to an equivalent per-tonne rate using the density recorded for that specific deal. Preserve the transaction amount as litres × the source per-litre rate.
- For historical transactions with per-litre prices, preserve the already stored monetary totals while converting the displayed rate using that deal's density.
- Historical БДР `salesVolume` values must be recomputed by month from non-deleted OPT and refueling quantities; only this field is replaced, while `salesRevenue` and other budget fields remain unchanged.
- Monetary totals and the signs/directions of stock movements must not change during unit conversion.
- During staged rollout, keep legacy kg and per-kg API/DB contracts behind explicit, tested conversion adapters; never write tonne values into legacy columns.
- Dashboard warehouse balances show only the current balance in tonnes. Do not treat `storageCost` (₽/т) or `limitVolume` (monthly throughput) as physical capacity; disable capacity alerts until a real capacity field exists.

**Why:** The user requires mass precision to remain at five decimal places after conversion, while prices display two decimals, and explicitly chose to preserve existing totals for historical per-litre deals. Per-litre rates cannot be converted to a universal per-tonne value without the deal's density. The dashboard's former capacity display compared a mass balance with a per-tonne price, so the user chose to show only actual balances until physical capacity is modeled. One БДР auto-fill path has stored revenue in the mass field, so the user chose to rebuild that field from transaction quantities.

**How to apply:** Keep each module's calculations and UI in tonnes/₽ per tonne, convert only at its legacy API/storage boundary, preserve stored historical per-litre deal totals, and remove adapters only during the coordinated cutover. Recalculate active БДР monthly sales volumes from non-deleted OPT/refueling quantities, changing no other budget fields. Follow these rules in database migrations, forms, stock and cost calculations, reports, audit displays, and exports. Reconcile totals and balances before production cutover. On dashboards, display current balances only unless a dedicated physical-capacity field is available.
