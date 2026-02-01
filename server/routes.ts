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
import { registerReportsRoutes } from "./modules/reports/routes/reports";
import { registerAnalyticsRoutes } from "./modules/analytics/routes/analytics";
import { registerRegistriesRoutes } from "./modules/registries/routes/registries";
import { registerMonthlyPlanRoutes } from "./modules/monthly-plan/routes/monthly-plan";
import { registerGovernmentContractRoutes } from "./modules/gov-contracts/routes/gov-contracts";
import { registerBudgetRoutes } from "./modules/budget/routes/budget";
import { registerManagementReportRoutes } from "./modules/management-report/routes/management-report";
import { registerExportRoutes } from "./modules/export/routes/export";
import { registerExchangeRatesRoutes } from "./modules/exchange-rates/routes/exchange-rates";
import { registerStorageCardsRoutes } from "./modules/storage-cards/routes/storage-cards";
import { registerRefuelingAbroadRoutes } from "./modules/refueling-abroad/routes/refueling-abroad";
import { registerCurrenciesRoutes } from "./modules/currencies/routes/currencies";
import { SSEService } from "./services/sse-service";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Trust proxy - required for Replit deployment
  app.set("trust proxy", 1);

  await seedDefaultRoles();

  // SSE Endpoint
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    SSEService.register(res);
  });


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
  registerReportsRoutes(app);
  registerAnalyticsRoutes(app);
  registerRegistriesRoutes(app);
  registerMonthlyPlanRoutes(app);
  registerGovernmentContractRoutes(app);
  registerBudgetRoutes(app);
  registerManagementReportRoutes(app);
  registerExportRoutes(app);
  registerExchangeRatesRoutes(app);
  registerStorageCardsRoutes(app);
  registerRefuelingAbroadRoutes(app);
  registerCurrenciesRoutes(app);

  return httpServer;
}