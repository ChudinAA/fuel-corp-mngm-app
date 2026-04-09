import { eq, asc, isNull, and, sql } from "drizzle-orm";
import { db } from "server/db";
import {
  aircraft,
  flightNumbers,
  type Aircraft,
  type InsertAircraft,
  type FlightNumber,
  type InsertFlightNumber,
} from "@shared/schema";

export class AviationStorage {
  async getAllAircraft(): Promise<Aircraft[]> {
    return db
      .select()
      .from(aircraft)
      .where(isNull(aircraft.deletedAt))
      .orderBy(asc(aircraft.name));
  }

  async getAircraft(id: string): Promise<Aircraft | undefined> {
    const [item] = await db
      .select()
      .from(aircraft)
      .where(and(eq(aircraft.id, id), isNull(aircraft.deletedAt)))
      .limit(1);
    return item;
  }

  async createAircraft(data: InsertAircraft): Promise<Aircraft> {
    const existing = await db
      .select()
      .from(aircraft)
      .where(and(eq(aircraft.name, data.name), isNull(aircraft.deletedAt)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Такая запись уже существует");
    }

    const [created] = await db.insert(aircraft).values(data).returning();
    return created;
  }

  async updateAircraft(id: string, data: Partial<InsertAircraft>): Promise<Aircraft | undefined> {
    const [updated] = await db
      .update(aircraft)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(aircraft.id, id))
      .returning();
    return updated;
  }

  async deleteAircraft(id: string, userId?: string): Promise<boolean> {
    await db
      .update(aircraft)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(aircraft.id, id));
    return true;
  }

  async getAllFlightNumbers(basisId?: string): Promise<FlightNumber[]> {
    if (basisId) {
      return db
        .select()
        .from(flightNumbers)
        .where(
          and(
            eq(flightNumbers.basisId, basisId),
            isNull(flightNumbers.deletedAt)
          )
        )
        .orderBy(asc(flightNumbers.number));
    }
    return db
      .select()
      .from(flightNumbers)
      .where(isNull(flightNumbers.deletedAt))
      .orderBy(asc(flightNumbers.number));
  }

  async getFlightNumber(id: string): Promise<FlightNumber | undefined> {
    const [item] = await db
      .select()
      .from(flightNumbers)
      .where(and(eq(flightNumbers.id, id), isNull(flightNumbers.deletedAt)))
      .limit(1);
    return item;
  }

  async createFlightNumber(data: InsertFlightNumber): Promise<FlightNumber> {
    const existing = await db
      .select()
      .from(flightNumbers)
      .where(
        and(
          eq(flightNumbers.number, data.number),
          isNull(flightNumbers.deletedAt)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Такая запись уже существует");
    }

    const [created] = await db.insert(flightNumbers).values(data).returning();
    return created;
  }

  async updateFlightNumber(id: string, data: Partial<InsertFlightNumber>): Promise<FlightNumber | undefined> {
    const [updated] = await db
      .update(flightNumbers)
      .set({ ...data, updatedAt: sql`NOW()` })
      .where(eq(flightNumbers.id, id))
      .returning();
    return updated;
  }

  async deleteFlightNumber(id: string, userId?: string): Promise<boolean> {
    await db
      .update(flightNumbers)
      .set({ deletedAt: sql`NOW()`, deletedById: userId })
      .where(eq(flightNumbers.id, id));
    return true;
  }
}
