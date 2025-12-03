import { eq, and, desc, like, or, sql, asc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  roles,
  permissions,
  rolePermissions,
  customers,
  wholesaleSuppliers,
  wholesaleBases,
  refuelingProviders,
  refuelingBases,
  refuelingServices,
  logisticsCarriers,
  logisticsDeliveryLocations,
  logisticsVehicles,
  logisticsTrailers,
  logisticsDrivers,
  logisticsWarehouses,
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
  type Customer,
  type InsertCustomer,
  type WholesaleSupplier,
  type InsertWholesaleSupplier,
  type WholesaleBase,
  type InsertWholesaleBase,
  type RefuelingProvider,
  type InsertRefuelingProvider,
  type RefuelingBase,
  type InsertRefuelingBase,
  type RefuelingService,
  type InsertRefuelingService,
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
  type LogisticsWarehouse,
  type InsertLogisticsWarehouse,
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

  // Customers (unified for wholesale and refueling)
  getAllCustomers(module?: string): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;

  // Wholesale Suppliers
  getAllWholesaleSuppliers(): Promise<WholesaleSupplier[]>;
  getWholesaleSupplier(id: number): Promise<WholesaleSupplier | undefined>;
  createWholesaleSupplier(data: InsertWholesaleSupplier): Promise<WholesaleSupplier>;
  updateWholesaleSupplier(id: number, data: Partial<InsertWholesaleSupplier>): Promise<WholesaleSupplier | undefined>;
  deleteWholesaleSupplier(id: number): Promise<boolean>;

  // Wholesale Bases
  getAllWholesaleBases(supplierId?: number): Promise<WholesaleBase[]>;
  getWholesaleBase(id: number): Promise<WholesaleBase | undefined>;
  createWholesaleBase(data: InsertWholesaleBase): Promise<WholesaleBase>;
  updateWholesaleBase(id: number, data: Partial<InsertWholesaleBase>): Promise<WholesaleBase | undefined>;
  deleteWholesaleBase(id: number): Promise<boolean>;

  // Refueling Providers
  getAllRefuelingProviders(): Promise<RefuelingProvider[]>;
  getRefuelingProvider(id: number): Promise<RefuelingProvider | undefined>;
  createRefuelingProvider(data: InsertRefuelingProvider): Promise<RefuelingProvider>;
  updateRefuelingProvider(id: number, data: Partial<InsertRefuelingProvider>): Promise<RefuelingProvider | undefined>;
  deleteRefuelingProvider(id: number): Promise<boolean>;

  // Refueling Bases
  getAllRefuelingBases(providerId?: number): Promise<RefuelingBase[]>;
  getRefuelingBase(id: number): Promise<RefuelingBase | undefined>;
  createRefuelingBase(data: InsertRefuelingBase): Promise<RefuelingBase>;
  updateRefuelingBase(id: number, data: Partial<InsertRefuelingBase>): Promise<RefuelingBase | undefined>;
  deleteRefuelingBase(id: number): Promise<boolean>;

  // Refueling Services
  getAllRefuelingServices(): Promise<RefuelingService[]>;
  getRefuelingService(id: number): Promise<RefuelingService | undefined>;
  createRefuelingService(data: InsertRefuelingService): Promise<RefuelingService>;
  updateRefuelingService(id: number, data: Partial<InsertRefuelingService>): Promise<RefuelingService | undefined>;
  deleteRefuelingService(id: number): Promise<boolean>;

  // Logistics Carriers
  getAllLogisticsCarriers(): Promise<LogisticsCarrier[]>;
  getLogisticsCarrier(id: number): Promise<LogisticsCarrier | undefined>;
  createLogisticsCarrier(data: InsertLogisticsCarrier): Promise<LogisticsCarrier>;
  updateLogisticsCarrier(id: number, data: Partial<InsertLogisticsCarrier>): Promise<LogisticsCarrier | undefined>;
  deleteLogisticsCarrier(id: number): Promise<boolean>;

  // Logistics Delivery Locations
  getAllLogisticsDeliveryLocations(): Promise<LogisticsDeliveryLocation[]>;
  getLogisticsDeliveryLocation(id: number): Promise<LogisticsDeliveryLocation | undefined>;
  createLogisticsDeliveryLocation(data: InsertLogisticsDeliveryLocation): Promise<LogisticsDeliveryLocation>;
  updateLogisticsDeliveryLocation(id: number, data: Partial<InsertLogisticsDeliveryLocation>): Promise<LogisticsDeliveryLocation | undefined>;
  deleteLogisticsDeliveryLocation(id: number): Promise<boolean>;

  // Logistics Vehicles
  getAllLogisticsVehicles(carrierId?: number): Promise<LogisticsVehicle[]>;
  getLogisticsVehicle(id: number): Promise<LogisticsVehicle | undefined>;
  createLogisticsVehicle(data: InsertLogisticsVehicle): Promise<LogisticsVehicle>;
  updateLogisticsVehicle(id: number, data: Partial<InsertLogisticsVehicle>): Promise<LogisticsVehicle | undefined>;
  deleteLogisticsVehicle(id: number): Promise<boolean>;

  // Logistics Trailers
  getAllLogisticsTrailers(carrierId?: number): Promise<LogisticsTrailer[]>;
  getLogisticsTrailer(id: number): Promise<LogisticsTrailer | undefined>;
  createLogisticsTrailer(data: InsertLogisticsTrailer): Promise<LogisticsTrailer>;
  updateLogisticsTrailer(id: number, data: Partial<InsertLogisticsTrailer>): Promise<LogisticsTrailer | undefined>;
  deleteLogisticsTrailer(id: number): Promise<boolean>;

  // Logistics Drivers
  getAllLogisticsDrivers(carrierId?: number): Promise<LogisticsDriver[]>;
  getLogisticsDriver(id: number): Promise<LogisticsDriver | undefined>;
  createLogisticsDriver(data: InsertLogisticsDriver): Promise<LogisticsDriver>;
  updateLogisticsDriver(id: number, data: Partial<InsertLogisticsDriver>): Promise<LogisticsDriver | undefined>;
  deleteLogisticsDriver(id: number): Promise<boolean>;

  // Logistics Warehouses
  getAllLogisticsWarehouses(): Promise<LogisticsWarehouse[]>;
  getLogisticsWarehouse(id: number): Promise<LogisticsWarehouse | undefined>;
  createLogisticsWarehouse(data: InsertLogisticsWarehouse): Promise<LogisticsWarehouse>;
  updateLogisticsWarehouse(id: number, data: Partial<InsertLogisticsWarehouse>): Promise<LogisticsWarehouse | undefined>;
  deleteLogisticsWarehouse(id: number): Promise<boolean>;

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

  // ============ Customers ============
  async getAllCustomers(module?: string): Promise<Customer[]> {
    if (module && module !== "all") {
      return db.select().from(customers).where(
        or(eq(customers.module, module), eq(customers.module, "both"))
      ).orderBy(asc(customers.name));
    }
    return db.select().from(customers).orderBy(asc(customers.name));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return customer;
  }

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(data).returning();
    return created;
  }

  async updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers).set(data).where(eq(customers.id, id)).returning();
    return updated;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    await db.delete(customers).where(eq(customers.id, id));
    return true;
  }

  // ============ Wholesale Suppliers ============
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

  // ============ Wholesale Bases ============
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

  // ============ Refueling Providers ============
  async getAllRefuelingProviders(): Promise<RefuelingProvider[]> {
    return db.select().from(refuelingProviders).orderBy(asc(refuelingProviders.name));
  }

  async getRefuelingProvider(id: number): Promise<RefuelingProvider | undefined> {
    const [provider] = await db.select().from(refuelingProviders).where(eq(refuelingProviders.id, id)).limit(1);
    return provider;
  }

  async createRefuelingProvider(data: InsertRefuelingProvider): Promise<RefuelingProvider> {
    const [created] = await db.insert(refuelingProviders).values(data).returning();
    return created;
  }

  async updateRefuelingProvider(id: number, data: Partial<InsertRefuelingProvider>): Promise<RefuelingProvider | undefined> {
    const [updated] = await db.update(refuelingProviders).set(data).where(eq(refuelingProviders.id, id)).returning();
    return updated;
  }

  async deleteRefuelingProvider(id: number): Promise<boolean> {
    await db.delete(refuelingProviders).where(eq(refuelingProviders.id, id));
    return true;
  }

  // ============ Refueling Bases ============
  async getAllRefuelingBases(providerId?: number): Promise<RefuelingBase[]> {
    if (providerId) {
      return db.select().from(refuelingBases).where(eq(refuelingBases.providerId, providerId)).orderBy(asc(refuelingBases.name));
    }
    return db.select().from(refuelingBases).orderBy(asc(refuelingBases.name));
  }

  async getRefuelingBase(id: number): Promise<RefuelingBase | undefined> {
    const [base] = await db.select().from(refuelingBases).where(eq(refuelingBases.id, id)).limit(1);
    return base;
  }

  async createRefuelingBase(data: InsertRefuelingBase): Promise<RefuelingBase> {
    const [created] = await db.insert(refuelingBases).values(data).returning();
    return created;
  }

  async updateRefuelingBase(id: number, data: Partial<InsertRefuelingBase>): Promise<RefuelingBase | undefined> {
    const [updated] = await db.update(refuelingBases).set(data).where(eq(refuelingBases.id, id)).returning();
    return updated;
  }

  async deleteRefuelingBase(id: number): Promise<boolean> {
    await db.delete(refuelingBases).where(eq(refuelingBases.id, id));
    return true;
  }

  // ============ Refueling Services ============
  async getAllRefuelingServices(): Promise<RefuelingService[]> {
    return db.select().from(refuelingServices).orderBy(asc(refuelingServices.name));
  }

  async getRefuelingService(id: number): Promise<RefuelingService | undefined> {
    const [service] = await db.select().from(refuelingServices).where(eq(refuelingServices.id, id)).limit(1);
    return service;
  }

  async createRefuelingService(data: InsertRefuelingService): Promise<RefuelingService> {
    const [created] = await db.insert(refuelingServices).values(data).returning();
    return created;
  }

  async updateRefuelingService(id: number, data: Partial<InsertRefuelingService>): Promise<RefuelingService | undefined> {
    const [updated] = await db.update(refuelingServices).set(data).where(eq(refuelingServices.id, id)).returning();
    return updated;
  }

  async deleteRefuelingService(id: number): Promise<boolean> {
    await db.delete(refuelingServices).where(eq(refuelingServices.id, id));
    return true;
  }

  // ============ Logistics Carriers ============
  async getAllLogisticsCarriers(): Promise<LogisticsCarrier[]> {
    return db.select().from(logisticsCarriers).orderBy(asc(logisticsCarriers.name));
  }

  async getLogisticsCarrier(id: number): Promise<LogisticsCarrier | undefined> {
    const [carrier] = await db.select().from(logisticsCarriers).where(eq(logisticsCarriers.id, id)).limit(1);
    return carrier;
  }

  async createLogisticsCarrier(data: InsertLogisticsCarrier): Promise<LogisticsCarrier> {
    const [created] = await db.insert(logisticsCarriers).values(data).returning();
    return created;
  }

  async updateLogisticsCarrier(id: number, data: Partial<InsertLogisticsCarrier>): Promise<LogisticsCarrier | undefined> {
    const [updated] = await db.update(logisticsCarriers).set(data).where(eq(logisticsCarriers.id, id)).returning();
    return updated;
  }

  async deleteLogisticsCarrier(id: number): Promise<boolean> {
    await db.delete(logisticsCarriers).where(eq(logisticsCarriers.id, id));
    return true;
  }

  // ============ Logistics Delivery Locations ============
  async getAllLogisticsDeliveryLocations(): Promise<LogisticsDeliveryLocation[]> {
    return db.select().from(logisticsDeliveryLocations).orderBy(asc(logisticsDeliveryLocations.name));
  }

  async getLogisticsDeliveryLocation(id: number): Promise<LogisticsDeliveryLocation | undefined> {
    const [location] = await db.select().from(logisticsDeliveryLocations).where(eq(logisticsDeliveryLocations.id, id)).limit(1);
    return location;
  }

  async createLogisticsDeliveryLocation(data: InsertLogisticsDeliveryLocation): Promise<LogisticsDeliveryLocation> {
    const [created] = await db.insert(logisticsDeliveryLocations).values(data).returning();
    return created;
  }

  async updateLogisticsDeliveryLocation(id: number, data: Partial<InsertLogisticsDeliveryLocation>): Promise<LogisticsDeliveryLocation | undefined> {
    const [updated] = await db.update(logisticsDeliveryLocations).set(data).where(eq(logisticsDeliveryLocations.id, id)).returning();
    return updated;
  }

  async deleteLogisticsDeliveryLocation(id: number): Promise<boolean> {
    await db.delete(logisticsDeliveryLocations).where(eq(logisticsDeliveryLocations.id, id));
    return true;
  }

  // ============ Logistics Vehicles ============
  async getAllLogisticsVehicles(carrierId?: number): Promise<LogisticsVehicle[]> {
    if (carrierId) {
      return db.select().from(logisticsVehicles).where(eq(logisticsVehicles.carrierId, carrierId)).orderBy(asc(logisticsVehicles.regNumber));
    }
    return db.select().from(logisticsVehicles).orderBy(asc(logisticsVehicles.regNumber));
  }

  async getLogisticsVehicle(id: number): Promise<LogisticsVehicle | undefined> {
    const [vehicle] = await db.select().from(logisticsVehicles).where(eq(logisticsVehicles.id, id)).limit(1);
    return vehicle;
  }

  async createLogisticsVehicle(data: InsertLogisticsVehicle): Promise<LogisticsVehicle> {
    const [created] = await db.insert(logisticsVehicles).values(data).returning();
    return created;
  }

  async updateLogisticsVehicle(id: number, data: Partial<InsertLogisticsVehicle>): Promise<LogisticsVehicle | undefined> {
    const [updated] = await db.update(logisticsVehicles).set(data).where(eq(logisticsVehicles.id, id)).returning();
    return updated;
  }

  async deleteLogisticsVehicle(id: number): Promise<boolean> {
    await db.delete(logisticsVehicles).where(eq(logisticsVehicles.id, id));
    return true;
  }

  // ============ Logistics Trailers ============
  async getAllLogisticsTrailers(carrierId?: number): Promise<LogisticsTrailer[]> {
    if (carrierId) {
      return db.select().from(logisticsTrailers).where(eq(logisticsTrailers.carrierId, carrierId)).orderBy(asc(logisticsTrailers.regNumber));
    }
    return db.select().from(logisticsTrailers).orderBy(asc(logisticsTrailers.regNumber));
  }

  async getLogisticsTrailer(id: number): Promise<LogisticsTrailer | undefined> {
    const [trailer] = await db.select().from(logisticsTrailers).where(eq(logisticsTrailers.id, id)).limit(1);
    return trailer;
  }

  async createLogisticsTrailer(data: InsertLogisticsTrailer): Promise<LogisticsTrailer> {
    const [created] = await db.insert(logisticsTrailers).values(data).returning();
    return created;
  }

  async updateLogisticsTrailer(id: number, data: Partial<InsertLogisticsTrailer>): Promise<LogisticsTrailer | undefined> {
    const [updated] = await db.update(logisticsTrailers).set(data).where(eq(logisticsTrailers.id, id)).returning();
    return updated;
  }

  async deleteLogisticsTrailer(id: number): Promise<boolean> {
    await db.delete(logisticsTrailers).where(eq(logisticsTrailers.id, id));
    return true;
  }

  // ============ Logistics Drivers ============
  async getAllLogisticsDrivers(carrierId?: number): Promise<LogisticsDriver[]> {
    if (carrierId) {
      return db.select().from(logisticsDrivers).where(eq(logisticsDrivers.carrierId, carrierId)).orderBy(asc(logisticsDrivers.fullName));
    }
    return db.select().from(logisticsDrivers).orderBy(asc(logisticsDrivers.fullName));
  }

  async getLogisticsDriver(id: number): Promise<LogisticsDriver | undefined> {
    const [driver] = await db.select().from(logisticsDrivers).where(eq(logisticsDrivers.id, id)).limit(1);
    return driver;
  }

  async createLogisticsDriver(data: InsertLogisticsDriver): Promise<LogisticsDriver> {
    const [created] = await db.insert(logisticsDrivers).values(data).returning();
    return created;
  }

  async updateLogisticsDriver(id: number, data: Partial<InsertLogisticsDriver>): Promise<LogisticsDriver | undefined> {
    const [updated] = await db.update(logisticsDrivers).set(data).where(eq(logisticsDrivers.id, id)).returning();
    return updated;
  }

  async deleteLogisticsDriver(id: number): Promise<boolean> {
    await db.delete(logisticsDrivers).where(eq(logisticsDrivers.id, id));
    return true;
  }

  // ============ Logistics Warehouses ============
  async getAllLogisticsWarehouses(): Promise<LogisticsWarehouse[]> {
    return db.select().from(logisticsWarehouses).orderBy(asc(logisticsWarehouses.name));
  }

  async getLogisticsWarehouse(id: number): Promise<LogisticsWarehouse | undefined> {
    const [warehouse] = await db.select().from(logisticsWarehouses).where(eq(logisticsWarehouses.id, id)).limit(1);
    return warehouse;
  }

  async createLogisticsWarehouse(data: InsertLogisticsWarehouse): Promise<LogisticsWarehouse> {
    const [created] = await db.insert(logisticsWarehouses).values(data).returning();
    return created;
  }

  async updateLogisticsWarehouse(id: number, data: Partial<InsertLogisticsWarehouse>): Promise<LogisticsWarehouse | undefined> {
    const [updated] = await db.update(logisticsWarehouses).set(data).where(eq(logisticsWarehouses.id, id)).returning();
    return updated;
  }

  async deleteLogisticsWarehouse(id: number): Promise<boolean> {
    await db.delete(logisticsWarehouses).where(eq(logisticsWarehouses.id, id));
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
    let dateCheckWarning: string | null = null;
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

  async calculatePriceSelection(
    counterpartyId: number,
    counterpartyType: string,
    basis: string,
    dateFrom: string,
    dateTo: string
  ): Promise<number> {
    let totalVolume = 0;

    if (counterpartyType === "wholesale") {
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

  async checkPriceDateOverlaps(
    counterpartyId: number,
    counterpartyType: string,
    counterpartyRole: string,
    basis: string,
    dateFrom: string,
    dateTo: string,
    excludeId?: number
  ): Promise<{ status: string; message: string; overlaps?: { id: number; dateFrom: string; dateTo: string }[] }> {
    const conditions = [
      eq(prices.counterpartyId, counterpartyId),
      eq(prices.counterpartyType, counterpartyType),
      eq(prices.counterpartyRole, counterpartyRole),
      eq(prices.basis, basis),
      eq(prices.isActive, true),
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

  // ============ Dashboard Stats ============
  async getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [optCount] = await db.select({ count: sql<number>`count(*)` }).from(opt).where(eq(opt.dealDate, today));
    const [refuelingCount] = await db.select({ count: sql<number>`count(*)` }).from(aircraftRefueling).where(eq(aircraftRefueling.refuelingDate, today));
    
    const [optProfit] = await db.select({ total: sql<string>`COALESCE(SUM(${opt.profit}), 0)` }).from(opt).where(sql`${opt.dealDate} >= ${startOfMonth}`);
    const [refuelingProfit] = await db.select({ total: sql<string>`COALESCE(SUM(${aircraftRefueling.profit}), 0)` }).from(aircraftRefueling).where(sql`${aircraftRefueling.refuelingDate} >= ${startOfMonth}`);

    return {
      optDealsToday: Number(optCount?.count || 0),
      refuelingToday: Number(refuelingCount?.count || 0),
      warehouseAlerts: 0,
      totalProfitMonth: parseFloat(optProfit?.total || "0") + parseFloat(refuelingProfit?.total || "0"),
    };
  }
}

export const storage = new DatabaseStorage();
