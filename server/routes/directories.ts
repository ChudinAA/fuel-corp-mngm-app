
import type { Express } from "express";
import { registerCustomerRoutes } from "./directories/customers";
import { registerLogisticsRoutes } from "./directories/logistics";
import { registerSuppliersRoutes } from "./directories/suppliers";
import { registerBasesRoutes } from "./directories/bases";

export function registerDirectoriesRoutes(app: Express) {
  registerSuppliersRoutes(app);
  registerBasesRoutes(app);
  registerCustomerRoutes(app);
  registerLogisticsRoutes(app);
}
