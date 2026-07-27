---
name: Logistics Plan Bug Fixes & Features
description: Summary of all bug fixes and features implemented in the logistics plan and planning modules (route dialog, summary panel, auto-assign, extra drivers, delivery tariff).
---

## Fixes implemented

**Summary panel (planning-tab.tsx)**
- Routes tile: was using `r.fromLocation/toLocation/date` (fields don't exist); fixed to `r.fromEntityName/toEntityName/dateStart`.
- Unassigned tile: was using `d.warehouse?.name`; fixed to `d.fromEntityName/toEntityName + type + volume + deliveryDeadline`.
- Added "Назначить" button that calls `onOpenDay(new Date(demand.deliveryDeadline))` callback passed down from PlanningTab.

**Route-plan-dialog.tsx** — full rewrite:
- EntitySelector component for from/to: entity type select + combobox by type.
- TariffMatchPanel: auto-finds delivery_cost records for selected from/to pair; shows carrier, transitDays, costPerKg; allows selecting tariff (auto-fills dateEnd via transitDays); inline AddDeliveryCostDialog creation when no tariff found.
- useEffect on [open, day] for date reset.
- Unassigned demands panel for the selected day with "Заполнить" button.
- Existing routes list for the day with status badges.

**Auto-assign.ts**
- Tariff candidate cascade expanded: supplier basisId now tried as BASE/DELIVERY_LOCATION/WAREHOUSE → warehouse basis AND warehouse direct (all permutations).
- Extra drivers fallback: when primary driver blocked by schedule, checks unit's extra drivers for availability (respects their scheduleType and dateFrom/dateTo window).
- Extra drivers are loaded in the initial parallel fetch.

**logistics-plan-storage.ts**
- `getPlanRoutes`: when `scenarioId` not provided, now filters with `isNull(scenarioId)` to avoid mixing scenarios.
- `getUnassignedRoutes`: removed `dateStart >= periodFrom` constraint when checking assigned entries — fixes false positives where routes starting before the period were ignored.

**logistics-plan.ts (server routes)**
- Re-sync cleanup: deletes auto routes by period+scenario (gte/lte dateStart + scenarioId eq/isNull), not just by syncId.
- Extra driver creation now accepts dateFrom, dateTo, scheduleType.

**quick-plan-dialog.tsx**
- `basesForSupplier()` now returns empty list (not all bases) when supplier has no resources with basisId.

**delivery-cost-dialog.tsx + delivery-storage.ts**
- Added transitDays and priority fields to the form (form schema, UI inputs, reset logic).
- Storage createDeliveryCost now saves transitDays/priority.

**logistics-plan entities + migration**
- Added `dateFrom`, `dateTo`, `scheduleType` to `logisticsUnitExtraDrivers` (both schema and DB via executeSql).
- ExtraDriversSection in transport-tab.tsx rewritten with full schedule UI.

## Fixes in session 2 (corrections)

**Tariff cascade (auto-assign.ts)** — removed treating `entry.basisId` as DL/WAREHOUSE entity types. `basisId` is always a BASE ID. The cascade now mirrors OPT deals exactly: for income [B, basisId, B, wBasisId], [B, basisId, W, warehouseId]; for expense [B, wBasisId, B, basisId], [W, warehouseId, B, basisId]. Added skip for same-entity routes (basisId === warehouseBasisId — e.g. ЯНОС→ЯНОС).

**Volume in tonnes (server)** — `plan_entries.volume` stores in **kg** (quick-plan-dialog uses `tonsToKg()` on input). Calendar endpoint now computes `volumeTons = volume / 1000` and includes `fromEntityType/fromEntityId/toEntityType/toEntityId` in unassigned demand objects.

**"Заполнить" button (route-plan-dialog)** — was not working because server never returned `fromEntityType/Id/toEntityType/Id` on demands. Fixed server-side enrichment.

**Driver availability + extra drivers (planning-tab.tsx)** — Calendar endpoint now fetches all extra drivers and enriches each transport unit with `extraDriversForPeriod`. WeekView cell now shows "Доп. вод." (green) when primary driver is unavailable but an active extra driver covers that day, vs "Вод. нет" (orange) when no substitute. Unit row label shows "Недоступен (есть замена)" vs "Недоступен". Summary panel "unavailable" section now shows unavailability periods, schedule type, and extra driver coverage per unit.

## Why
- Without these fixes, calendar showed routes from all scenarios mixed together.
- getUnassignedRoutes returned false positives for entries already assigned via routes starting before the period.
- Summary panel was completely broken (undefined fields).
- Re-sync deleted only routes from the specific syncId, not all auto routes in the period.
