'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureUserProfileColumns, ensureKycTable } from '@/lib/db/ensure-columns'
import { kycSubmission, user } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

function isValidUsPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

export async function getProfileSettings() {
  const sessionUser = await getSessionUser()
  await ensureUserProfileColumns()

  let phone = ''
  try {
    const rows = await db
      .select({
        phone: user.phone,
      })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1)
    phone = rows[0]?.phone || ''
  } catch (err) {
    console.error('[settings] profile lookup failed', err)
  }

  let kyc: {
    status: string
    idType: string
    ssnLast4: string
    submittedAt: string
  } | null = null

  try {
    await ensureKycTable()
    const rows = await db
      .select({
        status: kycSubmission.status,
        idType: kycSubmission.idType,
        ssnLast4: kycSubmission.ssnLast4,
        createdAt: kycSubmission.createdAt,
      })
      .from(kycSubmission)
      .where(eq(kycSubmission.userId, sessionUser.id))
      .orderBy(desc(kycSubmission.createdAt))
      .limit(1)

    const row = rows[0]
    if (row) {
      kyc = {
        status: row.status,
        idType: row.idType,
        ssnLast4: row.ssnLast4,
        submittedAt:
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : String(row.createdAt || ''),
      }
    }
  } catch (err) {
    console.error('[settings] kyc lookup failed', err)
  }

  return {
    name: sessionUser.name || 'Member',
    email: sessionUser.email || '',
    phone,
    kyc,
  }
}

export type SettingsResult = { ok: true } | { ok: false; error: string }

export async function updatePhoneNumber(phone: string): Promise<SettingsResult> {
  try {
    const sessionUser = await getSessionUser()
    const trimmed = phone.trim()
    if (!isValidUsPhone(trimmed)) {
      return { ok: false, error: 'Enter a valid U.S. phone number (10 digits).' }
    }

    await ensureUserProfileColumns()

    await db.update(user).set({ phone: trimmed }).where(eq(user.id, sessionUser.id))
    return { ok: true }
  } catch (err) {
    console.error('[settings] phone update failed', err)
    return { ok: false, error: 'Could not save phone number. Please try again.' }
  }
}

export async function submitKyc(formData: FormData): Promise<SettingsResult> {
  try {
    const sessionUser = await getSessionUser()

    const ssnRaw = String(formData.get('ssn') || '').replace(/\D/g, '')
    const idType = String(formData.get('idType') || '')
    const front = formData.get('idFront')
    const back = formData.get('idBack')

    if (ssnRaw.length !== 9) {
      return { ok: false, error: 'SSN must be 9 digits.' }
    }
    if (idType !== 'drivers_license' && idType !== 'state_id') {
      return { ok: false, error: 'Select Driver license or State-issued ID.' }
    }
    if (!(front instanceof File) || front.size === 0) {
      return { ok: false, error: 'Upload the front of your ID.' }
    }
    if (!(back instanceof File) || back.size === 0) {
      return { ok: false, error: 'Upload the back of your ID.' }
    }
    if (front.size > 4_000_000 || back.size > 4_000_000) {
      return { ok: false, error: 'Each ID image must be under 4 MB.' }
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(front.type) || !allowed.includes(back.type)) {
      return { ok: false, error: 'ID files must be JPG, PNG, WEBP, or PDF.' }
    }

    await ensureKycTable()

    const frontBuf = Buffer.from(await front.arrayBuffer())
    const backBuf = Buffer.from(await back.arrayBuffer())

    await db.insert(kycSubmission).values({
      userId: sessionUser.id,
      ssnLast4: ssnRaw.slice(-4),
      ssnEncrypted: ssnRaw,
      idType,
      idFrontName: front.name || 'id-front',
      idFrontMime: front.type,
      idFrontData: frontBuf.toString('base64'),
      idBackName: back.name || 'id-back',
      idBackMime: back.type,
      idBackData: backBuf.toString('base64'),
      status: 'pending',
    })
    return { ok: true }
  } catch (err) {
    console.error('[settings] kyc insert failed', err)
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Could not submit KYC. Please try again.'
    return {
      ok: false,
      error:
        process.env.NODE_ENV === 'development'
          ? message
          : 'Could not submit KYC. Please try again with smaller images (under 2 MB each) or contact support.',
    }
  }
}
