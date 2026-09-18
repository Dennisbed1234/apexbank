import { db, pool } from '@/lib/db'
import { bankAccount, transaction } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { DEFAULT_CARD_LIMIT_CENTS } from '@/lib/card-figures'

export { DEFAULT_CARD_LIMIT_CENTS, cardFigures } from '@/lib/card-figures'

let limitColumnReady = false

export async function ensureCreditLimitColumn() {
  if (limitColumnReady) return
  await pool.query(
    `ALTER TABLE bank_account ADD COLUMN IF NOT EXISTS "creditLimitCents" bigint NOT NULL DEFAULT 0`
  )
  limitColumnReady = true
}

export async function postLedgerEntry(input: {
  userId: string
  accountId: number
  amountCents: number
  type: string
  description: string
  category?: string
  counterparty?: string
  createdAt?: Date
}) {
  const account = (
    await db
      .select()
      .from(bankAccount)
      .where(and(eq(bankAccount.id, input.accountId), eq(bankAccount.userId, input.userId)))
      .limit(1)
  )[0]
  if (!account) throw new Error('Account not found')

  await db.insert(transaction).values({
    userId: input.userId,
    accountId: input.accountId,
    amountCents: input.amountCents,
    type: input.type,
    description: input.description,
    category: input.category,
    counterparty: input.counterparty,
    createdAt: input.createdAt || new Date(),
  })

  const nextBalance =
    account.type === 'credit'
      ? Math.max(0, account.balanceCents - input.amountCents)
      : account.balanceCents + input.amountCents

  await db
    .update(bankAccount)
    .set({ balanceCents: nextBalance })
    .where(and(eq(bankAccount.id, account.id), eq(bankAccount.userId, input.userId)))

  return nextBalance
}

export async function reconcileCreditAccounts(input: {
  userId: string
  name?: string | null
  email?: string | null
}) {
  await ensureCreditLimitColumn()
  const accounts = await db.select().from(bankAccount).where(eq(bankAccount.userId, input.userId))
  const cards = accounts.filter((account) => account.type === 'credit')
  for (const card of cards) {
    const txs = await db
      .select({ amountCents: transaction.amountCents })
      .from(transaction)
      .where(and(eq(transaction.userId, input.userId), eq(transaction.accountId, card.id)))
    const net = txs.reduce((sum, row) => sum + Number(row.amountCents || 0), 0)
    const currentCents = Math.max(0, -net)
    // Keep admin-assigned limit; only fall back to default if never set
    const stored = Number((card as any).creditLimitCents || 0)
    const limitCents = stored > 0 ? stored : DEFAULT_CARD_LIMIT_CENTS
    await pool.query(
      `UPDATE bank_account SET "creditLimitCents" = $1, "balanceCents" = $2 WHERE id = $3 AND "userId" = $4`,
      [limitCents, currentCents, card.id, input.userId]
    )
  }
}
