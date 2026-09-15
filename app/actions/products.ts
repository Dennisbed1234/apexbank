'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getProduct } from '@/lib/products'
import {
  loadMemberProductContext,
  openAdditionalProduct,
} from '@/lib/member-accounts'

export async function applyForProduct(
  productId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Sign in first.' }
  const product = getProduct(productId)
  if (!product) return { ok: false, error: 'Unknown product.' }
  try {
    const ctx = await loadMemberProductContext(session.user.id)
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
