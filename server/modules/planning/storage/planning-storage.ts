import { eq, and, gte, lte, isNull, asc, or, sql, inArray } from "drizzle-orm";
import { db } from "server/db";
import {
  planEntries,
  freeVolumeAllocations,
  supplierAllocatedVolumes,
  planningResources,
  planningSettings,
  planningComments,
  warehouses,
  warehouseTransactions,
  suppliers,
  customers,
  users,
  bases,
  supplierBases,
  opt,
  aircraftRefueling,
} from "@shared/schema";
import { SOURCE_TYPE } from "@shared/constants";
import type {
  IPlanningStorage,
  PlanEntry,
  InsertPlanEntry,
  FreeVolumeAllocation,
  FreeVolumeAllocationWithNames,
  InsertFreeVolumeAllocation,
  SupplierAllocatedVolume,
  InsertSupplierAllocatedVolume,
  PlanningResource,
  PlanningResourceWithSupplier,
  InsertPlanningResource,
  PlanningComment,
  PlanningCommentWithUser,
  InsertPlanningComment,
  PlanEntryWithMeta,
  ActualsByDate,
  ActualDetailItem,
  ResourceSummaryRow,
  WarehouseSummaryRow,
  CustomerSummaryRow,
} from "./types";

function startOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isMonthInPast(dateStr: string): boolean {
  const now = new Date();
  const entry = new Date(dateStr);
  const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const entryMonthStart = new Date(entry.getFullYear(), entry.getMonth(), 1);
  return entryMonthStart.getTime() < nowMonthStart.getTime();
}

function isEntryLockedByDate(date: string): boolean {
  const today = startOfDay(new Date().toISOString());
  const entryDate = startOfDay(date);
  return entryDate.getTime() <= today.getTime();
}

export class PlanningStorage implements IPlanningStorage {
  private async recalculateWarehouseChain(warehouseId: string): Promise<void> {
    const warehouse = await db.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
    });
    const actualBalance = parseFloat(warehouse?.currentBalance || "0");

    const entries = await db
      .select()
      .from(planEntries)
      .where(
        and(eq(planEntries.warehouseId, warehouseId), isNull(planEntries.deletedAt)),
      )
      .orderBy(asc(planEntries.date), asc(planEntries.createdAt));

    let runningBalance: number | null = null;

    for (const entry of entries) {
      const volume = parseFloat(entry.volume);
      let newBalance: number;

      if (entry.isManualBalance && entry.balanceAfter !== null) {
        newBalance = parseFloat(entry.balanceAfter);
      } else {
        const base = runningBalance === null ? actualBalance : runningBalance;
        newBalance = entry.type === "income" ? base + volume : base - volume;
        if (parseFloat(entry.balanceAfter || "NaN") !== newBalance) {
          await db
            .update(planEntries)
            .set({ balanceAfter: newBalance.toFixed(2) })
            .where(eq(planEntries.id, entry.id));
        }
      }

      runningBalance = newBalance;
    }
  }

  async getPlanEntries(
    warehouseId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<PlanEntryWithMeta[]> {
    const rows = await db
      .select()
      .from(planEntries)
      .where(
        and(
          eq(planEntries.warehouseId, warehouseId),
          isNull(planEntries.deletedAt),
          gte(planEntries.date, dateFrom),
          lte(planEntries.date, dateTo),
        ),
      )
      .orderBy(asc(planEntries.date), asc(planEntries.createdAt));

    const counterpartyIds = Array.from(
      new Set(rows.map((r) => r.counterpartyId).filter(Boolean) as string[]),
    );

    const basisIds = Array.from(
      new Set(rows.map((r) => (r as any).basisId).filter(Boolean) as string[]),
    );

    const [supplierRows, customerRows, basisRows] = await Promise.all([
      counterpartyIds.length
        ? db
            .select({ id: suppliers.id, name: suppliers.name })
            .from(suppliers)
            .where(inArray(suppliers.id, counterpartyIds))
        : Promise.resolve([]),
      counterpartyIds.length
        ? db
            .select({ id: customers.id, name: customers.name })
            .from(customers)
            .where(inArray(customers.id, counterpartyIds))
        : Promise.resolve([]),
      basisIds.length
        ? db
            .select({ id: bases.id, name: bases.name })
            .from(bases)
            .where(inArray(bases.id, basisIds))
        : Promise.resolve([]),
    ]);

    const nameMap = new Map<string, string>();
    supplierRows.forEach((s) => nameMap.set(s.id, s.name));
    customerRows.forEach((c) => nameMap.set(c.id, c.name));
    const basisNameMap = new Map(basisRows.map((b) => [b.id, b.name]));

    return rows.map((r) => ({
      ...r,
      isLocked: isEntryLockedByDate(r.date),
      counterpartyName: r.counterpartyId ? nameMap.get(r.counterpartyId) || null : null,
      basisName: (r as any).basisId ? basisNameMap.get((r as any).basisId) || null : null,
    }));
  }

  async getPlanEntry(id: string): Promise<PlanEntry | undefined> {
    return db.query.planEntries.findFirst({
      where: and(eq(planEntries.id, id), isNull(planEntries.deletedAt)),
    });
  }

  async createPlanEntry(data: InsertPlanEntry): Promise<PlanEntry> {
    const [created] = await db.insert(planEntries).values(data).returning();
    await this.recalculateWarehouseChain(created.warehouseId);
    const refreshed = await this.getPlanEntry(created.id);
    return refreshed!;
  }

  async updatePlanEntry(
    id: string,
    data: Partial<InsertPlanEntry>,
    userId?: string,
  ): Promise<PlanEntry | undefined> {
    const existing = await this.getPlanEntry(id);
    if (!existing) return undefined;

    const [updated] = await db
      .update(planEntries)
      .set({ ...data, updatedAt: sql`NOW()`, updatedById: userId })
      .where(eq(planEntries.id, id))
      .returning();

    await this.recalculateWarehouseChain(updated.warehouseId);
    return this.getPlanEntry(id);
  }

  async deletePlanEntry(id: string, userId?: string): Promise<boolean> {
    const existing = await this.getPlanEntry(id);
    if (!existing) return false;

    await db
      .update(planEntries)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(planEntries.id, id));

    await this.recalculateWarehouseChain(existing.warehouseId);
    return true;
  }

  async getFreeVolumeAllocations(
    warehouseId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<FreeVolumeAllocationWithNames[]> {
    const whereClause = warehouseId
      ? and(
          eq(freeVolumeAllocations.warehouseId, warehouseId),
          isNull(freeVolumeAllocations.deletedAt),
          gte(freeVolumeAllocations.date, dateFrom),
          lte(freeVolumeAllocations.date, dateTo),
        )
      : isNull(freeVolumeAllocations.deletedAt);

    const rows = await db
      .select()
      .from(freeVolumeAllocations)
      .where(whereClause)
      .orderBy(asc(freeVolumeAllocations.date));

    if (rows.length === 0) return [];

    const allIds = [
      ...new Set([
        ...rows.map((r) => r.fromCounterpartyId),
        ...rows.map((r) => r.toCounterpartyId),
      ].filter(Boolean)),
    ] as string[];

    const [supplierRows, customerRows] = await Promise.all([
      allIds.length > 0
        ? db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(inArray(suppliers.id, allIds))
        : Promise.resolve([]),
      allIds.length > 0
        ? db.select({ id: customers.id, name: customers.name }).from(customers).where(inArray(customers.id, allIds))
        : Promise.resolve([]),
    ]);

    const supplierMap = new Map(supplierRows.map((s) => [s.id, s.name]));
    const customerMap = new Map(customerRows.map((c) => [c.id, c.name]));

    return rows.map((r) => ({
      ...r,
      fromName: r.fromCounterpartyId
        ? (supplierMap.get(r.fromCounterpartyId) ?? customerMap.get(r.fromCounterpartyId) ?? null)
        : null,
      toName: r.toCounterpartyId
        ? (customerMap.get(r.toCounterpartyId) ?? supplierMap.get(r.toCounterpartyId) ?? null)
        : null,
    }));
  }

  async createFreeVolumeAllocation(
    data: InsertFreeVolumeAllocation,
  ): Promise<FreeVolumeAllocation> {
    const [created] = await db
      .insert(freeVolumeAllocations)
      .values(data)
      .returning();
    return created;
  }

  async updateFreeVolumeAllocation(
    id: string,
    data: Partial<InsertFreeVolumeAllocation>,
    userId?: string,
  ): Promise<FreeVolumeAllocation | undefined> {
    const [updated] = await db
      .update(freeVolumeAllocations)
      .set({ ...data, updatedAt: sql`NOW()`, updatedById: userId })
      .where(eq(freeVolumeAllocations.id, id))
      .returning();
    return updated;
  }

  async deleteFreeVolumeAllocation(id: string, userId?: string): Promise<boolean> {
    await db
      .update(freeVolumeAllocations)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(freeVolumeAllocations.id, id));
    return true;
  }

  async getSupplierAllocatedVolumes(
    periodFrom: string,
    periodTo: string,
  ): Promise<SupplierAllocatedVolume[]> {
    return db
      .select()
      .from(supplierAllocatedVolumes)
      .where(
        and(
          isNull(supplierAllocatedVolumes.deletedAt),
          eq(supplierAllocatedVolumes.periodFrom, periodFrom),
          eq(supplierAllocatedVolumes.periodTo, periodTo),
        ),
      );
  }

  async getSupplierAllocatedVolumesBySupplier(
    supplierId: string,
  ): Promise<SupplierAllocatedVolume[]> {
    return db
      .select()
      .from(supplierAllocatedVolumes)
      .where(
        and(
          isNull(supplierAllocatedVolumes.deletedAt),
          eq(supplierAllocatedVolumes.supplierId, supplierId),
        ),
      )
      .orderBy(asc(supplierAllocatedVolumes.periodFrom));
  }

  async upsertSupplierAllocatedVolume(
    data: InsertSupplierAllocatedVolume,
  ): Promise<SupplierAllocatedVolume> {
    const existing = await db.query.supplierAllocatedVolumes.findFirst({
      where: and(
        eq(supplierAllocatedVolumes.supplierId, data.supplierId),
        eq(supplierAllocatedVolumes.periodFrom, data.periodFrom),
        eq(supplierAllocatedVolumes.periodTo, data.periodTo),
        isNull(supplierAllocatedVolumes.deletedAt),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(supplierAllocatedVolumes)
        .set({
          volume: data.volume,
          updatedAt: sql`NOW()`,
          updatedById: data.createdById,
        })
        .where(eq(supplierAllocatedVolumes.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(supplierAllocatedVolumes)
      .values(data)
      .returning();
    return created;
  }

  // ============ PLANNING RESOURCES ============

  async getPlanningResources(): Promise<PlanningResourceWithSupplier[]> {
    const rows = await db
      .select()
      .from(planningResources)
      .where(isNull(planningResources.deletedAt))
      .orderBy(asc(planningResources.createdAt));

    if (rows.length === 0) return [];

    const supplierIds = rows.map((r) => r.supplierId);
    const basisIds = Array.from(
      new Set(rows.map((r) => (r as any).basisId).filter(Boolean) as string[]),
    );
    const [supplierRows, basisRows] = await Promise.all([
      db
        .select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(inArray(suppliers.id, supplierIds)),
      basisIds.length
        ? db
            .select({ id: bases.id, name: bases.name })
            .from(bases)
            .where(inArray(bases.id, basisIds))
        : Promise.resolve([]),
    ]);

    const nameMap = new Map(supplierRows.map((s) => [s.id, s.name]));
    const basisNameMap = new Map(basisRows.map((b) => [b.id, b.name]));

    return rows.map((r) => ({
      ...r,
      supplierName: nameMap.get(r.supplierId) || "—",
      basisName: (r as any).basisId ? basisNameMap.get((r as any).basisId) || null : null,
    }));
  }

  async createPlanningResource(data: InsertPlanningResource): Promise<PlanningResource> {
    const [created] = await db.insert(planningResources).values(data).returning();
    return created;
  }

  async updatePlanningResource(
    id: string,
    data: Partial<InsertPlanningResource>,
    userId?: string,
  ): Promise<PlanningResource | undefined> {
    const [updated] = await db
      .update(planningResources)
      .set({ ...data, updatedAt: sql`NOW()`, updatedById: userId })
      .where(eq(planningResources.id, id))
      .returning();
    return updated;
  }

  async deletePlanningResource(id: string, userId?: string): Promise<boolean> {
    await db
      .update(planningResources)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(planningResources.id, id));
    return true;
  }

  // ============ PLANNING SETTINGS ============

  async getPlanningSettings(): Promise<Record<string, string>> {
    const rows = await db.select().from(planningSettings);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async upsertPlanningSetting(key: string, value: string, userId?: string): Promise<void> {
    await db
      .insert(planningSettings)
      .values({ key, value, updatedById: userId })
      .onConflictDoUpdate({
        target: planningSettings.key,
        set: { value, updatedAt: sql`NOW()`, updatedById: userId },
      });
  }

  // ============ PLANNING COMMENTS ============

  async getPlanningComments(
    entityType: string,
    entityId: string,
    fieldKey: string,
  ): Promise<PlanningCommentWithUser[]> {
    const rows = await db
      .select()
      .from(planningComments)
      .where(
        and(
          eq(planningComments.entityType, entityType),
          eq(planningComments.entityId, entityId),
          eq(planningComments.fieldKey, fieldKey),
        ),
      )
      .orderBy(asc(planningComments.createdAt));

    if (rows.length === 0) return [];

    const userIds = [...new Set(rows.map((r) => r.userId))];
    const userRows = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));

    const userMap = new Map(
      userRows.map((u) => [
        u.id,
        `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || "—",
      ]),
    );

    return rows.map((r) => ({
      ...r,
      userName: userMap.get(r.userId) || "—",
    }));
  }

  async createPlanningComment(data: InsertPlanningComment): Promise<PlanningComment> {
    const [created] = await db.insert(planningComments).values(data).returning();
    return created;
  }

  async updatePlanningComment(
    id: string,
    userId: string,
    data: { text?: string; isHighPriority?: boolean },
  ): Promise<PlanningComment | null> {
    const [existing] = await db
      .select()
      .from(planningComments)
      .where(eq(planningComments.id, id));
    if (!existing || existing.userId !== userId) return null;

    const [updated] = await db
      .update(planningComments)
      .set(data)
      .where(eq(planningComments.id, id))
      .returning();
    return updated ?? null;
  }

  // ============ ACTUALS ============

  async getActuals(
    warehouseId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<ActualsByDate[]> {
    // Use DATE() cast so timestamp columns compare correctly with date strings
    const transactions = await db
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          isNull(warehouseTransactions.deletedAt),
          sql`DATE(COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})) >= ${dateFrom}::date`,
          sql`DATE(COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})) <= ${dateTo}::date`,
        ),
      )
      .orderBy(
        sql`DATE(COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt}))`,
        sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`,
      );

    // Bulk-lookup buyer names for OPT and refueling transactions
    const optSourceIds = transactions
      .filter((t) => t.sourceType === SOURCE_TYPE.OPT && t.sourceId)
      .map((t) => t.sourceId!);
    const refuelSourceIds = transactions
      .filter((t) => t.sourceType === SOURCE_TYPE.REFUELING && t.sourceId)
      .map((t) => t.sourceId!);

    const [optRows, refuelRows] = await Promise.all([
      optSourceIds.length > 0
        ? db
            .select({ id: opt.id, buyerId: opt.buyerId })
            .from(opt)
            .where(inArray(opt.id, optSourceIds))
        : Promise.resolve([]),
      refuelSourceIds.length > 0
        ? db
            .select({ id: aircraftRefueling.id, buyerId: aircraftRefueling.buyerId })
            .from(aircraftRefueling)
            .where(inArray(aircraftRefueling.id, refuelSourceIds))
        : Promise.resolve([]),
    ]);

    // Map sourceId → buyerId
    const sourceToBuyer = new Map<string, string | null>();
    optRows.forEach((r) => sourceToBuyer.set(r.id, r.buyerId));
    refuelRows.forEach((r) => sourceToBuyer.set(r.id, r.buyerId));

    const allBuyerIds = [
      ...new Set(
        [...optRows, ...refuelRows]
          .map((r) => r.buyerId)
          .filter(Boolean) as string[],
      ),
    ];
    const buyerRows =
      allBuyerIds.length > 0
        ? await db
            .select({ id: customers.id, name: customers.name })
            .from(customers)
            .where(inArray(customers.id, allBuyerIds))
        : [];
    const buyerNameMap = new Map(buyerRows.map((r) => [r.id, r.name]));

    const byDate = new Map<string, ActualsByDate>();

    for (const t of transactions) {
      const rawDate = (t.transactionDate || t.createdAt || "").slice(0, 10);
      const dateKey = rawDate;
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          date: dateKey,
          incomeActual: "0",
          expenseActual: "0",
          factBalanceAfter: t.balanceAfter || null,
          details: [],
        });
      }
      const entry = byDate.get(dateKey)!;
      if (t.balanceAfter !== null && t.balanceAfter !== undefined) {
        entry.factBalanceAfter = t.balanceAfter;
      }

      const rawQty = parseFloat(t.quantity);
      const absQty = Math.abs(rawQty);
      let isExpense: boolean;

      if (t.transactionType === "inventory") {
        // Inventory: positive qty = adding stock (income), negative qty = removing (expense)
        isExpense = rawQty < 0;
      } else if (
        t.transactionType === "receipt" ||
        t.transactionType === "transfer_in"
      ) {
        isExpense = false;
      } else {
        // sale, transfer_out — stored as negative; treat as expense
        isExpense = true;
      }

      if (isExpense) {
        entry.expenseActual = (
          parseFloat(entry.expenseActual) + absQty
        ).toFixed(2);
      } else {
        entry.incomeActual = (
          parseFloat(entry.incomeActual) + absQty
        ).toFixed(2);
      }

      // Resolve buyer name for OPT / refueling
      let counterpartyName: string | null = null;
      if (t.sourceId && sourceToBuyer.has(t.sourceId)) {
        const buyerId = sourceToBuyer.get(t.sourceId);
        if (buyerId) counterpartyName = buyerNameMap.get(buyerId) || null;
      }

      let label: string;
      if (t.transactionType === "inventory") {
        label = `Инвентаризация (${isExpense ? "расход" : "приход"})`;
      } else if (t.sourceType === SOURCE_TYPE.OPT) {
        label = "ОПТ";
      } else if (t.sourceType === SOURCE_TYPE.REFUELING) {
        label = "Заправка ВС";
      } else if (t.sourceType === SOURCE_TYPE.REFUELING_ABROAD) {
        label = "Заправка ВС (Зарубеж)";
      } else if (t.sourceType === SOURCE_TYPE.MOVEMENT) {
        label = "Перемещение/Биржа";
      } else {
        label = t.sourceType || "Операция";
      }

      entry.details.push({
        sourceType: t.sourceType || "",
        sourceId: t.sourceId || "",
        label,
        quantity: absQty.toFixed(2),
        date: dateKey,
        isExpense,
        balanceAfter: t.balanceAfter || null,
        counterpartyName,
      });
    }

    return Array.from(byDate.values());
  }

  // ============ SUMMARIES ============

  async getResourcesSummary(
    periodFrom: string,
    periodTo: string,
  ): Promise<ResourceSummaryRow[]> {
    const resources = await this.getPlanningResources();
    if (resources.length === 0) return [];

    const resourceSupplierIds = resources.map((r) => r.supplierId);

    const incomeEntries = await db
      .select()
      .from(planEntries)
      .where(
        and(
          isNull(planEntries.deletedAt),
          eq(planEntries.type, "income"),
          gte(planEntries.date, periodFrom),
          lte(planEntries.date, periodTo),
        ),
      );

    const allAllocations = await db
      .select()
      .from(freeVolumeAllocations)
      .where(
        and(
          isNull(freeVolumeAllocations.deletedAt),
          gte(freeVolumeAllocations.date, periodFrom),
          lte(freeVolumeAllocations.date, periodTo),
        ),
      );

    // Get all allocated volumes for this period (across all months in range)
    const allAllocatedVolumes = await db
      .select()
      .from(supplierAllocatedVolumes)
      .where(
        and(
          isNull(supplierAllocatedVolumes.deletedAt),
          inArray(supplierAllocatedVolumes.supplierId, resourceSupplierIds),
        ),
      );

    const demandBySupplier = new Map<string, number>();
    for (const e of incomeEntries) {
      if (!e.counterpartyId) continue;
      demandBySupplier.set(
        e.counterpartyId,
        (demandBySupplier.get(e.counterpartyId) || 0) + parseFloat(e.volume),
      );
    }

    for (const a of allAllocations) {
      if (a.fromCounterpartyId) {
        demandBySupplier.set(
          a.fromCounterpartyId,
          (demandBySupplier.get(a.fromCounterpartyId) || 0) + parseFloat(a.volume),
        );
      }
    }

    // Calculate total allocated volume per supplier for the period
    // by summing months that overlap with the period
    const pFrom = new Date(periodFrom);
    const pTo = new Date(periodTo);

    const allocatedBySupplier = new Map<string, number>();
    for (const av of allAllocatedVolumes) {
      const avFrom = new Date(av.periodFrom);
      const avTo = new Date(av.periodTo);
      // Check overlap
      if (avFrom <= pTo && avTo >= pFrom) {
        const cur = allocatedBySupplier.get(av.supplierId) || 0;
        allocatedBySupplier.set(av.supplierId, cur + parseFloat(av.volume));
      }
    }

    return resources.map((res) => {
      const allocatedVolume = (allocatedBySupplier.get(res.supplierId) || 0).toFixed(2);
      const demand = (demandBySupplier.get(res.supplierId) || 0).toFixed(2);
      const balance = (parseFloat(allocatedVolume) - parseFloat(demand)).toFixed(2);
      return {
        supplierId: res.supplierId,
        supplierName: res.supplierName,
        allocatedVolume,
        demand,
        balance,
      };
    });
  }

  async getWarehousesSummary(
    periodFrom: string,
    periodTo: string,
  ): Promise<WarehouseSummaryRow[]> {
    const activeWarehouses = await db
      .select()
      .from(warehouses)
      .where(isNull(warehouses.deletedAt));

    const entries = await db
      .select()
      .from(planEntries)
      .where(
        and(
          isNull(planEntries.deletedAt),
          gte(planEntries.date, periodFrom),
          lte(planEntries.date, periodTo),
        ),
      )
      .orderBy(asc(planEntries.date), asc(planEntries.createdAt));

    const result: WarehouseSummaryRow[] = [];

    for (const wh of activeWarehouses) {
      const whEntries = entries.filter((e) => e.warehouseId === wh.id);
      const plannedIncome = whEntries
        .filter((e) => e.type === "income")
        .reduce((sum, e) => sum + parseFloat(e.volume), 0);
      const plannedExpense = whEntries
        .filter((e) => e.type === "expense")
        .reduce((sum, e) => sum + parseFloat(e.volume), 0);
      const lastEntry = whEntries[whEntries.length - 1];
      const balancePlan = lastEntry
        ? lastEntry.balanceAfter || "0"
        : "0";

      result.push({
        warehouseId: wh.id,
        warehouseName: wh.name,
        plannedIncome: plannedIncome.toFixed(2),
        plannedExpense: plannedExpense.toFixed(2),
        balancePlan,
        balanceFact: wh.currentBalance || "0",
      });
    }

    return result;
  }

  async getCustomersSummary(
    periodFrom: string,
    periodTo: string,
  ): Promise<CustomerSummaryRow[]> {
    const expenseEntries = await db
      .select()
      .from(planEntries)
      .where(
        and(
          isNull(planEntries.deletedAt),
          eq(planEntries.type, "expense"),
          gte(planEntries.date, periodFrom),
          lte(planEntries.date, periodTo),
        ),
      );

    const volumeByCustomer = new Map<string, number>();
    for (const e of expenseEntries) {
      if (!e.counterpartyId) continue;
      volumeByCustomer.set(
        e.counterpartyId,
        (volumeByCustomer.get(e.counterpartyId) || 0) + parseFloat(e.volume),
      );
    }

    if (volumeByCustomer.size === 0) return [];

    const customerRows = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(inArray(customers.id, Array.from(volumeByCustomer.keys())));

    const nameMap = new Map(customerRows.map((c) => [c.id, c.name]));

    return Array.from(volumeByCustomer.entries()).map(([customerId, volume]) => ({
      customerId,
      customerName: nameMap.get(customerId) || "—",
      volume: volume.toFixed(2),
    }));
  }
}
