
import type { Express } from "express";
import { registerCustomerRoutes } from "./directories/customers";
import { registerLogisticsRoutes } from "./directories/logistics";
import { registerSupplierRoutes } from "./directories/suppliers";
import { registerBaseRoutes } from "./directories/bases";

export function registerDirectoriesRoutes(app: Express) {
  registerSupplierRoutes(app);
  registerBaseRoutes(app);
  registerCustomerRoutes(app);
  registerLogisticsRoutes(app);
}
