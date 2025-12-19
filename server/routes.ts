import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminRoutes } from "./routes/admin";
import { registerDirectoriesRoutes } from "./routes/directories";
import { registerPricesRoutes } from "./routes/prices";
import { registerDeliveryRoutes } from "./routes/delivery"; // Import new delivery routes
import { registerOperationsRoutes } from "./routes/operations";
import { seedDefaultRoles } from "./routes/utils";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Trust proxy - required for Replit deployment
  app.set("trust proxy", 1);

  await seedDefaultRoles();

  // Register all route modules
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerDirectoriesRoutes(app);
  registerPricesRoutes(app);
  registerDeliveryRoutes(app); // Register new delivery routes
  registerOperationsRoutes(app);

  return httpServer;
}