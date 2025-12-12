import type {
  User,
  InsertUser,
  Role,
  InsertRole,
  Customer,
  InsertCustomer,
  Base,
  InsertBase,
  Supplier,
  InsertSupplier,
  LogisticsCarrier,
  InsertLogisticsCarrier,
  LogisticsDeliveryLocation,
  InsertLogisticsDeliveryLocation,
  LogisticsVehicle,
  InsertLogisticsVehicle,
  LogisticsTrailer,
  InsertLogisticsTrailer,
  LogisticsDriver,
  InsertLogisticsDriver,
  LogisticsWarehouse,
  InsertLogisticsWarehouse,
  Price,
  InsertPrice,
  DeliveryCost,
  InsertDeliveryCost,
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

export interface IUserStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  verifyUserPassword(email: string, password: string): Promise<User | null>;
  updateLastLogin(id: string): Promise<void>;
}

export interface IRoleStorage {
  getRole(id: string): Promise<Role | undefined>;
  getAllRoles(): Promise<Role[]>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, data: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
}

export interface ICustomerStorage {
  getAllCustomers(module?: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
}

export interface IBaseStorage {
  getAllBases(baseType?: string): Promise<Base[]>;
  getBase(id: string): Promise<Base | undefined>;
  createBase(data: InsertBase): Promise<Base>;
  updateBase(id: string, data: Partial<InsertBase>): Promise<Base | undefined>;
  deleteBase(id: string): Promise<boolean>;
}

export interface ISupplierStorage {
  getAllSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(data: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;
}

export interface ILogisticsStorage {
  getAllLogisticsCarriers(): Promise<LogisticsCarrier[]>;
  getLogisticsCarrier(id: string): Promise<LogisticsCarrier | undefined>;
  createLogisticsCarrier(data: InsertLogisticsCarrier): Promise<LogisticsCarrier>;
  updateLogisticsCarrier(id: string, data: Partial<InsertLogisticsCarrier>): Promise<LogisticsCarrier | undefined>;
  deleteLogisticsCarrier(id: string): Promise<boolean>;
  getAllLogisticsDeliveryLocations(): Promise<LogisticsDeliveryLocation[]>;
  getLogisticsDeliveryLocation(id: string): Promise<LogisticsDeliveryLocation | undefined>;
  createLogisticsDeliveryLocation(data: InsertLogisticsDeliveryLocation): Promise<LogisticsDeliveryLocation>;
  updateLogisticsDeliveryLocation(id: string, data: Partial<InsertLogisticsDeliveryLocation>): Promise<LogisticsDeliveryLocation | undefined>;
  deleteLogisticsDeliveryLocation(id: string): Promise<boolean>;
  getAllLogisticsVehicles(carrierId?: string): Promise<LogisticsVehicle[]>;
  getLogisticsVehicle(id: string): Promise<LogisticsVehicle | undefined>;
  createLogisticsVehicle(data: InsertLogisticsVehicle): Promise<LogisticsVehicle>;
  updateLogisticsVehicle(id: string, data: Partial<InsertLogisticsVehicle>): Promise<LogisticsVehicle | undefined>;
  deleteLogisticsVehicle(id: string): Promise<boolean>;
  getAllLogisticsTrailers(carrierId?: string): Promise<LogisticsTrailer[]>;
  getLogisticsTrailer(id: string): Promise<LogisticsTrailer | undefined>;
  createLogisticsTrailer(data: InsertLogisticsTrailer): Promise<LogisticsTrailer>;
  updateLogisticsTrailer(id: string, data: Partial<InsertLogisticsTrailer>): Promise<LogisticsTrailer | undefined>;
  deleteLogisticsTrailer(id: string): Promise<boolean>;
  getAllLogisticsDrivers(carrierId?: string): Promise<LogisticsDriver[]>;
  getLogisticsDriver(id: string): Promise<LogisticsDriver | undefined>;
  createLogisticsDriver(data: InsertLogisticsDriver): Promise<LogisticsDriver>;
  updateLogisticsDriver(id: string, data: Partial<InsertLogisticsDriver>): Promise<LogisticsDriver | undefined>;
  deleteLogisticsDriver(id: string): Promise<boolean>;
}

export interface IPriceStorage {
  getAllPrices(): Promise<Price[]>;
  getPricesByRole(counterpartyRole: string, counterpartyType: string): Promise<Price[]>;
  createPrice(data: InsertPrice): Promise<Price>;
  updatePrice(id: string, data: Partial<InsertPrice>): Promise<Price | undefined>;
  deletePrice(id: string): Promise<boolean>;
  calculatePriceSelection(counterpartyId: string, counterpartyType: string, basis: string, dateFrom: string, dateTo: string): Promise<number>;
  checkPriceDateOverlaps(counterpartyId: string, counterpartyType: string, counterpartyRole: string, basis: string, dateFrom: string, dateTo: string, excludeId?: string): Promise<{ status: string; message: string; overlaps?: { id: string; dateFrom: string; dateTo: string }[] }>;
  getAllDeliveryCosts(): Promise<DeliveryCost[]>;
  createDeliveryCost(data: InsertDeliveryCost): Promise<DeliveryCost>;
  updateDeliveryCost(id: string, data: Partial<InsertDeliveryCost>): Promise<DeliveryCost | undefined>;
  deleteDeliveryCost(id: string): Promise<boolean>;
}

export interface IWarehouseStorage {
  getAllWarehouses(): Promise<Warehouse[]>;
  getWarehouse(id: string): Promise<Warehouse | undefined>;
  createWarehouse(data: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: string, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: string): Promise<boolean>;
  getWarehouseTransactions(warehouseId: string): Promise<any[]>;
  getWarehouseStatsForDashboard(): Promise<any[]>;
}

export interface IExchangeStorage {
  getExchangeDeals(page: number, pageSize: number): Promise<{ data: Exchange[]; total: number }>;
  createExchange(data: InsertExchange): Promise<Exchange>;
  updateExchange(id: string, data: Partial<InsertExchange>): Promise<Exchange | undefined>;
  deleteExchange(id: string): Promise<boolean>;
}

export interface IMovementStorage {
  getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }>;
  createMovement(data: InsertMovement): Promise<Movement>;
  updateMovement(id: string, data: Partial<InsertMovement>): Promise<Movement | undefined>;
  deleteMovement(id: string): Promise<boolean>;
}

export interface IOptStorage {
  getOptDeals(page: number, pageSize: number): Promise<{ data: Opt[]; total: number }>;
  createOpt(data: InsertOpt): Promise<Opt>;
  updateOpt(id: string, data: Partial<InsertOpt>): Promise<Opt | undefined>;
  deleteOpt(id: string): Promise<boolean>;
}

export interface IAircraftRefuelingStorage {
  getRefuelings(page: number, pageSize: number): Promise<{ data: AircraftRefueling[]; total: number }>;
  createRefueling(data: InsertAircraftRefueling): Promise<AircraftRefueling>;
  updateRefueling(id: string, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined>;
  deleteRefueling(id: string): Promise<boolean>;
}

export interface IDashboardStorage {
  getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
    pendingDeliveries: number;
    totalVolumeSold: number;
  }>;
  getRecentOperations(): Promise<any[]>;
  getWeekStats(): Promise<{
    optDealsWeek: number;
    refuelingsWeek: number;
    volumeSoldWeek: number;
    profitWeek: number;
  }>;
}

export interface IStorage {
  users: IUserStorage;
  roles: IRoleStorage;
  customers: ICustomerStorage;
  bases: IBaseStorage;
  suppliers: ISupplierStorage;
}