import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
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
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "aviation-fuel-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

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