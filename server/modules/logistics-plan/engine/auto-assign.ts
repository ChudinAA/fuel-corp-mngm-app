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

  /** Helper: human-readable name for any entity */
  function entityName(type: string, id: string): string {
    if (type === DELIVERY_ENTITY_TYPE.BASE) return basesMap.get(id) ?? `базис(${id.slice(0, 6)})`;
    if (type === DELIVERY_ENTITY_TYPE.WAREHOUSE) return warehousesMap.get(id)?.name ?? `склад(${id.slice(0, 6)})`;
    return `точка(${id.slice(0, 6)})`;
  }

  for (const entry of entries) {
    const warehouseName = warehousesMap.get(entry.warehouseId)?.name ?? "Склад";
    const warehouseBasisId = warehousePrimaryBasis.get(entry.warehouseId);
    const B = DELIVERY_ENTITY_TYPE.BASE;
    const W = DELIVERY_ENTITY_TYPE.WAREHOUSE;
    const DL = DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION;

    // Build ordered candidate (from, to) pairs — tried in cascade until one has matching tariffs
    // Each candidate: [fromType, fromId, toType, toId]
    type Quad = [string, string, string, string];
    let candidates: Quad[] = [];

    if (entry.type === "income") {
      // Goods arrive TO warehouse FROM supplier
      // "from" side = supplier (entry.basisId as base or delivery_location)
      // "to" side   = warehouse (by basis or directly by warehouseId)
      if (entry.basisId) {
        if (warehouseBasisId) candidates.push([B, entry.basisId, B, warehouseBasisId]);
        candidates.push([B, entry.basisId, W, entry.warehouseId]);
        if (warehouseBasisId) candidates.push([DL, entry.basisId, B, warehouseBasisId]);
        candidates.push([DL, entry.basisId, W, entry.warehouseId]);
      }
      // Also try warehouse→warehouse if entry has no basisId
      if (!entry.basisId) {
        candidates.push([W, entry.warehouseId, W, entry.warehouseId]); // unlikely but failsafe
      }
    } else if (entry.type === "expense") {
      // Goods leave FROM warehouse TO counterparty
      // "from" side = warehouse (by basis or directly)
      // "to" side   = counterparty (entry.basisId as base or delivery_location)
      if (entry.basisId) {
        if (warehouseBasisId) candidates.push([B, warehouseBasisId, B, entry.basisId]);
        candidates.push([W, entry.warehouseId, B, entry.basisId]);
        if (warehouseBasisId) candidates.push([B, warehouseBasisId, DL, entry.basisId]);
        candidates.push([W, entry.warehouseId, DL, entry.basisId]);
      } else {
        // No counterparty basis — try warehouse→warehouse
        candidates.push([W, entry.warehouseId, W, entry.warehouseId]);
      }
    } else {
      // unknown type — skip silently
      continue;
    }

    // Try each candidate in cascade, take first non-empty match
    let matchingRaw: typeof allDeliveryCosts = [];
    let matchedFrom: Quad[0] = B;
    let matchedFromId: Quad[1] = entry.basisId ?? entry.warehouseId;
    let matchedTo: Quad[2] = B;
    let matchedToId: Quad[3] = entry.warehouseId;

    for (const [ft, fi, tt, ti] of candidates) {
      const found = allDeliveryCosts.filter(
        (dc) => dc.fromEntityType === ft && dc.fromEntityId === fi &&
                dc.toEntityType === tt && dc.toEntityId === ti,
      );
      if (found.length > 0) {
        matchingRaw = found;
        [matchedFrom, matchedFromId, matchedTo, matchedToId] = [ft, fi, tt, ti];
        break;
      }
    }

    const fromEntityType = matchedFrom;
    const fromEntityId = matchedFromId;
    const fromEntityName = entityName(matchedFrom, matchedFromId);
    const toEntityType = matchedTo;
    const toEntityId = matchedToId;
    const toEntityName = entityName(matchedTo, matchedToId);

    const candidateLabel = candidates.length > 0
      ? `${entityName(candidates[0][0], candidates[0][1])} → ${entityName(candidates[0][2], candidates[0][3])}`
      : "?";

    if (matchingRaw.length === 0) {
      problemNotifications.push({
        type: "unassigned",
        message: `Тариф доставки не найден: ${candidateLabel}. Нет подходящего тарифа ни для одной из ${candidates.length} комбинаций маршрута. Задайте вручную.`,
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
