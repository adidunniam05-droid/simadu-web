import { Pool } from 'pg';

const globalForPg = global;

const pool =
  globalForPg.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;

export const db = {
  query: (text, params) => pool.query(text, params),
};