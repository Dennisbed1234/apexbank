import { db, pool } from '@/lib/db'
import { bankAccount, user } from '@/lib/db/schema'
import { SHARED_CHECKING_NUMBER } from '@/lib/bank-constants'
import { getProduct } from '@/lib/products'
import { defaultAccountName, parseExtraProducts, serializeExtraProducts } from '@/lib/member-products'
import { eq } from 'drizzle-orm'

export type ProductApplication = {
  id: number
  userId: string
  productId: string
  status: string
  memberName?: string
  memberEmail?: string
  productName?: string
}

let tableReady = false

export async function ensureProductApplicationTable() {
  if (tableReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_application (
      id serial PRIMARY KEY,
      "userId" text NOT NULL,
      "productId" text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `)
  tableReady = true
}

function randomAccountNumber() {
  let n = ''
  do {
    n = String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999))
  } while (n === SHARED_CHECKING_NUMBER)
  return n
}

export async function submitProductApplication(userId: string, productId: string) {
  await ensureProductApplicationTable()
  const product = getProduct(productId)
  if (!product) throw new Error('Unknown product')
  const existing = await pool.query(
    `SELECT id, status FROM product_application WHERE "userId" = $1 AND "productId" = $2 ORDER BY id DESC LIMIT 1`,
    [userId, productId]
  )
  if (existing.rows[0]?.status === 'pending' || existing.rows[0]?.status === 'approved') {
    return { id: Number(existing.rows[0].id), status: existing.rows[0].status as string }
  }
  const inserted = await pool.query(
    `INSERT INTO product_application ("userId", "productId", status) VALUES ($1, $2, 'pending') RETURNING id`,
    [userId, productId]
  )
  const member = (
    await db
      .select({ selectedProduct: user.selectedProduct, applicationStatus: user.applicationStatus })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
  )[0]
  if (!member?.selectedProduct) {
    await db
      .update(user)
      .set({
        selectedProduct: productId,
        applicationStatus: product.category === 'credit-card' ? 'pending' : member?.applicationStatus || 'pending',
      } as any)
      .where(eq(user.id, userId))
  }
  return { id: Number(inserted.rows[0].id), status: 'pending' }
}

export async function listProductApplications(): Promise<ProductApplication[]> {
  await ensureProductApplicationTable()
  const result = await pool.query(
    `SELECT a.id, a."userId", a."productId", a.status, u.name, u.email
     FROM product_application a
     LEFT JOIN "user" u ON u.id = a."userId"
     ORDER BY a.id DESC`
  )
  return result.rows.map((row: any) => ({
    id: Number(row.id),
    userId: row.userId,
    productId: row.productId,
    status: row.status,
    memberName: row.name || 'Member',
    memberEmail: row.email || '',
    productName: getProduct(row.productId)?.name || row.productId,
  }))
}

export async function approvedProductIds(userId: string) {
  await ensureProductApplicationTable()
  const result = await pool.query(
    `SELECT "productId" FROM product_application WHERE "userId" = $1 AND status = 'approved'`,
    [userId]
  )
  return result.rows.map((row: any) => String(row.productId))
}

export async function reviewProductApplication(
  applicationId: number,
  decision: 'approved' | 'rejected'
) {
  await ensureProductApplicationTable()
  const found = await pool.query(
    `SELECT id, "userId", "productId" FROM product_application WHERE id = $1`,
    [applicationId]
  )
  const row = found.rows[0]
  if (!row) throw new Error('Application not found')
  await pool.query(
    `UPDATE product_application SET status = $1, "updatedAt" = now() WHERE id = $2`,
    [decision, applicationId]
  )
  const member = (
    await db
      .select({ selectedProduct: user.selectedProduct })
      .from(user)
      .where(eq(user.id, row.userId))
      .limit(1)
  )[0]
  await db
    .update(user)
    .set({
      applicationStatus: decision,
      selectedProduct: member?.selectedProduct || row.productId,
    } as any)
    .where(eq(user.id, row.userId))

  if (decision === 'approved') {
    await provisionApprovedProduct(String(row.userId), String(row.productId))
  }
  return {
    userId: String(row.userId),
    productId: String(row.productId),
  }
}

export async function provisionApprovedProduct(userId: string, productId: string) {
  const product = getProduct(productId)
  if (!product) return
  const member = await db
    .select({
      extraProducts: user.extraProducts,
      selectedProduct: user.selectedProduct,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const extras = parseExtraProducts(member[0]?.extraProducts)
  if (!extras.includes(productId)) extras.push(productId)
  await db
    .update(user)
    .set({
      extraProducts: serializeExtraProducts(extras),
      applicationStatus: 'approved',
    } as any)
    .where(eq(user.id, userId))

  const kind =
    product.category === 'checking'
      ? 'checking'
      : product.category === 'savings'
        ? product.id === 'traditional-ira'
          ? 'retirement'
          : 'savings'
        : 'credit'
  const existing = await db.select().from(bankAccount).where(eq(bankAccount.userId, userId))
  if (kind === 'credit' && existing.some((account) => account.type === 'credit' && account.name === product.name)) {
    return
  }
  if (kind !== 'credit' && existing.some((account) => account.type === kind)) return
  await db.insert(bankAccount).values({
    userId,
    name: defaultAccountName(kind, {
      name: member[0]?.name,
      email: member[0]?.email,
      selectedProduct: productId,
    }),
    type: kind,
    accountNumber: kind === 'checking' ? SHARED_CHECKING_NUMBER : randomAccountNumber(),
    balanceCents: 0,
  })
}
