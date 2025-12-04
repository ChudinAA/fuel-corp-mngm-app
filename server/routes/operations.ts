import type { Express } from "express";
import { registerWarehousesOperationsRoutes } from "./operations/warehouses";
import { registerExchangeRoutes } from "./operations/exchange";
import { registerMovementRoutes } from "./operations/movement";
import { registerOptRoutes } from "./operations/opt";
import { registerRefuelingOperationsRoutes } from "./operations/refueling";
import { registerDashboardRoutes } from "./operations/dashboard";

export function registerOperationsRoutes(app: Express) {
  registerWarehousesOperationsRoutes(app);
  registerExchangeRoutes(app);
  registerMovementRoutes(app);
  registerOptRoutes(app);
  registerRefuelingOperationsRoutes(app);
  registerDashboardRoutes(app);
}