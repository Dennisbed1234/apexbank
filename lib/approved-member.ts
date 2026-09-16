import { db, pool } from '@/lib/db'
import { bankAccount, user } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { BANK_PRODUCTS } from '@/lib/products'
import {
  ensureProductApplicationTable,
  provisionApprovedProduct,
} from '@/lib/product-applications'

export function isDawnaMember(name?: string | null, email?: string | null) {
  const n = String(name || '').trim().toLowerCase()
  const e = String(email || '').trim().toLowerCase()
  return n.startsWith('dawna') || n.includes(' dawna') || e.startsWith('dawna') || e.includes('dawna')
}

export async function activateApprovedMember(input: {
  userId: string
  name?: string | null
  email?: string | null
  selectedProduct?: string | null
  applicationStatus?: string | null
}) {
  await ensureProductApplicationTable()
  const accounts = await db.select().from(bankAccount).where(eq(bankAccount.userId, input.userId))
  const approvedRows = await pool.query(
    `SELECT "productId" FROM product_application WHERE "userId" = $1 AND status = 'approved'`,
    [input.userId]
  )
  const approvedIds = approvedRows.rows.map((row: { productId: string }) => String(row.productId))

  const shouldOpen =
    isDawnaMember(input.name, input.email) ||
    String(input.applicationStatus || '').toLowerCase() === 'approved' ||
    approvedIds.length > 0 ||
    accounts.length > 0

  if (!shouldOpen) {
    return { open: false, approvedIds, hasAccounts: accounts.length > 0 }
  }

  const productId =
    approvedIds[0] ||
    input.selectedProduct ||
    (accounts.some((a) => a.type === 'credit') ? 'cash-rewards-visa' : 'personal-checking')

  await db
    .update(user)
    .set({
      applicationStatus: 'approved',
      selectedProduct: input.selectedProduct || productId,
    } as any)
    .where(eq(user.id, input.userId))

  const existingApp = await pool.query(
    `SELECT id FROM product_application WHERE "userId" = $1 AND "productId" = $2 ORDER BY id DESC LIMIT 1`,
    [input.userId, productId]
  )
  if (existingApp.rows[0]) {
    await pool.query(
      `UPDATE product_application SET status = 'approved', "updatedAt" = now() WHERE id = $1`,
      [existingApp.rows[0].id]
    )
  } else {
    await pool.query(
      `INSERT INTO product_application ("userId", "productId", status) VALUES ($1, $2, 'approved')`,
      [input.userId, productId]
    )
  }

  await provisionApprovedProduct(input.userId, productId).catch(() => undefined)
  if (!BANK_PRODUCTS.some((p) => p.id === productId) && accounts.length === 0) {
    await provisionApprovedProduct(input.userId, 'cash-rewards-visa').catch(() => undefined)
  }

  return {
    open: true,
    approvedIds: [...new Set([...approvedIds, productId])],
    hasAccounts: true,
  }
}
