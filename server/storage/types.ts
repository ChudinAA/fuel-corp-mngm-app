
import type {
  User,
  InsertUser,
  Role,
  InsertRole,
  Customer,
  InsertCustomer,
  WholesaleSupplier,
  InsertWholesaleSupplier,
  WholesaleBase,
  InsertWholesaleBase,
  RefuelingProvider,
  InsertRefuelingProvider,
  RefuelingBase,
  InsertRefuelingBase,
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
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  verifyUserPassword(email: string, password: string): Promise<User | null>;
  updateLastLogin(id: number): Promise<void>;
}

export interface IRoleStorage {
  getRole(id: number): Promise<Role | undefined>;
  getAllRoles(): Promise<Role[]>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: number, data: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: number): Promise<boolean>;
}

export interface ICustomerStorage {
  getAllCustomers(module?: string): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
}

export interface IWholesaleStorage {
  getAllWholesaleSuppliers(): Promise<WholesaleSupplier[]>;
  getWholesaleSupplier(id: number): Promise<WholesaleSupplier | undefined>;
  createWholesaleSupplier(data: InsertWholesaleSupplier): Promise<WholesaleSupplier>;
  updateWholesaleSupplier(id: number, data: Partial<InsertWholesaleSupplier>): Promise<WholesaleSupplier | undefined>;
  deleteWholesaleSupplier(id: number): Promise<boolean>;
  getAllWholesaleBases(supplierId?: number): Promise<WholesaleBase[]>;
  getWholesaleBase(id: number): Promise<WholesaleBase | undefined>;
  createWholesaleBase(data: InsertWholesaleBase): Promise<WholesaleBase>;
  updateWholesaleBase(id: number, data: Partial<InsertWholesaleBase>): Promise<WholesaleBase | undefined>;
  deleteWholesaleBase(id: number): Promise<boolean>;
}

export interface IRefuelingStorage {
  getAllRefuelingProviders(): Promise<RefuelingProvider[]>;
  getRefuelingProvider(id: number): Promise<RefuelingProvider | undefined>;
  createRefuelingProvider(data: InsertRefuelingProvider): Promise<RefuelingProvider>;
  updateRefuelingProvider(id: number, data: Partial<InsertRefuelingProvider>): Promise<RefuelingProvider | undefined>;
  deleteRefuelingProvider(id: number): Promise<boolean>;
  getAllRefuelingBases(providerId?: number): Promise<RefuelingBase[]>;
  getRefuelingBase(id: number): Promise<RefuelingBase | undefined>;
  createRefuelingBase(data: InsertRefuelingBase): Promise<RefuelingBase>;
  updateRefuelingBase(id: number, data: Partial<InsertRefuelingBase>): Promise<RefuelingBase | undefined>;
  deleteRefuelingBase(id: number): Promise<boolean>;
}

export interface ILogisticsStorage {
  getAllLogisticsCarriers(): Promise<LogisticsCarrier[]>;
  getLogisticsCarrier(id: number): Promise<LogisticsCarrier | undefined>;
  createLogisticsCarrier(data: InsertLogisticsCarrier): Promise<LogisticsCarrier>;
  updateLogisticsCarrier(id: number, data: Partial<InsertLogisticsCarrier>): Promise<LogisticsCarrier | undefined>;
  deleteLogisticsCarrier(id: number): Promise<boolean>;
  getAllLogisticsDeliveryLocations(): Promise<LogisticsDeliveryLocation[]>;
  getLogisticsDeliveryLocation(id: number): Promise<LogisticsDeliveryLocation | undefined>;
  createLogisticsDeliveryLocation(data: InsertLogisticsDeliveryLocation): Promise<LogisticsDeliveryLocation>;
  updateLogisticsDeliveryLocation(id: number, data: Partial<InsertLogisticsDeliveryLocation>): Promise<LogisticsDeliveryLocation | undefined>;
  deleteLogisticsDeliveryLocation(id: number): Promise<boolean>;
  getAllLogisticsVehicles(carrierId?: number): Promise<LogisticsVehicle[]>;
  getLogisticsVehicle(id: number): Promise<LogisticsVehicle | undefined>;
  createLogisticsVehicle(data: InsertLogisticsVehicle): Promise<LogisticsVehicle>;
  updateLogisticsVehicle(id: number, data: Partial<InsertLogisticsVehicle>): Promise<LogisticsVehicle | undefined>;
  deleteLogisticsVehicle(id: number): Promise<boolean>;
  getAllLogisticsTrailers(carrierId?: number): Promise<LogisticsTrailer[]>;
  getLogisticsTrailer(id: number): Promise<LogisticsTrailer | undefined>;
  createLogisticsTrailer(data: InsertLogisticsTrailer): Promise<LogisticsTrailer>;
  updateLogisticsTrailer(id: number, data: Partial<InsertLogisticsTrailer>): Promise<LogisticsTrailer | undefined>;
  deleteLogisticsTrailer(id: number): Promise<boolean>;
  getAllLogisticsDrivers(carrierId?: number): Promise<LogisticsDriver[]>;
  getLogisticsDriver(id: number): Promise<LogisticsDriver | undefined>;
  createLogisticsDriver(data: InsertLogisticsDriver): Promise<LogisticsDriver>;
  updateLogisticsDriver(id: number, data: Partial<InsertLogisticsDriver>): Promise<LogisticsDriver | undefined>;
  deleteLogisticsDriver(id: number): Promise<boolean>;
  getAllLogisticsWarehouses(): Promise<LogisticsWarehouse[]>;
  getLogisticsWarehouse(id: number): Promise<LogisticsWarehouse | undefined>;
  createLogisticsWarehouse(data: InsertLogisticsWarehouse): Promise<LogisticsWarehouse>;
  updateLogisticsWarehouse(id: number, data: Partial<InsertLogisticsWarehouse>): Promise<LogisticsWarehouse | undefined>;
  deleteLogisticsWarehouse(id: number): Promise<boolean>;
}

export interface IPriceStorage {
  getAllPrices(): Promise<Price[]>;
  getPricesByRole(counterpartyRole: string, counterpartyType: string): Promise<Price[]>;
  createPrice(data: InsertPrice): Promise<Price>;
  updatePrice(id: number, data: Partial<InsertPrice>): Promise<Price | undefined>;
  deletePrice(id: number): Promise<boolean>;
  calculatePriceSelection(counterpartyId: number, counterpartyType: string, basis: string, dateFrom: string, dateTo: string): Promise<number>;
  checkPriceDateOverlaps(counterpartyId: number, counterpartyType: string, counterpartyRole: string, basis: string, dateFrom: string, dateTo: string, excludeId?: number): Promise<{ status: string; message: string; overlaps?: { id: number; dateFrom: string; dateTo: string }[] }>;
  getAllDeliveryCosts(): Promise<DeliveryCost[]>;
  createDeliveryCost(data: InsertDeliveryCost): Promise<DeliveryCost>;
  updateDeliveryCost(id: number, data: Partial<InsertDeliveryCost>): Promise<DeliveryCost | undefined>;
  deleteDeliveryCost(id: number): Promise<boolean>;
}

export interface IOperationsStorage {
  getAllWarehouses(): Promise<Warehouse[]>;
  getWarehouse(id: number): Promise<Warehouse | undefined>;
  createWarehouse(data: InsertWarehouse): Promise<Warehouse>;
  updateWarehouse(id: number, data: Partial<InsertWarehouse>): Promise<Warehouse | undefined>;
  deleteWarehouse(id: number): Promise<boolean>;
  getExchangeDeals(page: number, pageSize: number): Promise<{ data: Exchange[]; total: number }>;
  createExchange(data: InsertExchange): Promise<Exchange>;
  updateExchange(id: number, data: Partial<InsertExchange>): Promise<Exchange | undefined>;
  deleteExchange(id: number): Promise<boolean>;
  getMovements(page: number, pageSize: number): Promise<{ data: Movement[]; total: number }>;
  createMovement(data: InsertMovement): Promise<Movement>;
  updateMovement(id: number, data: Partial<InsertMovement>): Promise<Movement | undefined>;
  deleteMovement(id: number): Promise<boolean>;
  getOptDeals(page: number, pageSize: number): Promise<{ data: Opt[]; total: number }>;
  createOpt(data: InsertOpt): Promise<Opt>;
  updateOpt(id: number, data: Partial<InsertOpt>): Promise<Opt | undefined>;
  deleteOpt(id: number): Promise<boolean>;
  getRefuelings(page: number, pageSize: number): Promise<{ data: AircraftRefueling[]; total: number }>;
  createRefueling(data: InsertAircraftRefueling): Promise<AircraftRefueling>;
  updateRefueling(id: number, data: Partial<InsertAircraftRefueling>): Promise<AircraftRefueling | undefined>;
  deleteRefueling(id: number): Promise<boolean>;
  getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
  }>;
}
