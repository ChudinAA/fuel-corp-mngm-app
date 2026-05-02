/**
 * db.standalone.ts — Альтернативный модуль подключения к БД
 * для развёртывания на серверах заказчика (стандартный PostgreSQL,
 * без Neon serverless / WebSocket).
 *
 * КАК ИСПОЛЬЗОВАТЬ:
 *   1. Переименуйте server/db.ts → server/db.neon.ts (резервная копия)
 *   2. Переименуйте server/db.standalone.ts → server/db.ts
 *   3. Соберите проект: npm run build
 *
 * DATABASE_URL формат: postgresql://user:password@host:5432/dbname
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Example: postgresql://avfuel:password@db:5432/avfuel"
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                  // максимум соединений в пуле
  idleTimeoutMillis: 30000, // закрывать простаивающие соединения через 30с
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

// Graceful shutdown
process.on("SIGTERM", async () => {
  await pool.end();
});
