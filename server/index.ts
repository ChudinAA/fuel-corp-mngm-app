import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { RecalculationWorker } from "./modules/warehouses/services/recalculation-worker";
import { EquipmentRecalculationWorker } from "./modules/warehouses-equipment/services/equipment-recalculation-worker";
import { integrationRequestLogger } from "./modules/integrations/middleware/integration-request-logger";

const app = express();
const httpServer = createServer(app);

// Capture every request to the dedicated 1C API, including malformed JSON,
// without recording request bodies, query strings, or Authorization headers.
app.use("/api/integrations/1c/v1", integrationRequestLogger);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Session configuration
const PgStore = connectPgSimple(session);
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  session({
    store: new PgStore({
      pool: pgPool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    // Response bodies may contain one-time credentials or sensitive business data.
    // Request diagnostics are recorded by the dedicated integration logger.
    if (
      process.env.DEBUG_NETWORK === "true" &&
      !path.startsWith("/api/integrations/1c") &&
      !path.startsWith("/api/admin/integrations/1c")
    ) {
      capturedJsonResponse = bodyJson;
    }
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (process.env.DEBUG_NETWORK === "true") {
        log(logLine);
      } else if (res.statusCode >= 400) {
        log(`ERROR: ${logLine}`);
      }
    }
  });

  next();
});

// Global handlers to prevent server crashes from unhandled rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("[Process] Unhandled Promise Rejection:", reason?.message || reason);
  console.error("[Process] Promise:", promise);
  // Do NOT exit — log and continue
});

process.on("uncaughtException", (error: Error) => {
  console.error("[Process] Uncaught Exception:", error.message);
  console.error(error.stack);
  // Do NOT exit for recoverable errors
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("[Express] Unhandled error:", err.message || err);
    res.status(status).json({ message });
    // NOTE: do NOT re-throw here — it would become an unhandled rejection
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      RecalculationWorker.start(5000);
      log("Recalculation worker started");
      EquipmentRecalculationWorker.start(5000);
      log("Equipment recalculation worker started");
    },
  );
})();
