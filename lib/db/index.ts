import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

// Neon serverless works on Vercel; plain `pg` TCP pools often hang or fail cold starts.
// Disable WebSocket in edge-like environments — Pool falls back to HTTP fetch.
if (typeof WebSocket === 'undefined') {
  // Node on Vercel: use the built-in undici/websocket when available;
  // neonConfig will negotiate correctly with the connection string.
  neonConfig.poolQueryViaFetch = true
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('[db] DATABASE_URL is not set')
}

export const pool = new Pool({
  connectionString,
})

export const db = drizzle(pool, { schema })
