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

## Why
- Without these fixes, calendar showed routes from all scenarios mixed together.
- getUnassignedRoutes returned false positives for entries already assigned via routes starting before the period.
- Summary panel was completely broken (undefined fields).
- Re-sync deleted only routes from the specific syncId, not all auto routes in the period.
