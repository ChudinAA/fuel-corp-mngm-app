
import { eq, sql, and, isNull } from "drizzle-orm";
import { db } from "server/db";
import { deliveryCost } from "@shared/schema";
import type { InsertDeliveryCost, DeliveryCost } from "@shared/schema";
import { IDeliveryStorage } from "./types";

export class DeliveryStorage implements IDeliveryStorage {
  async getAllDeliveryCosts(): Promise<DeliveryCost[]> {
    const costs = await db
      .select()
      .from(deliveryCost)
      .where(isNull(deliveryCost.deletedAt));
    return costs;
  }

  async getDeliveryCost(id: string): Promise<DeliveryCost | undefined> {
    const [cost] = await db
      .select()
      .from(deliveryCost)
      .where(and(eq(deliveryCost.id, id), isNull(deliveryCost.deletedAt)))
      .limit(1);
    return cost;
  }

  async createDeliveryCost(
    data: InsertDeliveryCost,
    userId?: string
  ): Promise<DeliveryCost> {
    // Check for duplicates
    const existing = await db
      .select()
      .from(deliveryCost)
      .where(and(
        eq(deliveryCost.carrierId, data.carrierId),
        eq(deliveryCost.fromEntityType, data.fromEntityType),
        eq(deliveryCost.fromEntityId, data.fromEntityId),
        eq(deliveryCost.toEntityType, data.toEntityType),
        eq(deliveryCost.toEntityId, data.toEntityId),
        isNull(deliveryCost.deletedAt)
      ))
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Такая запись уже существует");
    }

    const [created] = await db
      .insert(deliveryCost)
      .values({
        carrierId: data.carrierId,
        fromEntityType: data.fromEntityType,
        fromEntityId: data.fromEntityId,
        fromLocation: data.fromLocation,
        toEntityType: data.toEntityType,
        toEntityId: data.toEntityId,
        toLocation: data.toLocation,
        costPerKg: data.costPerKg,
        distance: data.distance || null,
        createdById: userId,
      })
      .returning();

    return created;
  }

  async updateDeliveryCost(
    id: string,
    data: Partial<InsertDeliveryCost>,
    userId?: string
  ): Promise<DeliveryCost | undefined> {
    const updateFields: Record<string, any> = {};
    if (data.carrierId !== undefined) updateFields.carrierId = data.carrierId;
    if (data.fromEntityType !== undefined) updateFields.fromEntityType = data.fromEntityType;
    if (data.fromEntityId !== undefined) updateFields.fromEntityId = data.fromEntityId;
    if (data.fromLocation !== undefined) updateFields.fromLocation = data.fromLocation;
    if (data.toEntityType !== undefined) updateFields.toEntityType = data.toEntityType;
    if (data.toEntityId !== undefined) updateFields.toEntityId = data.toEntityId;
    if (data.toLocation !== undefined) updateFields.toLocation = data.toLocation;
    if (data.costPerKg !== undefined) updateFields.costPerKg = data.costPerKg !== null ? String(data.costPerKg) : null;
    if (data.distance !== undefined) updateFields.distance = data.distance !== null ? String(data.distance) : null;
    if (data.isActive !== undefined) updateFields.isActive = data.isActive;

    const [updated] = await db
      .update(deliveryCost)
      .set({
        ...updateFields,
        updatedAt: sql`NOW()`,
        updatedById: userId,
      })
      .where(eq(deliveryCost.id, id))
      .returning();

    return updated;
  }

  async deleteDeliveryCost(id: string, userId?: string): Promise<boolean> {
    await db
      .update(deliveryCost)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(deliveryCost.id, id));
    
    return true;
  }

  async restoreDeliveryCost(id: string, userId?: string): Promise<boolean> {
    await db
      .update(deliveryCost)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(deliveryCost.id, id));
    
    return true;
  }
}
