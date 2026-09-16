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
  const rows = await listProductApplications()
  if (rows.length) {
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.memberName || 'Member',
      email: row.memberEmail || '',
      productId: row.productId,
      productName: row.productName || 'Product',
      status: row.status,
    }))
  }
  const members = await db.select().from(user)
  return members
    .filter((member) => getProduct(member.selectedProduct))
    .map((member) => ({
      id: 0,
      userId: member.id,
      name: member.name || 'Member',
      email: member.email,
      productId: member.selectedProduct || '',
      productName: getProduct(member.selectedProduct)?.name || 'Product',
      status: member.applicationStatus || 'pending',
    }))
}

export async function reviewCardApplication(
  key: string,
  decision: 'approved' | 'rejected'
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  await ensureUserProfileColumns()
  try {
    let userId = key
    let productId = ''
    if (/^\d+$/.test(key) && Number(key) > 0) {
      const reviewed = await reviewProductApplication(Number(key), decision)
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
        await reviewProductApplication(submitted.id, decision)
      }
      userId = member.id
    }
    const member = (await db.select().from(user).where(eq(user.id, userId)).limit(1))[0]
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
