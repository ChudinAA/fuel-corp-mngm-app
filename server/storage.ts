import { eq, and, desc, like, or, sql, asc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  roles,
  permissions,
  rolePermissions,
  directoryWholesale,
  directoryRefueling,
  directoryLogistics,
  prices,
  deliveryCost,
  warehouses,
  warehouseTransactions,
  exchange,
  movement,
  opt,
  aircraftRefueling,
  type User,
  type InsertUser,
  type Role,
  type InsertRole,
  type Permission,
  type DirectoryWholesale,
  type InsertDirectoryWholesale,
  type DirectoryRefueling,
  type InsertDirectoryRefueling,
  type DirectoryLogistics,
  type InsertDirectoryLogistics,
  type Price,
  type InsertPrice,
  type DeliveryCost,
  type InsertDeliveryCost,
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
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function verifyPassword(storedPassword: string, suppliedPassword: string): Promise<boolean> {
  const [hashedPassword, salt] = storedPassword.split(".");
  const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
  const suppliedPasswordBuf = (await scryptAsync(suppliedPassword, salt, 64)) as Buffer;
  return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
}

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  verifyUserPassword(email: string, password: string): Promise<User | null>;
  updateLastLogin(id: number): Promise<void>;

  // Roles
  getRole(id: number): Promise<Role | undefined>;
  getAllRoles(): Promise<Role[]>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: number, data: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: number): Promise<boolean>;

  // Directories
  getDirectoryWholesale(type?: string): Promise<DirectoryWholesale[]>;
  createDirectoryWholesale(data: InsertDirectoryWholesale): Promise<DirectoryWholesale>;
  updateDirectoryWholesale(id: number, data: Partial<InsertDirectoryWholesale>): Promise<DirectoryWholesale | undefined>;
  deleteDirectoryWholesale(id: number): Promise<boolean>;

  getDirectoryRefueling(type?: string): Promise<DirectoryRefueling[]>;
  createDirectoryRefueling(data: InsertDirectoryRefueling): Promise<DirectoryRefueling>;
  updateDirectoryRefueling(id: number, data: Partial<InsertDirectoryRefueling>): Promise<DirectoryRefueling | undefined>;
  deleteDirectoryRefueling(id: number): Promise<boolean>;

  getDirectoryLogistics(type?: string): Promise<DirectoryLogistics[]>;
  createDirectoryLogistics(data: InsertDirectoryLogistics): Promise<DirectoryLogistics>;
  updateDirectoryLogistics(id: number, data: Partial<InsertDirectoryLogistics>): Promise<DirectoryLogistics | undefined>;
  deleteDirectoryLogistics(id: number): Promise<boolean>;

  // Prices
  getAllPrices(): Promise<Price[]>;
  getPricesByRole(counterpartyRole: string, counterpartyType: string): Promise<Price[]>;
  createPrice(data: InsertPrice): Promise<Price>;
  updatePrice(id: number, data: Partial<InsertPrice>): Promise<Price | undefined>;
  deletePrice(id: number): Promise<boolean>;
  calculatePriceSelection(counterpartyId: number, counterpartyType: string, basis: string, dateFrom: string, dateTo: string): Promise<number>;
  checkPriceDateOverlaps(counterpartyId: number, counterpartyType: string, counterpartyRole: string, basis: string, dateFrom: string, dateTo: string, excludeId?: number): Promise<{ status: string; message: string; overlaps?: { id: number; dateFrom: string; dateTo: string }[] }>;

  // Delivery Cost
  getAllDeliveryCosts(): Promise<DeliveryCost[]>;
  createDeliveryCost(data: InsertDeliveryCost): Promise<DeliveryCost>;
  updateDeliveryCost(id: number, data: Partial<InsertDeliveryCost>): Promise<DeliveryCost | undefined>;
  deleteDeliveryCost(id: number): Promise<boolean>;

  // Warehouses
  getAllWarehouses(): Promise<Warehouse[]>;
  getWarehouse(id: number): Promise<Warehouse | undefined>;
  createWarehouse(data: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: number, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: number): Promise<boolean>;

  // Exchange
  getExchangeDeals(page: number, pageSize: number): Promise<{ data: Exchange[]; total: number }>;
  createExchange(data: InsertExchange): Promise<Exchange>;
  updateExchange(id: number, data: Partial<InsertExchange>): Promise<Exchange | undefined>;
  deleteExchange(id: number): Promise<boolean>;

  // Movement
  getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }>;
  createMovement(data: InsertMovement): Promise<Movement>;
  updateMovement(id: number, data: Partial<InsertMovement>): Promise<Movement | undefined>;
  deleteMovement(id: number): Promise<boolean>;

  // OPT
  getOptDeals(page: number, pageSize: number): Promise<{ data: Opt[]; total: number }>;
  createOpt(data: InsertOpt): Promise<Opt>;
  updateOpt(id: number, data: Partial<InsertOpt>): Promise<Opt | undefined>;
  deleteOpt(id: number): Promise<boolean>;

  // Aircraft Refueling
  getRefuelings(page: number, pageSize: number): Promise<{ data: AircraftRefueling[]; total: number }>;
  createRefueling(data: InsertAircraftRefueling): Promise<AircraftRefueling>;
  updateRefueling(id: number, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined>;
  deleteRefueling(id: number): Promise<boolean>;

  // Dashboard stats
  getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // ============ Users ============
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await hashPassword(insertUser.password);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    if (data.password) {
      data.password = await hashPassword(data.password);
    }
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(asc(users.lastName));
  }

  async verifyUserPassword(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    const isValid = await verifyPassword(user.password, password);
    return isValid ? user : null;
  }

  async updateLastLogin(id: number): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id));
  }

  // ============ Roles ============
  async getRole(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return role;
  }

  async getAllRoles(): Promise<Role[]> {
    return db.select().from(roles).orderBy(asc(roles.name));
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [created] = await db.insert(roles).values(role).returning();
    return created;
  }

  async updateRole(id: number, data: Partial<InsertRole>): Promise<Role | undefined> {
    const [updated] = await db.update(roles).set(data).where(eq(roles.id, id)).returning();
    return updated;
  }

  async deleteRole(id: number): Promise<boolean> {
    await db.delete(roles).where(eq(roles.id, id));
    return true;
  }

  // ============ Directory Wholesale ============
  async getDirectoryWholesale(type?: string): Promise<DirectoryWholesale[]> {
    if (type && type !== "all") {
      return db.select().from(directoryWholesale).where(eq(directoryWholesale.type, type)).orderBy(asc(directoryWholesale.name));
    }
    return db.select().from(directoryWholesale).orderBy(asc(directoryWholesale.name));
  }

  async createDirectoryWholesale(data: InsertDirectoryWholesale): Promise<DirectoryWholesale> {
    const [created] = await db.insert(directoryWholesale).values(data).returning();
    return created;
  }

  async updateDirectoryWholesale(id: number, data: Partial<InsertDirectoryWholesale>): Promise<DirectoryWholesale | undefined> {
    const [updated] = await db.update(directoryWholesale).set(data).where(eq(directoryWholesale.id, id)).returning();
    return updated;
  }

  async deleteDirectoryWholesale(id: number): Promise<boolean> {
    await db.delete(directoryWholesale).where(eq(directoryWholesale.id, id));
    return true;
  }

  // ============ Directory Refueling ============
  async getDirectoryRefueling(type?: string): Promise<DirectoryRefueling[]> {
    if (type && type !== "all") {
      return db.select().from(directoryRefueling).where(eq(directoryRefueling.type, type)).orderBy(asc(directoryRefueling.name));
    }
    return db.select().from(directoryRefueling).orderBy(asc(directoryRefueling.name));
  }

  async createDirectoryRefueling(data: InsertDirectoryRefueling): Promise<DirectoryRefueling> {
    const [created] = await db.insert(directoryRefueling).values(data).returning();
    return created;
  }

  async updateDirectoryRefueling(id: number, data: Partial<InsertDirectoryRefueling>): Promise<DirectoryRefueling | undefined> {
    const [updated] = await db.update(directoryRefueling).set(data).where(eq(directoryRefueling.id, id)).returning();
    return updated;
  }

  async deleteDirectoryRefueling(id: number): Promise<boolean> {
    await db.delete(directoryRefueling).where(eq(directoryRefueling.id, id));
    return true;
  }

  // ============ Directory Logistics ============
  async getDirectoryLogistics(type?: string): Promise<DirectoryLogistics[]> {
    if (type && type !== "all") {
      return db.select().from(directoryLogistics).where(eq(directoryLogistics.type, type)).orderBy(asc(directoryLogistics.name));
    }
    return db.select().from(directoryLogistics).orderBy(asc(directoryLogistics.name));
  }

  async createDirectoryLogistics(data: InsertDirectoryLogistics): Promise<DirectoryLogistics> {
    const [created] = await db.insert(directoryLogistics).values(data).returning();
    return created;
  }

  async updateDirectoryLogistics(id: number, data: Partial<InsertDirectoryLogistics>): Promise<DirectoryLogistics | undefined> {
    const [updated] = await db.update(directoryLogistics).set(data).where(eq(directoryLogistics.id, id)).returning();
    return updated;
  }

  async deleteDirectoryLogistics(id: number): Promise<boolean> {
    await db.delete(directoryLogistics).where(eq(directoryLogistics.id, id));
    return true;
  }

  // ============ Prices ============
  async getAllPrices(): Promise<Price[]> {
    const allPrices = await db.select().from(prices).orderBy(desc(prices.dateFrom));
    return allPrices.map(p => this.enrichPriceWithCalculations(p));
  }

  async getPricesByRole(counterpartyRole: string, counterpartyType: string): Promise<Price[]> {
    const filtered = await db.select().from(prices).where(
      and(eq(prices.counterpartyRole, counterpartyRole), eq(prices.counterpartyType, counterpartyType))
    ).orderBy(desc(prices.dateFrom));
    return filtered.map(p => this.enrichPriceWithCalculations(p));
  }

  private enrichPriceWithCalculations(price: Price): Price {
    // Расчет выборки (soldVolume) - сумма сделок из OPT и Refueling по этой цене
    // Для простоты - возвращаем как есть, логика может быть расширена при необходимости
    
    // Проверка пересечения дат
    let dateCheckWarning: string | null = null;
    if (price.dateFrom && price.dateTo) {
      // Логика проверки может быть расширена для проверки конфликтов с другими ценами
      // Текущая версия возвращает null (без ошибок)
    }
    
    return {
      ...price,
      dateCheckWarning,
    } as Price;
  }

  async createPrice(data: InsertPrice): Promise<Price> {
    const enrichedData = {
      ...data,
      dateCheckWarning: null,
    };
    const [created] = await db.insert(prices).values(enrichedData).returning();
    return this.enrichPriceWithCalculations(created);
  }

  async updatePrice(id: number, data: Partial<InsertPrice>): Promise<Price | undefined> {
    const [updated] = await db.update(prices).set(data).where(eq(prices.id, id)).returning();
    return updated;
  }

  async deletePrice(id: number): Promise<boolean> {
    await db.delete(prices).where(eq(prices.id, id));
    return true;
  }

  // Расчет выборки - сумма сделок из ОПТ и Заправка ВС
  async calculatePriceSelection(
    counterpartyId: number,
    counterpartyType: string,
    basis: string,
    dateFrom: string,
    dateTo: string
  ): Promise<number> {
    let totalVolume = 0;

    if (counterpartyType === "wholesale") {
      // Суммируем из таблицы opt - сделки где контрагент это либо поставщик, либо покупатель
      const optDealsSupplier = await db.select({
        total: sql<string>`COALESCE(SUM(${opt.quantityKg}), 0)`
      }).from(opt).where(
        and(
          eq(opt.supplierId, counterpartyId),
          eq(opt.basis, basis),
          sql`${opt.dealDate} >= ${dateFrom}`,
          sql`${opt.dealDate} <= ${dateTo}`
        )
      );

      const optDealsBuyer = await db.select({
        total: sql<string>`COALESCE(SUM(${opt.quantityKg}), 0)`
      }).from(opt).where(
        and(
          eq(opt.buyerId, counterpartyId),
          eq(opt.basis, basis),
          sql`${opt.dealDate} >= ${dateFrom}`,
          sql`${opt.dealDate} <= ${dateTo}`
        )
      );

      totalVolume += parseFloat(optDealsSupplier[0]?.total || "0");
      totalVolume += parseFloat(optDealsBuyer[0]?.total || "0");
    } else if (counterpartyType === "refueling") {
      // Суммируем из таблицы aircraftRefueling
      const refuelingDealsSupplier = await db.select({
        total: sql<string>`COALESCE(SUM(${aircraftRefueling.quantityKg}), 0)`
      }).from(aircraftRefueling).where(
        and(
          eq(aircraftRefueling.supplierId, counterpartyId),
          eq(aircraftRefueling.basis, basis),
          sql`${aircraftRefueling.refuelingDate} >= ${dateFrom}`,
          sql`${aircraftRefueling.refuelingDate} <= ${dateTo}`
        )
      );

      const refuelingDealsBuyer = await db.select({
        total: sql<string>`COALESCE(SUM(${aircraftRefueling.quantityKg}), 0)`
      }).from(aircraftRefueling).where(
        and(
          eq(aircraftRefueling.buyerId, counterpartyId),
          eq(aircraftRefueling.basis, basis),
          sql`${aircraftRefueling.refuelingDate} >= ${dateFrom}`,
          sql`${aircraftRefueling.refuelingDate} <= ${dateTo}`
        )
      );

      totalVolume += parseFloat(refuelingDealsSupplier[0]?.total || "0");
      totalVolume += parseFloat(refuelingDealsBuyer[0]?.total || "0");
    }

    return totalVolume;
  }

  // Проверка пересечения диапазонов дат
  async checkPriceDateOverlaps(
    counterpartyId: number,
    counterpartyType: string,
    counterpartyRole: string,
    basis: string,
    dateFrom: string,
    dateTo: string,
    excludeId?: number
  ): Promise<{ status: string; message: string; overlaps?: { id: number; dateFrom: string; dateTo: string }[] }> {
    // Ищем цены с пересекающимися диапазонами дат для того же контрагента и базиса
    const conditions = [
      eq(prices.counterpartyId, counterpartyId),
      eq(prices.counterpartyType, counterpartyType),
      eq(prices.counterpartyRole, counterpartyRole),
      eq(prices.basis, basis),
      eq(prices.isActive, true),
      // Проверка пересечения дат: (A.start <= B.end) AND (A.end >= B.start)
      sql`${prices.dateFrom} <= ${dateTo}`,
      sql`${prices.dateTo} >= ${dateFrom}`
    ];

    if (excludeId) {
      conditions.push(sql`${prices.id} != ${excludeId}`);
    }

    const overlappingPrices = await db.select({
      id: prices.id,
      dateFrom: prices.dateFrom,
      dateTo: prices.dateTo
    }).from(prices).where(and(...conditions));

    if (overlappingPrices.length > 0) {
      // Обновляем статус проверки дат для всех пересекающихся цен
      for (const price of overlappingPrices) {
        await db.update(prices).set({ dateCheckWarning: "error" }).where(eq(prices.id, price.id));
      }

      return {
        status: "error",
        message: `Обнаружено пересечение дат с ${overlappingPrices.length} ценами. При пересечении цены будут суммироваться!`,
        overlaps: overlappingPrices.map(p => ({
          id: p.id,
          dateFrom: p.dateFrom,
          dateTo: p.dateTo || p.dateFrom
        }))
      };
    }

    return {
      status: "ok",
      message: "Пересечений не обнаружено"
    };
  }

  // ============ Delivery Cost ============
  async getAllDeliveryCosts(): Promise<DeliveryCost[]> {
    return db.select().from(deliveryCost).orderBy(asc(deliveryCost.basis));
  }

  async createDeliveryCost(data: InsertDeliveryCost): Promise<DeliveryCost> {
    const [created] = await db.insert(deliveryCost).values(data).returning();
    return created;
  }

  async updateDeliveryCost(id: number, data: Partial<InsertDeliveryCost>): Promise<DeliveryCost | undefined> {
    const [updated] = await db.update(deliveryCost).set(data).where(eq(deliveryCost.id, id)).returning();
    return updated;
  }

  async deleteDeliveryCost(id: number): Promise<boolean> {
    await db.delete(deliveryCost).where(eq(deliveryCost.id, id));
    return true;
  }

  // ============ Warehouses ============
  async getAllWarehouses(): Promise<Warehouse[]> {
    return db.select().from(warehouses).orderBy(asc(warehouses.name));
  }

  async getWarehouse(id: number): Promise<Warehouse | undefined> {
    const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);
    return wh;
  }

  async createWarehouse(data: InsertWarehouse): Promise<Warehouse> {
    const [created] = await db.insert(warehouses).values(data).returning();
    return created;
  }

  async updateWarehouse(id: number, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    const [updated] = await db.update(warehouses).set(data).where(eq(warehouses.id, id)).returning();
    return updated;
  }

  async deleteWarehouse(id: number): Promise<boolean> {
    await db.delete(warehouses).where(eq(warehouses.id, id));
    return true;
  }

  // ============ Exchange ============
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

  async updateExchange(id: number, data: Partial<InsertExchange>): Promise<Exchange | undefined> {
    const [updated] = await db.update(exchange).set(data).where(eq(exchange.id, id)).returning();
    return updated;
  }

  async deleteExchange(id: number): Promise<boolean> {
    await db.delete(exchange).where(eq(exchange.id, id));
    return true;
  }

  // ============ Movement ============
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

  async updateMovement(id: number, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    const [updated] = await db.update(movement).set(data).where(eq(movement.id, id)).returning();
    return updated;
  }

  async deleteMovement(id: number): Promise<boolean> {
    await db.delete(movement).where(eq(movement.id, id));
    return true;
  }

  // ============ OPT ============
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

  async updateOpt(id: number, data: Partial<InsertOpt>): Promise<Opt | undefined> {
    const [updated] = await db.update(opt).set(data).where(eq(opt.id, id)).returning();
    return updated;
  }

  async deleteOpt(id: number): Promise<boolean> {
    await db.delete(opt).where(eq(opt.id, id));
    return true;
  }

  // ============ Aircraft Refueling ============
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

  async updateRefueling(id: number, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined> {
    const [updated] = await db.update(aircraftRefueling).set(data).where(eq(aircraftRefueling.id, id)).returning();
    return updated;
  }

  async deleteRefueling(id: number): Promise<boolean> {
    await db.delete(aircraftRefueling).where(eq(aircraftRefueling.id, id));
    return true;
  }

  // ============ Dashboard ============
  async getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    const [optCount] = await db.select({ count: sql<number>`count(*)` }).from(opt).where(eq(opt.dealDate, today));
    const [refuelingCount] = await db.select({ count: sql<number>`count(*)` }).from(aircraftRefueling).where(eq(aircraftRefueling.refuelingDate, today));
    
    return {
      optDealsToday: Number(optCount?.count || 0),
      refuelingToday: Number(refuelingCount?.count || 0),
      warehouseAlerts: 2,
      totalProfitMonth: 2450000,
    };
  }
}

export const storage = new DatabaseStorage();
