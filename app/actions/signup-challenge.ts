'use server'

import { createHash, randomBytes, randomInt } from 'node:crypto'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, verification } from '@/lib/db/schema'
import { sendOtpEmail } from '@/lib/mail'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { getProduct, isValidUsState, isValidUsZip } from '@/lib/products'
import { isValidSsn, ssnLast4 } from '@/lib/ssn'
import { statusForNewProduct } from '@/lib/application-status'
import { submitProductApplication } from '@/lib/product-applications'
import {
  consumeSignupVerification,
  emailHasVerifiedSignupOtp,
  signupOtpKey,
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
    const expires = new Date(Date.now() + 20 * 60 * 1000)

    await consumeSignupVerification(email)
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
      console.info('[nicolet] signup OTP for', email, otp)
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
      if (await emailHasVerifiedSignupOtp(email)) return { ok: true }
      return { ok: false, error: 'No active code for this email. Request a new one.' }
    }
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      await consumeSignupVerification(email)
      return { ok: false, error: 'Code expired. Request a new code.' }
    }
    if (hashOtp(otp) !== row.value) {
      return { ok: false, error: 'Incorrect code. Try again.' }
    }
    return { ok: true }
  } catch (err) {
    console.error('[signup] submitSignupOtp', err)
    return { ok: false, error: 'Unable to verify code.' }
  }
}

export async function completeSignup(input: {
  email: string
  password: string
  name: string
  phone: string
  dateOfBirth: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  productId?: string
  ssn?: string
  otp: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = String(input.email || '').trim().toLowerCase()
  const password = String(input.password || '')
  const name = String(input.name || '').trim()
  const phone = String(input.phone || '').trim()
  const dateOfBirth = String(input.dateOfBirth || '')
  const addressLine1 = String(input.addressLine1 || '').trim()
  const addressLine2 = String(input.addressLine2 || '').trim()
  const city = String(input.city || '').trim()
  const state = String(input.state || '').trim().toUpperCase()
  const postalCode = String(input.postalCode || '').trim()
  const product = getProduct(input.productId)
  const ssn = String(input.ssn || '')
  const last4 = ssnLast4(ssn)
  const otp = String(input.otp || '').replace(/\D/g, '')

  const verified = await submitSignupOtp({ email, otp })
  if (!verified.ok) return verified

  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  if (!addressLine1 || !city) {
    return { ok: false, error: 'Enter your U.S. mailing address.' }
  }
  if (!isValidUsState(state)) {
    return { ok: false, error: 'Select a valid U.S. state.' }
  }
  if (!isValidUsZip(postalCode)) {
    return { ok: false, error: 'Enter a valid ZIP code.' }
  }
  if (!product) {
    return { ok: false, error: 'Choose a product before opening the account.' }
  }
  if (!isValidSsn(ssn)) {
    return { ok: false, error: 'Enter a valid 9-digit Social Security number.' }
  }

  const reqHeaders = await headers()

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        phone,
        dateOfBirth,
      } as any,
      headers: reqHeaders,
    })
    await consumeSignupVerification(email).catch(() => undefined)
    await saveSignupProfile({
      email,
      phone,
      dateOfBirth,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      productId: product.id,
      ssnLast4: last4,
    })
    return { ok: true }
  } catch (err) {
    console.error('[signup] signUpEmail', err)
    const message = err instanceof Error ? err.message : ''
    if (/exist|already/i.test(message)) {
      try {
        await auth.api.signInEmail({
          body: { email, password },
          headers: reqHeaders,
        })
        await saveSignupProfile({
          email,
          phone,
          dateOfBirth,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          productId: product.id,
          ssnLast4: last4,
        })
        return { ok: true }
      } catch (signInErr) {
        console.error('[signup] signIn after existing', signInErr)
        return {
          ok: false,
          error: 'An account with this email already exists. Log in instead.',
        }
      }
    }
    return {
      ok: false,
      error: message || 'Could not create the account. Try again.',
    }
  }
}

async function saveSignupProfile(input: {
  email: string
  phone: string
  dateOfBirth: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  productId: string
  ssnLast4: string
}) {
  await ensureUserProfileColumns()
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1)
  if (!rows[0]) return
  await db
    .update(user)
    .set({
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 || null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      selectedProduct: input.productId,
      ssnLast4: input.ssnLast4,
      applicationStatus: statusForNewProduct(input.productId),
    } as any)
    .where(eq(user.id, rows[0].id))
  await submitProductApplication(rows[0].id, input.productId).catch(() => undefined)
}

export async function resendSignupOtp(input: {
  email: string
  name: string
}): Promise<{ ok: true; attemptId: string } | { ok: false; error: string }> {
  return startSignupChallenge(input)
}
