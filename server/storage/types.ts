export * from "server/modules/bases/storage/types";
export * from "server/modules/users/storage/types";
export * from "server/modules/movement/storage/types";
export * from "server/modules/refueling/storage/types";
export * from "server/modules/opt/storage/types";
export * from "server/modules/exchange/storage/types";
export * from "server/modules/warehouses/storage/types";
export * from "server/modules/suppliers/storage/types";
export * from "server/modules/customers/storage/types";
export * from "server/modules/logistics/storage/types";
export * from "server/modules/prices/storage/types";
export * from "server/modules/delivery/storage/types";
export * from "server/modules/dashboard/storage/types";
export * from "server/modules/users/storage/types";
export * from "server/modules/finance/storage/types";
import type { IPriceCalculationStorage } from "../modules/finance/storage/types";
import type { IReportsStorage } from "../modules/reports/storage/types";
import type { IAnalyticsStorage } from "../modules/analytics/storage/types";

export interface IStorage {
  bases: any;
  users: any;
  movement: any;
  refueling: any;
  opt: any;
  exchange: any;
  warehouses: any;
  suppliers: any;
  customers: any;
  logistics: any;
  prices: any;
  delivery: any;
  dashboard: any;
  finance: IPriceCalculationStorage;
  reports: IReportsStorage;
  analytics: IAnalyticsStorage;
}