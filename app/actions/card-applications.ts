'use server'

import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { getProduct } from '@/lib/products'
import { isCreditCardProduct } from '@/lib/application-status'
import {
  ensureProductAccounts,
  loadMemberProductContext,
} from '@/lib/member-accounts'
import { sendCardDecisionEmail } from '@/lib/card-mail'
import { revalidatePath } from 'next/cache'

export type CardApplicationRow = {
  userId: string
  name: string
  email: string
  productId: string
  productName: string
  status: string
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const email = String(session.user.email || '').trim().toLowerCase()
  if (email !== ADMIN_EMAIL) throw new Error('Admin access required')
  return session.user
}

export async function listCardApplications(): Promise<CardApplicationRow[]> {
  await requireAdmin()
  await ensureUserProfileColumns()
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      productId: user.selectedProduct,
      status: user.applicationStatus,
    })
    .from(user)
  return rows
    .filter((row) => isCreditCardProduct(row.productId))
    .map((row) => ({
      userId: row.userId,
      name: row.name || 'Member',
      email: row.email,
      productId: row.productId || '',
      productName: getProduct(row.productId)?.name || 'Credit card',
      status: row.status || 'pending',
    }))
}

export async function reviewCardApplication(
  userId: string,
  decision: 'approved' | 'rejected'
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  await ensureUserProfileColumns()
  const rows = await db
    .select({
      name: user.name,
      email: user.email,
      selectedProduct: user.selectedProduct,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const member = rows[0]
  if (!member) return { ok: false, error: 'Member not found.' }
  const product = getProduct(member.selectedProduct)

  await db
    .update(user)
    .set({ applicationStatus: decision } as any)
    .where(eq(user.id, userId))

  if (decision === 'approved') {
    const ctx = await loadMemberProductContext(userId)
    await ensureProductAccounts({
      ...ctx,
      applicationStatus: 'approved',
      userId,
    }).catch(() => undefined)
  }

  await sendCardDecisionEmail({
    to: member.email,
    name: member.name,
    productName: product?.name || 'credit card',
    approved: decision === 'approved',
  }).catch(() => undefined)

  revalidatePath('/ops')
  revalidatePath('/dashboard')
  return { ok: true }
}
