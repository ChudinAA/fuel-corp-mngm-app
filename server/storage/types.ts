
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

export interface IWholesaleStorage {
  getAllWholesaleSuppliers(): Promise<WholesaleSupplier[]>;
  getWholesaleSupplier(id: string): Promise<WholesaleSupplier | undefined>;
  createWholesaleSupplier(data: InsertWholesaleSupplier): Promise<WholesaleSupplier>;
  updateWholesaleSupplier(id: string, data: Partial<InsertWholesaleSupplier>): Promise<WholesaleSupplier | undefined>;
  deleteWholesaleSupplier(id: string): Promise<boolean>;
  getAllWholesaleBases(supplierId?: string): Promise<WholesaleBase[]>;
  getWholesaleBase(id: string): Promise<WholesaleBase | undefined>;
  createWholesaleBase(data: InsertWholesaleBase): Promise<WholesaleBase>;
  updateWholesaleBase(id: string, data: Partial<InsertWholesaleBase>): Promise<WholesaleBase | undefined>;
  deleteWholesaleBase(id: string): Promise<boolean>;
}

export interface IRefuelingStorage {
  getAllRefuelingProviders(): Promise<RefuelingProvider[]>;
  getRefuelingProvider(id: string): Promise<RefuelingProvider | undefined>;
  createRefuelingProvider(data: InsertRefuelingProvider): Promise<RefuelingProvider>;
  updateRefuelingProvider(id: string, data: Partial<InsertRefuelingProvider>): Promise<RefuelingProvider | undefined>;
  deleteRefuelingProvider(id: string): Promise<boolean>;
  getAllRefuelingBases(providerId?: string): Promise<RefuelingBase[]>;
  getRefuelingBase(id: string): Promise<RefuelingBase | undefined>;
  createRefuelingBase(data: InsertRefuelingBase): Promise<RefuelingBase>;
  updateRefuelingBase(id: string, data: Partial<InsertRefuelingBase>): Promise<RefuelingBase | undefined>;
  deleteRefuelingBase(id: string): Promise<boolean>;
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


  getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
    pendingDeliveries: number;
    totalVolumeSold: number;
  }>;
  getWarehouseTransactions(warehouseId: string): Promise<any[]>;
  getRecentOperations(): Promise<any[]>;
  getWarehouseStatsForDashboard(): Promise<any[]>;
  getWeekStats(): Promise<{
    optDealsWeek: number;
    refuelingsWeek: number;
    volumeSoldWeek: number;
    profitWeek: number;
  }>;
}
