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
  // Trust proxy - required for Replit deployment
  app.set("trust proxy", 1);

  const isProduction = process.env.NODE_ENV === "production";

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "aviation-fuel-secret-key",
      resave: false,
      saveUninitialized: false,
      proxy: isProduction, // Trust the reverse proxy
      cookie: {
        secure: isProduction, // Use secure cookies in production (HTTPS)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProduction ? "none" : "lax", // Required for cross-site cookies in production
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