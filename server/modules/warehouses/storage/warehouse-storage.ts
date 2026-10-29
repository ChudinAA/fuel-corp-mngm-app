import { eq, desc, sql, isNull, and, inArray } from "drizzle-orm";
import { db } from "server/db";
import { normalizeWarehouseLimit } from "../warehouse-limit-units";
import { normalizeWarehouseBalanceUnits } from "../warehouse-balance-units";
import { format } from "date-fns";
import {
  warehouses,
  warehouseBases,
  warehouseTransactions,
  warehouseServices,
  userWarehouseAccess,
  type Warehouse,
  type InsertWarehouse,
  type WarehouseTransaction,
  type UserWarehouseAccess,
} from "@shared/schema";
import { IWarehouseStorage } from "./types";
import { PRODUCT_TYPE } from "@shared/constants";
import {
  kilogramsToTonnes,
  tonnesToKilograms,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
} from "@shared/units";

function normalizeWarehouseCostUnits(
  data: Partial<InsertWarehouse>,
  defaultMissing = false,
): Partial<InsertWarehouse> {
  const result: Record<string, string | null> = {};
  const applyPair = (
    tonneKey: "averageCostPerTonne" | "pvkjAverageCostPerTonne",
    kilogramKey: "averageCost" | "pvkjAverageCost",
  ) => {
    const tonnes = data[tonneKey];
    const kilograms = data[kilogramKey];
    if (defaultMissing && tonnes === undefined && kilograms === undefined) {
      result[tonneKey] = "0";
      result[kilogramKey] = "0";
      return;
    }
    if (tonnes !== undefined) {
      if (tonnes === null || tonnes === "") {
        result[tonneKey] = null;
        result[kilogramKey] = null;
      } else {
        const value = Number(tonnes);
        if (!Number.isFinite(value)) {
          throw new TypeError(`${tonneKey} must be a finite number`);
        }
        result[tonneKey] = value.toFixed(6);
        result[kilogramKey] = pricePerTonneToPerKilogram(value).toFixed(6);
      }
    } else if (kilograms !== undefined) {
      if (kilograms === null || kilograms === "") {
        result[kilogramKey] = null;
        result[tonneKey] = null;
      } else {
        const value = Number(kilograms);
        if (!Number.isFinite(value)) {
          throw new TypeError(`${kilogramKey} must be a finite number`);
        }
        result[kilogramKey] = value.toFixed(6);
        result[tonneKey] = pricePerKilogramToPerTonne(value).toFixed(6);
      }
    }
  };

  applyPair("averageCostPerTonne", "averageCost");
  applyPair("pvkjAverageCostPerTonne", "pvkjAverageCost");
  return result as Partial<InsertWarehouse>;
}

export class WarehouseStorage {
  async getAllWarehouses(): Promise<Warehouse[]> {
    const warehousesList = await db.query.warehouses.findMany({
      where: isNull(warehouses.deletedAt),
      orderBy: (warehouses, { asc, desc }) => [desc(warehouses.isPinned), asc(warehouses.name)],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          },
        },
        warehouseBases: {
          with: {
            base: true,
          },
        },
        warehouseServices: true,
      },
    });

    return warehousesList.map((w) => ({
      ...w,
      baseIds: w.warehouseBases?.map((wb) => wb.baseId) || [],
      services: w.warehouseServices?.map((s) => ({
        id: s.id,
        serviceName: s.serviceName,
        serviceType: s.serviceType,
        serviceValue: s.serviceValue,
      })) || [],
    }));
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    const warehouse = await db.query.warehouses.findFirst({
      where: and(eq(warehouses.id, id), isNull(warehouses.deletedAt)),
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          },
        },
        warehouseBases: {
          with: {
            base: true,
          },
        },
        warehouseServices: true,
      },
    });

    if (!warehouse) return undefined;

    return {
      ...warehouse,
      baseIds: warehouse.warehouseBases?.map((wb) => wb.baseId) || [],
      services: warehouse.warehouseServices?.map((s) => ({
        id: s.id,
        serviceName: s.serviceName,
        serviceType: s.serviceType,
        serviceValue: s.serviceValue,
      })) || [],
    };
  }

  async createWarehouse(
    data: InsertWarehouse & { baseIds?: string[]; services?: Array<{ serviceName?: string | null; serviceType: string; serviceValue: string }> },
  ): Promise<Warehouse> {
    const { baseIds, services, ...warehouseData } = data;
    const balanceInput = {
      currentBalance: warehouseData.currentBalance,
      currentBalanceTonnes:
        warehouseData.currentBalanceTonnes ??
        (warehouseData.currentBalance === undefined ? "0" : undefined),
      pvkjBalance: warehouseData.pvkjBalance,
      pvkjBalanceTonnes:
        warehouseData.pvkjBalanceTonnes ??
        (warehouseData.pvkjBalance === undefined ? "0" : undefined),
    };
    const normalizedWarehouseData = {
      ...warehouseData,
      ...normalizeWarehouseCostUnits(warehouseData, true),
      ...normalizeWarehouseLimit(warehouseData),
      ...normalizeWarehouseBalanceUnits(balanceInput),
    };

    // Check for duplicates
    const existing = await db.query.warehouses.findFirst({
      where: and(
        eq(warehouses.name, warehouseData.name),
        isNull(warehouses.deletedAt),
      ),
    });

    if (existing) {
      throw new Error("Такая запись уже существует");
    }

    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(warehouses)
        .values(normalizedWarehouseData)
        .returning();

      if (baseIds && baseIds.length > 0) {
        await tx.insert(warehouseBases).values(
          baseIds.map((baseId) => ({
            warehouseId: created.id,
            baseId,
          })),
        );
      }

      if (services && services.length > 0) {
        await tx.insert(warehouseServices).values(
          services.map((s) => ({
            warehouseId: created.id,
            serviceName: s.serviceName || null,
            serviceType: s.serviceType,
            serviceValue: String(s.serviceValue),
          })),
        );
      }

      return {
        ...created,
        baseIds: baseIds || [],
        services: services?.map((s, i) => ({ id: "", serviceName: s.serviceName || null, ...s })) || [],
      };
    });
  }

  async updateWarehouse(
    id: string,
    data: Partial<InsertWarehouse> & { baseIds?: string[]; services?: Array<{ serviceName?: string | null; serviceType: string; serviceValue: string }> },
  ): Promise<Warehouse | undefined> {
    const { baseIds, services, ...warehouseData } = data;
    const normalizedLimit = normalizeWarehouseLimit(warehouseData);
    const normalizedBalances = normalizeWarehouseBalanceUnits(warehouseData);

    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(warehouses)
        .set({
          ...warehouseData,
          ...normalizeWarehouseCostUnits(warehouseData),
          ...normalizedLimit,
          ...normalizedBalances,
          updatedAt: sql`NOW()`,
        })
        .where(eq(warehouses.id, id))
        .returning();

      if (!updated) return undefined;

      if (baseIds !== undefined) {
        await tx
          .delete(warehouseBases)
          .where(eq(warehouseBases.warehouseId, id));

        if (baseIds.length > 0) {
          await tx.insert(warehouseBases).values(
            baseIds.map((baseId) => ({
              warehouseId: id,
              baseId,
            })),
          );
        }
      }

      if (services !== undefined) {
        await tx
          .delete(warehouseServices)
          .where(eq(warehouseServices.warehouseId, id));

        if (services.length > 0) {
          await tx.insert(warehouseServices).values(
            services.map((s) => ({
              warehouseId: id,
              serviceName: s.serviceName || null,
              serviceType: s.serviceType,
              serviceValue: String(s.serviceValue),
            })),
          );
        }
      }

      const warehouseWithRelations = await tx.query.warehouses.findFirst({
        where: eq(warehouses.id, id),
        with: {
          warehouseBases: {
            with: {
              base: true,
            },
          },
          warehouseServices: true,
        },
      });

      if (!warehouseWithRelations) return undefined;

      return {
        ...warehouseWithRelations,
        baseIds:
          warehouseWithRelations.warehouseBases?.map((wb) => wb.baseId) || [],
        services:
          warehouseWithRelations.warehouseServices?.map((s) => ({
            id: s.id,
            serviceName: s.serviceName,
            serviceType: s.serviceType,
            serviceValue: s.serviceValue,
          })) || [],
      };
    });
  }

  async deleteWarehouse(id: string, userId?: string): Promise<boolean> {
    await db
      .update(warehouses)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(warehouses.id, id));
    return true;
  }

  async restoreWarehouse(id: string, userId?: string, transaction?: any): Promise<boolean> {
    const restore = async (tx: any) => {
      await tx
        .update(warehouses)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(warehouses.id, id));
    };
    if (transaction) await restore(transaction);
    else await db.transaction(restore);
    return true;
  }

  async getWarehouseTransactions(
    warehouseId: string,
    limit?: number,
    offset?: number,
  ): Promise<{ transactions: any[]; hasMore: boolean }> {
    const transactions = await db.query.warehouseTransactions.findMany({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        isNull(warehouseTransactions.deletedAt),
      ),
      orderBy: (warehouseTransactions, { desc }) => [
        desc(warehouseTransactions.transactionDate),
        desc(warehouseTransactions.id),
      ],
      limit: limit ? limit + 1 : undefined,
      offset: offset,
      with: {
        warehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const hasMore = limit ? transactions.length > limit : false;
    const items = limit ? transactions.slice(0, limit) : transactions;

    return {
      transactions: items.map((tx) => ({
        id: tx.id,
        warehouseId: tx.warehouseId,
        transactionType: tx.transactionType,
        sourceType: tx.sourceType,
        sourceId: tx.sourceId,
        productType: tx.productType || PRODUCT_TYPE.KEROSENE,
        quantityKg: tx.quantity,
        quantityTonnes: tx.quantityTonnes,
        sum: tx.sum,
        price: tx.price,
        pricePerTonne: tx.pricePerTonne,
        transactionDate: tx.transactionDate,
        balanceBefore: tx.balanceBefore || "0",
        balanceAfter: tx.balanceAfter || "0",
        balanceBeforeTonnes: tx.balanceBeforeTonnes,
        balanceAfterTonnes: tx.balanceAfterTonnes,
        averageCostBefore: tx.averageCostBefore || "0",
        averageCostBeforePerTonne: tx.averageCostBeforePerTonne,
        averageCostAfter: tx.averageCostAfter || "0",
        averageCostAfterPerTonne: tx.averageCostAfterPerTonne,
        createdAt: tx.createdAt,
      })),
      hasMore,
    };
  }

  async getWarehouseMonthlyStats(
    warehouseId: string,
    startOfMonth: Date,
  ): Promise<{
    income: number;
    expense: number;
    pvkjIncome: number;
    pvkjExpense: number;
    incomeTonnes: number;
    expenseTonnes: number;
    pvkjIncomeTonnes: number;
    pvkjExpenseTonnes: number;
  }> {
    const dateStr = format(startOfMonth, "yyyy-MM-dd");
    const transactions = await db.query.warehouseTransactions.findMany({
      where: and(
        eq(warehouseTransactions.warehouseId, warehouseId),
        isNull(warehouseTransactions.deletedAt),
        sql`${warehouseTransactions.transactionDate} >= ${dateStr}`,
      ),
    });

    let income = 0;
    let expense = 0;
    let pvkjIncome = 0;
    let pvkjExpense = 0;
    let incomeTonnes = 0;
    let expenseTonnes = 0;
    let pvkjIncomeTonnes = 0;
    let pvkjExpenseTonnes = 0;

    transactions.forEach((tx) => {
      const qty = parseFloat(tx.quantity || "0");
      const tonnes =
        tx.quantityTonnes == null
          ? kilogramsToTonnes(qty)
          : Number.parseFloat(tx.quantityTonnes);
      const isPvkj = tx.productType === PRODUCT_TYPE.PVKJ;

      if (qty > 0) {
        if (isPvkj) pvkjIncome += qty;
        else income += qty;
      } else {
        if (isPvkj) pvkjExpense += Math.abs(qty);
        else expense += Math.abs(qty);
      }

      if (tonnes > 0) {
        if (isPvkj) pvkjIncomeTonnes += tonnes;
        else incomeTonnes += tonnes;
      } else {
        if (isPvkj) pvkjExpenseTonnes += Math.abs(tonnes);
        else expenseTonnes += Math.abs(tonnes);
      }
    });

    return {
      income,
      expense,
      pvkjIncome,
      pvkjExpense,
      incomeTonnes,
      expenseTonnes,
      pvkjIncomeTonnes,
      pvkjExpenseTonnes,
    };
  }

  async getWarehouseBalanceAtDate(
    warehouseId: string,
    date: Date,
    productType: string,
  ): Promise<{
    balance: string;
    balanceTonnes: string;
    averageCost: string;
    averageCostPerTonne: string;
  }> {
    const dateStr = format(date, "yyyy-MM-dd");

    const [lastTransaction] = await db
      .select()
      .from(warehouseTransactions)
      .where(
        and(
          eq(warehouseTransactions.warehouseId, warehouseId),
          eq(warehouseTransactions.productType, productType),
          sql`CAST(${warehouseTransactions.transactionDate} AS DATE) <= CAST(${dateStr} AS DATE)`,
          isNull(warehouseTransactions.deletedAt),
        ),
      )
      .orderBy(
        desc(warehouseTransactions.transactionDate),
        desc(warehouseTransactions.createdAt),
        desc(warehouseTransactions.id),
      )
      .limit(1);

    return {
      balance: lastTransaction?.balanceAfter || "0",
      balanceTonnes:
        lastTransaction?.balanceAfterTonnes ??
        kilogramsToTonnes(
          Number.parseFloat(lastTransaction?.balanceAfter || "0"),
        ).toFixed(5),
      averageCost: lastTransaction?.averageCostAfter || "0",
      averageCostPerTonne:
        lastTransaction?.averageCostAfterPerTonne ??
        pricePerKilogramToPerTonne(
          Number.parseFloat(lastTransaction?.averageCostAfter || "0"),
        ).toString(),
    };
  }

  async createInventoryTransaction(params: {
    warehouseId: string;
    productType: string;
    targetDate: string;
    targetBalanceTonnes?: number;
    targetAverageCostPerTonne?: number;
    targetBalance?: number;
    targetAverageCost?: number;
    userId?: string;
  }): Promise<{ message: string; limitExpiresAt?: string }> {
    const {
      warehouseId,
      productType,
      targetDate,
      targetBalanceTonnes: requestedBalanceTonnes,
      targetAverageCostPerTonne: requestedAverageCostPerTonne,
      targetBalance,
      targetAverageCost,
      userId,
    } = params;
    const dateObj = new Date(targetDate);
    const balanceAtDate = await this.getWarehouseBalanceAtDate(warehouseId, dateObj, productType);

    const currentBalanceTonnes = Number.parseFloat(balanceAtDate.balanceTonnes);
    const currentAverageCostPerTonne = Number.parseFloat(
      balanceAtDate.averageCostPerTonne,
    );
    const targetBalanceInTonnes =
      requestedBalanceTonnes ??
      (targetBalance === undefined
        ? Number.NaN
        : kilogramsToTonnes(targetBalance));
    const targetCostPerTonne =
      requestedAverageCostPerTonne ??
      (targetAverageCost === undefined
        ? Number.NaN
        : pricePerKilogramToPerTonne(targetAverageCost));
    if (
      !Number.isFinite(targetBalanceInTonnes) ||
      !Number.isFinite(targetCostPerTonne)
    ) {
      throw new TypeError("Inventory balances and costs must be finite numbers");
    }

    const deltaTonnes = targetBalanceInTonnes - currentBalanceTonnes;
    const deltaCost =
      targetBalanceInTonnes * targetCostPerTonne -
      currentBalanceTonnes * currentAverageCostPerTonne;
    const absQuantityTonnes = Math.abs(deltaTonnes);
    const transactionQuantityTonnes = deltaTonnes >= 0 ? absQuantityTonnes : -absQuantityTonnes;
    const legacyTargetBalance = tonnesToKilograms(targetBalanceInTonnes);
    const legacyCurrentBalance = tonnesToKilograms(currentBalanceTonnes);
    const legacyTargetCost = pricePerTonneToPerKilogram(targetCostPerTonne);
    const legacyCurrentCost = pricePerTonneToPerKilogram(currentAverageCostPerTonne);
    const legacyQuantity = tonnesToKilograms(transactionQuantityTonnes);
    const legacyPricePerKg =
      absQuantityTonnes > 0
        ? pricePerTonneToPerKilogram(Math.abs(deltaCost) / absQuantityTonnes)
        : 0;
    const pricePerTonne =
      absQuantityTonnes > 0 ? Math.abs(deltaCost) / absQuantityTonnes : 0;

    const { format } = await import("date-fns");
    const txDate = format(
      new Date(new Date(targetDate).setHours(23, 59, 0, 0)),
      "yyyy-MM-dd'T'HH:mm:ss",
    );

    const { PRODUCT_TYPE: PT, TRANSACTION_TYPE: TT } = await import("@shared/constants");

    await db.transaction(async (tx) => {
      await tx
        .insert(warehouseTransactions)
        .values({
          warehouseId,
          transactionType: TT.INVENTORY,
          productType,
          sourceType: "inventory",
          sourceId: warehouseId,
          quantity: legacyQuantity.toFixed(2),
          quantityTonnes: transactionQuantityTonnes.toFixed(5),
          sum: deltaCost.toFixed(2),
          price: legacyPricePerKg.toFixed(6),
          pricePerTonne: pricePerTonne.toFixed(6),
          balanceBefore: legacyCurrentBalance.toFixed(2),
          balanceAfter: legacyTargetBalance.toFixed(2),
          balanceBeforeTonnes: currentBalanceTonnes.toFixed(5),
          balanceAfterTonnes: targetBalanceInTonnes.toFixed(5),
          averageCostBefore: legacyCurrentCost.toFixed(6),
          averageCostBeforePerTonne: currentAverageCostPerTonne.toFixed(6),
          averageCostAfter: legacyTargetCost.toFixed(6),
          averageCostAfterPerTonne: targetCostPerTonne.toFixed(6),
          transactionDate: txDate,
          createdById: userId,
        });

      const isPvkj = productType === PT.PVKJ;
      if (isPvkj) {
        await tx
          .update(warehouses)
          .set({
            pvkjBalance: legacyTargetBalance.toFixed(2),
            pvkjBalanceTonnes: targetBalanceInTonnes.toFixed(5),
            pvkjAverageCost: legacyTargetCost.toFixed(6),
            pvkjAverageCostPerTonne: targetCostPerTonne.toFixed(6),
            updatedAt: sql`NOW()`,
            updatedById: userId,
          })
          .where(eq(warehouses.id, warehouseId));
      } else {
        await tx
          .update(warehouses)
          .set({
            currentBalance: legacyTargetBalance.toFixed(2),
            currentBalanceTonnes: targetBalanceInTonnes.toFixed(5),
            averageCost: legacyTargetCost.toFixed(6),
            averageCostPerTonne: targetCostPerTonne.toFixed(6),
            updatedAt: sql`NOW()`,
            updatedById: userId,
          })
          .where(eq(warehouses.id, warehouseId));
      }
    });

    return { message: "Инвентаризация выполнена успешно" };
  }

  async getWarehouseStatsForDashboard(): Promise<
    Array<{ name: string; current: number; currentTonnes: number }>
  > {
    const warehousesList = await db.query.warehouses.findMany({
      where: and(eq(warehouses.isActive, true), isNull(warehouses.deletedAt)),
    });

    const stats = warehousesList.map((wh) => ({
      name: wh.name,
      current: parseFloat(wh.currentBalance || "0"),
      currentTonnes:
        wh.currentBalanceTonnes == null
          ? kilogramsToTonnes(parseFloat(wh.currentBalance || "0"))
          : Number.parseFloat(wh.currentBalanceTonnes),
    }));

    return stats;
  }

  // ============ LIK WAREHOUSE ACCESS METHODS ============

  /**
   * Get all LIK (ОП) warehouses.
   * If allowedIds is provided, only returns those warehouses.
   * If allowedIds is null/undefined, returns all LIK warehouses (full access).
   */
  async getLikWarehouses(allowedIds?: string[] | null): Promise<Warehouse[]> {
    const conditions: any[] = [
      isNull(warehouses.deletedAt),
      eq(warehouses.equipmentType, "lik"),
    ];

    if (allowedIds && allowedIds.length > 0) {
      conditions.push(inArray(warehouses.id, allowedIds));
    } else if (allowedIds !== null && allowedIds !== undefined && allowedIds.length === 0) {
      // User has restrictions but no warehouses assigned — return empty
      return [];
    }

    const warehousesList = await db.query.warehouses.findMany({
      where: and(...conditions),
      orderBy: (warehouses, { asc, desc }) => [desc(warehouses.isPinned), asc(warehouses.name)],
      with: {
        supplier: { columns: { id: true, name: true } },
        warehouseBases: { with: { base: true } },
        warehouseServices: true,
      },
    });

    return warehousesList.map((w) => ({
      ...w,
      baseIds: w.warehouseBases?.map((wb) => wb.baseId) || [],
      services: w.warehouseServices?.map((s) => ({
        id: s.id,
        serviceName: s.serviceName,
        serviceType: s.serviceType,
        serviceValue: s.serviceValue,
      })) || [],
    }));
  }

  /**
   * Returns the list of warehouse IDs the user is restricted to for LIK access.
   * Returns null if the user has no restrictions (full access).
   * Returns an empty array if the user has restrictions but none assigned.
   */
  async getUserAllowedLikWarehouseIds(userId: string): Promise<string[] | null> {
    const rows = await db
      .select({ warehouseId: userWarehouseAccess.warehouseId })
      .from(userWarehouseAccess)
      .where(eq(userWarehouseAccess.userId, userId));

    if (rows.length === 0) {
      // No restrictions — full access
      return null;
    }

    return rows.map((r) => r.warehouseId);
  }

  /**
   * Get all warehouse access rows for a specific user.
   */
  async getUserWarehouseAccess(userId: string): Promise<UserWarehouseAccess[]> {
    return db
      .select()
      .from(userWarehouseAccess)
      .where(eq(userWarehouseAccess.userId, userId));
  }

  /**
   * Replace the warehouse access list for a user.
   * Pass an empty array to grant full access (no restrictions).
   */
  async setUserWarehouseAccess(
    userId: string,
    warehouseIds: string[],
    createdById: string,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Remove all existing access rows for this user
      await tx
        .delete(userWarehouseAccess)
        .where(eq(userWarehouseAccess.userId, userId));

      if (warehouseIds.length > 0) {
        await tx.insert(userWarehouseAccess).values(
          warehouseIds.map((warehouseId) => ({
            userId,
            warehouseId,
            createdById,
          })),
        );
      }
    });
  }
}
