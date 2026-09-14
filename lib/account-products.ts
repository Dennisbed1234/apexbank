import { db } from '@/lib/db'
import { bankAccount } from '@/lib/db/schema'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { isJimmyMember } from '@/lib/seed-10k'
import { and, eq } from 'drizzle-orm'

export const PERSONAL_CHECKING_NAME = 'Personal Checking'
export const BUSINESS_CHECKING_NAME = 'Business Checking'

export function isBusinessCheckingMember(
  name?: string | null,
  email?: string | null
) {
  const e = String(email || '').trim().toLowerCase()
  if (e === ADMIN_EMAIL) return true
  return isJimmyMember(name, email)
}

/** Product name printed on statements, cards, and the dashboard. */
export function checkingProductName(
  name?: string | null,
  email?: string | null
) {
  return isBusinessCheckingMember(name, email)
    ? BUSINESS_CHECKING_NAME
    : PERSONAL_CHECKING_NAME
}

export function displayCheckingName(
  storedName: string | null | undefined,
  memberName?: string | null,
  memberEmail?: string | null
) {
  const product = checkingProductName(memberName, memberEmail)
  const stored = String(storedName || '').trim()
  if (product === PERSONAL_CHECKING_NAME) {
    if (/business/i.test(stored)) return PERSONAL_CHECKING_NAME
    if (/everyday|personal|checking/i.test(stored)) return stored.includes('Personal')
      ? PERSONAL_CHECKING_NAME
      : PERSONAL_CHECKING_NAME
    return PERSONAL_CHECKING_NAME
  }
  return BUSINESS_CHECKING_NAME
}

export async function ensureCheckingProductName(input: {
  userId: string
  checkingId: number
  memberName?: string | null
  memberEmail?: string | null
}) {
  const name = checkingProductName(input.memberName, input.memberEmail)
  await db
    .update(bankAccount)
    .set({ name })
    .where(
      and(
        eq(bankAccount.id, input.checkingId),
        eq(bankAccount.userId, input.userId)
      )
    )
  return name
}
