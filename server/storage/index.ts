import { UserStorage } from "./user-storage";
import { RoleStorage } from "./role-storage";
import { CustomerStorage } from "./customer-storage";
import { BaseStorage } from "./base-storage";
import { SupplierStorage } from "./supplier-storage";
import { LogisticsStorage } from "./logistics-storage";
import { PriceStorage } from "./price-storage";
import { WarehouseStorage } from "./warehouse-storage";
import { ExchangeStorage } from "./exchange-storage";
import { MovementStorage } from "./movement-storage";
import { OptStorage } from "./opt-storage";
import { AircraftRefuelingStorage } from "./aircraft-refueling-storage";
import { DashboardStorage } from "./dashboard-storage";

export * from "./types";

export class Storage {
  public users: UserStorage;
  public roles: RoleStorage;
  public customers: CustomerStorage;
  public bases: BaseStorage;
  public suppliers: SupplierStorage;
  public logistics: LogisticsStorage;
  public prices: PriceStorage;
  public warehouses: WarehouseStorage;
  public exchange: ExchangeStorage;
  public movement: MovementStorage;
  public opt: OptStorage;
  public aircraftRefueling: AircraftRefuelingStorage;
  public dashboard: DashboardStorage;

  constructor() {
    this.users = new UserStorage();
    this.roles = new RoleStorage();
    this.customers = new CustomerStorage();
    this.bases = new BaseStorage();
    this.suppliers = new SupplierStorage();
    this.logistics = new LogisticsStorage();
    this.prices = new PriceStorage();
    this.warehouses = new WarehouseStorage();
    this.exchange = new ExchangeExchangeStorage();
    this.movement = new MovementStorage();
    this.opt = new OptStorage();
    this.aircraftRefueling = new AircraftRefuelingStorage();
    this.dashboard = new DashboardStorage();
  }
}

export const storage = new Storage();