import { db } from "../../../db";
import { equipmentMovement, type EquipmentMovement, type InsertEquipmentMovement } from "../entities/equipment-movement";
import { eq, and, isNull, desc, or, ilike, sql } from "drizzle-orm";
import { TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";
import { EquipmentTransactionService } from "../../warehouses-equipment/services/equipment-transaction-service";

export class EquipmentMovementStorage {
  async getMovements(offset: number, pageSize: number, search?: string, filters?: Record<string, string[]>) {
    let query = db.select().from(equipmentMovement).where(isNull(equipmentMovement.deletedAt));

    if (search) {
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
    
    const totalCount = Number(totalResult?.count || 0);

    return { items, total: totalCount };
  }

  async getMovement(id: string): Promise<EquipmentMovement | undefined> {
    const [item] = await db.select().from(equipmentMovement).where(and(eq(equipmentMovement.id, id), isNull(equipmentMovement.deletedAt)));
    return item;
  }

  async createMovement(data: any): Promise<EquipmentMovement> {
    return await db.transaction(async (tx) => {
      const [item] = await tx.insert(equipmentMovement).values(data).returning();

      if (data.isDraft) {
        return item;
      }

      const quantityKg = parseFloat(item.quantityKg || "0");
      const totalCost = parseFloat(item.totalCost || "0");

      // Destination equipment (income)
      if (item.toEquipmentId) {
        const transaction = await EquipmentTransactionService.createTransactionAndUpdateEquipment(
          tx,
          item.toEquipmentId,
          TRANSACTION_TYPE.TRANSFER_IN,
          item.productType,
          SOURCE_TYPE.MOVEMENT,
          item.id,
          quantityKg,
          totalCost,
          item.createdById || undefined,
          item.movementDate
        );

        await tx.update(equipmentMovement)
          .set({ transactionId: transaction.id })
          .where(eq(equipmentMovement.id, item.id));
      }

      // Source equipment (expense)
      if (item.fromEquipmentId) {
        const sourceTransaction = await EquipmentTransactionService.createTransactionAndUpdateEquipment(
          tx,
          item.fromEquipmentId,
          TRANSACTION_TYPE.TRANSFER_OUT,
          item.productType,
          SOURCE_TYPE.MOVEMENT,
          item.id,
          quantityKg,
          0,
          item.createdById || undefined,
          item.movementDate
        );

        await tx.update(equipmentMovement)
          .set({ sourceTransactionId: sourceTransaction.id })
          .where(eq(equipmentMovement.id, item.id));
      }

      return item;
    });
  }

  async updateMovement(id: string, data: any): Promise<EquipmentMovement | undefined> {
    return await db.transaction(async (tx) => {
      const current = await this.getMovement(id);
      if (!current) throw new Error("Запись не найдена");

      const transitioningFromDraft = current.isDraft && data.isDraft === false;
      const [updated] = await tx.update(equipmentMovement)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(equipmentMovement.id, id))
        .returning();

      if (transitioningFromDraft) {
        const quantityKg = parseFloat(updated.quantityKg || "0");
        const totalCost = parseFloat(updated.totalCost || "0");

        if (updated.toEquipmentId) {
          const transaction = await EquipmentTransactionService.createTransactionAndUpdateEquipment(
            tx,
            updated.toEquipmentId,
            TRANSACTION_TYPE.TRANSFER_IN,
            updated.productType,
            SOURCE_TYPE.MOVEMENT,
            updated.id,
            quantityKg,
            totalCost,
            updated.updatedById || undefined,
            updated.movementDate
          );
          await tx.update(equipmentMovement).set({ transactionId: transaction.id }).where(eq(equipmentMovement.id, id));
        }

        if (updated.fromEquipmentId) {
          const sourceTransaction = await EquipmentTransactionService.createTransactionAndUpdateEquipment(
            tx,
            updated.fromEquipmentId,
            TRANSACTION_TYPE.TRANSFER_OUT,
            updated.productType,
            SOURCE_TYPE.MOVEMENT,
            updated.id,
            quantityKg,
            0,
            updated.updatedById || undefined,
            updated.movementDate
          );
          await tx.update(equipmentMovement).set({ sourceTransactionId: sourceTransaction.id }).where(eq(equipmentMovement.id, id));
        }
      } else if (!updated.isDraft) {
        // Logic for updating existing transactions if quantity/cost changed
        const oldQty = parseFloat(current.quantityKg || "0");
        const newQty = parseFloat(updated.quantityKg || "0");
        const oldCost = parseFloat(current.totalCost || "0");
        const newCost = parseFloat(updated.totalCost || "0");

        if (oldQty !== newQty || oldCost !== newCost) {
          if (updated.transactionId && updated.toEquipmentId) {
            await EquipmentTransactionService.updateTransactionAndRecalculateEquipment(
              tx,
              updated.transactionId,
              updated.toEquipmentId,
              oldQty,
              oldCost,
              newQty,
              newCost,
              updated.productType,
              updated.updatedById || undefined,
              updated.movementDate
            );
          }
          if (updated.sourceTransactionId && updated.fromEquipmentId) {
            await EquipmentTransactionService.updateTransactionAndRecalculateEquipment(
              tx,
              updated.sourceTransactionId,
              updated.fromEquipmentId,
              oldQty,
              0,
              newQty,
              0,
              updated.productType,
              updated.updatedById || undefined,
              updated.movementDate
            );
          }
        }
      }

      return updated;
    });
  }

  async deleteMovement(id: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const current = await this.getMovement(id);
      if (!current) return;

      if (current.transactionId) {
        await EquipmentTransactionService.deleteTransactionAndRevertEquipment(tx, current.transactionId, userId);
      }
      if (current.sourceTransactionId) {
        await EquipmentTransactionService.deleteTransactionAndRevertEquipment(tx, current.sourceTransactionId, userId);
      }

      await tx.update(equipmentMovement)
        .set({ deletedAt: new Date().toISOString(), deletedById: userId })
        .where(eq(equipmentMovement.id, id));
    });
  }

  async restoreMovement(id: string, oldData: any, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(equipmentMovement)
        .set({ deletedAt: null, deletedById: null })
        .where(eq(equipmentMovement.id, id));

      if (oldData.transactionId) {
        await EquipmentTransactionService.restoreTransactionAndRecalculateEquipment(tx, oldData.transactionId, userId);
      }
      if (oldData.sourceTransactionId) {
        await EquipmentTransactionService.restoreTransactionAndRecalculateEquipment(tx, oldData.sourceTransactionId, userId);
      }
    });
  }
}
