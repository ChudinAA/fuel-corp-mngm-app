import { eq, and, isNull } from "drizzle-orm";
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
    const [equipment] = await db.insert(equipments).values(data).returning();
    return equipment;
  }

  async updateEquipment(id: string, data: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const [equipment] = await db.update(equipments).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(equipments.id, id)).returning();
    return equipment;
  }

  async deleteEquipment(id: string, deletedById: string): Promise<boolean> {
    await db.update(equipments)
      .set({
        deletedAt: new Date().toISOString(),
        deletedById
      })
      .where(eq(equipments.id, id));
    return true;
  }

  async createTransaction(data: InsertEquipmentTransaction): Promise<EquipmentTransaction> {
    const [transaction] = await db.insert(equipmentTransactions).values(data).returning();
    return transaction;
  }

  async getTransactions(equipmentId: string): Promise<EquipmentTransaction[]> {
    return await db.select()
      .from(equipmentTransactions)
      .where(
        and(
          eq(equipmentTransactions.equipmentId, equipmentId),
          isNull(equipmentTransactions.deletedAt)
        )
      );
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
}

export const equipmentStorage = new EquipmentStorage();
