import { eq, desc, sql, isNull, and, or } from "drizzle-orm";
import { db } from "server/db";
import {
  storageCardTransactions,
  type StorageCard,
  type InsertStorageCard,
  type StorageCardTransaction,
  type InsertStorageCardTransaction,
} from "../entities/storage-cards";

import { prices, suppliers, storageCards, customers, currencies } from "@shared/schema";
import {
  COUNTERPARTY_ROLE,
  STORAGE_CARD_TRANSACTION_TYPE,
} from "@shared/constants";

export class StorageCardsStorage {
  async getAdvanceCards(cardType?: "supplier" | "buyer"): Promise<any[]> {
    const conditions: any[] = [isNull(storageCards.deletedAt)];

    if (cardType === "buyer") {
      conditions.push(sql`${storageCards.cardType} = 'buyer'`);
    } else {
      conditions.push(
        or(
          sql`${storageCards.cardType} = 'supplier'`,
          sql`${storageCards.cardType} IS NULL`,
        ),
      );
    }

    const cards = await db.query.storageCards.findMany({
      where: and(...conditions),
      with: {
        supplier: true,
        buyer: true,
      },
    });

    if (cardType === "buyer") {
      return cards.map((card) => {
        const usdBalance = parseFloat(card.currentBalance || "0");
        const rate = parseFloat(card.weightedAverageRate || "0");
        const localBalance = rate > 0 ? usdBalance * rate : null;

        return {
          ...card,
          latestPrice: null,
          kgAmount: 0,
          weightedAverageRate: rate,
          localCurrencyBalance: localBalance,
        };
      });
    }

    const results = await Promise.all(
      cards.map(async (card) => {
        if (!card.supplierId) {
          return {
            ...card,
            latestPrice: null,
            kgAmount: 0,
            weightedAverageRate: parseFloat(card.weightedAverageRate || "0"),
          };
        }

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

  async getCardByCounterparty(params: {
    supplierId?: string;
    buyerId?: string;
    excludeId?: string;
  }): Promise<StorageCard | undefined> {
    if (!params.supplierId && !params.buyerId) return undefined;

    let condition: any;
    if (params.supplierId) {
      condition = eq(storageCards.supplierId, params.supplierId);
    } else {
      condition = eq(storageCards.buyerId, params.buyerId!);
    }

    const found = await db.query.storageCards.findFirst({
      where: and(condition, isNull(storageCards.deletedAt)),
    });

    if (!found) return undefined;
    if (params.excludeId && found.id === params.excludeId) return undefined;
    return found;
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
      limit: 50,
      with: {
        localCurrency: true,
      },
    } as any);
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
    // weightedAverageRate = local units per 1 USD
    const currentWeightedAvgRate = parseFloat(card.weightedAverageRate || "0");
    const quantity = data.quantity;
    const price = data.price || 0;

    let newBalance = currentBalance;
    let newWeightedAvgRate = currentWeightedAvgRate;

    if (data.transactionType === STORAGE_CARD_TRANSACTION_TYPE.INCOME) {
      newBalance = currentBalance + quantity;

      if (data.localCurrencyAmount && data.exchangeRateToUsd) {
        // exchangeRateToUsd = local units per 1 USD (e.g., 90 RUB per 1 USD)
        // usdAmount = localAmount / rate (quantity is already the USD amount)
        const newLocalAmount = parseFloat(String(data.localCurrencyAmount));
        // prevLocalAmount = prevUsdBalance * weightedAverageRate
        const prevLocalTotal = currentBalance * currentWeightedAvgRate;
        const prevUsdTotal = currentBalance;
        const totalLocal = prevLocalTotal + newLocalAmount;
        const totalUsd = prevUsdTotal + quantity; // quantity is USD amount
        newWeightedAvgRate = totalUsd > 0 ? totalLocal / totalUsd : 0;
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
        weightedAverageRate: String(newWeightedAvgRate),
      };

      // Save local currency info to card on first local-currency deposit
      if (
        data.transactionType === STORAGE_CARD_TRANSACTION_TYPE.INCOME &&
        data.localCurrencyId &&
        !card.localCurrencyCode
      ) {
        const currency = await tx.query.currencies.findFirst({
          where: eq(currencies.id, data.localCurrencyId),
        });
        if (currency) {
          updateData.localCurrencyCode = currency.code;
          updateData.localCurrencySymbol = currency.symbol;
        }
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

    // Restore balance using balanceBefore from the transaction (accurate rollback)
    const restoredBalance = transaction.balanceBefore
      ? parseFloat(String(transaction.balanceBefore))
      : (() => {
          const quantity = parseFloat(transaction.quantity);
          const currentBalance = parseFloat(card.currentBalance || "0");
          if (
            transaction.transactionType ===
            STORAGE_CARD_TRANSACTION_TYPE.INCOME
          ) {
            return currentBalance - quantity;
          } else {
            return currentBalance + quantity;
          }
        })();

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
          currentBalance: String(restoredBalance),
          weightedAverageRate: String(prevWeightedAvgRate),
          updatedAt: sql`NOW()`,
        })
        .where(eq(storageCards.id, transaction.storageCardId));

      return true;
    });
  }
}
