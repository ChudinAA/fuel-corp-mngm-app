import { eq, asc, sql, isNull, and } from "drizzle-orm";
import { db } from "server/db";
import {
  logisticsCarriers,
  logisticsDeliveryLocations,
  logisticsVehicles,
  logisticsTrailers,
  logisticsDrivers,
  type LogisticsCarrier,
  type InsertLogisticsCarrier,
  type LogisticsDeliveryLocation,
  type InsertLogisticsDeliveryLocation,
  type LogisticsVehicle,
  type InsertLogisticsVehicle,
  type LogisticsTrailer,
  type InsertLogisticsTrailer,
  type LogisticsDriver,
  type InsertLogisticsDriver,
} from "@shared/schema";
import type { ILogisticsStorage } from "./types";

export class LogisticsStorage implements ILogisticsStorage {
  async getAllLogisticsCarriers(): Promise<LogisticsCarrier[]> {
    return db
      .select()
      .from(logisticsCarriers)
      .where(isNull(logisticsCarriers.deletedAt))
      .orderBy(asc(logisticsCarriers.name));
  }

  async getLogisticsCarrier(id: string): Promise<LogisticsCarrier | undefined> {
    const [carrier] = await db
      .select()
      .from(logisticsCarriers)
      .where(
        and(eq(logisticsCarriers.id, id), isNull(logisticsCarriers.deletedAt)),
      )
      .limit(1);
    return carrier;
  }

  async createLogisticsCarrier(
    data: InsertLogisticsCarrier,
  ): Promise<LogisticsCarrier> {
    // Check for duplicates
    const existing = await db
      .select()
      .from(logisticsCarriers)
      .where(
        and(
          eq(logisticsCarriers.name, data.name),
          isNull(logisticsCarriers.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Такая запись уже существует");
    }

    const [created] = await db
      .insert(logisticsCarriers)
      .values(data)
      .returning();
    return created;
  }

  async updateLogisticsCarrier(
    id: string,
    data: Partial<InsertLogisticsCarrier>,
  ): Promise<LogisticsCarrier | undefined> {
    const [updated] = await db
      .update(logisticsCarriers)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(logisticsCarriers.id, id))
      .returning();
    return updated;
  }

  async deleteLogisticsCarrier(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db
      .update(logisticsCarriers)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(logisticsCarriers.id, id));
    return true;
  }

  async getAllLogisticsDeliveryLocations(): Promise<
    LogisticsDeliveryLocation[]
  > {
    return db
      .select()
      .from(logisticsDeliveryLocations)
      .where(isNull(logisticsDeliveryLocations.deletedAt))
      .orderBy(asc(logisticsDeliveryLocations.name));
  }

  async getLogisticsDeliveryLocation(
    id: string,
  ): Promise<LogisticsDeliveryLocation | undefined> {
    const [location] = await db
      .select()
      .from(logisticsDeliveryLocations)
      .where(
        and(
          eq(logisticsDeliveryLocations.id, id),
          isNull(logisticsDeliveryLocations.deletedAt),
        ),
      )
      .limit(1);
    return location;
  }

  async createLogisticsDeliveryLocation(
    data: InsertLogisticsDeliveryLocation,
  ): Promise<LogisticsDeliveryLocation> {
    // Check for duplicates
    const existing = await db
      .select()
      .from(logisticsDeliveryLocations)
      .where(
        and(
          eq(logisticsDeliveryLocations.name, data.name),
          data.baseId
            ? eq(logisticsDeliveryLocations.baseId, data.baseId)
            : sql`TRUE`,
          isNull(logisticsDeliveryLocations.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Такая запись уже существует");
    }

    const [created] = await db
      .insert(logisticsDeliveryLocations)
      .values(data)
      .returning();
    return created;
  }

  async updateLogisticsDeliveryLocation(
    id: string,
    data: Partial<InsertLogisticsDeliveryLocation>,
  ): Promise<LogisticsDeliveryLocation | undefined> {
    const [updated] = await db
      .update(logisticsDeliveryLocations)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(logisticsDeliveryLocations.id, id))
      .returning();
    return updated;
  }

  async deleteLogisticsDeliveryLocation(
    id: string,
    userId?: string,
  ): Promise<boolean> {
    // Soft delete
    await db
      .update(logisticsDeliveryLocations)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(logisticsDeliveryLocations.id, id));
    return true;
  }

  async getAllLogisticsVehicles(
    carrierId?: string,
  ): Promise<LogisticsVehicle[]> {
    if (carrierId) {
      return db
        .select()
        .from(logisticsVehicles)
        .where(
          and(
            eq(logisticsVehicles.carrierId, carrierId),
            isNull(logisticsVehicles.deletedAt),
          ),
        )
        .orderBy(asc(logisticsVehicles.regNumber));
    }
    return db
      .select()
      .from(logisticsVehicles)
      .where(isNull(logisticsVehicles.deletedAt))
      .orderBy(asc(logisticsVehicles.regNumber));
  }

  async getLogisticsVehicle(id: string): Promise<LogisticsVehicle | undefined> {
    const [vehicle] = await db
      .select()
      .from(logisticsVehicles)
      .where(
        and(eq(logisticsVehicles.id, id), isNull(logisticsVehicles.deletedAt)),
      )
      .limit(1);
    return vehicle;
  }

  async createLogisticsVehicle(
    data: InsertLogisticsVehicle,
  ): Promise<LogisticsVehicle> {
    // Check for duplicates
    const existing = await db
      .select()
      .from(logisticsVehicles)
      .where(
        and(
          eq(logisticsVehicles.regNumber, data.regNumber),
          isNull(logisticsVehicles.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Такая запись уже существует");
    }

    const [created] = await db
      .insert(logisticsVehicles)
      .values(data)
      .returning();
    return created;
  }

  async updateLogisticsVehicle(
    id: string,
    data: Partial<InsertLogisticsVehicle>,
  ): Promise<LogisticsVehicle | undefined> {
    const [updated] = await db
      .update(logisticsVehicles)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(logisticsVehicles.id, id))
      .returning();
    return updated;
  }

  async deleteLogisticsVehicle(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db
      .update(logisticsVehicles)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(logisticsVehicles.id, id));
    return true;
  }

  async getAllLogisticsTrailers(
    carrierId?: string,
  ): Promise<LogisticsTrailer[]> {
    if (carrierId) {
      return db
        .select()
        .from(logisticsTrailers)
        .where(
          and(
            eq(logisticsTrailers.carrierId, carrierId),
            isNull(logisticsTrailers.deletedAt),
          ),
        )
        .orderBy(asc(logisticsTrailers.regNumber));
    }
    return db
      .select()
      .from(logisticsTrailers)
      .where(isNull(logisticsTrailers.deletedAt))
      .orderBy(asc(logisticsTrailers.regNumber));
  }

  async getLogisticsTrailer(id: string): Promise<LogisticsTrailer | undefined> {
    const [trailer] = await db
      .select()
      .from(logisticsTrailers)
      .where(
        and(eq(logisticsTrailers.id, id), isNull(logisticsTrailers.deletedAt)),
      )
      .limit(1);
    return trailer;
  }

  async createLogisticsTrailer(
    data: InsertLogisticsTrailer,
  ): Promise<LogisticsTrailer> {
    // Check for duplicates
    const existing = await db
      .select()
      .from(logisticsTrailers)
      .where(
        and(
          eq(logisticsTrailers.regNumber, data.regNumber),
          isNull(logisticsTrailers.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Такая запись уже существует");
    }

    const [created] = await db
      .insert(logisticsTrailers)
      .values(data)
      .returning();
    return created;
  }

  async updateLogisticsTrailer(
    id: string,
    data: Partial<InsertLogisticsTrailer>,
  ): Promise<LogisticsTrailer | undefined> {
    const [updated] = await db
      .update(logisticsTrailers)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(logisticsTrailers.id, id))
      .returning();
    return updated;
  }

  async deleteLogisticsTrailer(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db
      .update(logisticsTrailers)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(logisticsTrailers.id, id));
    return true;
  }

  async getAllLogisticsDrivers(carrierId?: string): Promise<LogisticsDriver[]> {
    if (carrierId) {
      return db
        .select()
        .from(logisticsDrivers)
        .where(
          and(
            eq(logisticsDrivers.carrierId, carrierId),
            isNull(logisticsDrivers.deletedAt),
          ),
        )
        .orderBy(asc(logisticsDrivers.fullName));
    }
    return db
      .select()
      .from(logisticsDrivers)
      .where(isNull(logisticsDrivers.deletedAt))
      .orderBy(asc(logisticsDrivers.fullName));
  }

  async getLogisticsDriver(id: string): Promise<LogisticsDriver | undefined> {
    const [driver] = await db
      .select()
      .from(logisticsDrivers)
      .where(
        and(eq(logisticsDrivers.id, id), isNull(logisticsDrivers.deletedAt)),
      )
      .limit(1);
    return driver;
  }

  async createLogisticsDriver(
    data: InsertLogisticsDriver,
  ): Promise<LogisticsDriver> {
    // Check for duplicates
    const existing = await db
      .select()
      .from(logisticsDrivers)
      .where(
        and(
          eq(logisticsDrivers.fullName, data.fullName),
          data.licenseNumber
            ? eq(logisticsDrivers.licenseNumber, data.licenseNumber)
            : sql`TRUE`,
          isNull(logisticsDrivers.deletedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("Такая запись уже существует");
    }

    const [created] = await db
      .insert(logisticsDrivers)
      .values(data)
      .returning();
    return created;
  }

  async updateLogisticsDriver(
    id: string,
    data: Partial<InsertLogisticsDriver>,
  ): Promise<LogisticsDriver | undefined> {
    const [updated] = await db
      .update(logisticsDrivers)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(logisticsDrivers.id, id))
      .returning();
    return updated;
  }

  async deleteLogisticsDriver(id: string, userId?: string): Promise<boolean> {
    // Soft delete
    await db
      .update(logisticsDrivers)
      .set({
        deletedAt: sql`NOW()`,
        deletedById: userId,
      })
      .where(eq(logisticsDrivers.id, id));
    return true;
  }

  async restoreLogisticsCarrier(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsCarriers)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(logisticsCarriers.id, id));
    return true;
  }

  async restoreLogisticsDeliveryLocation(
    id: string,
    userId?: string,
  ): Promise<boolean> {
    await db
      .update(logisticsDeliveryLocations)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(logisticsDeliveryLocations.id, id));
    return true;
  }

  async restoreLogisticsVehicle(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsVehicles)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(logisticsVehicles.id, id));
    return true;
  }

  async restoreLogisticsTrailer(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsTrailers)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(logisticsTrailers.id, id));
    return true;
  }

  async restoreLogisticsDriver(id: string, userId?: string): Promise<boolean> {
    await db
      .update(logisticsDrivers)
      .set({
        deletedAt: null,
        deletedById: null,
      })
      .where(eq(logisticsDrivers.id, id));
    return true;
  }
}
