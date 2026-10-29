
import { eq, sql, and, isNull, getTableColumns } from "drizzle-orm";
import { db } from "server/db";
import { deliveryCost } from "@shared/schema";
import type { InsertDeliveryCost, DeliveryCost } from "@shared/schema";
import { IDeliveryStorage } from "./types";
import { counterpartyContracts } from "../../catalogs/entities/contracts";

export class DeliveryStorage implements IDeliveryStorage {
  async getAllDeliveryCosts(): Promise<DeliveryCost[]> {
    const costs = await db
      .select({
        ...getTableColumns(deliveryCost),
        contractNumber: counterpartyContracts.contractNumber,
        contractName: counterpartyContracts.contractName,
        contractDate: counterpartyContracts.contractDate,
        parentContractId: counterpartyContracts.parentContractId,
      })
      .from(deliveryCost)
      .leftJoin(counterpartyContracts, eq(deliveryCost.contractId, counterpartyContracts.id))
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
        contractId: data.contractId || null,
        fromEntityType: data.fromEntityType,
        fromEntityId: data.fromEntityId,
        fromLocation: data.fromLocation,
        toEntityType: data.toEntityType,
        toEntityId: data.toEntityId,
        toLocation: data.toLocation,
        costPerTonne: String(data.costPerTonne),
        distance: data.distance || null,
        transitDays: data.transitDays != null ? Number(data.transitDays) : null,
        priority: data.priority != null ? Number(data.priority) : null,
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
    if (data.contractId !== undefined) updateFields.contractId = data.contractId || null;
    if (data.fromEntityType !== undefined) updateFields.fromEntityType = data.fromEntityType;
    if (data.fromEntityId !== undefined) updateFields.fromEntityId = data.fromEntityId;
    if (data.fromLocation !== undefined) updateFields.fromLocation = data.fromLocation;
    if (data.toEntityType !== undefined) updateFields.toEntityType = data.toEntityType;
    if (data.toEntityId !== undefined) updateFields.toEntityId = data.toEntityId;
    if (data.toLocation !== undefined) updateFields.toLocation = data.toLocation;
    if (data.costPerTonne !== undefined) updateFields.costPerTonne = (data.costPerTonne !== null && data.costPerTonne !== "") ? String(data.costPerTonne) : null;
    if (data.distance !== undefined) updateFields.distance = (data.distance !== null && data.distance !== "") ? String(data.distance) : null;
    if (data.isActive !== undefined) updateFields.isActive = data.isActive;
    if (data.transitDays !== undefined) updateFields.transitDays = data.transitDays != null ? Number(data.transitDays) : null;
    if (data.priority !== undefined) updateFields.priority = data.priority != null ? Number(data.priority) : null;

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

  async restoreDeliveryCost(id: string, userId?: string, transaction: any = db): Promise<boolean> {
    await transaction
      .update(deliveryCost)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(deliveryCost.id, id));
    
    return true;
  }
}
