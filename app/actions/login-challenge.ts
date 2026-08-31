'use server'

import { createHash, randomBytes, randomInt } from 'node:crypto'
import { headers } from 'next/headers'
import { eq, desc, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account, loginAttempt, user } from '@/lib/db/schema'
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
  otp1Verified: boolean
  otp2Verified: boolean
  lastEvent: string | null
  ipAddress: string | null
  createdAt: string
  updatedAt: string
}

function hashOtp(otp: string) {
  return createHash('sha256').update(otp).digest('hex')
}

function newId() {
  return randomBytes(16).toString('hex')
}

async function requestMeta() {
  const h = await headers()
  return {
    ip:
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null,
    ua: h.get('user-agent') || null,
  }
}

async function notifyAdmin(attempt: {
  id: string
  email: string
  memberName: string
  step: string
  lastEvent: string
  ipAddress?: string | null
}) {
  void sendAdminLoginStepAlert({
    attemptId: attempt.id,
    email: attempt.email,
    memberName: attempt.memberName,
    step: attempt.step,
    event: attempt.lastEvent,
    ip: attempt.ipAddress || undefined,
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

/** Step 1: email + password. Does NOT create a session yet. */
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

  try {
    await ensureLoginAttemptTable()

    // Verify credentials without creating a lasting session for the user yet.
    // better-auth sign-in will set cookies; we only care about success/failure.
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
      asResponse: true,
    })

    if (!result.ok) {
      return { ok: false, error: 'Invalid email or password.' }
    }

    // Immediately sign out so the multi-step challenge controls access.
    try {
      await auth.api.signOut({ headers: await headers() })
    } catch {
      // ignore
    }

    const users = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
    const member = users[0]
    if (!member) {
      return { ok: false, error: 'Invalid email or password.' }
    }

    const meta = await requestMeta()
    const id = newId()
    const lastEvent = 'Email & password accepted — waiting for username'

    await db.insert(loginAttempt).values({
      id,
      userId: member.id,
      email: member.email,
      memberName: member.name || 'Member',
      step: 'username',
      status: 'in_progress',
      lastEvent,
      ipAddress: meta.ip,
      userAgent: meta.ua,
    })

    await notifyAdmin({
      id,
      email: member.email,
      memberName: member.name || 'Member',
      step: 'credentials',
      lastEvent: 'User submitted email & password (verified)',
      ipAddress: meta.ip,
    })

    revalidatePath('/ops')
    return { ok: true, attemptId: id }
  } catch (err) {
    console.error('[login] startLoginChallenge', err)
    return { ok: false, error: 'Unable to start sign-in. Please try again.' }
  }
}

/** Step 2: username (must match member name, case-insensitive). */
export async function submitLoginUsername(input: {
  attemptId: string
  username: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const attemptId = String(input.attemptId || '')
  const username = String(input.username || '').trim()
  if (!attemptId || !username) {
    return { ok: false, error: 'Username is required.' }
  }

  try {
    const attempt = await getAttempt(attemptId)
    if (!attempt || attempt.status !== 'in_progress') {
      return { ok: false, error: 'This sign-in session expired. Start again.' }
    }
    if (attempt.step !== 'username') {
      return { ok: false, error: 'Unexpected step. Refresh and try again.' }
    }

    const expected = String(attempt.memberName || '').trim().toLowerCase()
    if (username.toLowerCase() !== expected) {
      await db
        .update(loginAttempt)
        .set({
          lastEvent: `Username rejected: "${username}"`,
          updatedAt: new Date(),
        })
        .where(eq(loginAttempt.id, attemptId))

      await notifyAdmin({
        id: attempt.id,
        email: attempt.email,
        memberName: attempt.memberName,
        step: 'username',
        lastEvent: `Wrong username entered: "${username}"`,
        ipAddress: attempt.ipAddress,
      })
      revalidatePath('/ops')
      return { ok: false, error: 'Username does not match this account.' }
    }

    // Generate 6-digit OTP and email it to the member.
    const otp = String(randomInt(100000, 999999))
    const otpHash = hashOtp(otp)
    const expires = new Date(Date.now() + 10 * 60 * 1000)
    const lastEvent = 'Username verified — OTP sent (enter twice)'

    await db
      .update(loginAttempt)
      .set({
        step: 'otp1',
        usernameSubmitted: username,
        otpHash,
        otpExpiresAt: expires,
        otp1Verified: false,
        otp2Verified: false,
        lastEvent,
        updatedAt: new Date(),
      })
      .where(eq(loginAttempt.id, attemptId))

    await sendOtpEmail(attempt.email, otp, attempt.memberName).catch((err) =>
      console.error('[login] otp mail', err)
    )

    // Log OTP to server console for demo / ops visibility if mail fails
    console.info('[apex-bank] login OTP for', attempt.email, otp)

    await notifyAdmin({
      id: attempt.id,
      email: attempt.email,
      memberName: attempt.memberName,
      step: 'username',
      lastEvent: `Username accepted: "${username}". OTP generated & emailed.`,
      ipAddress: attempt.ipAddress,
    })

    revalidatePath('/ops')
    return { ok: true }
  } catch (err) {
    console.error('[login] submitLoginUsername', err)
    return { ok: false, error: 'Unable to verify username.' }
  }
}

/** Step 3a / 3b: first or second OTP entry (same code, entered twice). */
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
          lastEvent: `OTP #${which} incorrect`,
          updatedAt: new Date(),
        })
        .where(eq(loginAttempt.id, attemptId))

      await notifyAdmin({
        id: attempt.id,
        email: attempt.email,
        memberName: attempt.memberName,
        step: expectedStep,
        lastEvent: `OTP #${which} failed (wrong code)`,
        ipAddress: attempt.ipAddress,
      })
      revalidatePath('/ops')
      return { ok: false, error: 'Incorrect code. Try again.' }
    }

    if (which === 1) {
      await db
        .update(loginAttempt)
        .set({
          step: 'otp2',
          otp1Verified: true,
          lastEvent: 'OTP #1 verified — enter the same code again',
          updatedAt: new Date(),
        })
        .where(eq(loginAttempt.id, attemptId))

      await notifyAdmin({
        id: attempt.id,
        email: attempt.email,
        memberName: attempt.memberName,
        step: 'otp1',
        lastEvent: 'OTP #1 verified successfully',
        ipAddress: attempt.ipAddress,
      })

      revalidatePath('/ops')
      return { ok: true, next: 'otp2' }
    }

    // Second OTP correct → waiting for ops desk approval
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
      lastEvent:
        'OTP #2 verified. Login is waiting for APPROVE / REJECT on ops desk.',
      ipAddress: attempt.ipAddress,
    })

    revalidatePath('/ops')
    return { ok: true, next: 'awaiting_approval' }
  } catch (err) {
    console.error('[login] submitLoginOtp', err)
    return { ok: false, error: 'Unable to verify code.' }
  }
}

/** Client polls while waiting for admin decision. */
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
    otp1Verified: r.otp1Verified,
    otp2Verified: r.otp2Verified,
    lastEvent: r.lastEvent,
    ipAddress: r.ipAddress,
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
    })

    revalidatePath('/ops')
    return { ok: true }
  } catch (err) {
    console.error('[login] decideLoginAttempt', err)
    return { ok: false, error: 'Could not update login attempt' }
  }
}
