import { eq, and, gte, lte, isNull, asc, or, sql, inArray } from "drizzle-orm";
import { db } from "server/db";
import {
  planEntries,
  freeVolumeAllocations,
  supplierAllocatedVolumes,
  warehouses,
  warehouseTransactions,
  suppliers,
  customers,
  opt,
  aircraftRefueling,
  movement,
} from "@shared/schema";
import { SOURCE_TYPE } from "@shared/constants";
import type {
  IPlanningStorage,
  PlanEntry,
  InsertPlanEntry,
  FreeVolumeAllocation,
  InsertFreeVolumeAllocation,
  SupplierAllocatedVolume,
  InsertSupplierAllocatedVolume,
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

function isEntryLocked(date: string): boolean {
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

    const [supplierRows, customerRows] = await Promise.all([
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
    ]);

    const nameMap = new Map<string, string>();
    supplierRows.forEach((s) => nameMap.set(s.id, s.name));
    customerRows.forEach((c) => nameMap.set(c.id, c.name));

    return rows.map((r) => ({
      ...r,
      isLocked: isEntryLocked(r.date),
      counterpartyName: r.counterpartyId ? nameMap.get(r.counterpartyId) || null : null,
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
    if (isEntryLocked(existing.date)) {
      throw new Error("Запись заблокирована: дата уже наступила");
    }

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
    if (isEntryLocked(existing.date)) {
      throw new Error("Запись заблокирована: дата уже наступила");
    }

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
  ): Promise<FreeVolumeAllocation[]> {
    return db
      .select()
      .from(freeVolumeAllocations)
      .where(
        and(
          eq(freeVolumeAllocations.warehouseId, warehouseId),
          isNull(freeVolumeAllocations.deletedAt),
          gte(freeVolumeAllocations.date, dateFrom),
          lte(freeVolumeAllocations.date, dateTo),
        ),
      )
      .orderBy(asc(freeVolumeAllocations.date));
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

  async getActuals(
    warehouseId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<ActualsByDate[]> {
    const transactions = await db
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          isNull(warehouseTransactions.deletedAt),
          gte(
            sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`,
            dateFrom,
          ),
          lte(
            sql`COALESCE(${warehouseTransactions.transactionDate}, ${warehouseTransactions.createdAt})`,
            dateTo,
          ),
        ),
      );

    const byDate = new Map<string, ActualsByDate>();

    for (const t of transactions) {
      const rawDate = t.transactionDate || t.createdAt || "";
      const dateKey = rawDate.slice(0, 10);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, {
          date: dateKey,
          incomeActual: "0",
          expenseActual: "0",
          details: [],
        });
      }
      const entry = byDate.get(dateKey)!;
      const isReceipt = t.transactionType === "receipt" || t.transactionType === "transfer_in";
      const qty = parseFloat(t.quantity);

      if (isReceipt) {
        entry.incomeActual = (parseFloat(entry.incomeActual) + qty).toFixed(2);
      } else {
        entry.expenseActual = (parseFloat(entry.expenseActual) + qty).toFixed(2);
      }

      let label = t.sourceType || "Операция";
      if (t.sourceType === SOURCE_TYPE.OPT) label = "ОПТ";
      else if (t.sourceType === SOURCE_TYPE.REFUELING) label = "Заправка ВС";
      else if (t.sourceType === SOURCE_TYPE.REFUELING_ABROAD) label = "Заправка ВС (Зарубеж)";
      else if (t.sourceType === SOURCE_TYPE.MOVEMENT) label = "Движение/Биржа";

      entry.details.push({
        sourceType: t.sourceType || "",
        sourceId: t.sourceId || "",
        label,
        quantity: t.quantity,
        date: dateKey,
      });
    }

    return Array.from(byDate.values());
  }

  async getResourcesSummary(
    periodFrom: string,
    periodTo: string,
  ): Promise<ResourceSummaryRow[]> {
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

    const allocations = await db
      .select()
      .from(freeVolumeAllocations)
      .where(
        and(
          isNull(freeVolumeAllocations.deletedAt),
          gte(freeVolumeAllocations.date, periodFrom),
          lte(freeVolumeAllocations.date, periodTo),
        ),
      );

    const allocatedVolumes = await this.getSupplierAllocatedVolumes(
      periodFrom,
      periodTo,
    );

    const demandBySupplier = new Map<string, number>();
    for (const e of incomeEntries) {
      if (!e.counterpartyId) continue;
      demandBySupplier.set(
        e.counterpartyId,
        (demandBySupplier.get(e.counterpartyId) || 0) + parseFloat(e.volume),
      );
    }

    for (const a of allocations) {
      const vol = parseFloat(a.volume);
      if (a.fromCounterpartyId) {
        demandBySupplier.set(
          a.fromCounterpartyId,
          (demandBySupplier.get(a.fromCounterpartyId) || 0) - vol,
        );
      }
      if (a.toCounterpartyId) {
        demandBySupplier.set(
          a.toCounterpartyId,
          (demandBySupplier.get(a.toCounterpartyId) || 0) + vol,
        );
      }
    }

    const supplierIds = new Set<string>([
      ...Array.from(demandBySupplier.keys()),
      ...allocatedVolumes.map((v) => v.supplierId),
    ]);

    if (supplierIds.size === 0) return [];

    const supplierRows = await db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(inArray(suppliers.id, Array.from(supplierIds)));

    const nameMap = new Map(supplierRows.map((s) => [s.id, s.name]));
    const allocatedMap = new Map(
      allocatedVolumes.map((v) => [v.supplierId, v.volume]),
    );

    return Array.from(supplierIds).map((supplierId) => {
      const allocatedVolume = allocatedMap.get(supplierId) || "0";
      const demand = (demandBySupplier.get(supplierId) || 0).toFixed(2);
      const balance = (parseFloat(allocatedVolume) - parseFloat(demand)).toFixed(2);
      return {
        supplierId,
        supplierName: nameMap.get(supplierId) || "—",
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
      const balance = lastEntry
        ? lastEntry.balanceAfter || "0"
        : wh.currentBalance || "0";

      result.push({
        warehouseId: wh.id,
        warehouseName: wh.name,
        plannedIncome: plannedIncome.toFixed(2),
        plannedExpense: plannedExpense.toFixed(2),
        balance,
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
