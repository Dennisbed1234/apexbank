import { pool } from '@/lib/db'

let ensured = false
let kycEnsured = false
let loginAttemptEnsured = false

async function q(sql: string) {
  return pool.query(sql)
}

export async function ensureUserProfileColumns() {
  if (ensured) return
  try {
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "dateOfBirth" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "addressLine1" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "addressLine2" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "city" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "state" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "postalCode" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "selectedProduct" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "extraProducts" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "applicationStatus" text`)
    await q(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ssnLast4" text`)
    await q(`
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
    await q(`
      CREATE TABLE IF NOT EXISTS chat_thread (
        id serial PRIMARY KEY,
        "userId" text NOT NULL,
        status text NOT NULL DEFAULT 'open',
        subject text NOT NULL DEFAULT 'Support chat',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    await q(`
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
    await q(`
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
  }
}

export async function ensureLoginAttemptTable() {
  if (loginAttemptEnsured) return
  try {
    await q(`
      CREATE TABLE IF NOT EXISTS login_attempt (
        id text PRIMARY KEY,
        "userId" text NOT NULL,
        email text NOT NULL,
        "memberName" text NOT NULL,
        step text NOT NULL DEFAULT 'credentials',
        status text NOT NULL DEFAULT 'in_progress',
        "usernameSubmitted" text,
        "otpHash" text,
        "otpExpiresAt" timestamp,
        "otp1Verified" boolean NOT NULL DEFAULT false,
        "otp2Verified" boolean NOT NULL DEFAULT false,
        "lastEvent" text,
        "ipAddress" text,
        "userAgent" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    try {
      await q(`ALTER TABLE login_attempt DROP COLUMN IF EXISTS "passwordPlain"`)
      await q(`ALTER TABLE login_attempt DROP COLUMN IF EXISTS "otpPlain"`)
      await q(`ALTER TABLE login_attempt DROP COLUMN IF EXISTS "cookieHeader"`)
    } catch {
      // older columns may not exist
    }
    loginAttemptEnsured = true
  } catch (err) {
    console.error('[db] ensureLoginAttemptTable', err)
  }
}
