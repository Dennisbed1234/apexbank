import { eq, like, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verification } from '@/lib/db/schema'

export function signupOtpKey(email: string) {
  return `signup-otp:${String(email || '').trim().toLowerCase()}`
}

export function signupVerifiedKey(email: string) {
  return `signup-verified:${String(email || '').trim().toLowerCase()}`
}

function stillValid(expiresAt: Date | string | null | undefined) {
  if (!expiresAt) return false
  const ts = new Date(expiresAt).getTime()
  return Number.isFinite(ts) && ts > Date.now()
}

export async function emailHasVerifiedSignupOtp(email: string) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return false

  const rows = await db
    .select()
    .from(verification)
    .where(
      or(
        eq(verification.identifier, signupVerifiedKey(normalized)),
        eq(verification.identifier, signupOtpKey(normalized))
      )
    )

  return rows.some((row) => stillValid(row.expiresAt))
}

export async function consumeSignupVerification(email: string) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return
  await db
    .delete(verification)
    .where(like(verification.identifier, `signup-%:${normalized}`))
}
