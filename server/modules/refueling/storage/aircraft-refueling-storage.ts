import { eq, desc, asc, sql, or, isNull, and, inArray, ilike } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "server/db";
import {
  aircraftRefueling,
  suppliers,
  customers,
  prices,
  warehouses,
  warehouseTransactions,
  equipmentTransactions,
  type AircraftRefueling,
  type InsertAircraftRefueling,
  equipments,
} from "@shared/schema";
import { IAircraftRefuelingStorage } from "./types";
import {
  EQUIPMENT_TYPE,
  PRODUCT_TYPE,
  SOURCE_TYPE,
  TRANSACTION_TYPE,
} from "@shared/constants";
import { WarehouseTransactionService } from "server/modules/warehouses/services/warehouse-transaction-service";
import { EquipmentTransactionService } from "server/modules/warehouses-equipment/services/equipment-transaction-service";

export class AircraftRefuelingStorage {
  async getRefueling(id: string): Promise<AircraftRefueling | undefined> {
    return db.query.aircraftRefueling.findFirst({
      where: and(
        eq(aircraftRefueling.id, id),
        isNull(aircraftRefueling.deletedAt),
      ),
    });
  }

  async getRefuelings(
    offset: number = 0,
    pageSize: number = 100,
    equipmentType?: string,
    search?: string,
    filters?: Record<string, string[]>,
    allowedWarehouseIds?: string[] | null,
  ): Promise<{ data: any[]; total: number }> {
    const baseConditions: any[] = [isNull(aircraftRefueling.deletedAt)];

    if (equipmentType && equipmentType !== EQUIPMENT_TYPE.COMMON) {
      baseConditions.push(eq(aircraftRefueling.equipmentType, equipmentType));
    }

    // Warehouse access restriction for LIK section
    if (equipmentType === EQUIPMENT_TYPE.LIK || equipmentType === "lik") {
      if (allowedWarehouseIds !== null && allowedWarehouseIds !== undefined) {
        if (allowedWarehouseIds.length === 0) {
          // User has restriction but no warehouses assigned → show nothing
          return { data: [], total: 0 };
        }
        baseConditions.push(inArray(aircraftRefueling.warehouseId, allowedWarehouseIds));
      }
    }

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      baseConditions.push(
        or(
          sql`${suppliers.name} ILIKE ${searchPattern}`,
          sql`${customers.name} ILIKE ${searchPattern}`,
          sql`${aircraftRefueling.aircraftNumber}::text ILIKE ${searchPattern}`,
          sql`${aircraftRefueling.notes}::text ILIKE ${searchPattern}`,
        ),
      );
    }

    if (filters) {
      if (filters.supplier?.length) {
        baseConditions.push(sql`${suppliers.name} IN ${filters.supplier}`);
      }
      if (filters.buyer?.length) {
        baseConditions.push(sql`${customers.name} IN ${filters.buyer}`);
      }
      if (filters.productType?.length) {
        baseConditions.push(
          sql`${aircraftRefueling.productType} IN ${filters.productType}`,
        );
      }
      if (filters.date?.length) {
        // Convert dates to string format for comparison
        baseConditions.push(
          sql`TO_CHAR(${aircraftRefueling.refuelingDate}, 'DD.MM.YYYY') IN ${filters.date}`,
        );
      }
      if (filters.orderNumber?.length) {
        baseConditions.push(
          sql`${aircraftRefueling.orderNumber} IN ${filters.orderNumber}`,
        );
      }
      if (filters.direction?.length) {
        baseConditions.push(
          sql`${aircraftRefueling.flightNumber} IN ${filters.direction}`,
        );
      }
      if (filters.board?.length) {
        baseConditions.push(
          sql`${aircraftRefueling.aircraftNumber} IN ${filters.board}`,
        );
      }
      if (filters.equipment?.length) {
        // Фильтр по СЗ (для ЛИК) — по имени средства заправки
        baseConditions.push(
          sql`(SELECT name FROM equipments WHERE id = ${aircraftRefueling.equipmentId}) IN ${filters.equipment}`,
        );
      }
      if (filters.basis?.length) {
        baseConditions.push(
          sql`(SELECT name FROM bases WHERE id = ${aircraftRefueling.basisId}) IN ${filters.basis}`,
        );
      }
      // Диапазон дат (приоритет над filter_date)
      if (filters.dateFrom?.length && filters.dateTo?.length) {
        baseConditions.push(
          sql`${aircraftRefueling.refuelingDate}::date >= ${filters.dateFrom[0]}::date`,
          sql`${aircraftRefueling.refuelingDate}::date <= ${filters.dateTo[0]}::date`,
        );
        // Убираем filter_date если задан диапазон
        delete filters.date;
      }
    }

    const whereCondition = and(...baseConditions);

    const rawData = await db
      .select({
        refueling: aircraftRefueling,
        supplierName: suppliers.name,
        supplierIsWarehouse: suppliers.isWarehouse,
        buyerName: customers.name,
        warehouseName: sql<string>`${warehouses.name}`,
        equipmentName: equipments.name,
        basisName: sql<string | null>`(SELECT name FROM bases WHERE id = ${aircraftRefueling.basisId})`,
        customerBasisName: sql<string | null>`(SELECT name FROM bases WHERE id = ${aircraftRefueling.customerBasisId})`,
      })
      .from(aircraftRefueling)
      .leftJoin(suppliers, eq(aircraftRefueling.supplierId, suppliers.id))
      .leftJoin(customers, eq(aircraftRefueling.buyerId, customers.id))
      .leftJoin(warehouses, eq(aircraftRefueling.warehouseId, warehouses.id))
      .leftJoin(equipments, eq(aircraftRefueling.equipmentId, equipments.id))
      .where(whereCondition)
      .orderBy(
        desc(aircraftRefueling.refuelingDate),
        // Группировка по номеру РТ внутри одной даты
        sql`COALESCE(${aircraftRefueling.orderNumber}, '')`,
        sql`COALESCE(${aircraftRefueling.refuelingOrderId}::text, ${aircraftRefueling.id}::text)`,
        // Сортировка по типу продукта внутри группы РТ: керосин → ПВКЖ → услуга → прочее
        sql`CASE WHEN ${aircraftRefueling.productType} = 'kerosene' THEN 0 WHEN ${aircraftRefueling.productType} = 'pvkj' THEN 1 WHEN ${aircraftRefueling.productType} = 'service' THEN 2 ELSE 3 END`,
      )
      .limit(pageSize)
      .offset(offset);

    const data = rawData.map((row) => ({
      ...row.refueling,
      supplier: {
        id: row.refueling.supplierId,
        name: row.supplierName || "Не указан",
        isWarehouse: row.supplierIsWarehouse || false,
      },
      buyer: {
        id: row.refueling.buyerId,
        name: row.buyerName || "Не указан",
      },
      warehouse: row.refueling.warehouseId
        ? {
            id: row.refueling.warehouseId,
            name: row.warehouseName || "Не указан",
          }
        : null,
      equipment: row.refueling.equipmentId
        ? {
            id: row.refueling.equipmentId,
            name: row.equipmentName || "Не указан",
          }
        : null,
      basis: row.refueling.basisId
        ? {
            id: row.refueling.basisId,
            name: row.basisName || "Не указан",
          }
        : null,
      customerBasis: row.refueling.customerBasisId
        ? {
            id: row.refueling.customerBasisId,
            name: row.customerBasisName || "Не указан",
          }
        : null,
    }));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(aircraftRefueling)
      .leftJoin(suppliers, eq(aircraftRefueling.supplierId, suppliers.id))
      .leftJoin(customers, eq(aircraftRefueling.buyerId, customers.id))
      .where(whereCondition);

    return { data, total: Number(countResult?.count || 0) };
  }

  async createRefueling(
    data: InsertAircraftRefueling,
  ): Promise<AircraftRefueling> {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(aircraftRefueling)
        .values({ ...data, refuelingOrderId: data.refuelingOrderId || randomUUID() } as any)
        .returning();
      let result = created;

      // Для услуги заправки или черновика не создаем транзакции на складе
      if (
        !created.isDraft &&
        (created.warehouseId || created.equipmentId) &&
        (created.productType === PRODUCT_TYPE.KEROSENE ||
          created.productType === PRODUCT_TYPE.PVKJ)
      ) {
        if (created.equipmentId) {
          const transaction =
            await EquipmentTransactionService.createTransactionAndUpdateEquipment(
              tx,
              created.equipmentId,
              TRANSACTION_TYPE.SALE,
              created.productType,
              SOURCE_TYPE.REFUELING,
              created.id,
              parseFloat(created.quantityKg),
              parseFloat(created.purchaseAmount || "0"),
              data.createdById || undefined,
              created.refuelingDate,
            );

          const [updated] = await tx
            .update(aircraftRefueling)
            .set({ equipmentTransactionId: transaction.id })
            .where(eq(aircraftRefueling.id, created.id))
            .returning();
          result = updated;
        } else if (created.warehouseId) {
          const { transaction } =
            await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
              tx,
              created.warehouseId,
              TRANSACTION_TYPE.SALE,
              created.productType,
              SOURCE_TYPE.REFUELING,
              created.id,
              parseFloat(created.quantityKg),
              parseFloat(created.purchaseAmount || "0"),
              data.createdById || undefined,
              created.refuelingDate,
            );

          const [updated] = await tx
            .update(aircraftRefueling)
            .set({ transactionId: transaction.id })
            .where(eq(aircraftRefueling.id, created.id))
            .returning();
          result = updated;
        }
      }

      return result;
    });
  }

  /**
   * Create all product rows for one refueling order in a single DB transaction.
   * Warehouse/equipment movements roll back together if any row fails.
   */
  async createRefuelings(
    items: InsertAircraftRefueling[],
  ): Promise<AircraftRefueling[]> {
    return db.transaction(async (tx) => {
      const createdItems: AircraftRefueling[] = [];
      const refuelingOrderId = randomUUID();
      for (const data of items) {
        const [created] = await tx
          .insert(aircraftRefueling)
          .values({ ...data, refuelingOrderId } as any)
          .returning();

        if (
          !created.isDraft &&
          (created.warehouseId || created.equipmentId) &&
          (created.productType === PRODUCT_TYPE.KEROSENE ||
            created.productType === PRODUCT_TYPE.PVKJ)
        ) {
          if (created.equipmentId) {
            const transaction =
              await EquipmentTransactionService.createTransactionAndUpdateEquipment(
                tx,
                created.equipmentId,
                TRANSACTION_TYPE.SALE,
                created.productType,
                SOURCE_TYPE.REFUELING,
                created.id,
                Number.parseFloat(created.quantityKg),
                Number.parseFloat(created.purchaseAmount || "0"),
                data.createdById || undefined,
                created.refuelingDate,
              );
            await tx
              .update(aircraftRefueling)
              .set({ equipmentTransactionId: transaction.id })
              .where(eq(aircraftRefueling.id, created.id));
            created.equipmentTransactionId = transaction.id;
          } else if (created.warehouseId) {
            const { transaction } =
              await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
                tx,
                created.warehouseId,
                TRANSACTION_TYPE.SALE,
                created.productType,
                SOURCE_TYPE.REFUELING,
                created.id,
                Number.parseFloat(created.quantityKg),
                Number.parseFloat(created.purchaseAmount || "0"),
                data.createdById || undefined,
                created.refuelingDate,
              );
            await tx
              .update(aircraftRefueling)
              .set({ transactionId: transaction.id })
              .where(eq(aircraftRefueling.id, created.id));
            created.transactionId = transaction.id;
          }
        }
        createdItems.push(created);
      }
      return createdItems;
    });
  }

  async getRefuelingOrder(anchorId: string): Promise<AircraftRefueling[]> {
    const anchor = await db.query.aircraftRefueling.findFirst({
      where: and(
        eq(aircraftRefueling.id, anchorId),
        isNull(aircraftRefueling.deletedAt),
      ),
    });
    if (!anchor) return [];
    return db.query.aircraftRefueling.findMany({
      where: and(
        anchor.refuelingOrderId
          ? eq(aircraftRefueling.refuelingOrderId, anchor.refuelingOrderId)
          : eq(aircraftRefueling.id, anchor.id),
        isNull(aircraftRefueling.deletedAt),
      ),
      orderBy: [
        sql`CASE WHEN ${aircraftRefueling.productType} = 'kerosene' THEN 0 WHEN ${aircraftRefueling.productType} = 'pvkj' THEN 1 WHEN ${aircraftRefueling.productType} = 'service' THEN 2 ELSE 3 END`,
      ],
    });
  }

  private async reverseOrderDealStock(tx: any, deal: AircraftRefueling, userId?: string) {
    if (
      deal.isDraft ||
      (deal.productType !== PRODUCT_TYPE.KEROSENE &&
        deal.productType !== PRODUCT_TYPE.PVKJ)
    ) {
      return;
    }
    if (deal.equipmentTransactionId) {
      await EquipmentTransactionService.deleteTransactionAndRevertEquipment(
        tx,
        deal.equipmentTransactionId,
        userId,
      );
    } else if (deal.transactionId) {
      await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
        tx,
        deal.transactionId,
        userId,
      );
    }
  }

  private async applyOrderDealStock(
    tx: any,
    deal: AircraftRefueling,
    userId?: string,
  ): Promise<AircraftRefueling> {
    if (
      deal.isDraft ||
      (!deal.warehouseId && !deal.equipmentId) ||
      (deal.productType !== PRODUCT_TYPE.KEROSENE &&
        deal.productType !== PRODUCT_TYPE.PVKJ)
    ) {
      return deal;
    }

    let transactionId: string | null = null;
    let equipmentTransactionId: string | null = null;
    if (deal.equipmentId) {
      const transaction =
        await EquipmentTransactionService.createTransactionAndUpdateEquipment(
          tx,
          deal.equipmentId,
          TRANSACTION_TYPE.SALE,
          deal.productType,
          SOURCE_TYPE.REFUELING,
          deal.id,
          Number.parseFloat(deal.quantityKg),
          Number.parseFloat(deal.purchaseAmount || "0"),
          userId,
          deal.refuelingDate,
        );
      equipmentTransactionId = transaction.id;
    } else if (deal.warehouseId) {
      const result =
        await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
          tx,
          deal.warehouseId,
          TRANSACTION_TYPE.SALE,
          deal.productType,
          SOURCE_TYPE.REFUELING,
          deal.id,
          Number.parseFloat(deal.quantityKg),
          Number.parseFloat(deal.purchaseAmount || "0"),
          userId,
          deal.refuelingDate,
        );
      transactionId = result.transaction.id;
    }

    const [updated] = await tx
      .update(aircraftRefueling)
      .set({ transactionId, equipmentTransactionId })
      .where(eq(aircraftRefueling.id, deal.id))
      .returning();
    return updated;
  }

  /**
   * Replaces the products in a refueling order atomically. Existing deal IDs are
   * retained for product types that remain in the order.
   */
  async updateRefuelingOrder(
    anchorId: string,
    items: InsertAircraftRefueling[],
    userId?: string,
  ): Promise<{ oldDeals: AircraftRefueling[]; deals: AircraftRefueling[] }> {
    if (items.length < 1 || items.length > 3) {
      throw new Error("Заказ должен содержать от одного до трёх продуктов");
    }
    const productTypes = items.map((item) => String(item.productType || ""));
    if (
      new Set(productTypes).size !== productTypes.length ||
      productTypes.some(
        (type) =>
          type !== PRODUCT_TYPE.KEROSENE &&
          type !== PRODUCT_TYPE.PVKJ &&
          type !== PRODUCT_TYPE.SERVICE,
      )
    ) {
      throw new Error("В заказе не должно быть повторяющихся или неизвестных продуктов");
    }

    return db.transaction(async (tx) => {
      const [anchor] = await tx
        .select()
        .from(aircraftRefueling)
        .where(
          and(
            eq(aircraftRefueling.id, anchorId),
            isNull(aircraftRefueling.deletedAt),
          ),
        );
      if (!anchor) throw new Error("Заказ заправки не найден");

      const oldDeals = await tx
        .select()
        .from(aircraftRefueling)
        .where(
          and(
            anchor.refuelingOrderId
              ? eq(aircraftRefueling.refuelingOrderId, anchor.refuelingOrderId)
              : eq(aircraftRefueling.id, anchor.id),
            isNull(aircraftRefueling.deletedAt),
          ),
        )
        .orderBy(asc(aircraftRefueling.id))
        .for("update");
      if (!oldDeals.some((deal) => deal.id === anchorId)) {
        throw new Error("Заказ изменён другим пользователем. Обновите список и попробуйте снова");
      }
      const refuelingOrderId = anchor.refuelingOrderId || randomUUID();
      const existingByType = new Map(
        oldDeals.map((deal) => [String(deal.productType), deal] as const),
      );

      // Reverse every prior movement before applying the new order state.
      for (const deal of oldDeals) {
        await this.reverseOrderDealStock(tx, deal, userId);
      }

      const keptTypes = new Set(productTypes);
      for (const deal of oldDeals) {
        if (!keptTypes.has(deal.productType)) {
          await tx
            .update(aircraftRefueling)
            .set({ deletedAt: sql`NOW()`, deletedById: userId })
            .where(eq(aircraftRefueling.id, deal.id));
        }
      }

      const savedDeals: AircraftRefueling[] = [];
      for (const item of items) {
        const current = existingByType.get(String(item.productType));
        let deal: AircraftRefueling;
        if (current) {
          const [updated] = await tx
            .update(aircraftRefueling)
            .set({
              ...item,
              refuelingOrderId,
              transactionId: null,
              equipmentTransactionId: null,
              createdById: current.createdById,
              updatedById: userId,
              updatedAt: sql`NOW()`,
            } as any)
            .where(eq(aircraftRefueling.id, current.id))
            .returning();
          deal = updated;
        } else {
          const [created] = await tx
            .insert(aircraftRefueling)
            .values({
              ...item,
              refuelingOrderId,
              createdById: userId,
            } as any)
            .returning();
          deal = created;
        }
        savedDeals.push(await this.applyOrderDealStock(tx, deal, userId));
      }
      return { oldDeals, deals: savedDeals };
    });
  }

  async deleteRefuelingOrder(anchorId: string, userId?: string): Promise<AircraftRefueling[]> {
    return db.transaction(async (tx) => {
      const [anchor] = await tx
        .select()
        .from(aircraftRefueling)
        .where(
          and(
            eq(aircraftRefueling.id, anchorId),
            isNull(aircraftRefueling.deletedAt),
          ),
        );
      if (!anchor) return [];
      const deals: AircraftRefueling[] = await tx
        .select()
        .from(aircraftRefueling)
        .where(
          and(
            anchor.refuelingOrderId
              ? eq(aircraftRefueling.refuelingOrderId, anchor.refuelingOrderId)
              : eq(aircraftRefueling.id, anchor.id),
            isNull(aircraftRefueling.deletedAt),
          ),
        )
        .orderBy(asc(aircraftRefueling.id))
        .for("update");
      if (!deals.some((deal) => deal.id === anchorId)) return [];
      for (const deal of deals) {
        await this.reverseOrderDealStock(tx, deal, userId);
      }
      for (const deal of deals) {
        await tx
          .update(aircraftRefueling)
          .set({ deletedAt: sql`NOW()`, deletedById: userId })
          .where(eq(aircraftRefueling.id, deal.id));
      }
      return deals;
    });
  }

  async updateRefueling(
    id: string,
    data: Partial<InsertAircraftRefueling>,
  ): Promise<AircraftRefueling | undefined> {
    return await db.transaction(async (tx) => {
      const currentRefueling = await tx.query.aircraftRefueling.findFirst({
        where: eq(aircraftRefueling.id, id),
      });

      if (!currentRefueling) {
        throw new Error("Deal not found");
      }

      // Логика перехода из черновика в готовую заправку
      const transitioningFromDraft =
        currentRefueling.isDraft && data.isDraft === false;

      if (
        transitioningFromDraft &&
        (data.warehouseId || data.equipmentId) &&
        data.quantityKg &&
        (data.productType === PRODUCT_TYPE.KEROSENE ||
          data.productType === PRODUCT_TYPE.PVKJ)
      ) {
        if (data.equipmentId) {
          const transaction =
            await EquipmentTransactionService.createTransactionAndUpdateEquipment(
              tx,
              data.equipmentId,
              TRANSACTION_TYPE.SALE,
              data.productType,
              SOURCE_TYPE.REFUELING,
              currentRefueling.id,
              data.quantityKg,
              data.purchaseAmount || 0,
              data.updatedById!,
              data.refuelingDate ?? undefined,
            );

          data.equipmentTransactionId = transaction.id;
        } else if (data.warehouseId) {
          const { transaction } =
            await WarehouseTransactionService.createTransactionAndUpdateWarehouse(
              tx,
              data.warehouseId,
              TRANSACTION_TYPE.SALE,
              data.productType,
              SOURCE_TYPE.REFUELING,
              currentRefueling.id,
              data.quantityKg,
              data.purchaseAmount || 0,
              data.updatedById ?? undefined,
              data.refuelingDate ?? undefined,
            );

          data.transactionId = transaction.id;
        }
      }
      // Проверяем изменилось ли количество КГ и/или дата сделки, и есть ли привязанная транзакция (для НЕ черновиков)
      else if (
        !currentRefueling.isDraft &&
        (currentRefueling.transactionId ||
          currentRefueling.equipmentTransactionId) &&
        (currentRefueling.warehouseId || currentRefueling.equipmentId) &&
        (currentRefueling.productType === PRODUCT_TYPE.KEROSENE ||
          currentRefueling.productType === PRODUCT_TYPE.PVKJ)
      ) {
        if (
          data.productType !== undefined &&
          data.productType !== currentRefueling.productType
        ) {
          throw new Error(
            "Нельзя поменять тип продукта для существующей сделки",
          );
        }

        if (
          data.warehouseId !== undefined &&
          data.warehouseId !== currentRefueling.warehouseId
        ) {
          throw new Error(
            "Нельзя поменять склад-источник для существующей сделки",
          );
        }

        const oldQuantityKg = parseFloat(currentRefueling.quantityKg);
        const newQuantityKg = data.quantityKg
          ? parseFloat(data.quantityKg.toString())
          : oldQuantityKg;
        const oldTotalCost = parseFloat(currentRefueling.purchaseAmount || "0");
        const newTotalCost = data.purchaseAmount ?? oldTotalCost;

        const quantityChanged = oldQuantityKg !== newQuantityKg;
        const dateChanged =
          data.refuelingDate !== undefined &&
          data.refuelingDate !== currentRefueling.refuelingDate;

        if (quantityChanged) {
          // Количество изменилось — обновляем транзакцию (метод также применит новую дату)
          if (
            currentRefueling.equipmentId &&
            currentRefueling.equipmentTransactionId
          ) {
            await EquipmentTransactionService.updateTransactionAndRecalculateEquipment(
              tx,
              currentRefueling.equipmentTransactionId,
              currentRefueling.equipmentId,
              oldQuantityKg,
              oldTotalCost,
              newQuantityKg,
              newTotalCost,
              data.updatedById!,
              data.refuelingDate ?? undefined,
            );
          } else if (
            currentRefueling.warehouseId &&
            currentRefueling.transactionId
          ) {
            await WarehouseTransactionService.updateTransactionAndRecalculateWarehouse(
              tx,
              currentRefueling.transactionId,
              currentRefueling.warehouseId,
              oldQuantityKg,
              oldTotalCost,
              newQuantityKg,
              newTotalCost,
              currentRefueling.productType,
              data.updatedById ?? undefined,
              data.refuelingDate ?? undefined,
            );
          }
        } else if (dateChanged) {
          // Только дата изменилась — обновляем дату транзакции и запускаем пересчёт.
          // Ранее этот случай полностью игнорировался, из-за чего дата транзакции
          // оставалась старой и возникал рассинхрон с реестром заправок.
          if (
            currentRefueling.warehouseId &&
            currentRefueling.transactionId
          ) {
            await WarehouseTransactionService.updateTransactionDateAndRecalculate(
              tx,
              currentRefueling.transactionId,
              currentRefueling.warehouseId,
              currentRefueling.productType,
              currentRefueling.refuelingDate!,
              data.refuelingDate!,
              data.updatedById ?? undefined,
            );
          } else if (
            currentRefueling.equipmentId &&
            currentRefueling.equipmentTransactionId
          ) {
            await EquipmentTransactionService.updateTransactionDateAndRecalculate(
              tx,
              currentRefueling.equipmentTransactionId,
              currentRefueling.equipmentId,
              currentRefueling.productType,
              currentRefueling.refuelingDate!,
              data.refuelingDate!,
              data.updatedById ?? undefined,
            );
          }
        }
      }

      const [updated] = await tx
        .update(aircraftRefueling)
        .set({
          ...data,
          updatedAt: sql`NOW()`,
        } as any)
        .where(eq(aircraftRefueling.id, id))
        .returning();

      return updated;
    });
  }

  async deleteRefueling(id: string, userId?: string): Promise<boolean> {
    await db.transaction(async (tx) => {
      const currentRefueling = await tx.query.aircraftRefueling.findFirst({
        where: eq(aircraftRefueling.id, id),
        with: {
          warehouse: true,
        },
      });

      // Для услуг заправки пропускаем восстановление баланса на складе
      if (
        currentRefueling &&
        (currentRefueling.transactionId ||
          currentRefueling.equipmentTransactionId) &&
        (currentRefueling.productType === PRODUCT_TYPE.KEROSENE ||
          currentRefueling.productType === PRODUCT_TYPE.PVKJ)
      ) {
        if (currentRefueling.equipmentTransactionId) {
          await EquipmentTransactionService.deleteTransactionAndRevertEquipment(
            tx,
            currentRefueling.equipmentTransactionId,
            userId,
          );
        } else if (currentRefueling.transactionId) {
          await WarehouseTransactionService.deleteTransactionAndRevertWarehouse(
            tx,
            currentRefueling.transactionId,
            userId,
          );
        }
      }

      await tx
        .update(aircraftRefueling)
        .set({
          deletedAt: sql`NOW()`,
          deletedById: userId,
        })
        .where(eq(aircraftRefueling.id, id));
    });

    return true;
  }

  async getUsedVolumeByPrice(priceId: string): Promise<number> {
    const price = await db.query.prices.findFirst({
      where: eq(prices.id, priceId),
      columns: { priceUnit: true },
    });
    const quantityColumn =
      price?.priceUnit === "liter"
        ? aircraftRefueling.quantityLiters
        : aircraftRefueling.quantityKg;

    const [result] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${quantityColumn}), 0)`,
      })
      .from(aircraftRefueling)
      .where(
        and(
          or(
            eq(aircraftRefueling.salePriceId, priceId),
            eq(aircraftRefueling.purchasePriceId, priceId),
          ),
          isNull(aircraftRefueling.deletedAt),
          eq(aircraftRefueling.isDraft, false),
        ),
      );
    return parseFloat(result?.total || "0");
  }

  async getUsedAmountByPrice(priceId: string): Promise<number> {
    const [saleResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${aircraftRefueling.saleAmount}), 0)`,
      })
      .from(aircraftRefueling)
      .where(
        and(
          eq(aircraftRefueling.salePriceId, priceId),
          isNull(aircraftRefueling.deletedAt),
          eq(aircraftRefueling.isDraft, false),
        ),
      );

    const [purchaseResult] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${aircraftRefueling.purchaseAmount}), 0)`,
      })
      .from(aircraftRefueling)
      .where(
        and(
          eq(aircraftRefueling.purchasePriceId, priceId),
          isNull(aircraftRefueling.deletedAt),
          eq(aircraftRefueling.isDraft, false),
        ),
      );

    const saleTotal = parseFloat(saleResult?.total || "0");
    const purchaseTotal = parseFloat(purchaseResult?.total || "0");
    return Math.max(saleTotal, purchaseTotal);
  }

  async checkDuplicate(data: {
    refuelingDate: string;
    supplierId: string;
    buyerId: string;
    productType: string;
    basisId?: string | null;
    customerBasisId?: string | null;
    quantityKg: number;
  }): Promise<boolean> {
    const existing = await db.query.aircraftRefueling.findFirst({
      where: and(
        sql`DATE(${aircraftRefueling.refuelingDate}) = DATE(${data.refuelingDate})`,
        eq(aircraftRefueling.supplierId, data.supplierId),
        eq(aircraftRefueling.buyerId, data.buyerId),
        eq(aircraftRefueling.productType, data.productType),
        data.basisId
          ? eq(aircraftRefueling.basisId, data.basisId)
          : isNull(aircraftRefueling.basisId),
        data.customerBasisId
          ? eq(aircraftRefueling.customerBasisId, data.customerBasisId)
          : isNull(aircraftRefueling.customerBasisId),
        eq(aircraftRefueling.quantityKg, data.quantityKg.toString()),
        isNull(aircraftRefueling.deletedAt),
        eq(aircraftRefueling.isDraft, false),
      ),
    });
    return !!existing;
  }

  async restoreRefueling(
    id: string,
    oldData: any,
    userId?: string,
    transaction?: any,
  ): Promise<boolean> {
    const restore = async (tx: any) => {
      // Restore the aircraft refueling record
      await tx
        .update(aircraftRefueling)
        .set({
          deletedAt: null,
          deletedById: null,
        })
        .where(eq(aircraftRefueling.id, id));

      if (oldData.equipmentTransactionId) {
        await EquipmentTransactionService.restoreTransactionAndRecalculateEquipment(
          tx,
          oldData.equipmentTransactionId,
          userId,
        );
      } else if (oldData.transactionId) {
        await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
          tx,
          oldData.transactionId,
          userId,
        );
      }
    };
    if (transaction) await restore(transaction);
    else await db.transaction(restore);

    return true;
  }

  /**
   * Restore every deal and stock movement deleted together with an order in one
   * transaction. Matching the deletion timestamp excludes products removed in
   * earlier edits of the same order.
   */
  async restoreRefuelingOrder(
    anchorId: string,
    userId?: string,
    transaction?: any,
  ): Promise<AircraftRefueling[]> {
    const restore = async (tx: any) => {
      const [anchor] = await tx
        .select()
        .from(aircraftRefueling)
        .where(eq(aircraftRefueling.id, anchorId));
      if (!anchor) throw new Error("Удалённый заказ заправки не найден");
      if (!anchor.deletedAt) {
        throw new Error("Заказ уже восстановлен или восстановлен не полностью");
      }

      const orderCondition = anchor.refuelingOrderId
        ? eq(aircraftRefueling.refuelingOrderId, anchor.refuelingOrderId)
        : eq(aircraftRefueling.id, anchor.id);
      const deals = await tx
        .select()
        .from(aircraftRefueling)
        .where(
          and(
            orderCondition,
            eq(aircraftRefueling.deletedAt, anchor.deletedAt),
          ),
        )
        .orderBy(asc(aircraftRefueling.id))
        .for("update");
      if (deals.length === 0) {
        throw new Error("Состав удалённого заказа не найден");
      }
      if (deals.some((deal: typeof aircraftRefueling.$inferSelect) => !deal.deletedAt)) {
        throw new Error("Заказ уже восстановлен или восстановлен не полностью");
      }

      // Validate every linked movement before changing any stock balance, so
      // a missing movement on a later deal is found before any recalculation.
      const movements: Array<
        | { kind: "equipment"; id: string; deletedAt: string | null }
        | { kind: "warehouse"; id: string; deletedAt: string | null }
      > = [];
      for (const deal of deals) {
        const isLiquid =
          deal.productType === PRODUCT_TYPE.KEROSENE ||
          deal.productType === PRODUCT_TYPE.PVKJ;
        if (deal.isDraft || !isLiquid) continue;

        if (deal.equipmentTransactionId) {
          const [transaction] = await tx
            .select({ deletedAt: equipmentTransactions.deletedAt })
            .from(equipmentTransactions)
            .where(eq(equipmentTransactions.id, deal.equipmentTransactionId));
          if (!transaction) {
            throw new Error(`Топливное движение ${deal.equipmentTransactionId} не найдено`);
          }
          movements.push({
            kind: "equipment",
            id: deal.equipmentTransactionId,
            deletedAt: transaction.deletedAt,
          });
        } else if (deal.transactionId) {
          const [transaction] = await tx
            .select({ deletedAt: warehouseTransactions.deletedAt })
            .from(warehouseTransactions)
            .where(eq(warehouseTransactions.id, deal.transactionId));
          if (!transaction) {
            throw new Error(`Складское движение ${deal.transactionId} не найдено`);
          }
          movements.push({
            kind: "warehouse",
            id: deal.transactionId,
            deletedAt: transaction.deletedAt,
          });
        } else if (deal.equipmentId || deal.warehouseId) {
          throw new Error(`У сделки ${deal.id} не найдено связанное топливное движение`);
        }
      }

      // Restore existing stock records rather than creating replacements, so
      // the original deal and movement identifiers remain stable.
      for (const movement of movements) {
        if (movement.deletedAt) {
          if (movement.kind === "equipment") {
            await EquipmentTransactionService.restoreTransactionAndRecalculateEquipment(
              tx,
              movement.id,
              userId,
            );
          } else {
            await WarehouseTransactionService.restoreTransactionAndRecalculateWarehouse(
              tx,
              movement.id,
              userId,
            );
          }
        }
      }

      await tx
        .update(aircraftRefueling)
        .set({ deletedAt: null, deletedById: null })
        .where(inArray(aircraftRefueling.id, deals.map((deal: typeof aircraftRefueling.$inferSelect) => deal.id)));

      return deals.map((deal: typeof aircraftRefueling.$inferSelect) => ({
        ...deal,
        deletedAt: null,
        deletedById: null,
      }));
    };

    return transaction ? restore(transaction) : db.transaction(restore);
  }

  async getAllAircraftRefuelings(): Promise<any[]> {
    const data = await db.query.aircraftRefueling.findMany({
      where: isNull(aircraftRefueling.deletedAt),
      orderBy: (aircraftRefueling, { desc }) => [
        desc(aircraftRefueling.refuelingDate),
      ],
      with: {
        basis: {
          columns: {
            id: true,
            name: true,
          },
        },
        warehouse: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return data;
  }

  /** Поиск уникальных значений по колонке для фильтра */
  async getFilterValues(column: string, q: string): Promise<{ label: string; value: string }[]> {
    const pattern = `%${q}%`;
    let results: { val: string | null }[] = [];

    if (column === "board") {
      results = await db
        .selectDistinct({ val: aircraftRefueling.aircraftNumber })
        .from(aircraftRefueling)
        .where(and(isNull(aircraftRefueling.deletedAt), ilike(aircraftRefueling.aircraftNumber, pattern)))
        .limit(20);
    } else if (column === "orderNumber") {
      results = await db
        .selectDistinct({ val: aircraftRefueling.orderNumber })
        .from(aircraftRefueling)
        .where(and(isNull(aircraftRefueling.deletedAt), ilike(aircraftRefueling.orderNumber, pattern)))
        .limit(20);
    } else if (column === "direction") {
      results = await db
        .selectDistinct({ val: aircraftRefueling.flightNumber })
        .from(aircraftRefueling)
        .where(and(isNull(aircraftRefueling.deletedAt), ilike(aircraftRefueling.flightNumber, pattern)))
        .limit(20);
    } else {
      return [];
    }

    return results
      .filter((r) => r.val)
      .map((r) => ({ label: r.val!, value: r.val! }));
  }
}
