import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import {
  storageCards,
  storageCardTransactions,
  type StorageCard,
  type InsertStorageCard,
  type StorageCardTransaction,
  type InsertStorageCardTransaction,
} from "../entities/storage-cards";

export class StorageCardsStorage {
  async getAllStorageCards(): Promise<StorageCard[]> {
    return await db.query.storageCards.findMany({
      where: isNull(storageCards.deletedAt),
      orderBy: [desc(storageCards.createdAt)],
    });
  }

  async getStorageCard(id: string): Promise<StorageCard | undefined> {
    return await db.query.storageCards.findFirst({
      where: and(eq(storageCards.id, id), isNull(storageCards.deletedAt)),
    });
  }

  async createStorageCard(data: InsertStorageCard): Promise<StorageCard> {
    const existing = await db.query.storageCards.findFirst({
      where: and(
        eq(storageCards.name, data.name),
        isNull(storageCards.deletedAt)
      ),
    });

    if (existing) {
      throw new Error("Карта хранения с таким названием уже существует");
    }

    const [created] = await db
      .insert(storageCards)
      .values(data)
      .returning();

    return created;
  }

  async updateStorageCard(
    id: string,
    data: Partial<InsertStorageCard>
  ): Promise<StorageCard | undefined> {
    const [updated] = await db
      .update(storageCards)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(storageCards.id, id))
      .returning();

    return updated;
  }

  async deleteStorageCard(id: string, deletedById?: string): Promise<boolean> {
    const [deleted] = await db
      .update(storageCards)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: deletedById || null,
      })
      .where(eq(storageCards.id, id))
      .returning();

    return !!deleted;
  }

  async getCardTransactions(
    storageCardId: string
  ): Promise<StorageCardTransaction[]> {
    return await db.query.storageCardTransactions.findMany({
      where: and(
        eq(storageCardTransactions.storageCardId, storageCardId),
        isNull(storageCardTransactions.deletedAt)
      ),
      orderBy: [desc(storageCardTransactions.createdAt)],
    });
  }

  async createTransaction(
    data: InsertStorageCardTransaction
  ): Promise<StorageCardTransaction> {
    const card = await this.getStorageCard(data.storageCardId);
    if (!card) {
      throw new Error("Карта хранения не найдена");
    }

    const currentBalance = parseFloat(card.currentBalance || "0");
    const currentAvgCost = parseFloat(card.averageCost || "0");
    const quantity = data.quantity;
    const price = data.price || 0;
    const sum = data.sum || quantity * price;

    let newBalance = currentBalance;
    let newAvgCost = currentAvgCost;

    if (data.transactionType === "income") {
      newBalance = currentBalance + quantity;
      if (newBalance > 0 && price > 0) {
        newAvgCost =
          (currentBalance * currentAvgCost + quantity * price) / newBalance;
      }
    } else if (data.transactionType === "expense") {
      newBalance = currentBalance - quantity;
    } else if (data.transactionType === "adjustment") {
      newBalance = currentBalance + quantity;
    }

    return await db.transaction(async (tx) => {
      const [transaction] = await tx
        .insert(storageCardTransactions)
        .values({
          ...data,
          quantity: String(quantity),
          price: price ? String(price) : null,
          sum: sum ? String(sum) : null,
          balanceBefore: String(currentBalance),
          balanceAfter: String(newBalance),
          averageCostBefore: String(currentAvgCost),
          averageCostAfter: String(newAvgCost),
        })
        .returning();

      await tx
        .update(storageCards)
        .set({
          currentBalance: String(newBalance),
          averageCost: String(newAvgCost),
          updatedAt: sql`NOW()`,
        })
        .where(eq(storageCards.id, data.storageCardId));

      return transaction;
    });
  }

  async deleteTransaction(
    id: string,
    deletedById?: string
  ): Promise<boolean> {
    const transaction = await db.query.storageCardTransactions.findFirst({
      where: eq(storageCardTransactions.id, id),
    });

    if (!transaction) return false;

    const card = await this.getStorageCard(transaction.storageCardId);
    if (!card) return false;

    const quantity = parseFloat(transaction.quantity);
    const currentBalance = parseFloat(card.currentBalance || "0");
    let newBalance = currentBalance;

    if (transaction.transactionType === "income") {
      newBalance = currentBalance - quantity;
    } else if (transaction.transactionType === "expense") {
      newBalance = currentBalance + quantity;
    } else if (transaction.transactionType === "adjustment") {
      newBalance = currentBalance - quantity;
    }

    return await db.transaction(async (tx) => {
      await tx
        .update(storageCardTransactions)
        .set({
          deletedAt: sql`NOW()`,
          deletedById: deletedById || null,
        })
        .where(eq(storageCardTransactions.id, id));

      await tx
        .update(storageCards)
        .set({
          currentBalance: String(newBalance),
          updatedAt: sql`NOW()`,
        })
        .where(eq(storageCards.id, transaction.storageCardId));

      return true;
    });
  }
}
