import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { db } from "../../../db";
import { equipments, equipmentTransactions, warehousesEquipment, type Equipment, type InsertEquipment, type EquipmentTransaction, type InsertEquipmentTransaction } from "../entities/equipment";

export class EquipmentStorage {
  async getEquipments(): Promise<Equipment[]> {
    return await db.select().from(equipments).where(isNull(equipments.deletedAt));
  }

  async getEquipment(id: string): Promise<Equipment | undefined> {
    const [equipment] = await db.select().from(equipments).where(and(eq(equipments.id, id), isNull(equipments.deletedAt)));
    return equipment;
  }

  async createEquipment(data: InsertEquipment): Promise<Equipment> {
    // Check for duplicates
    const existing = await db.query.equipments.findFirst({
      where: and(
        eq(equipments.name, data.name),
        isNull(equipments.deletedAt),
      ),
    });

    if (existing) {
      throw new Error("Такая запись уже существует");
    }
    
    const [equipment] = await db.insert(equipments).values(data).returning();
    return equipment;
  }

  async updateEquipment(id: string, data: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const [equipment] = await db.update(equipments).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(equipments.id, id)).returning();
    return equipment;
  }

  async deleteEquipment(id: string, deletedById: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Soft delete equipment
      await tx.update(equipments)
        .set({
          deletedAt: new Date().toISOString(),
          deletedById
        })
        .where(eq(equipments.id, id));

      // Soft delete linked relations
      await tx.update(warehousesEquipment)
        .set({
          deletedAt: new Date().toISOString(),
          deletedById
        })
        .where(eq(warehousesEquipment.equipmentId, id));

      return true;
    });
  }

  async restoreEquipment(id: string, restoredById: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      // Restore equipment
      await tx.update(equipments)
        .set({
          deletedAt: null,
          deletedById: null,
          updatedById: restoredById,
          updatedAt: new Date().toISOString()
        })
        .where(eq(equipments.id, id));

      // Restore linked relations
      await tx.update(warehousesEquipment)
        .set({
          deletedAt: null,
          deletedById: null
        })
        .where(eq(warehousesEquipment.equipmentId, id));

      return true;
    });
  }

  async createTransaction(data: InsertEquipmentTransaction): Promise<EquipmentTransaction> {
    const [transaction] = await db.insert(equipmentTransactions).values(data).returning();
    return transaction;
  }

  async getTransactions(equipmentId: string, limit: number = 25, offset: number = 0): Promise<{ transactions: EquipmentTransaction[], hasMore: boolean }> {
    const transactions = await db.select()
      .from(equipmentTransactions)
      .where(
        and(
          eq(equipmentTransactions.equipmentId, equipmentId),
          isNull(equipmentTransactions.deletedAt)
        )
      )
      .orderBy(sql`${equipmentTransactions.transactionDate} DESC`, sql`${equipmentTransactions.id} DESC`)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = transactions.length > limit;
    return {
      transactions: transactions.slice(0, limit),
      hasMore
    };
  }

  async getEquipmentBalanceAtDate(
    equipmentId: string,
    date: Date,
    productType: string,
  ): Promise<{ balance: string; averageCost: string }> {
    const dateStr = date.toISOString().split("T")[0];

    const [lastTransaction] = await db
      .select()
      .from(equipmentTransactions)
      .where(
        and(
          eq(equipmentTransactions.equipmentId, equipmentId),
          eq(equipmentTransactions.productType, productType),
          sql`CAST(${equipmentTransactions.transactionDate} AS DATE) <= CAST(${dateStr} AS DATE)`,
          isNull(equipmentTransactions.deletedAt),
        ),
      )
      .orderBy(
        desc(equipmentTransactions.transactionDate),
        desc(equipmentTransactions.createdAt),
        desc(equipmentTransactions.id),
      )
      .limit(1);

    return {
      balance: lastTransaction?.balanceAfter || "0",
      averageCost: lastTransaction?.averageCostAfter || "0",
    };
  }

  async linkToWarehouse(warehouseId: string, equipmentId: string): Promise<void> {
    await db.insert(warehousesEquipment).values({ warehouseId, equipmentId });
  }

  async unlinkFromWarehouse(warehouseId: string, equipmentId: string): Promise<void> {
    await db.delete(warehousesEquipment)
      .where(
        and(
          eq(warehousesEquipment.warehouseId, warehouseId),
          eq(warehousesEquipment.equipmentId, equipmentId)
        )
      );
  }

  async getEquipmentsByWarehouse(warehouseId: string): Promise<Equipment[]> {
    const results = await db
      .select({
        equipment: equipments,
      })
      .from(equipments)
      .innerJoin(
        warehousesEquipment,
        eq(equipments.id, warehousesEquipment.equipmentId)
      )
      .where(
        and(
          eq(warehousesEquipment.warehouseId, warehouseId),
          isNull(equipments.deletedAt),
          isNull(warehousesEquipment.deletedAt)
        )
      );
    
    return results.map(r => r.equipment);
  }
}

export const equipmentStorage = new EquipmentStorage();
