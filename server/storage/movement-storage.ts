
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  movement,
  warehouses,
  warehouseTransactions,
  type Movement,
  type InsertMovement,
} from "@shared/schema";
import { IMovementStorage } from "./types";
import { PRODUCT_TYPE, MOVEMENT_TYPE, TRANSACTION_TYPE, SOURCE_TYPE } from "@shared/constants";

export class MovementStorage implements IMovementStorage {
  async getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const data = await db.query.movement.findMany({
      limit: pageSize,
      offset: offset,
      orderBy: (movement, { desc }) => [desc(movement.movementDate)],
      with: {
        supplier: {
          columns: {
            id: true,
            name: true,
          }
        },
        fromWarehouse: {
          columns: {
            id: true,
            name: true,
          }
        },
        toWarehouse: {
          columns: {
            id: true,
            name: true,
          }
        },
        carrier: {
          columns: {
            id: true,
            name: true,
          }
        },
      },
    });

    const enrichedData = data.map((mov) => ({
      ...mov,
      fromName: mov.movementType === MOVEMENT_TYPE.SUPPLY && mov.supplier 
        ? mov.supplier.name 
        : mov.fromWarehouse?.name || null,
      toName: mov.toWarehouse?.name || mov.toWarehouseId,
      carrierName: mov.carrier?.name || null,
    }));

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(movement);
    return { data: enrichedData, total: Number(countResult?.count || 0) };
  }

  async createMovement(data: InsertMovement): Promise<Movement> {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(movement).values(data).returning();

      const quantityKg = parseFloat(created.quantityKg);
      const isPvkj = created.productType === PRODUCT_TYPE.PVKJ;

      // Обработка склада назначения
      if (created.toWarehouseId) {
        const targetWarehouse = await tx.query.warehouses.findFirst({
          where: eq(warehouses.id, created.toWarehouseId),
        });

        if (targetWarehouse) {
          const totalCost = parseFloat(created.totalCost || "0");

          if (isPvkj) {
            const currentBalance = parseFloat(targetWarehouse.pvkjBalance || "0");
            const currentCost = parseFloat(targetWarehouse.pvkjAverageCost || "0");
            const newBalance = currentBalance + quantityKg;
            const newAverageCost = newBalance > 0
              ? ((currentBalance * currentCost) + totalCost) / newBalance
              : 0;

            await tx.update(warehouses)
              .set({
                pvkjBalance: newBalance.toFixed(2),
                pvkjAverageCost: newAverageCost.toFixed(4),
                updatedAt: sql`NOW()`,
                updatedById: data.createdById,
              })
              .where(eq(warehouses.id, created.toWarehouseId));

            await tx.insert(warehouseTransactions).values({
              warehouseId: created.toWarehouseId,
              transactionType: created.movementType === MOVEMENT_TYPE.SUPPLY ? TRANSACTION_TYPE.RECEIPT : TRANSACTION_TYPE.TRANSFER_IN,
              productType: PRODUCT_TYPE.PVKJ,
              sourceType: SOURCE_TYPE.MOVEMENT,
              sourceId: created.id,
              quantity: quantityKg.toString(),
              balanceBefore: currentBalance.toString(),
              balanceAfter: newBalance.toString(),
              averageCostBefore: currentCost.toString(),
              averageCostAfter: newAverageCost.toString(),
              createdById: data.createdById,
            });
          } else {
            const currentBalance = parseFloat(targetWarehouse.currentBalance || "0");
            const currentCost = parseFloat(targetWarehouse.averageCost || "0");
            const newBalance = currentBalance + quantityKg;
            const newAverageCost = newBalance > 0
              ? ((currentBalance * currentCost) + totalCost) / newBalance
              : 0;

            await tx.update(warehouses)
              .set({
                currentBalance: newBalance.toFixed(2),
                averageCost: newAverageCost.toFixed(4),
                updatedAt: sql`NOW()`,
                updatedById: data.createdById,
              })
              .where(eq(warehouses.id, created.toWarehouseId));

            await tx.insert(warehouseTransactions).values({
              warehouseId: created.toWarehouseId,
              transactionType: created.movementType === MOVEMENT_TYPE.SUPPLY ? TRANSACTION_TYPE.RECEIPT : TRANSACTION_TYPE.TRANSFER_IN,
              productType: PRODUCT_TYPE.KEROSENE,
              sourceType: SOURCE_TYPE.MOVEMENT,
              sourceId: created.id,
              quantity: quantityKg.toString(),
              balanceBefore: currentBalance.toString(),
              balanceAfter: newBalance.toString(),
              averageCostBefore: currentCost.toString(),
              averageCostAfter: newAverageCost.toString(),
              createdById: data.createdById,
            });
          }
        }
      }

      // Обработка склада-источника для внутреннего перемещения
      if (created.movementType === MOVEMENT_TYPE.INTERNAL && created.fromWarehouseId) {
        const sourceWarehouse = await tx.query.warehouses.findFirst({
          where: eq(warehouses.id, created.fromWarehouseId),
        });

        if (sourceWarehouse) {
          if (isPvkj) {
            const currentBalance = parseFloat(sourceWarehouse.pvkjBalance || "0");
            const currentCost = parseFloat(sourceWarehouse.pvkjAverageCost || "0");
            const newBalance = Math.max(0, currentBalance - quantityKg);

            await tx.update(warehouses)
              .set({
                pvkjBalance: newBalance.toFixed(2),
                updatedAt: sql`NOW()`,
                updatedById: data.createdById
              })
              .where(eq(warehouses.id, created.fromWarehouseId));

            await tx.insert(warehouseTransactions).values({
              warehouseId: created.fromWarehouseId,
              transactionType: TRANSACTION_TYPE.TRANSFER_OUT,
              productType: PRODUCT_TYPE.PVKJ,
              sourceType: SOURCE_TYPE.MOVEMENT,
              sourceId: created.id,
              quantity: (-quantityKg).toString(),
              balanceBefore: currentBalance.toString(),
              balanceAfter: newBalance.toString(),
              averageCostBefore: currentCost.toString(),
              averageCostAfter: currentCost.toString(),
              createdById: data.createdById
            });
          } else {
            const currentBalance = parseFloat(sourceWarehouse.currentBalance || "0");
            const currentCost = parseFloat(sourceWarehouse.averageCost || "0");
            const newBalance = Math.max(0, currentBalance - quantityKg);

            await tx.update(warehouses)
              .set({
                currentBalance: newBalance.toFixed(2),
                updatedAt: sql`NOW()`,
                updatedById: data.createdById
              })
              .where(eq(warehouses.id, created.fromWarehouseId));

            await tx.insert(warehouseTransactions).values({
              warehouseId: created.fromWarehouseId,
              transactionType: TRANSACTION_TYPE.TRANSFER_OUT,
              productType: PRODUCT_TYPE.KEROSENE,
              sourceType: SOURCE_TYPE.MOVEMENT,
              sourceId: created.id,
              quantity: (-quantityKg).toString(),
              balanceBefore: currentBalance.toString(),
              balanceAfter: newBalance.toString(),
              averageCostBefore: currentCost.toString(),
              averageCostAfter: currentCost.toString(),
              createdById: data.createdById
            });
          }
        }
      }

      return created;
    });
  }

  async updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    const [updated] = await db.update(movement).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(movement.id, id)).returning();
    return updated;
  }

  async deleteMovement(id: string): Promise<boolean> {
    await db.delete(movement).where(eq(movement.id, id));
    return true;
  }
}
