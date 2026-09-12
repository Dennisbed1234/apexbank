import { eq, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { verification } from '@/lib/db/schema'

export function signupOtpKey(email: string) {
  return `signup-otp:${email}`
}

export function signupVerifiedKey(email: string) {
  return `signup-verified:${email}`
}

export async function emailHasVerifiedSignupOtp(email: string) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return false
  const rows = await db
    .select()
    .from(verification)
    .where(eq(verification.identifier, signupVerifiedKey(normalized)))
    .limit(1)
  const row = rows[0]
  if (!row) return false
  if (new Date(row.expiresAt).getTime() < Date.now()) return false
  return true
}

export async function consumeSignupVerification(email: string) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return
  await db
    .delete(verification)
    .where(like(verification.identifier, `signup-%:${normalized}`))
}
