'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getProduct } from '@/lib/products'
import { submitProductApplication } from '@/lib/product-applications'

export async function applyForProduct(
  productId: string
): Promise<{ ok: true; pending: true } | { ok: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Sign in first.' }
  const product = getProduct(productId)
  if (!product) return { ok: false, error: 'Unknown product.' }
  try {
    await submitProductApplication(session.user.id, product.id)
    return { ok: true, pending: true }
  } catch (err) {
    console.error('[products] apply', err)
    return { ok: false, error: 'Could not submit that application.' }
  }
}
