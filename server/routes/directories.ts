import type { Express } from "express";
import { registerCustomersRoutes } from "./directories/customers";
import { registerWholesaleRoutes } from "./directories/wholesale";
import { registerRefuelingDirectoryRoutes } from "./directories/refueling";
import { registerLogisticsRoutes } from "./directories/logistics";

export function registerDirectoriesRoutes(app: Express) {
  registerCustomersRoutes(app);
  registerWholesaleRoutes(app);
  registerRefuelingDirectoryRoutes(app);
  registerLogisticsRoutes(app);
}