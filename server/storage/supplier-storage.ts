
import { eq, asc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  suppliers,
  type Supplier,
  type InsertSupplier,
} from "@shared/schema";
import type { ISupplierStorage } from "./types";

export class SupplierStorage implements ISupplierStorage {
  async getAllSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(asc(suppliers.name));
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    return supplier;
  }

  async createSupplier(data: InsertSupplier): Promise<Supplier> {
    const [created] = await db.insert(suppliers).values(data).returning();
    return created;
  }

  async updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updated] = await db.update(suppliers).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
    return true;
  }
}
