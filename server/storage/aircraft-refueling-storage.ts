import { eq, desc, sql, or } from "drizzle-orm";
import { db } from "../db";
import {
  aircraftRefueling,
  refuelingProviders,
  customers,
  warehouses,
  warehouseTransactions,
  type AircraftRefueling,
  type InsertAircraftRefueling,
} from "@shared/schema";
import { IAircraftRefuelingStorage } from "./types";

export class AircraftRefuelingStorage implements IAircraftRefuelingStorage {
  async getRefuelings(page: number, pageSize: number): Promise<{ data: AircraftRefueling[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(aircraftRefueling).orderBy(desc(aircraftRefueling.refuelingDate)).limit(pageSize).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(aircraftRefueling);
    return { data, total: Number(countResult?.count || 0) };
  }

  async createRefueling(data: InsertAircraftRefueling): Promise<AircraftRefueling> {
    const [created] = await db.insert(aircraftRefueling).values(data).returning();
    return created;
  }

  async updateRefueling(id: string, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined> {
    const [updated] = await db.update(aircraftRefueling).set(data).where(eq(aircraftRefueling.id, id)).returning();
    return updated;
  }

  async deleteRefueling(id: string): Promise<boolean> {
    await db.delete(aircraftRefueling).where(eq(aircraftRefueling.id, id));
    return true;
  }
}