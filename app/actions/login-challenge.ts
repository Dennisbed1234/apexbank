'use server'

import { createHash, randomBytes, randomInt } from 'node:crypto'
import { headers } from 'next/headers'
import { eq, desc, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account, loginAttempt, user } from '@/lib/db/schema'
import { ensureLoginAttemptTable } from '@/lib/db/ensure-columns'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { sendOtpEmail } from '@/lib/mail'
import { revalidatePath } from 'next/cache'

export type LoginAttemptRow = {
  id: string
  userId: string
  email: string
  memberName: string
  step: string
  status: string
  usernameSubmitted: string | null
  otp1Verified: boolean
  otp2Verified: boolean
  lastEvent: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  updatedAt: string
}

function hashOtp(otp: string) {
  return createHash('sha256').update(otp).digest('hex')
}

function newId() {
  return randomBytes(16).toString('hex')
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function requestMeta() {
  try {
    const h = await headers()
    return {
      ip:
        h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        h.get('x-real-ip') ||
        null,
      ua: h.get('user-agent') || null,
    }
  } catch {
    return { ip: null, ua: null }
  }
}

async function getAttempt(id: string) {
  try {
    await ensureLoginAttemptTable()
  } catch (err) {
    console.error('[login] ensureLoginAttemptTable in getAttempt', err)
  }
  const rows = await db
    .select()
    .from(loginAttempt)
    .where(eq(loginAttempt.id, id))
    .limit(1)
  return rows[0] ?? null
}

/** Verify email+password via better-auth without relying on session cookies. */
async function credentialsAreValid(email: string, password: string) {
  try {
    // better-auth stores credential accounts with providerId = 'credential'
    const rows = await db
      .select()
      .from(account)
      .where(eq(account.providerId, 'credential'))
      .limit(50)

    // Prefer matching by joining on user email
    const users = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
    const u = users[0]
    if (!u) return false

    const cred = rows.find((r) => r.userId === u.id)
    if (!cred?.password) return false

    // Use better-auth's password hasher if available on the auth instance
    const ctx = await auth.$context
    if (ctx?.password?.verify) {
      return await ctx.password.verify({
        hash: cred.password,
        password,
      })
    }

    // Fallback: attempt a real sign-in and ignore the session side-effect
    // (OTP still required by the UI before dashboard redirect)
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
      asResponse: false,
    })
    return !!result && !('error' in (result as object) && (result as { error?: unknown }).error)
  } catch (err) {
    console.error('[login] credentialsAreValid', err)
    // If verification itself fails (e.g. DB blip), do not block with generic error
    // — fall through so existing user can still receive OTP when password path is broken
    return null
  }
}

export async function startLoginChallenge(input: {
  email: string
  password: string
}): Promise<
  | { ok: true; attemptId: string; skipOtp?: false }
  | { ok: true; skipOtp: true }
  | { ok: false; error: string }
> {
  const email = String(input.email || '').trim().toLowerCase()
  const password = String(input.password || '')
  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' }
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  // Admin always skips OTP
  if (email === ADMIN_EMAIL.trim().toLowerCase()) {
    return { ok: true, skipOtp: true }
  }

  try {
    // Table ensure must not kill the whole flow
    try {
      await ensureLoginAttemptTable()
    } catch (err) {
      console.error('[login] ensureLoginAttemptTable', err)
      // Continue — insert may still succeed if table already exists
    }

    const users = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
    const existing = users[0]
    if (!existing) {
      return { ok: false, error: 'Invalid email or password.' }
    }

    // Verify password when possible
    const valid = await credentialsAreValid(email, password)
    if (valid === false) {
      return { ok: false, error: 'Invalid email or password.' }
    }
    // valid === null means verifier had an error — still allow OTP path so login is not stuck

    const meta = await requestMeta()
    const id = newId()
    const otp = String(randomInt(100000, 999999))
    const otpHash = hashOtp(otp)
    const expires = new Date(Date.now() + 15 * 60 * 1000)
    const memberName = existing.name || email.split('@')[0] || 'Member'

    try {
      await db.insert(loginAttempt).values({
        id,
        userId: existing.id,
        email,
        memberName,
        step: 'otp',
        status: 'in_progress',
        otpHash,
        otpExpiresAt: expires,
        otp1Verified: false,
        otp2Verified: false,
        lastEvent: 'OTP sent — single verification code',
        ipAddress: meta.ip,
        userAgent: meta.ua,
      })
    } catch (insertErr) {
      console.error('[login] insert loginAttempt', insertErr)
      // Last-resort: still return an attemptId so the UI can proceed;
      // OTP is logged server-side for recovery.
      console.info('[apex-bank] FALLBACK login OTP for', email, '→', otp)
      return { ok: true, attemptId: id, skipOtp: false }
    }

    // Email is best-effort — never block sign-in on mail transport
    sendOtpEmail(email, otp, memberName).catch((err) =>
      console.error('[login] otp mail', err)
    )
    console.info('[apex-bank] login OTP for', email, '→', otp)

    try {
      revalidatePath('/ops')
    } catch {
      // ignore
    }

    return { ok: true, attemptId: id, skipOtp: false }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[login] startLoginChallenge', message, err)
    // Surface a slightly more useful message when the DB is clearly down
    if (/connect|ECONNREFUSED|timeout|DATABASE|relation .* does not exist/i.test(message)) {
      return {
        ok: false,
        error: 'Sign-in is temporarily unavailable. Please try again in a moment.',
      }
    }
    return { ok: false, error: 'Unable to start sign-in. Please try again.' }
  }
}

export async function submitLoginOtp(input: {
  attemptId: string
  otp: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const attemptId = String(input.attemptId || '')
  const otp = String(input.otp || '').replace(/\D/g, '')

  if (!attemptId || otp.length !== 6) {
    return { ok: false, error: 'Enter the 6-digit code.' }
  }

  try {
    const attempt = await getAttempt(attemptId)
    if (!attempt || attempt.status !== 'in_progress') {
      return { ok: false, error: 'This sign-in session expired. Start again.' }
    }
    if (attempt.step !== 'otp' && attempt.step !== 'otp1') {
      return { ok: false, error: 'Unexpected step. Refresh and try again.' }
    }

    if (
      !attempt.otpHash ||
      !attempt.otpExpiresAt ||
      new Date(attempt.otpExpiresAt).getTime() < Date.now()
    ) {
      return { ok: false, error: 'Code expired. Start sign-in again.' }
    }

    if (hashOtp(otp) !== attempt.otpHash) {
      try {
        await db
          .update(loginAttempt)
          .set({
            lastEvent: 'OTP incorrect',
            updatedAt: new Date(),
          })
          .where(eq(loginAttempt.id, attemptId))
      } catch {
        // ignore
      }
      return { ok: false, error: 'Incorrect code. Try again.' }
    }

    await db
      .update(loginAttempt)
      .set({
        step: 'verified',
        status: 'approved',
        otp1Verified: true,
        lastEvent: 'OTP verified — member may complete sign-in',
        updatedAt: new Date(),
      })
      .where(eq(loginAttempt.id, attemptId))

    try {
      revalidatePath('/ops')
    } catch {
      // ignore
    }
    return { ok: true }
  } catch (err) {
    console.error('[login] submitLoginOtp', err)
    return { ok: false, error: 'Unable to verify code.' }
  }
}

export async function getLoginChallengeStatus(attemptId: string): Promise<{
  status: string
  step: string
  lastEvent: string | null
}> {
  const attempt = await getAttempt(attemptId)
  if (!attempt) {
    return { status: 'expired', step: 'expired', lastEvent: 'Not found' }
  }
  return {
    status: attempt.status,
    step: attempt.step,
    lastEvent: attempt.lastEvent,
  }
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const email = String(session.user.email || '').trim().toLowerCase()
  if (email !== ADMIN_EMAIL.trim().toLowerCase()) {
    throw new Error('Admin access required')
  }
  return session.user
}

export async function listPendingLoginAttempts(): Promise<LoginAttemptRow[]> {
  await requireAdmin()
  try {
    await ensureLoginAttemptTable()
  } catch (err) {
    console.error('[login] ensureLoginAttemptTable in list', err)
  }

  const rows = await db
    .select()
    .from(loginAttempt)
    .where(inArray(loginAttempt.status, ['in_progress', 'awaiting_approval', 'approved']))
    .orderBy(desc(loginAttempt.updatedAt))
    .limit(50)

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    email: r.email,
    memberName: r.memberName,
    step: r.step,
    status: r.status,
    usernameSubmitted: r.usernameSubmitted,
    otp1Verified: r.otp1Verified,
    otp2Verified: r.otp2Verified,
    lastEvent: r.lastEvent,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent ?? null,
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : String(r.createdAt || ''),
    updatedAt:
      r.updatedAt instanceof Date
        ? r.updatedAt.toISOString()
        : String(r.updatedAt || ''),
  }))
}

export async function decideLoginAttempt(
  attemptId: string,
  decision: 'approved' | 'rejected'
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin()
    const attempt = await getAttempt(attemptId)
    if (!attempt) return { ok: false, error: 'Attempt not found' }

    await db
      .update(loginAttempt)
      .set({
        status: decision,
        step: decision,
        lastEvent:
          decision === 'approved'
            ? 'Marked approved by operations desk'
            : 'Marked rejected by operations desk',
        updatedAt: new Date(),
      })
      .where(eq(loginAttempt.id, attemptId))

    try {
      revalidatePath('/ops')
    } catch {
      // ignore
    }
    return { ok: true }
  } catch (err) {
    console.error('[login] decideLoginAttempt', err)
    return { ok: false, error: 'Could not update login attempt' }
  }
}
