import { db } from '@/lib/db'
import { bankAccount } from '@/lib/db/schema'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { isJimmyMember } from '@/lib/seed-10k'
import { getProduct } from '@/lib/products'
import { and, eq } from 'drizzle-orm'

export const PERSONAL_CHECKING_NAME = 'Personal Checking'
export const BUSINESS_CHECKING_NAME = 'Business Checking'

export function isBusinessCheckingMember(
  name?: string | null,
  email?: string | null,
  selectedProduct?: string | null
) {
  const product = getProduct(selectedProduct)
  if (product?.id === 'business-checking') return true
  const e = String(email || '').trim().toLowerCase()
  if (e === ADMIN_EMAIL) return true
  return isJimmyMember(name, email)
}

export function checkingProductName(
  name?: string | null,
  email?: string | null,
  selectedProduct?: string | null
) {
  const product = getProduct(selectedProduct)
  if (product?.checkingName) return product.checkingName
  return isBusinessCheckingMember(name, email, selectedProduct)
    ? BUSINESS_CHECKING_NAME
    : PERSONAL_CHECKING_NAME
}

export function displayCheckingName(
  storedName: string | null | undefined,
  memberName?: string | null,
  memberEmail?: string | null,
  selectedProduct?: string | null
) {
  return checkingProductName(memberName, memberEmail, selectedProduct)
}

export async function ensureCheckingProductName(input: {
  userId: string
  checkingId: number
  memberName?: string | null
  memberEmail?: string | null
  selectedProduct?: string | null
}) {
  const name = checkingProductName(
    input.memberName,
    input.memberEmail,
    input.selectedProduct
  )
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
