import { eq, desc, sql } from "drizzle-orm";
import { db } from "server/db";
import {
  exchange,
  type Exchange,
  type InsertExchange,
} from "@shared/schema";
import { IExchangeStorage } from "./types";
import { PRODUCT_TYPE, TRANSACTION_TYPE } from "@shared/constants";

export class ExchangeStorage implements IExchangeStorage {
  async getExchange(id: string): Promise<Exchange | undefined> {
    return db.query.exchange.findFirst({
      where: eq(exchange.id, id),
      with: {
        counterparty: true,
        baseDelivery: true,
        createdBy: {
          columns: {
            id: true,
            username: true,
            email: true,
          }
        },
        updatedBy: {
          columns: {
            id: true,
            username: true,
            email: true,
          }
        },
      }
    });
  }

  async getExchangeDeals(page: number = 1, pageSize: number = 10): Promise<{ data: Exchange[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(exchange).orderBy(desc(exchange.dealDate)).limit(pageSize).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(exchange);
    return { data, total: Number(countResult?.count || 0) };
  }

  async createExchange(data: InsertExchange): Promise<Exchange> {
    const [created] = await db.insert(exchange).values(data).returning();
    return created;
  }

  async updateExchange(id: string, data: Partial<InsertExchange>): Promise<Exchange | undefined> {
    const [updated] = await db.update(exchange).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(exchange.id, id)).returning();
    return updated;
  }

  async deleteExchange(id: string): Promise<boolean> {
    // Soft delete
    await db.update(exchange).set({
      deletedAt: sql`NOW()`,
    }).where(eq(exchange.id, id));
    return true;
  }
}