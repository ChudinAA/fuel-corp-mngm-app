/**
 * Logistics Plan Auto-Assignment Engine
 *
 * Triggered after a monthly plan sync to automatically generate
 * logistics routes from plan_entries and assign them to transport units.
 *
 * Logic:
 * 1. Map each plan_entry → {from, to} entity pair
 *    - income: from = supplier basis (entry.basisId), to = warehouse's basis
 *    - expense: from = warehouse's basis, to = counterparty basis (entry.basisId)
 * 2. Find matching delivery_cost record (same cascade as OPT deals)
 * 3. Calculate dates: delivery deadline = entry.date − 2 days, dateStart = deadline − transitDays
 * 4. Assign the nearest free transport unit, АС-carrier first
 * 5. If unit is at wrong location, prepend a deadhead trip
 * 6. Set isDeadline / isLate / isOptimal flags and create notifications
 */

import { db } from "server/db";
import { and, isNull, gte, lte, eq, sql } from "drizzle-orm";
import {
  planEntries,
  warehouseBases,
  deliveryCost,
  logisticsCarriers,
  logisticsTransportUnits,
  logisticsDriverSchedule,
  logisticsVehicleAvailability,
  logisticsPlanRoutes,
  logisticsPlanNotifications,
  bases,
  warehouses,
} from "@shared/schema";
import { DELIVERY_ENTITY_TYPE } from "@shared/constants";

// ─── date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString();
}

function addDays(isoStr: string, days: number): string {
  const d = new Date(isoStr);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function subtractDays(isoStr: string, days: number): string {
  return addDays(isoStr, -days);
}

/** true if [a1,a2] and [b1,b2] overlap (inclusive) */
function overlaps(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 <= b2 && a2 >= b1;
}

// ─── types ────────────────────────────────────────────────────────────────────

interface RouteRequirement {
  planEntryId: string;
  fromEntityType: string;
  fromEntityId: string;
  fromEntityName: string;
  toEntityType: string;
  toEntityId: string;
  toEntityName: string;
  /** Delivery must arrive by this date */
  deliveryDeadline: string;
  /** All matching delivery costs, АС-carrier first then by priority ASC */
  matchingCosts: DeliveryCostRow[];
}

interface DeliveryCostRow {
  id: string;
  carrierId: string;
  transitDays: number | null;
  priority: number | null;
  isAsCarrier: boolean; // true if carrier name matches АС pattern
}

interface UnitLocation {
  entityType: string | null;
  entityId: string | null;
  name: string | null;
}

interface BusyPeriod {
  dateStart: string;
  dateEnd: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isAsCarrierName(name: string): boolean {
  return /авиасерв|авиа\s*сервис/i.test(name);
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function runAutoAssignment(opts: {
  syncId: string;
  periodFrom: string;
  periodTo: string;
  scenarioId?: string | null;
  userId?: string;
}): Promise<{ created: number; deadheads: number; unassigned: number }> {
  const { syncId, periodFrom, periodTo, scenarioId, userId } = opts;

  // ── 1. Load all reference data in parallel ──────────────────────────────────
  const periodConditions = (dateCol: any) =>
    and(lte(dateCol, periodTo), gte(dateCol, periodFrom));

  const [
    entries,
    allDeliveryCosts,
    allUnits,
    allDriverSchedules,
    allVehicleUnavail,
    wbRows,
    allBases,
    allWarehouses,
    allCarriers,
    existingManualRoutes,
  ] = await Promise.all([
    db
      .select()
      .from(planEntries)
      .where(
        and(
          isNull(planEntries.deletedAt),
          gte(planEntries.date, periodFrom),
          lte(planEntries.date, periodTo),
          ...(scenarioId ? [eq(planEntries.scenarioId, scenarioId)] : []),
        ),
      ),

    db
      .select()
      .from(deliveryCost)
      .where(and(isNull(deliveryCost.deletedAt), eq(deliveryCost.isActive, true))),

    db
      .select()
      .from(logisticsTransportUnits)
      .where(and(isNull(logisticsTransportUnits.deletedAt), eq(logisticsTransportUnits.isActive, true))),

    // driver schedules overlapping the period
    db
      .select()
      .from(logisticsDriverSchedule)
      .where(
        and(
          isNull(logisticsDriverSchedule.deletedAt),
          lte(logisticsDriverSchedule.dateFrom, periodTo),
          gte(logisticsDriverSchedule.dateTo, periodFrom),
        ),
      ),

    // vehicle unavailability overlapping the period
    db
      .select()
      .from(logisticsVehicleAvailability)
      .where(
        and(
          isNull(logisticsVehicleAvailability.deletedAt),
          lte(logisticsVehicleAvailability.dateFrom, periodTo),
          gte(logisticsVehicleAvailability.dateTo, periodFrom),
        ),
      ),

    db.select().from(warehouseBases),

    db.select().from(bases).where(isNull(bases.deletedAt)),

    db.select().from(warehouses).where(isNull(warehouses.deletedAt)),

    db.select().from(logisticsCarriers).where(isNull(logisticsCarriers.deletedAt)),

    // pre-existing manually assigned routes (must not be overwritten)
    db
      .select()
      .from(logisticsPlanRoutes)
      .where(
        and(
          isNull(logisticsPlanRoutes.deletedAt),
          eq(logisticsPlanRoutes.status, "manual"),
          lte(logisticsPlanRoutes.dateStart, periodTo),
          gte(logisticsPlanRoutes.dateEnd, periodFrom),
          ...(scenarioId ? [eq(logisticsPlanRoutes.scenarioId, scenarioId)] : []),
        ),
      ),
  ]);

  // ── 2. Build lookup maps ────────────────────────────────────────────────────
  const basesMap = new Map(allBases.map((b) => [b.id, b.name]));
  const warehousesMap = new Map(allWarehouses.map((w) => [w.id, w]));
  const carriersMap = new Map(allCarriers.map((c) => [c.id, c]));

  // warehouseId → first basisId (primary basis of the warehouse)
  const warehousePrimaryBasis = new Map<string, string>();
  for (const wb of wbRows) {
    if (!warehousePrimaryBasis.has(wb.warehouseId)) {
      warehousePrimaryBasis.set(wb.warehouseId, wb.baseId);
    }
  }

  // carrierId → isАС
  const carrierIsAs = new Map<string, boolean>(
    allCarriers.map((c) => [c.id, isAsCarrierName(c.name)]),
  );

  // ── 3. Build route requirements from plan_entries ───────────────────────────
  const requirements: RouteRequirement[] = [];
  const problemNotifications: Array<{ type: string; message: string }> = [];

  for (const entry of entries) {
    let fromEntityType: string;
    let fromEntityId: string;
    let fromEntityName: string;
    let toEntityType: string;
    let toEntityId: string;
    let toEntityName: string;

    const warehouseName = warehousesMap.get(entry.warehouseId)?.name ?? "Склад";
    const warehouseBasisId = warehousePrimaryBasis.get(entry.warehouseId);

    if (entry.type === "income") {
      // from = supplier basis, to = warehouse's basis
      if (!entry.basisId) {
        problemNotifications.push({
          type: "unassigned",
          message: `Приход: не указан базис поставщика (запись ${entry.id.slice(0, 8)}) — маршрут пропущен`,
        });
        continue;
      }
      if (!warehouseBasisId) {
        problemNotifications.push({
          type: "unassigned",
          message: `Склад «${warehouseName}» не привязан ни к одному базису — маршрут пропущен`,
        });
        continue;
      }
      fromEntityType = DELIVERY_ENTITY_TYPE.BASE;
      fromEntityId = entry.basisId;
      fromEntityName = basesMap.get(entry.basisId) ?? "Базис поставщика";
      toEntityType = DELIVERY_ENTITY_TYPE.BASE;
      toEntityId = warehouseBasisId;
      toEntityName = basesMap.get(warehouseBasisId) ?? warehouseName;
    } else if (entry.type === "expense") {
      // from = warehouse's basis, to = counterparty basis
      if (!entry.basisId) {
        problemNotifications.push({
          type: "unassigned",
          message: `Расход: не указан базис контрагента (запись ${entry.id.slice(0, 8)}) — маршрут пропущен`,
        });
        continue;
      }
      if (!warehouseBasisId) {
        problemNotifications.push({
          type: "unassigned",
          message: `Склад «${warehouseName}» не привязан ни к одному базису — маршрут пропущен`,
        });
        continue;
      }
      fromEntityType = DELIVERY_ENTITY_TYPE.BASE;
      fromEntityId = warehouseBasisId;
      fromEntityName = basesMap.get(warehouseBasisId) ?? warehouseName;
      toEntityType = DELIVERY_ENTITY_TYPE.BASE;
      toEntityId = entry.basisId;
      toEntityName = basesMap.get(entry.basisId) ?? "Базис контрагента";
    } else {
      // unknown type — skip silently
      continue;
    }

    // Find all delivery costs matching this from→to pair (any carrier)
    // Cascade: base→base first, warehouse→base fallback
    let matchingRaw = allDeliveryCosts.filter(
      (dc) =>
        dc.fromEntityType === fromEntityType &&
        dc.fromEntityId === fromEntityId &&
        dc.toEntityType === toEntityType &&
        dc.toEntityId === toEntityId,
    );

    // Warehouse→base fallback for income entries when no base→base found
    if (matchingRaw.length === 0 && entry.type === "income") {
      matchingRaw = allDeliveryCosts.filter(
        (dc) =>
          dc.fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
          dc.fromEntityId === entry.warehouseId &&
          dc.toEntityType === DELIVERY_ENTITY_TYPE.BASE &&
          dc.toEntityId === entry.basisId,
      );
    }

    if (matchingRaw.length === 0) {
      problemNotifications.push({
        type: "unassigned",
        message: `Маршрут не найден в тарифах доставки: ${fromEntityName} → ${toEntityName}. Задайте маршрут вручную.`,
      });
      continue;
    }

    // Sort: АС carrier first, then by priority ASC (null = lowest)
    const matchingCosts: DeliveryCostRow[] = matchingRaw
      .map((dc) => ({
        id: dc.id,
        carrierId: dc.carrierId ?? "",
        transitDays: dc.transitDays,
        priority: dc.priority,
        isAsCarrier: carrierIsAs.get(dc.carrierId ?? "") ?? false,
      }))
      .sort((a, b) => {
        // АС first
        if (a.isAsCarrier !== b.isAsCarrier) return a.isAsCarrier ? -1 : 1;
        // then by priority (lower number = higher importance; null last)
        const pa = a.priority ?? 999;
        const pb = b.priority ?? 999;
        return pa - pb;
      });

    // delivery deadline = entry.date − 2 days (last pentad day minus 2)
    const deliveryDeadline = subtractDays(entry.date, 2);

    requirements.push({
      planEntryId: entry.id,
      fromEntityType,
      fromEntityId,
      fromEntityName,
      toEntityType,
      toEntityId,
      toEntityName,
      deliveryDeadline,
      matchingCosts,
    });
  }

  // Sort requirements: earliest deadline first, then by highest priority (lowest number)
  requirements.sort((a, b) => {
    const d = a.deliveryDeadline.localeCompare(b.deliveryDeadline);
    if (d !== 0) return d;
    const pa = a.matchingCosts[0]?.priority ?? 999;
    const pb = b.matchingCosts[0]?.priority ?? 999;
    return pa - pb;
  });

  // ── 4. Set up per-unit tracking ─────────────────────────────────────────────

  // current location per unit (mutable during assignment)
  const unitLocation = new Map<string, UnitLocation>(
    allUnits.map((u) => [
      u.id,
      {
        entityType: u.currentLocationEntityType,
        entityId: u.currentLocationEntityId,
        name: u.currentLocationName,
      },
    ]),
  );

  // busy periods per unit (start with manual routes)
  const unitBusy = new Map<string, BusyPeriod[]>(allUnits.map((u) => [u.id, []]));
  for (const r of existingManualRoutes) {
    if (r.transportUnitId && r.dateStart && r.dateEnd) {
      unitBusy.get(r.transportUnitId)?.push({ dateStart: r.dateStart, dateEnd: r.dateEnd });
    }
  }

  /** Check availability of a unit for a date range */
  function isAvailable(unitId: string, vehicleId: string | null, driverId: string | null, ds: string, de: string): boolean {
    // vehicle maintenance/repair
    if (vehicleId) {
      const blocked = allVehicleUnavail.some(
        (va) => va.vehicleId === vehicleId && overlaps(va.dateFrom, va.dateTo, ds, de),
      );
      if (blocked) return false;
    }
    // driver leave/unavailability
    if (driverId) {
      const blocked = allDriverSchedules.some(
        (ds2) =>
          ds2.driverId === driverId &&
          ds2.type !== "available" &&
          overlaps(ds2.dateFrom, ds2.dateTo, ds, de),
      );
      if (blocked) return false;
    }
    // existing route conflicts
    const busy = unitBusy.get(unitId) ?? [];
    return !busy.some((p) => overlaps(p.dateStart, p.dateEnd, ds, de));
  }

  /** Mark a period as busy for a unit */
  function markBusy(unitId: string, ds: string, de: string) {
    unitBusy.get(unitId)?.push({ dateStart: ds, dateEnd: de });
  }

  // ── 5. Assign ────────────────────────────────────────────────────────────────
  const routesToInsert: any[] = [];
  const notificationsToInsert: Array<{ type: string; message: string }> = [
    ...problemNotifications,
  ];
  let unassignedCount = 0;

  for (const req of requirements) {
    let assigned = false;

    outer: for (const dc of req.matchingCosts) {
      const transitDays = dc.transitDays ?? 1;
      const dateEnd = req.deliveryDeadline;
      const dateStart = subtractDays(dateEnd, transitDays);

      // Find units for this carrier
      const carrierUnits = allUnits.filter((u) => u.carrierId === dc.carrierId);

      for (const unit of carrierUnits) {
        const loc = unitLocation.get(unit.id);
        const needsDeadhead =
          !!loc?.entityId && loc.entityId !== req.fromEntityId;

        // When deadhead is needed, add 1 day before the main route
        const dh_de = dateStart; // deadhead arrives at route start
        const dh_ds = subtractDays(dateStart, 1); // 1-day relocation

        const checkStart = needsDeadhead ? dh_ds : dateStart;
        const checkEnd = dateEnd;

        if (!isAvailable(unit.id, unit.vehicleId, unit.driverId, checkStart, checkEnd)) {
          // Deadline case: if АС unit finishes its last route before the deadline,
          // try assigning the route as a deadline route (tight schedule)
          if (dc.isAsCarrier) {
            const busy = unitBusy.get(unit.id) ?? [];
            const lastRoute = busy.sort((a, b) => b.dateEnd.localeCompare(a.dateEnd))[0];
            if (lastRoute) {
              const asDateStart = lastRoute.dateEnd; // starts right after current route ends
              const asDateEnd = addDays(asDateStart, transitDays);
              // Can it arrive by deadline?
              if (asDateEnd <= dateEnd && isAvailable(unit.id, unit.vehicleId, unit.driverId, asDateStart, asDateEnd)) {
                routesToInsert.push(makeRoute(unit.id, req, dc, asDateStart, asDateEnd, true, false, syncId, periodFrom, periodTo, scenarioId, userId));
                markBusy(unit.id, asDateStart, asDateEnd);
                unitLocation.set(unit.id, { entityType: req.toEntityType, entityId: req.toEntityId, name: req.toEntityName });
                notificationsToInsert.push({
                  type: "deadline",
                  message: `Маршрут «${req.fromEntityName} → ${req.toEntityName}» назначен впритык к дедлайну (ТС ${unit.id.slice(0, 8)})`,
                });
                assigned = true;
                break outer;
              }
            }
          }
          continue; // try next unit
        }

        // Insert deadhead if needed
        if (needsDeadhead && loc?.entityId) {
          routesToInsert.push({
            transportUnitId: unit.id,
            scenarioId,
            syncId,
            planEntryId: null,
            deliveryCostId: null,
            type: "deadhead",
            status: "auto",
            fromEntityType: loc.entityType,
            fromEntityId: loc.entityId,
            fromEntityName: loc.name,
            toEntityType: req.fromEntityType,
            toEntityId: req.fromEntityId,
            toEntityName: req.fromEntityName,
            dateStart: dh_ds,
            dateEnd: dh_de,
            priority: null,
            isDeadline: false,
            isUnplanned: false,
            isOptimal: true,
            isLate: false,
            periodFrom,
            periodTo,
            createdById: userId ?? null,
          });
          markBusy(unit.id, dh_ds, dh_de);
        }

        // Check optimality: if a non-АС unit was chosen when АС was preferred
        const isOptimal = dc.isAsCarrier || !req.matchingCosts.some((c) => c.isAsCarrier);
        if (!isOptimal) {
          notificationsToInsert.push({
            type: "unassigned",
            message: `Маршрут «${req.fromEntityName} → ${req.toEntityName}» назначен не оптимально (нет свободных машин АС)`,
          });
        }

        routesToInsert.push(makeRoute(unit.id, req, dc, dateStart, dateEnd, false, !isOptimal, syncId, periodFrom, periodTo, scenarioId, userId));
        markBusy(unit.id, dateStart, dateEnd);
        unitLocation.set(unit.id, { entityType: req.toEntityType, entityId: req.toEntityId, name: req.toEntityName });

        assigned = true;
        break outer;
      }
    }

    if (!assigned) {
      unassignedCount++;
      notificationsToInsert.push({
        type: "unassigned",
        message: `Нет свободного ТС для маршрута «${req.fromEntityName} → ${req.toEntityName}» к ${req.deliveryDeadline.slice(0, 10)}`,
      });
    }
  }

  // ── 6. Write to DB ────────────────────────────────────────────────────────────

  if (routesToInsert.length > 0) {
    await db.insert(logisticsPlanRoutes).values(routesToInsert);
  }

  for (const n of notificationsToInsert) {
    await db.insert(logisticsPlanNotifications).values({
      syncId,
      type: n.type as any,
      message: n.message,
      periodFrom,
      periodTo,
    });
  }

  // Update currentLocation on transport units that moved during assignment
  for (const unit of allUnits) {
    const newLoc = unitLocation.get(unit.id);
    if (
      newLoc &&
      (newLoc.entityId !== unit.currentLocationEntityId ||
        newLoc.entityType !== unit.currentLocationEntityType)
    ) {
      await db
        .update(logisticsTransportUnits)
        .set({
          currentLocationEntityType: newLoc.entityType,
          currentLocationEntityId: newLoc.entityId,
          currentLocationName: newLoc.name,
          updatedAt: sql`NOW()`,
        })
        .where(eq(logisticsTransportUnits.id, unit.id));
    }
  }

  const created = routesToInsert.filter((r) => r.type === "route").length;
  const deadheads = routesToInsert.filter((r) => r.type === "deadhead").length;
  return { created, deadheads, unassigned: unassignedCount };
}

// ─── factory helper ───────────────────────────────────────────────────────────

function makeRoute(
  transportUnitId: string,
  req: RouteRequirement,
  dc: DeliveryCostRow,
  dateStart: string,
  dateEnd: string,
  isDeadline: boolean,
  isNotOptimal: boolean,
  syncId: string,
  periodFrom: string,
  periodTo: string,
  scenarioId: string | null | undefined,
  userId: string | undefined,
) {
  return {
    transportUnitId,
    scenarioId,
    syncId,
    planEntryId: req.planEntryId,
    deliveryCostId: dc.id,
    type: "route",
    status: "auto",
    fromEntityType: req.fromEntityType,
    fromEntityId: req.fromEntityId,
    fromEntityName: req.fromEntityName,
    toEntityType: req.toEntityType,
    toEntityId: req.toEntityId,
    toEntityName: req.toEntityName,
    dateStart,
    dateEnd,
    priority: dc.priority,
    isDeadline,
    isUnplanned: false,
    isOptimal: !isNotOptimal,
    isLate: dateEnd > req.deliveryDeadline,
    periodFrom,
    periodTo,
    createdById: userId ?? null,
  };
}
