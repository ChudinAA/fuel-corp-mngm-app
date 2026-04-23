import { eq, desc, isNull, and, ilike, or } from "drizzle-orm";
import { db } from "server/db";
import {
  railwayStations,
  railwayTariffs,
  type RailwayStation,
  type InsertRailwayStation,
  type RailwayTariff,
  type InsertRailwayTariff,
} from "../entities/railway";

export class RailwayStorage {
  // ===== RAILWAY STATIONS =====

  async getAllStations(search?: string): Promise<RailwayStation[]> {
    const conditions: any[] = [isNull(railwayStations.deletedAt)];
    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(railwayStations.name, pattern),
          ilike(railwayStations.code, pattern),
        ),
      );
    }
    return db.query.railwayStations.findMany({
      where: and(...conditions),
      orderBy: [desc(railwayStations.createdAt)],
    });
  }

  async getStation(id: string): Promise<RailwayStation | undefined> {
    return db.query.railwayStations.findFirst({
      where: and(eq(railwayStations.id, id), isNull(railwayStations.deletedAt)),
    });
  }

  async createStation(data: InsertRailwayStation): Promise<RailwayStation> {
    const [station] = await db.insert(railwayStations).values(data).returning();
    return station;
  }

  async updateStation(id: string, data: Partial<InsertRailwayStation>, updatedById?: string): Promise<RailwayStation | undefined> {
    const [station] = await db
      .update(railwayStations)
      .set({ ...data, updatedAt: new Date().toISOString(), updatedById })
      .where(and(eq(railwayStations.id, id), isNull(railwayStations.deletedAt)))
      .returning();
    return station;
  }

  async deleteStation(id: string, deletedById?: string): Promise<boolean> {
    const [result] = await db
      .update(railwayStations)
      .set({ deletedAt: new Date().toISOString(), deletedById })
      .where(and(eq(railwayStations.id, id), isNull(railwayStations.deletedAt)))
      .returning();
    return !!result;
  }

  async restoreStation(id: string, data: any): Promise<RailwayStation | undefined> {
    const [station] = await db
      .insert(railwayStations)
      .values({ ...data, id, deletedAt: null })
      .onConflictDoUpdate({
        target: railwayStations.id,
        set: { ...data, deletedAt: null, updatedAt: new Date().toISOString() },
      })
      .returning();
    return station;
  }

  // ===== RAILWAY TARIFFS =====

  async getAllTariffs(search?: string): Promise<RailwayTariff[]> {
    const conditions: any[] = [isNull(railwayTariffs.deletedAt)];
    if (search && search.trim()) {
      conditions.push(ilike(railwayTariffs.zoneName, `%${search.trim()}%`));
    }
    return db.query.railwayTariffs.findMany({
      where: and(...conditions),
      orderBy: [desc(railwayTariffs.createdAt)],
    });
  }

  async getTariff(id: string): Promise<RailwayTariff | undefined> {
    return db.query.railwayTariffs.findFirst({
      where: and(eq(railwayTariffs.id, id), isNull(railwayTariffs.deletedAt)),
    });
  }

  async createTariff(data: InsertRailwayTariff): Promise<RailwayTariff> {
    const [tariff] = await db.insert(railwayTariffs).values(data).returning();
    return tariff;
  }

  async updateTariff(id: string, data: Partial<InsertRailwayTariff>, updatedById?: string): Promise<RailwayTariff | undefined> {
    const [tariff] = await db
      .update(railwayTariffs)
      .set({ ...data, updatedAt: new Date().toISOString(), updatedById })
      .where(and(eq(railwayTariffs.id, id), isNull(railwayTariffs.deletedAt)))
      .returning();
    return tariff;
  }

  async deleteTariff(id: string, deletedById?: string): Promise<boolean> {
    const [result] = await db
      .update(railwayTariffs)
      .set({ deletedAt: new Date().toISOString(), deletedById })
      .where(and(eq(railwayTariffs.id, id), isNull(railwayTariffs.deletedAt)))
      .returning();
    return !!result;
  }

  async restoreTariff(id: string, data: any): Promise<RailwayTariff | undefined> {
    const [tariff] = await db
      .insert(railwayTariffs)
      .values({ ...data, id, deletedAt: null })
      .onConflictDoUpdate({
        target: railwayTariffs.id,
        set: { ...data, deletedAt: null, updatedAt: new Date().toISOString() },
      })
      .returning();
    return tariff;
  }
}
