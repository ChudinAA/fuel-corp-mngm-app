import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { Pool as NodePostgresPool } from "pg";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const useStandardPostgres = process.env.STOCK_TEST_USE_STANDARD_POSTGRES === "true";
const nodePostgresPool = useStandardPostgres
  ? new NodePostgresPool({ connectionString: process.env.DATABASE_URL })
  : undefined;
const neonPool = useStandardPostgres
  ? undefined
  : new Pool({ connectionString: process.env.DATABASE_URL });

export const pool = (nodePostgresPool ?? neonPool)!;
export const db = (
  nodePostgresPool
    ? drizzleNodePostgres(nodePostgresPool, { schema })
    : drizzle({ client: neonPool!, schema })
) as unknown as NeonDatabase<typeof schema>;
