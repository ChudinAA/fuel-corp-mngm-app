---
name: Logistics Auto-Assignment Engine
description: How the logistics plan auto-assignment engine works — what it does on sync, where the code lives, key design decisions.
---

## Rule
POST /api/logistics-plan/sync now runs a full auto-assignment engine (not just a JSONB snapshot).

**Why:** Calendar was always empty because no `logistics_plan_routes` rows were ever created automatically.

## How to apply

### Engine location
`server/modules/logistics-plan/engine/auto-assign.ts` — `runAutoAssignment(opts)`

### What it does on sync
1. Loads plan_entries, delivery_costs, transport_units, driver_schedules, vehicle_availability
2. Maps each plan_entry → {from, to} entity:
   - income: from = (base, entry.basisId), to = (base, warehouse's first basisId via warehouseBases table)
   - expense: from = (base, warehouse's basisId), to = (base, entry.basisId)
3. Finds matching delivery_cost records (same cascade logic as OPT use-opt-calculations.ts)
4. Calculates dates: deliveryDeadline = entry.date − 2 days, dateEnd = deadline, dateStart = deadline − transitDays
5. Sorts requirements: earliest deadline first, then by priority ASC
6. Assigns transport units: АС-carrier first (identified by /авиасерв|авиа\s*сервис/i), then others
7. Inserts deadhead routes if unit is at wrong location (1-day relocation)
8. Sets isDeadline / isLate / isOptimal flags
9. Creates notifications for every issue (not found, unassigned, deadline, non-optimal)
10. On re-sync: soft-deletes existing auto routes (status='auto') for the syncId before re-running; preserves manual routes

### Re-sync delete pattern
```sql
UPDATE logistics_plan_routes SET deleted_at = NOW()
WHERE sync_id = $1 AND status = 'auto' AND deleted_at IS NULL
```

### Calendar endpoint
GET /api/logistics-plan/calendar now also returns `unassignedDemands` — enriched plan_entries with no route, with fromEntityName/toEntityName/deliveryDeadline added.

### Frontend
- `planning-tab.tsx`: WeekView and MonthView accept `unassignedDemands` prop; red dot shown on deliveryDeadline date
- `route-plan-dialog.tsx`: shows unassigned demands section (amber), "Заполнить" button pre-fills form; shows isLate/isDeadline warnings based on dateEnd vs selected day

## Key schema facts
- `logistics_transport_units.currentLocationEntityType/Id/Name` — tracked during assignment, updated after
- `logistics_plan_routes.status` = 'auto' | 'manual' — must preserve 'manual' on re-sync
- Warehouse→basis via `warehouseBases` junction table (warehouseId → baseId, take first row)
- АС carrier identified by name regex, not a flag in the DB
