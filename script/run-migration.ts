
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const migrationSQL = fs.readFileSync(
      path.join(process.cwd(), 'migrations', '0003_migrate_to_uuid.sql'),
      'utf-8'
    );

    console.log('Running migration...');
    await client.query(migrationSQL);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration();
