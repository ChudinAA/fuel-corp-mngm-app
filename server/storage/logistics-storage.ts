
import { eq, asc } from "drizzle-orm";
import { db } from "../db";
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
    return db.select().from(logisticsCarriers).orderBy(asc(logisticsCarriers.name));
  }

  async getLogisticsCarrier(id: string): Promise<LogisticsCarrier | undefined> {
    const [carrier] = await db.select().from(logisticsCarriers).where(eq(logisticsCarriers.id, id)).limit(1);
    return carrier;
  }

  async createLogisticsCarrier(data: InsertLogisticsCarrier): Promise<LogisticsCarrier> {
    const [created] = await db.insert(logisticsCarriers).values(data).returning();
    return created;
  }

  async updateLogisticsCarrier(id: string, data: Partial<InsertLogisticsCarrier>): Promise<LogisticsCarrier | undefined> {
    const [updated] = await db.update(logisticsCarriers).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(logisticsCarriers.id, id)).returning();
    return updated;
  }

  async deleteLogisticsCarrier(id: string): Promise<boolean> {
    await db.delete(logisticsCarriers).where(eq(logisticsCarriers.id, id));
    return true;
  }

  async getAllLogisticsDeliveryLocations(): Promise<LogisticsDeliveryLocation[]> {
    return db.select().from(logisticsDeliveryLocations).orderBy(asc(logisticsDeliveryLocations.name));
  }

  async getLogisticsDeliveryLocation(id: string): Promise<LogisticsDeliveryLocation | undefined> {
    const [location] = await db.select().from(logisticsDeliveryLocations).where(eq(logisticsDeliveryLocations.id, id)).limit(1);
    return location;
  }

  async createLogisticsDeliveryLocation(data: InsertLogisticsDeliveryLocation): Promise<LogisticsDeliveryLocation> {
    const [created] = await db.insert(logisticsDeliveryLocations).values(data).returning();
    return created;
  }

  async updateLogisticsDeliveryLocation(id: string, data: Partial<InsertLogisticsDeliveryLocation>): Promise<LogisticsDeliveryLocation | undefined> {
    const [updated] = await db.update(logisticsDeliveryLocations).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(logisticsDeliveryLocations.id, id)).returning();
    return updated;
  }

  async deleteLogisticsDeliveryLocation(id: string): Promise<boolean> {
    await db.delete(logisticsDeliveryLocations).where(eq(logisticsDeliveryLocations.id, id));
    return true;
  }

  async getAllLogisticsVehicles(carrierId?: string): Promise<LogisticsVehicle[]> {
    if (carrierId) {
      return db.select().from(logisticsVehicles).where(eq(logisticsVehicles.carrierId, carrierId)).orderBy(asc(logisticsVehicles.regNumber));
    }
    return db.select().from(logisticsVehicles).orderBy(asc(logisticsVehicles.regNumber));
  }

  async getLogisticsVehicle(id: string): Promise<LogisticsVehicle | undefined> {
    const [vehicle] = await db.select().from(logisticsVehicles).where(eq(logisticsVehicles.id, id)).limit(1);
    return vehicle;
  }

  async createLogisticsVehicle(data: InsertLogisticsVehicle): Promise<LogisticsVehicle> {
    const [created] = await db.insert(logisticsVehicles).values(data).returning();
    return created;
  }

  async updateLogisticsVehicle(id: string, data: Partial<InsertLogisticsVehicle>): Promise<LogisticsVehicle | undefined> {
    const [updated] = await db.update(logisticsVehicles).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(logisticsVehicles.id, id)).returning();
    return updated;
  }

  async deleteLogisticsVehicle(id: string): Promise<boolean> {
    await db.delete(logisticsVehicles).where(eq(logisticsVehicles.id, id));
    return true;
  }

  async getAllLogisticsTrailers(carrierId?: string): Promise<LogisticsTrailer[]> {
    if (carrierId) {
      return db.select().from(logisticsTrailers).where(eq(logisticsTrailers.carrierId, carrierId)).orderBy(asc(logisticsTrailers.regNumber));
    }
    return db.select().from(logisticsTrailers).orderBy(asc(logisticsTrailers.regNumber));
  }

  async getLogisticsTrailer(id: string): Promise<LogisticsTrailer | undefined> {
    const [trailer] = await db.select().from(logisticsTrailers).where(eq(logisticsTrailers.id, id)).limit(1);
    return trailer;
  }

  async createLogisticsTrailer(data: InsertLogisticsTrailer): Promise<LogisticsTrailer> {
    const [created] = await db.insert(logisticsTrailers).values(data).returning();
    return created;
  }

  async updateLogisticsTrailer(id: string, data: Partial<InsertLogisticsTrailer>): Promise<LogisticsTrailer | undefined> {
    const [updated] = await db.update(logisticsTrailers).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(logisticsTrailers.id, id)).returning();
    return updated;
  }

  async deleteLogisticsTrailer(id: string): Promise<boolean> {
    await db.delete(logisticsTrailers).where(eq(logisticsTrailers.id, id));
    return true;
  }

  async getAllLogisticsDrivers(carrierId?: string): Promise<LogisticsDriver[]> {
    if (carrierId) {
      return db.select().from(logisticsDrivers).where(eq(logisticsDrivers.carrierId, carrierId)).orderBy(asc(logisticsDrivers.fullName));
    }
    return db.select().from(logisticsDrivers).orderBy(asc(logisticsDrivers.fullName));
  }

  async getLogisticsDriver(id: string): Promise<LogisticsDriver | undefined> {
    const [driver] = await db.select().from(logisticsDrivers).where(eq(logisticsDrivers.id, id)).limit(1);
    return driver;
  }

  async createLogisticsDriver(data: InsertLogisticsDriver): Promise<LogisticsDriver> {
    const [created] = await db.insert(logisticsDrivers).values(data).returning();
    return created;
  }

  async updateLogisticsDriver(id: string, data: Partial<InsertLogisticsDriver>): Promise<LogisticsDriver | undefined> {
    const [updated] = await db.update(logisticsDrivers).set({
      ...data,
      updatedAt: sql`NOW()`
    }).where(eq(logisticsDrivers.id, id)).returning();
    return updated;
  }

  async deleteLogisticsDriver(id: string): Promise<boolean> {
    await db.delete(logisticsDrivers).where(eq(logisticsDrivers.id, id));
    return true;
  }

  }
