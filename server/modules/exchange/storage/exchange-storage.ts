import { eq, desc, sql, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import { exchange, type Exchange, type InsertExchange } from "@shared/schema";
import { IExchangeStorage } from "./types";

export class ExchangeStorage implements IExchangeStorage {
  async getExchange(id: string): Promise<Exchange | undefined> {
    return db.query.exchange.findFirst({
      where: and(eq(exchange.id, id), isNull(exchange.deletedAt)),
    });
  }

  async getExchangeDeals(
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ data: Exchange[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db
      .select()
      .from(exchange)
      .where(isNull(exchange.deletedAt))
      .orderBy(desc(exchange.dealDate))
      .limit(pageSize)
      .offset(offset);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(exchange)
      .where(isNull(exchange.deletedAt));
    return { data, total: Number(countResult?.count || 0) };
  }

  async createExchange(data: InsertExchange): Promise<Exchange> {
    const [created] = await db.insert(exchange).values(data).returning();
    return created;
  }

  async updateExchange(
    id: string,
    data: Partial<InsertExchange>,
  ): Promise<Exchange | undefined> {
    const [updated] = await db
      .update(exchange)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(exchange.id, id))
      .returning();
    return updated;
  }

  async deleteExchange(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db
      .update(exchange)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(exchange.id, id));
    return true;
  }

  async restoreExchange(id: string, userId?: string): Promise<boolean> {
    await db
      .update(exchange)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(exchange.id, id));
    return true;
  }
}
