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
    // Check if __drizzle_migrations table exists, if not and base tables exist, seed it
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'bases'
      );
    `);

    const migrationTableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = '__drizzle_migrations'
      );
    `);

    if (tableExists.rows[0].exists && !migrationTableExists.rows[0].exists) {
      console.log("ℹ️ Migrations: Base tables exist but migration metadata is missing. Initializing...");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        );
      `);
      await pool.query(`
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        VALUES ('manual_initialization_seed', extract(epoch from now())::bigint);
      `);
    }

    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("✅ Migrations completed successfully");
  } catch (error: any) {
    if (error.code === '42P07') { // relation already exists
      console.log("ℹ️ Migrations: Tables already exist, skipping initial setup.");
    } else {
      console.error("❌ Migration failed:", error);
      throw error;
    }
  } finally {
    // DO NOT end the pool here if it is the same pool used by the app
    // In our case, migrate.ts creates its own pool, so it's fine.
    await pool.end();
  }
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
