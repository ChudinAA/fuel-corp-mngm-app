---
name: Extra drivers multi-driver support
description: How multiple drivers per transport unit are stored and served
---

## Rule
A transport unit has one primary driver (driverId on logisticsTransportUnits) and any number of extra drivers via `logistics_unit_extra_drivers` table.

**Why:** Users needed to assign relief/backup drivers to one truck, each with their own schedule.

**How to apply:**
- DB: `logistics_unit_extra_drivers` (transport_unit_id, driver_id, notes, deleted_at)
- Schema entity: `logisticsUnitExtraDrivers` in `server/modules/logistics-plan/entities/logistics-plan.ts`
- Storage: `getExtraDriversForUnit`, `addExtraDriver`, `removeExtraDriver` in `logistics-plan-storage.ts`
- API: GET/POST `/api/logistics-plan/transport-units/:id/extra-drivers`, DELETE `/api/logistics-plan/extra-drivers/:id`
- Frontend: `ExtraDriversSection` component inside `DriverScheduleCell` popover in transport-tab.tsx; fetches allDrivers from `/api/logistics/drivers`
- Calendar invalidation is triggered on driver-schedule mutations so planning-tab auto-refreshes (refetchInterval 30s)
