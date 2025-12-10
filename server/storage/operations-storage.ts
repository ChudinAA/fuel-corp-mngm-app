import type { IOperationsStorage } from "./types";
import { WarehouseStorage } from "./warehouse-storage";
import { ExchangeStorage } from "./exchange-storage";
import { MovementStorage } from "./movement-storage";
import { OptStorage } from "./opt-storage";
import { AircraftRefuelingStorage } from "./aircraft-refueling-storage";
import { DashboardStorage } from "./dashboard-storage";
import type {
  Warehouse,
  InsertWarehouse,
  Exchange,
  InsertExchange,
  Movement,
  InsertMovement,
  Opt,
  InsertOpt,
  AircraftRefueling,
  InsertAircraftRefueling,
} from "@shared/schema";

export class OperationsStorage implements IOperationsStorage {
  private warehouseStorage: WarehouseStorage;
  private exchangeStorage: ExchangeStorage;
  private movementStorage: MovementStorage;
  private optStorage: OptStorage;
  private aircraftRefuelingStorage: AircraftRefuelingStorage;
  private dashboardStorage: DashboardStorage;

  constructor() {
    this.warehouseStorage = new WarehouseStorage();
    this.exchangeStorage = new ExchangeStorage();
    this.movementStorage = new MovementStorage();
    this.optStorage = new OptStorage();
    this.aircraftRefuelingStorage = new AircraftRefuelingStorage();
    this.dashboardStorage = new DashboardStorage();
  }

  // Warehouse methods
  async getAllWarehouses(): Promise<Warehouse[]> {
    return this.warehouseStorage.getAllWarehouses();
  }

  async getWarehouse(id: string): Promise<Warehouse | undefined> {
    return this.warehouseStorage.getWarehouse(id);
  }

  async createWarehouse(data: InsertWarehouse): Promise<Warehouse> {
    return this.warehouseStorage.createWarehouse(data);
  }

  async updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined> {
    return this.warehouseStorage.updateWarehouse(id, data);
  }

  async deleteWarehouse(id: string): Promise<boolean> {
    return this.warehouseStorage.deleteWarehouse(id);
  }

  async getWarehouseTransactions(warehouseId: string): Promise<any[]> {
    return this.warehouseStorage.getWarehouseTransactions(warehouseId);
  }

  async getWarehouseStatsForDashboard(): Promise<any[]> {
    return this.warehouseStorage.getWarehouseStatsForDashboard();
  }

  // Exchange methods
  async getExchangeDeals(page: number, pageSize: number): Promise<{ data: Exchange[]; total: number }> {
    return this.exchangeStorage.getExchangeDeals(page, pageSize);
  }

  async createExchange(data: InsertExchange): Promise<Exchange> {
    return this.exchangeStorage.createExchange(data);
  }

  async updateExchange(id: string, data: Partial<InsertExchange>): Promise<Exchange | undefined> {
    return this.exchangeStorage.updateExchange(id, data);
  }

  async deleteExchange(id: string): Promise<boolean> {
    return this.exchangeStorage.deleteExchange(id);
  }

  // Movement methods
  async getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }> {
    return this.movementStorage.getMovements(page, pageSize);
  }

  async createMovement(data: InsertMovement): Promise<Movement> {
    return this.movementStorage.createMovement(data);
  }

  async updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined> {
    return this.movementStorage.updateMovement(id, data);
  }

  async deleteMovement(id: string): Promise<boolean> {
    return this.movementStorage.deleteMovement(id);
  }

  // Opt methods
  async getOptDeals(page: number, pageSize: number): Promise<{ data: Opt[]; total: number }> {
    return this.optStorage.getOptDeals(page, pageSize);
  }

  async createOpt(data: InsertOpt): Promise<Opt> {
    return this.optStorage.createOpt(data);
  }

  async updateOpt(id: string, data: Partial<InsertOpt>): Promise<Opt | undefined> {
    return this.optStorage.updateOpt(id, data);
  }

  async deleteOpt(id: string): Promise<boolean> {
    return this.optStorage.deleteOpt(id);
  }

  // Aircraft Refueling methods
  async getRefuelings(page: number, pageSize: number): Promise<{ data: AircraftRefueling[]; total: number }> {
    return this.aircraftRefuelingStorage.getRefuelings(page, pageSize);
  }

  async createRefueling(data: InsertAircraftRefueling): Promise<AircraftRefueling> {
    return this.aircraftRefuelingStorage.createRefueling(data);
  }

  async updateRefueling(id: string, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined> {
    return this.aircraftRefuelingStorage.updateRefueling(id, data);
  }

  async deleteRefueling(id: string): Promise<boolean> {
    return this.aircraftRefuelingStorage.deleteRefueling(id);
  }

  // Dashboard methods
  async getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
    pendingDeliveries: number;
    totalVolumeSold: number;
  }> {
    return this.dashboardStorage.getDashboardStats();
  }

  async getRecentOperations(): Promise<any[]> {
    return this.dashboardStorage.getRecentOperations();
  }

  async getWeekStats(): Promise<{
    optDealsWeek: number;
    refuelingsWeek: number;
    volumeSoldWeek: number;
    profitWeek: number;
  }> {
    return this.dashboardStorage.getWeekStats();
  }
}