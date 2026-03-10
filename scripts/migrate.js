import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import pg from 'pg';

async function main() {
    console.log('[Migration] Starting database migration process...');
    const databaseUrl = process.env.DATABASE_URL || 'postgres://trulymeet:trulymeet@localhost:5432/trulymeet';
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);

    try {
        const { rows: tableRows } = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'events'
            );
        `);
        const eventsTableExists = tableRows[0].exists;

        const { rows: typeRows } = await pool.query(`
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'availability_status'
            );
        `);
        const typeExists = typeRows[0].exists;

        let migrationsApplied = 0;
        const { rows: migrationTableRows } = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'drizzle' 
                AND table_name = '__drizzle_migrations'
            );
        `);
        const migrationsTableExists = migrationTableRows[0].exists;

        if (migrationsTableExists) {
            const { rows: countRows } = await pool.query('SELECT COUNT(*) as count FROM "drizzle"."__drizzle_migrations"');
            migrationsApplied = parseInt(countRows[0].count, 10);
        }

        if ((eventsTableExists || typeExists) && migrationsApplied === 0) {
            console.log('[Migration] Detected legacy database.');
            console.log('[Migration] Bootstrapping __drizzle_migrations safely...');

            await pool.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
                    id SERIAL PRIMARY KEY,
                    hash text NOT NULL,
                    created_at bigint
                );
            `);

            const migrations = readMigrationFiles({ migrationsFolder: 'drizzle' });
            if (migrations && migrations.length > 0) {
                const baselineHash = migrations[0].hash;
                await pool.query(
                    `INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
                    [baselineHash, migrations[0].folderMillis]
                );
                console.log(`[Migration] Baseline successfully marked complete.`);
            }
        }

        console.log('[Migration] Applying Drizzle migrations...');
        await migrate(db, { migrationsFolder: 'drizzle' });
        console.log('[Migration] Database is up to date!');
    } catch (error) {
        console.error('[Migration] Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
