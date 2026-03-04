import { eq, desc, sql, isNull, and, ne } from "drizzle-orm";
import { db } from "server/db";
import {
  storageCardTransactions,
  type StorageCard,
  type InsertStorageCard,
  type StorageCardTransaction,
  type InsertStorageCardTransaction,
} from "../entities/storage-cards";

import { prices, suppliers, storageCards, customers } from "@shared/schema";
import {
  COUNTERPARTY_ROLE,
  STORAGE_CARD_TRANSACTION_TYPE,
} from "@shared/constants";

export class StorageCardsStorage {
  async getAdvanceCards(cardType?: "supplier" | "buyer"): Promise<any[]> {
    const conditions: any[] = [isNull(storageCards.deletedAt)];

    if (cardType === "buyer") {
      conditions.push(sql`${storageCards.cardType} = 'buyer'`);
      conditions.push(sql`${storageCards.buyerId} IS NOT NULL`);
    } else {
      conditions.push(
        sql`(${storageCards.cardType} = 'supplier' OR ${storageCards.cardType} IS NULL)`,
      );
      conditions.push(sql`${storageCards.supplierId} IS NOT NULL`);
    }

    const cards = await db.query.storageCards.findMany({
      where: and(...conditions),
      with: {
        supplier: true,
        buyer: true,
      },
    });

    if (cardType === "buyer") {
      return cards.map((card) => ({
        ...card,
        latestPrice: null,
        kgAmount: 0,
        weightedAverageRate: parseFloat(card.weightedAverageRate || "0"),
      }));
    }

    const results = await Promise.all(
      cards.map(async (card) => {
        const latestPrice = await db.query.prices.findFirst({
          where: and(
            eq(prices.counterpartyId, card.supplierId!),
            eq(prices.counterpartyRole, COUNTERPARTY_ROLE.SUPPLIER),
            eq(prices.currency, "USD"),
            isNull(prices.deletedAt),
          ),
          orderBy: [desc(prices.dateTo)],
        });

        let pricePerKg = 0;
        if (
          latestPrice &&
          latestPrice.priceValues &&
          latestPrice.priceValues.length > 0
        ) {
          try {
            const priceObj = JSON.parse(latestPrice.priceValues[0]);
            pricePerKg = parseFloat(priceObj.price || "0");
          } catch (e) {
            console.error(
              "Error parsing price value:",
              latestPrice.priceValues[0],
            );
            pricePerKg = parseFloat(latestPrice.priceValues[0] || "0");
          }
        }

        const balance = parseFloat(card.currentBalance || "0");
        const kgAmount = pricePerKg > 0 ? balance / pricePerKg : 0;

        return {
          ...card,
          latestPrice: latestPrice
            ? {
                price: pricePerKg,
                dateTo: latestPrice.dateTo,
                isExpired: new Date(latestPrice.dateTo) < new Date(),
              }
            : null,
          kgAmount,
          weightedAverageRate: parseFloat(card.weightedAverageRate || "0"),
        };
      }),
    );

    return results;
  }

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
        isNull(storageCards.deletedAt),
      ),
    });

    if (existing) {
      throw new Error("Карта хранения с таким названием уже существует");
    }

    const [created] = await db.insert(storageCards).values(data).returning();

    return created;
  }

  async updateStorageCard(
    id: string,
    data: Partial<InsertStorageCard>,
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
    storageCardId: string,
  ): Promise<StorageCardTransaction[]> {
    return await db.query.storageCardTransactions.findMany({
      where: and(
        eq(storageCardTransactions.storageCardId, storageCardId),
        isNull(storageCardTransactions.deletedAt),
      ),
      orderBy: [desc(storageCardTransactions.transactionDate)],
      limit: 20,
    });
  }

  async createTransaction(
    data: InsertStorageCardTransaction,
  ): Promise<StorageCardTransaction> {
    const card = await this.getStorageCard(data.storageCardId);
    if (!card) {
      throw new Error("Карта хранения не найдена");
    }

    const currentBalance = parseFloat(card.currentBalance || "0");
    const currentAvgCost = parseFloat(card.averageCost || "0");
    const currentWeightedAvgRate = parseFloat(card.weightedAverageRate || "0");
    const quantity = data.quantity;
    const price = data.price || 0;

    let newBalance = currentBalance;
    let newWeightedAvgRate = currentWeightedAvgRate;

    if (data.transactionType === STORAGE_CARD_TRANSACTION_TYPE.INCOME) {
      newBalance = currentBalance + quantity;

      if (data.localCurrencyAmount && data.exchangeRateToUsd) {
        const prevLocalTotal = currentWeightedAvgRate > 0
          ? currentBalance / currentWeightedAvgRate
          : 0;
        const newLocalAmount = parseFloat(String(data.localCurrencyAmount));
        const newRate = parseFloat(String(data.exchangeRateToUsd));
        const totalLocal = prevLocalTotal + newLocalAmount;
        const prevUsdTotal = currentBalance;
        const newUsdAmount = quantity;
        const totalUsd = prevUsdTotal + newUsdAmount;
        newWeightedAvgRate = totalLocal > 0 ? totalUsd / totalLocal : 0;
      }
    } else if (data.transactionType === STORAGE_CARD_TRANSACTION_TYPE.EXPENSE) {
      newBalance = currentBalance - quantity;
    }

    return await db.transaction(async (tx) => {
      const [transaction] = await tx
        .insert(storageCardTransactions)
        .values({
          ...data,
          quantity: String(quantity),
          price: String(price),
          balanceBefore: String(currentBalance),
          balanceAfter: String(newBalance),
          averageCostBefore: String(currentAvgCost),
          averageCostAfter: String(price),
          weightedAverageRateBefore: String(currentWeightedAvgRate),
          weightedAverageRateAfter: String(newWeightedAvgRate),
          localCurrencyAmount: data.localCurrencyAmount
            ? String(data.localCurrencyAmount)
            : null,
          exchangeRateToUsd: data.exchangeRateToUsd
            ? String(data.exchangeRateToUsd)
            : null,
        } as any)
        .returning();

      const updateData: any = {
        currentBalance: String(newBalance),
        averageCost: String(price),
        updatedAt: sql`NOW()`,
        updatedById: data.createdById,
      };

      if (newWeightedAvgRate !== currentWeightedAvgRate) {
        updateData.weightedAverageRate = String(newWeightedAvgRate);
      }

      await tx
        .update(storageCards)
        .set(updateData)
        .where(eq(storageCards.id, data.storageCardId));

      return transaction;
    });
  }

  async deleteTransaction(id: string, deletedById?: string): Promise<boolean> {
    const transaction = await db.query.storageCardTransactions.findFirst({
      where: eq(storageCardTransactions.id, id),
    });

    if (!transaction) return false;

    const card = await this.getStorageCard(transaction.storageCardId);
    if (!card) return false;

    const quantity = parseFloat(transaction.quantity);
    const currentBalance = parseFloat(card.currentBalance || "0");
    let newBalance = currentBalance;

    if (transaction.transactionType === STORAGE_CARD_TRANSACTION_TYPE.INCOME) {
      newBalance = currentBalance - quantity;
    } else if (
      transaction.transactionType === STORAGE_CARD_TRANSACTION_TYPE.EXPENSE
    ) {
      newBalance = currentBalance + quantity;
    }

    const prevWeightedAvgRate = transaction.weightedAverageRateBefore
      ? parseFloat(String(transaction.weightedAverageRateBefore))
      : parseFloat(card.weightedAverageRate || "0");

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
          weightedAverageRate: String(prevWeightedAvgRate),
          updatedAt: sql`NOW()`,
        })
        .where(eq(storageCards.id, transaction.storageCardId));

      return true;
    });
  }
}
