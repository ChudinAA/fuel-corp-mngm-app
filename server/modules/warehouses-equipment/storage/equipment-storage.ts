import { eq, and } from "drizzle-orm";
import { db } from "../../../db";
import { equipments, equipmentTransactions, warehousesEquipment, type Equipment, type InsertEquipment, type EquipmentTransaction, type InsertEquipmentTransaction } from "../entities/equipment";

export class EquipmentStorage {
  async getEquipments(): Promise<Equipment[]> {
    return await db.select().from(equipments);
  }

  async getEquipment(id: string): Promise<Equipment | undefined> {
    const [equipment] = await db.select().from(equipments).where(eq(equipments.id, id));
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

  async deleteEquipment(id: string): Promise<boolean> {
    await db.delete(equipments).where(eq(equipments.id, id));
    return true;
  }

  async createTransaction(data: InsertEquipmentTransaction): Promise<EquipmentTransaction> {
    const [transaction] = await db.insert(equipmentTransactions).values(data).returning();
    return transaction;
  }

  async getTransactions(equipmentId: string): Promise<EquipmentTransaction[]> {
    return await db.select().from(equipmentTransactions).where(eq(equipmentTransactions.equipmentId, equipmentId));
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
