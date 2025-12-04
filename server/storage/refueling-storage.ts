
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import {
  refuelingProviders,
  refuelingBases,
  type RefuelingProvider,
  type InsertRefuelingProvider,
  type RefuelingBase,
  type InsertRefuelingBase,
} from "@shared/schema";
import type { IRefuelingStorage } from "./types";

export class RefuelingStorage implements IRefuelingStorage {
  async getAllRefuelingProviders(): Promise<RefuelingProvider[]> {
    return db.select().from(refuelingProviders).orderBy(asc(refuelingProviders.name));
  }

  async getRefuelingProvider(id: number): Promise<RefuelingProvider | undefined> {
    const [provider] = await db.select().from(refuelingProviders).where(eq(refuelingProviders.id, id)).limit(1);
    return provider;
  }

  async createRefuelingProvider(data: InsertRefuelingProvider): Promise<RefuelingProvider> {
    const [created] = await db.insert(refuelingProviders).values(data).returning();
    return created;
  }

  async updateRefuelingProvider(id: number, data: Partial<InsertRefuelingProvider>): Promise<RefuelingProvider | undefined> {
    const [updated] = await db.update(refuelingProviders).set(data).where(eq(refuelingProviders.id, id)).returning();
    return updated;
  }

  async deleteRefuelingProvider(id: number): Promise<boolean> {
    await db.delete(refuelingProviders).where(eq(refuelingProviders.id, id));
    return true;
  }

  async getAllRefuelingBases(providerId?: number): Promise<RefuelingBase[]> {
    if (providerId) {
      return db.select().from(refuelingBases).where(eq(refuelingBases.providerId, providerId)).orderBy(asc(refuelingBases.name));
    }
    return db.select().from(refuelingBases).orderBy(asc(refuelingBases.name));
  }

  async getRefuelingBase(id: number): Promise<RefuelingBase | undefined> {
    const [base] = await db.select().from(refuelingBases).where(eq(refuelingBases.id, id)).limit(1);
    return base;
  }

  async createRefuelingBase(data: InsertRefuelingBase): Promise<RefuelingBase> {
    const [created] = await db.insert(refuelingBases).values(data).returning();
    return created;
  }

  async updateRefuelingBase(id: number, data: Partial<InsertRefuelingBase>): Promise<RefuelingBase | undefined> {
    const [updated] = await db.update(refuelingBases).set(data).where(eq(refuelingBases.id, id)).returning();
    return updated;
  }

  async deleteRefuelingBase(id: number): Promise<boolean> {
    await db.delete(refuelingBases).where(eq(refuelingBases.id, id));
    return true;
  }
}
