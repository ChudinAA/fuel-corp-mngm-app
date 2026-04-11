import { eq, desc, isNull, and, sql } from "drizzle-orm";
import { db } from "server/db";
import {
  exchangeAdvanceCards,
  exchangeAdvanceTransactions,
  type ExchangeAdvanceCard,
  type InsertExchangeAdvanceCard,
  type ExchangeAdvanceTransaction,
  type InsertExchangeAdvanceTransaction,
} from "../entities/exchange-advances";
import { suppliers } from "../../suppliers/entities/suppliers";

export class ExchangeAdvancesStorage {
  // ===== CARDS =====

  async getAllCards(): Promise<any[]> {
    const data = await db
      .select({
        card: exchangeAdvanceCards,
        sellerName: suppliers.name,
      })
      .from(exchangeAdvanceCards)
      .leftJoin(suppliers, eq(exchangeAdvanceCards.sellerId, suppliers.id))
      .where(isNull(exchangeAdvanceCards.deletedAt))
      .orderBy(desc(exchangeAdvanceCards.createdAt));

    return data.map((row) => ({
      ...row.card,
      sellerName: row.sellerName,
    }));
  }

  async getCard(id: string): Promise<any | undefined> {
    const result = await db
      .select({
        card: exchangeAdvanceCards,
        sellerName: suppliers.name,
      })
      .from(exchangeAdvanceCards)
      .leftJoin(suppliers, eq(exchangeAdvanceCards.sellerId, suppliers.id))
      .where(and(eq(exchangeAdvanceCards.id, id), isNull(exchangeAdvanceCards.deletedAt)))
      .limit(1);

    if (!result.length) return undefined;
    return { ...result[0].card, sellerName: result[0].sellerName };
  }

  async getCardBySeller(sellerId: string): Promise<ExchangeAdvanceCard | undefined> {
    return db.query.exchangeAdvanceCards.findFirst({
      where: and(
        eq(exchangeAdvanceCards.sellerId, sellerId),
        isNull(exchangeAdvanceCards.deletedAt),
      ),
    });
  }

  async createCard(data: InsertExchangeAdvanceCard): Promise<ExchangeAdvanceCard> {
    // Check if a card for this seller already exists
    const existing = await this.getCardBySeller(data.sellerId);
    if (existing) return existing;

    const [card] = await db.insert(exchangeAdvanceCards).values(data).returning();
    return card;
  }

  async updateCard(id: string, data: Partial<InsertExchangeAdvanceCard>, updatedById?: string): Promise<ExchangeAdvanceCard | undefined> {
    const [card] = await db
      .update(exchangeAdvanceCards)
      .set({ ...data, updatedAt: new Date().toISOString(), updatedById })
      .where(and(eq(exchangeAdvanceCards.id, id), isNull(exchangeAdvanceCards.deletedAt)))
      .returning();
    return card;
  }

  async deleteCard(id: string, deletedById?: string): Promise<boolean> {
    const [result] = await db
      .update(exchangeAdvanceCards)
      .set({ deletedAt: new Date().toISOString(), deletedById })
      .where(and(eq(exchangeAdvanceCards.id, id), isNull(exchangeAdvanceCards.deletedAt)))
      .returning();
    return !!result;
  }

  // ===== TRANSACTIONS =====

  async getTransactions(cardId: string): Promise<ExchangeAdvanceTransaction[]> {
    return db.query.exchangeAdvanceTransactions.findMany({
      where: and(
        eq(exchangeAdvanceTransactions.cardId, cardId),
        isNull(exchangeAdvanceTransactions.deletedAt),
      ),
      orderBy: [desc(exchangeAdvanceTransactions.createdAt)],
    });
  }

  async createTransaction(data: InsertExchangeAdvanceTransaction): Promise<ExchangeAdvanceTransaction> {
    // Get the current card
    const card = await db.query.exchangeAdvanceCards.findFirst({
      where: eq(exchangeAdvanceCards.id, data.cardId),
    });
    if (!card) throw new Error("Карта аванса не найдена");

    const currentBalance = parseFloat(card.currentBalance ?? "0");
    const amount = parseFloat(String(data.amount));

    let newBalance: number;
    if (data.transactionType === "income") {
      newBalance = currentBalance + amount;
    } else {
      newBalance = currentBalance - amount;
    }

    const [transaction] = await db.insert(exchangeAdvanceTransactions).values({
      ...data,
      balanceBefore: String(currentBalance),
      balanceAfter: String(newBalance),
      transactionDate: data.transactionDate ?? new Date().toISOString(),
    }).returning();

    // Update card balance
    await db
      .update(exchangeAdvanceCards)
      .set({
        currentBalance: String(newBalance),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(exchangeAdvanceCards.id, data.cardId));

    return transaction;
  }

  async deleteTransaction(id: string, deletedById?: string): Promise<boolean> {
    const txn = await db.query.exchangeAdvanceTransactions.findFirst({
      where: and(
        eq(exchangeAdvanceTransactions.id, id),
        isNull(exchangeAdvanceTransactions.deletedAt),
      ),
    });
    if (!txn) return false;

    // Restore balance to before-state
    await db
      .update(exchangeAdvanceCards)
      .set({
        currentBalance: txn.balanceBefore,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(exchangeAdvanceCards.id, txn.cardId));

    // Soft-delete the transaction
    await db
      .update(exchangeAdvanceTransactions)
      .set({ deletedAt: new Date().toISOString(), deletedById })
      .where(eq(exchangeAdvanceTransactions.id, id));

    return true;
  }

  // Ensure a card exists for a seller, create if not
  async ensureCardForSeller(sellerId: string, createdById?: string): Promise<ExchangeAdvanceCard> {
    const existing = await this.getCardBySeller(sellerId);
    if (existing) return existing;

    const [card] = await db.insert(exchangeAdvanceCards).values({
      sellerId,
      currentBalance: "0",
      createdById,
    }).returning();
    return card;
  }
}
