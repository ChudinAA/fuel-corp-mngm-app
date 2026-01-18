import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../shared/schema";
import { sql } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(migrationClient, { schema });

async function runMigrations() {
  console.log("⏳ Starting migration sync...");
  
  try {
    // 1. Пытаемся поправить расхождения в структуре (идемпотентно)
    console.log("🔍 Checking for schema deltas...");
    
    // Пример идемпотентного добавления колонок, если их нет в Prod
    await db.execute(sql`
      DO $$ 
      BEGIN 
        -- 0043: add base_id to logistics_delivery_locations
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logistics_delivery_locations' AND column_name='base_id') THEN
          ALTER TABLE "logistics_delivery_locations" ADD COLUMN "base_id" uuid;
        END IF;

        -- 0044: add is_draft to various deal-like tables (example: opt)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='opt' AND column_name='is_draft') THEN
          ALTER TABLE "opt" ADD COLUMN "is_draft" boolean DEFAULT false;
        END IF;

        -- 0045: add trans_sum_price_date
        -- (Добавьте здесь аналогичные проверки для остальных колонок из 0043-0046)
        
        -- 0046: add basis for movement
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movement' AND column_name='basis') THEN
          ALTER TABLE "movement" ADD COLUMN "basis" text;
        END IF;
      END $$;
    `);

    console.log("📦 Applying file-based migrations...");
    await migrate(db, { migrationsFolder: "./migrations" });
    
    console.log("✅ Sync and migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
