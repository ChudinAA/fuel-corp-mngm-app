import { db } from "../../../db";
import { equipmentMovement, type EquipmentMovement, type InsertEquipmentMovement } from "../entities/equipment-movement";
import { eq, and, isNull, desc, or, ilike } from "drizzle-orm";

export class EquipmentMovementStorage {
  async getMovements(offset: number, pageSize: number, search?: string, filters?: Record<string, string[]>) {
    let query = db.select().from(equipmentMovement).where(isNull(equipmentMovement.deletedAt));

    if (search) {
      // Simple search implementation
      query = query.where(ilike(equipmentMovement.notes, `%${search}%`));
    }

    const items = await db.select()
      .from(equipmentMovement)
      .where(isNull(equipmentMovement.deletedAt))
      .limit(pageSize)
      .offset(offset)
      .orderBy(desc(equipmentMovement.movementDate));

    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(equipmentMovement)
      .where(isNull(equipmentMovement.deletedAt));
    
    const total = Number(totalResult?.count || 0);

    return { items, total };
  }

  async getMovement(id: string): Promise<EquipmentMovement | undefined> {
    const [item] = await db.select().from(equipmentMovement).where(and(eq(equipmentMovement.id, id), isNull(equipmentMovement.deletedAt)));
    return item;
  }

  async createMovement(data: any): Promise<EquipmentMovement> {
    const [item] = await db.insert(equipmentMovement).values(data).returning();
    return item;
  }

  async updateMovement(id: string, data: any): Promise<EquipmentMovement | undefined> {
    const [item] = await db.update(equipmentMovement)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(equipmentMovement.id, id))
      .returning();
    return item;
  }

  async deleteMovement(id: string, userId: string): Promise<void> {
    await db.update(equipmentMovement)
      .set({ deletedAt: new Date().toISOString(), deletedById: userId })
      .where(eq(equipmentMovement.id, id));
  }
}

import { sql } from "drizzle-orm";
