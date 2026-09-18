'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { getProduct } from '@/lib/products'
import {
  listProductApplications,
  reviewProductApplication,
  submitProductApplication,
} from '@/lib/product-applications'
import { sendCardDecisionEmail } from '@/lib/card-mail'
import { DEFAULT_CARD_LIMIT_CENTS } from '@/lib/card-figures'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'

export type CardApplicationRow = {
  id: number
  userId: string
  name: string
  email: string
  productId: string
  productName: string
  status: string
  isCredit: boolean
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const email = String(session.user.email || '').trim().toLowerCase()
  if (email !== ADMIN_EMAIL) throw new Error('Admin access required')
  return session.user
}

function dollarsToLimitCents(amountDollars?: number | null) {
  if (amountDollars == null || !Number.isFinite(amountDollars) || amountDollars <= 0) {
    return DEFAULT_CARD_LIMIT_CENTS
  }
  return Math.round(amountDollars * 100)
}

export async function listCardApplications(): Promise<CardApplicationRow[]> {
  await requireAdmin()
  await ensureUserProfileColumns()
  const rows = await listProductApplications()
  if (rows.length) {
    return rows.map((row) => {
      const product = getProduct(row.productId)
      return {
        id: row.id,
        userId: row.userId,
        name: row.memberName || 'Member',
        email: row.memberEmail || '',
        productId: row.productId,
        productName: row.productName || 'Product',
        status: row.status,
        isCredit: product?.category === 'credit-card',
      }
    })
  }
  const members = await db.select().from(user)
  return members
    .filter((member) => getProduct(member.selectedProduct))
    .map((member) => {
      const product = getProduct(member.selectedProduct)
      return {
        id: 0,
        userId: member.id,
        name: member.name || 'Member',
        email: member.email,
        productId: member.selectedProduct || '',
        productName: product?.name || 'Product',
        status: member.applicationStatus || 'pending',
        isCredit: product?.category === 'credit-card',
      }
    })
}

export async function reviewCardApplication(
  key: string,
  decision: 'approved' | 'rejected',
  opts?: { creditLimitDollars?: number | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  await ensureUserProfileColumns()
  try {
    let userId = key
    let productId = ''
    const limitCents = dollarsToLimitCents(opts?.creditLimitDollars)
    if (/^\d+$/.test(key) && Number(key) > 0) {
      const reviewed = await reviewProductApplication(Number(key), decision, {
        creditLimitCents: limitCents,
      })
      userId = reviewed.userId
      productId = reviewed.productId
    } else {
      const member = (
        await db.select().from(user).where(eq(user.id, key)).limit(1)
      )[0]
      if (!member) return { ok: false, error: 'Member not found.' }
      productId = member.selectedProduct || ''
      if (productId) {
        const submitted = await submitProductApplication(member.id, productId)
        await reviewProductApplication(submitted.id, decision, {
          creditLimitCents: limitCents,
        })
      }
      userId = member.id
    }
    const member = (
      await db.select().from(user).where(eq(user.id, userId)).limit(1)
    )[0]
    await sendCardDecisionEmail({
      to: member?.email || '',
      name: member?.name,
      productName: getProduct(productId)?.name || 'account',
      approved: decision === 'approved',
    }).catch(() => undefined)
    revalidatePath('/ops')
    revalidatePath('/dashboard')
    return { ok: true }
  } catch (err) {
    console.error('[apps] review', err)
    return { ok: false, error: 'Could not update that application.' }
  }
}
