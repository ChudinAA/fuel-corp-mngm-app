
import { eq, desc, sql, asc, or } from "drizzle-orm";
import { db } from "../db";
import {
  warehouses,
  exchange,
  movement,
  opt,
  aircraftRefueling,
  wholesaleBases,
  refuelingBases,
  type Warehouse,
  type InsertWarehouse,
  type Exchange,
  type InsertExchange,
  type Movement,
  type InsertMovement,
  type Opt,
  type InsertOpt,
  type AircraftRefueling,
  type InsertAircraftRefueling,
} from "@shared/schema";
import type { IOperationsStorage } from "./types";

export class OperationsStorage implements IOperationsStorage {
  async getAllWarehouses(): Promise<Warehouse[]> {
    const warehousesList = await db.select().from(warehouses).orderBy(asc(warehouses.name));
    
    // Enrich with basis name
    const enrichedWarehouses = await Promise.all(
      warehousesList.map(async (wh) => {
        if (wh.baseId) {
          // Try to find in wholesale bases first
          const [wholesaleBase] = await db.select().from(wholesaleBases).where(eq(wholesaleBases.id, wh.baseId)).limit(1);
          if (wholesaleBase) {
            return { ...wh, basis: wholesaleBase.name };
          }
          
          // Try refueling bases
          const [refuelingBase] = await db.select().from(refuelingBases).where(eq(refuelingBases.id, wh.baseId)).limit(1);
          if (refuelingBase) {
            return { ...wh, basis: refuelingBase.name };
          }
        }
        return wh;
      })
    );
    
    return enrichedWarehouses;
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);
    
    if (!wh) return undefined;
    
    if (wh.baseId) {
      // Try to find in wholesale bases first
      const [wholesaleBase] = await db.select().from(wholesaleBases).where(eq(wholesaleBases.id, wh.baseId)).limit(1);
      if (wholesaleBase) {
        return { ...wh, basis: wholesaleBase.name };
      }
      
      // Try refueling bases
      const [refuelingBase] = await db.select().from(refuelingBases).where(eq(refuelingBases.id, wh.baseId)).limit(1);
      if (refuelingBase) {
        return { ...wh, basis: refuelingBase.name };
      }
    }
    
    return wh;
  }

  async createWarehouse(data: InsertWarehouse): Promise<Warehouse> {
    const [created] = await db.insert(warehouses).values(data).returning();
    return created;
  }

  async updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const [updated] = await db.update(warehouses).set(data).where(eq(warehouses.id, id)).returning();
    return updated;
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    await db.delete(warehouses).where(eq(warehouses.id, id));
    return true;
  }

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

  async getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(movement).orderBy(desc(movement.movementDate)).limit(pageSize).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(movement);
    return { data, total: Number(countResult?.count || 0) };
  }

  async createMovement(data: InsertMovement): Promise<Movement> {
    const [created] = await db.insert(movement).values(data).returning();
    return created;
  }

  async updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    const [updated] = await db.update(movement).set(data).where(eq(movement.id, id)).returning();
    return updated;
  }

  async deleteMovement(id: string): Promise<boolean> {
    await db.delete(movement).where(eq(movement.id, id));
    return true;
  }

  async getOptDeals(page: number, pageSize: number): Promise<{ data: Opt[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const data = await db.select().from(opt).orderBy(desc(opt.dealDate)).limit(pageSize).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(opt);
    return { data, total: Number(countResult?.count || 0) };
  }

  async createOpt(data: InsertOpt): Promise<Opt> {
    const [created] = await db.insert(opt).values(data).returning();
    return created;
  }

  async updateOpt(id: string, data: Partial<InsertOpt>): Promise<Opt | undefined> {
    const [updated] = await db.update(opt).set(data).where(eq(opt.id, id)).returning();
    return updated;
  }

  async deleteOpt(id: string): Promise<boolean> {
    await db.delete(opt).where(eq(opt.id, id));
    return true;
  }

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

  async getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
  }> {
    return {
      optDealsToday: 0,
      refuelingToday: 0,
      warehouseAlerts: 0,
      totalProfitMonth: 0,
    };
  }
}
