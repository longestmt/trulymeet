import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { env } from '$env/dynamic/private';

const pool = new pg.Pool({
    connectionString: env.DATABASE_URL || 'postgres://trulymeet:trulymeet@localhost:5432/trulymeet'
});

export const db = drizzle(pool, { schema });
