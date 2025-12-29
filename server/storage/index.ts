import { UserStorage } from "../modules/users/storage/user-storage";
import { RoleStorage } from "../modules/users/storage/role-storage";
import { PriceStorage } from "../modules/prices/storage/price-storage";
import { DashboardStorage } from "../modules/dashboard/storage/dashboard-storage";
import { CustomerStorage } from "../modules/customers/storage/customer-storage";
import { BaseStorage } from "../modules/bases/storage/base-storage";
import { SupplierStorage } from "../modules/suppliers/storage/supplier-storage";
import { LogisticsStorage } from "../modules/logistics/storage/logistics-storage";
import { WarehouseStorage } from "../modules/warehouses/storage/warehouse-storage";
import { ExchangeStorage } from "../modules/exchange/storage/exchange-storage";
import { MovementStorage } from "../modules/movement/storage/movement-storage";
import { OptStorage } from "../modules/opt/storage/opt-storage";
import { AircraftRefuelingStorage } from "../modules/refueling/storage/aircraft-refueling-storage";
import { DeliveryStorage } from "../modules/delivery/storage/delivery-storage";

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
  public delivery: DeliveryStorage;
  public cashflow: CashflowStorage;
  public payments: PaymentCalendarStorage;
  public priceCalculations: PriceCalculationStorage;

  constructor() {
    this.users = new UserStorage();
    this.roles = new RoleStorage();
    this.customers = new CustomerStorage();
    this.bases = new BaseStorage();
    this.suppliers = new SupplierStorage();
    this.logistics = new LogisticsStorage();
    this.prices = new PriceStorage();
    this.warehouses = new WarehouseStorage();
    this.exchange = new ExchangeStorage();
    this.movement = new MovementStorage();
    this.opt = new OptStorage();
    this.aircraftRefueling = new AircraftRefuelingStorage();
    this.dashboard = new DashboardStorage();
    this.delivery = new DeliveryStorage();
  }
}

export const storage = new Storage();
