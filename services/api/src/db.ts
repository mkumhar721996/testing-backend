import pg from 'pg';

// Pool connects lazily, so creating it does not require a running database.
export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
}
