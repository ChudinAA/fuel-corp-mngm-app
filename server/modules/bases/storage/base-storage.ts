
import { eq, asc, sql } from "drizzle-orm";
import { db } from "server/db";
import {
  bases,
  type Base,
  type InsertBase,
} from "@shared/schema";
import type { IBaseStorage } from "./types";

export class BaseStorage implements IBaseStorage {
  async getAllBases(baseType?: string): Promise<Base[]> {
    if (baseType) {
      return db.select().from(bases).where(eq(bases.baseType, baseType)).orderBy(asc(bases.name));
    }
    return db.select().from(bases).orderBy(asc(bases.name));
  }

  async getBase(id: string): Promise<Base | undefined> {
    const [base] = await db.select().from(bases).where(eq(bases.id, id)).limit(1);
    return base;
  }

  async createBase(data: InsertBase): Promise<Base> {
    const [created] = await db.insert(bases).values(data).returning();
    return created;
  }

  async updateBase(id: string, data: Partial<InsertBase>): Promise<Base | undefined> {
    const [updated] = await db.update(bases).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(bases.id, id)).returning();
    return updated;
  }

  async deleteBase(id: string): Promise<boolean> {
    // Soft delete
    await db.update(bases).set({
      deletedAt: sql`NOW()`,
    }).where(eq(bases.id, id));
    return true;
  }
}
