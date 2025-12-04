
import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const { Client } = pg;

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
    console.log('This may take a few moments...');
    
    // Split by statement and execute one by one for better error reporting
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        await client.query(statements[i]);
      } catch (error) {
        console.error(`Error in statement ${i + 1}:`, statements[i].substring(0, 100));
        throw error;
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch(() => process.exit(1));
