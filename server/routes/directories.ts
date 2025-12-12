import type { Express } from "express";
import { registerCustomersRoutes } from "./directories/customers";
import { registerBasesRoutes } from "./directories/bases";
import { registerSuppliersRoutes } from "./directories/suppliers";
import { registerLogisticsRoutes } from "./directories/logistics";

export function registerDirectoriesRoutes(app: Express) {
  registerCustomersRoutes(app);
  registerBasesRoutes(app);
  registerSuppliersRoutes(app);
  registerLogisticsRoutes(app);
}