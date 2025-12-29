import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./modules/users/routes/auth";
import { registerAdminRoutes } from "./modules/users/routes/admin";
import { registerPricesRoutes } from "./modules/prices/routes/prices";
import { registerDeliveryRoutes } from "./modules/delivery/routes/delivery";
import { seedDefaultRoles } from "./modules/users/routes/utils";
import { registerSuppliersRoutes } from "./modules/suppliers/routes/suppliers";
import { registerBasesRoutes } from "./modules/bases/routes/bases";
import { registerCustomersRoutes } from "./modules/customers/routes/customers";
import { registerLogisticsRoutes } from "./modules/logistics/routes/logistics";
import { registerWarehousesOperationsRoutes } from "./modules/warehouses/routes/warehouses";
import { registerExchangeRoutes } from "./modules/exchange/routes/exchange";
import { registerMovementRoutes } from "./modules/movement/routes/movement";
import { registerOptRoutes } from "./modules/opt/routes/opt";
import { registerRefuelingOperationsRoutes } from "./modules/refueling/routes/refueling";
import { registerDashboardRoutes } from "./modules/dashboard/routes/dashboard";
import { enrichAuditContext } from "./modules/audit/middleware/audit-middleware";
import { registerAuditRoutes } from "./modules/audit/routes/audit";
import { registerCashflowRoutes } from "./modules/finance/routes/cashflow";
import { registerPaymentCalendarRoutes } from "./modules/finance/routes/payment-calendar";
import { registerPriceCalculationRoutes } from "./modules/finance/routes/price-calculation";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Trust proxy - required for Replit deployment
  app.set("trust proxy", 1);

  await seedDefaultRoles();

  // Apply audit context enrichment globally
  app.use(enrichAuditContext);

  // Register all route modules
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerSuppliersRoutes(app);
  registerBasesRoutes(app);
  registerCustomersRoutes(app);
  registerLogisticsRoutes(app);
  registerPricesRoutes(app);
  registerDeliveryRoutes(app);
  registerWarehousesOperationsRoutes(app);
  registerExchangeRoutes(app);
  registerMovementRoutes(app);
  registerAuditRoutes(app);
  registerOptRoutes(app);
  registerRefuelingOperationsRoutes(app);
  registerDashboardRoutes(app);
  registerCashflowRoutes(app);
  registerPaymentCalendarRoutes(app);
  registerPriceCalculationRoutes(app);

  return httpServer;
}