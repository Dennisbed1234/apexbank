'use server'

import { createHash, randomBytes, randomInt } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { user, verification } from '@/lib/db/schema'
import { sendOtpEmail } from '@/lib/mail'
import {
  consumeSignupVerification,
  signupOtpKey,
  signupVerifiedKey,
} from '@/lib/signup-otp'

function hashOtp(otp: string) {
  return createHash('sha256').update(otp).digest('hex')
}

function newId() {
  return randomBytes(16).toString('hex')
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function clearSignupKeys(email: string) {
  await consumeSignupVerification(email)
}

export async function startSignupChallenge(input: {
  email: string
  name: string
}): Promise<{ ok: true; attemptId: string } | { ok: false; error: string }> {
  const email = String(input.email || '').trim().toLowerCase()
  const name = String(input.name || '').trim()

  if (!name) return { ok: false, error: 'Full name is required.' }
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  try {
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
    if (existing[0]) {
      return {
        ok: false,
        error: 'An account with this email already exists. Log in instead.',
      }
    }

    const otp = String(randomInt(100000, 999999))
    const id = newId()
    const expires = new Date(Date.now() + 10 * 60 * 1000)

    await clearSignupKeys(email)
    await db.insert(verification).values({
      id,
      identifier: signupOtpKey(email),
      value: hashOtp(otp),
      expiresAt: expires,
    })

    const sent = await sendOtpEmail(email, otp, name, 'sign-up').catch((err) => {
      console.error('[signup] otp mail', err)
      return false
    })
    if (!sent) {
      console.info('[apex-bank] signup OTP for', email, otp)
    }

    return { ok: true, attemptId: id }
  } catch (err) {
    console.error('[signup] startSignupChallenge', err)
    return { ok: false, error: 'Unable to send verification code. Try again.' }
  }
}

export async function submitSignupOtp(input: {
  email: string
  otp: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(input.email || '').trim().toLowerCase()
  const otp = String(input.otp || '').replace(/\D/g, '')

  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  if (otp.length !== 6) {
    return { ok: false, error: 'Enter the 6-digit code.' }
  }

  try {
    const rows = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, signupOtpKey(email)))
      .limit(1)
    const row = rows[0]
    if (!row) {
      return { ok: false, error: 'Session expired. Request a new code.' }
    }
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await clearSignupKeys(email)
      return { ok: false, error: 'Code expired. Request a new code.' }
    }
    if (hashOtp(otp) !== row.value) {
      return { ok: false, error: 'Incorrect code. Try again.' }
    }

    await clearSignupKeys(email)
    await db.insert(verification).values({
      id: newId(),
      identifier: signupVerifiedKey(email),
      value: 'ok',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    })

    return { ok: true }
  } catch (err) {
    console.error('[signup] submitSignupOtp', err)
    return { ok: false, error: 'Unable to verify code.' }
  }
}

export async function resendSignupOtp(input: {
  email: string
  name: string
}): Promise<{ ok: true; attemptId: string } | { ok: false; error: string }> {
  return startSignupChallenge(input)
}
