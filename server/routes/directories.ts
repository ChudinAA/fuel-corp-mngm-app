
import type { Express } from "express";
import { registerCustomersRoutes } from "./directories/customers";
import { registerLogisticsRoutes } from "./directories/logistics";
import { registerSuppliersRoutes } from "./directories/suppliers";
import { registerBasesRoutes } from "./directories/bases";

export function registerDirectoriesRoutes(app: Express) {
  registerSuppliersRoutes(app);
  registerBasesRoutes(app);
  registerCustomersRoutes(app);
  registerLogisticsRoutes(app);
}
