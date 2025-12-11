
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  exchange,
  type Exchange,
  type InsertExchange,
} from "@shared/schema";
import { IExchangeStorage } from "./types";

export class ExchangeStorage implements IExchangeStorage {
  async getExchangeDeals(page: number, pageSize: number): Promise<{ data: Exchange[]; total: number }> {
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
    const [updated] = await db.update(exchange).set(data).where(eq(exchange.id, id)).returning();
    return updated;
  }

  async deleteExchange(id: string): Promise<boolean> {
    await db.delete(exchange).where(eq(exchange.id, id));
    return true;
  }
}
