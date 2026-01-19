import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

export async function runMigrations() {
  console.log("⏳ Running migrations...");
  try {
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations completed successfully");
  } catch (error: any) {
    if (error.code === '42P07') { // relation already exists
      console.log("ℹ️ Migrations: Tables already exist. This usually happens when the database was synced via db:push but the migrations metadata table is missing or out of sync. Skipping initial schema creation.");
      return;
    }
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Allow running directly
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('migrate.ts') || 
  process.argv[1].endsWith('migrate.js') ||
  (process.env.NODE_ENV === 'production' && process.argv[1].endsWith('index.cjs') && process.argv.includes('--migrate'))
);

if (isDirectRun) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
