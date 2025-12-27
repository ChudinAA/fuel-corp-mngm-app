
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
    const [updated] = await db
      .update(deliveryCost)
      .set({
        ...data,
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
}
