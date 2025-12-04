
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
import {
  wholesaleSuppliers,
  wholesaleBases,
  type WholesaleSupplier,
  type InsertWholesaleSupplier,
  type WholesaleBase,
  type InsertWholesaleBase,
} from "@shared/schema";
import type { IWholesaleStorage } from "./types";

export class WholesaleStorage implements IWholesaleStorage {
  async getAllWholesaleSuppliers(): Promise<WholesaleSupplier[]> {
    return db.select().from(wholesaleSuppliers).orderBy(asc(wholesaleSuppliers.name));
  }

  async getWholesaleSupplier(id: number): Promise<WholesaleSupplier | undefined> {
    const [supplier] = await db.select().from(wholesaleSuppliers).where(eq(wholesaleSuppliers.id, id)).limit(1);
    return supplier;
  }

  async createWholesaleSupplier(data: InsertWholesaleSupplier): Promise<WholesaleSupplier> {
    const [created] = await db.insert(wholesaleSuppliers).values(data).returning();
    return created;
  }

  async updateWholesaleSupplier(id: number, data: Partial<InsertWholesaleSupplier>): Promise<WholesaleSupplier | undefined> {
    const [updated] = await db.update(wholesaleSuppliers).set(data).where(eq(wholesaleSuppliers.id, id)).returning();
    return updated;
  }

  async deleteWholesaleSupplier(id: number): Promise<boolean> {
    await db.delete(wholesaleSuppliers).where(eq(wholesaleSuppliers.id, id));
    return true;
  }

  async getAllWholesaleBases(supplierId?: number): Promise<WholesaleBase[]> {
    if (supplierId) {
      return db.select().from(wholesaleBases).where(eq(wholesaleBases.supplierId, supplierId)).orderBy(asc(wholesaleBases.name));
    }
    return db.select().from(wholesaleBases).orderBy(asc(wholesaleBases.name));
  }

  async getWholesaleBase(id: number): Promise<WholesaleBase | undefined> {
    const [base] = await db.select().from(wholesaleBases).where(eq(wholesaleBases.id, id)).limit(1);
    return base;
  }

  async createWholesaleBase(data: InsertWholesaleBase): Promise<WholesaleBase> {
    const [created] = await db.insert(wholesaleBases).values(data).returning();
    return created;
  }

  async updateWholesaleBase(id: number, data: Partial<InsertWholesaleBase>): Promise<WholesaleBase | undefined> {
    const [updated] = await db.update(wholesaleBases).set(data).where(eq(wholesaleBases.id, id)).returning();
    return updated;
  }

  async deleteWholesaleBase(id: number): Promise<boolean> {
    await db.delete(wholesaleBases).where(eq(wholesaleBases.id, id));
    return true;
  }
}
