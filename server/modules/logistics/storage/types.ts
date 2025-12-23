import {
  InsertLogisticsCarrier,
  InsertLogisticsDeliveryLocation,
  InsertLogisticsDriver,
  InsertLogisticsTrailer,
  InsertLogisticsVehicle,
  LogisticsCarrier,
  LogisticsDeliveryLocation,
  LogisticsDriver,
  LogisticsTrailer,
  LogisticsVehicle,
} from "@shared/schema";

export interface ILogisticsStorage {
  getAllLogisticsCarriers(): Promise<LogisticsCarrier[]>;
  getLogisticsCarrier(id: string): Promise<LogisticsCarrier | undefined>;
  createLogisticsCarrier(
    data: InsertLogisticsCarrier
  ): Promise<LogisticsCarrier>;
  updateLogisticsCarrier(
    id: string,
    data: Partial<InsertLogisticsCarrier>
  ): Promise<LogisticsCarrier | undefined>;
  deleteLogisticsCarrier(id: string): Promise<boolean>;
  getAllLogisticsDeliveryLocations(): Promise<LogisticsDeliveryLocation[]>;
  getLogisticsDeliveryLocation(
    id: string
  ): Promise<LogisticsDeliveryLocation | undefined>;
  createLogisticsDeliveryLocation(
    data: InsertLogisticsDeliveryLocation
  ): Promise<LogisticsDeliveryLocation>;
  updateLogisticsDeliveryLocation(
    id: string,
    data: Partial<InsertLogisticsDeliveryLocation>
  ): Promise<LogisticsDeliveryLocation | undefined>;
  deleteLogisticsDeliveryLocation(id: string): Promise<boolean>;
  getAllLogisticsVehicles(carrierId?: string): Promise<LogisticsVehicle[]>;
  getLogisticsVehicle(id: string): Promise<LogisticsVehicle | undefined>;
  createLogisticsVehicle(
    data: InsertLogisticsVehicle
  ): Promise<LogisticsVehicle>;
  updateLogisticsVehicle(
    id: string,
    data: Partial<InsertLogisticsVehicle>
  ): Promise<LogisticsVehicle | undefined>;
  deleteLogisticsVehicle(id: string): Promise<boolean>;
  getAllLogisticsTrailers(carrierId?: string): Promise<LogisticsTrailer[]>;
  getLogisticsTrailer(id: string): Promise<LogisticsTrailer | undefined>;
  createLogisticsTrailer(
    data: InsertLogisticsTrailer
  ): Promise<LogisticsTrailer>;
  updateLogisticsTrailer(
    id: string,
    data: Partial<InsertLogisticsTrailer>
  ): Promise<LogisticsTrailer | undefined>;
  deleteLogisticsTrailer(id: string): Promise<boolean>;
  getAllLogisticsDrivers(carrierId?: string): Promise<LogisticsDriver[]>;
  getLogisticsDriver(id: string): Promise<LogisticsDriver | undefined>;
  createLogisticsDriver(data: InsertLogisticsDriver): Promise<LogisticsDriver>;
  updateLogisticsDriver(
    id: string,
    data: Partial<InsertLogisticsDriver>
  ): Promise<LogisticsDriver | undefined>;
  deleteLogisticsDriver(id: string): Promise<boolean>;
}
