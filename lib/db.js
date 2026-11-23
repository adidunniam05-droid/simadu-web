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

  /**
   * Jalankan beberapa query dalam satu transaksi: semua tersimpan, atau
   * (bila ada error) semua dibatalkan.
   */
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  },
};
