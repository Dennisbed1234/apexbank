'use server'

import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { getProduct } from '@/lib/products'
import {
  loadMemberProductContext,
  openAdditionalProduct,
} from '@/lib/member-accounts'
import { statusForNewProduct } from '@/lib/application-status'

export async function applyForProduct(
  productId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Sign in first.' }
  const product = getProduct(productId)
  if (!product) return { ok: false, error: 'Unknown product.' }
  try {
    const ctx = await loadMemberProductContext(session.user.id)
    if (product.category === 'credit-card') {
      await db
        .update(user)
        .set({
          selectedProduct: ctx.selectedProduct || product.id,
          applicationStatus: 'pending',
        } as any)
        .where(eq(user.id, session.user.id))
      return { ok: true }
    }
    await openAdditionalProduct({
      userId: session.user.id,
      productId: product.id,
      ctx,
    })
    return { ok: true }
  } catch (err) {
    console.error('[products] apply', err)
    return { ok: false, error: 'Could not add that product.' }
  }
}

export { statusForNewProduct }
