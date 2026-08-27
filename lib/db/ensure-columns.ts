import { pool } from '@/lib/db'

let ensured = false

/** Add profile columns and tables if this Neon DB predates them. */
export async function ensureUserProfileColumns() {
  if (ensured) return
  try {
    await pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" text`)
    await pool.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "dateOfBirth" text`)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS outbound_payment (
        id serial PRIMARY KEY,
        "userId" text NOT NULL,
        "fromAccountId" integer NOT NULL,
        method text NOT NULL,
        "amountCents" bigint NOT NULL,
        status text NOT NULL DEFAULT 'scheduled',
        "scheduledFor" timestamp NOT NULL,
        "recipientName" text NOT NULL,
        "recipientBank" text,
        "routingNumber" text,
        "accountNumber" text,
        "zelleHandle" text,
        memo text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "processedAt" timestamp
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_thread (
        id serial PRIMARY KEY,
        "userId" text NOT NULL,
        status text NOT NULL DEFAULT 'open',
        subject text NOT NULL DEFAULT 'Support chat',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_message (
        id serial PRIMARY KEY,
        "threadId" integer NOT NULL,
        sender text NOT NULL,
        body text NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    ensured = true
  } catch (err) {
    console.error('[db] ensureUserProfileColumns', err)
  }
}
