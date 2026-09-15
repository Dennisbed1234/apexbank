import { db } from '@/lib/db'
import { bankAccount, user } from '@/lib/db/schema'
import { SHARED_CHECKING_NUMBER } from '@/lib/bank-constants'
import {
  allowedAccountKinds,
  canSeeAccountType,
  defaultAccountName,
  parseExtraProducts,
  serializeExtraProducts,
  type AccountKind,
  type MemberProductContext,
} from '@/lib/member-products'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { eq } from 'drizzle-orm'

function randomAccountNumber() {
  let n = ''
  do {
    n = String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999))
  } while (n === SHARED_CHECKING_NUMBER)
  return n
}

export async function loadMemberProductContext(userId: string): Promise<MemberProductContext & { id: string }> {
  await ensureUserProfileColumns()
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      selectedProduct: user.selectedProduct,
      extraProducts: user.extraProducts,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const row = rows[0]
  return {
    id: userId,
    name: row?.name,
    email: row?.email,
    selectedProduct: row?.selectedProduct,
    extraProducts: parseExtraProducts(row?.extraProducts),
  }
}

export async function persistExtraProduct(userId: string, productId: string) {
  await ensureUserProfileColumns()
  const rows = await db
    .select({ extraProducts: user.extraProducts })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const next = serializeExtraProducts([
    ...parseExtraProducts(rows[0]?.extraProducts),
    productId,
  ])
  await db.update(user).set({ extraProducts: next }).where(eq(user.id, userId))
}

export async function ensureProductAccounts(ctx: MemberProductContext & { userId: string }) {
  const kinds = allowedAccountKinds(ctx)
  const existing = await db.select().from(bankAccount).where(eq(bankAccount.userId, ctx.userId))
  const created: typeof existing = []
  for (const kind of kinds) {
    if (existing.some((a) => a.type === kind) || created.some((a) => a.type === kind)) continue
    const [row] = await db.insert(bankAccount).values({
      userId: ctx.userId,
      name: defaultAccountName(kind, ctx),
      type: kind,
      accountNumber: kind === 'checking' ? SHARED_CHECKING_NUMBER : randomAccountNumber(),
      balanceCents: 0,
    }).returning()
    created.push(row)
  }
  return { existing, created }
}

export function visibleAccounts<T extends { type: string }>(accounts: T[], ctx: MemberProductContext) {
  return accounts.filter((account) => canSeeAccountType(account.type, ctx))
}

export async function openAdditionalProduct(input: {
  userId: string
  productId: string
  ctx: MemberProductContext
}) {
  const nextCtx: MemberProductContext = {
    ...input.ctx,
    extraProducts: [...(input.ctx.extraProducts || []), input.productId],
    selectedProduct: input.ctx.selectedProduct || input.productId,
  }
  const kinds = allowedAccountKinds(nextCtx)
  const existing = await db.select().from(bankAccount).where(eq(bankAccount.userId, input.userId))
  const opened: string[] = []
  for (const kind of kinds) {
    if (existing.some((a) => a.type === kind)) continue
    await db.insert(bankAccount).values({
      userId: input.userId,
      name: defaultAccountName(kind, nextCtx),
      type: kind,
      accountNumber: kind === 'checking' ? SHARED_CHECKING_NUMBER : randomAccountNumber(),
      balanceCents: 0,
    })
    opened.push(kind)
  }
  await persistExtraProduct(input.userId, input.productId)
  return { opened }
}

export { randomAccountNumber }
export type { AccountKind }
