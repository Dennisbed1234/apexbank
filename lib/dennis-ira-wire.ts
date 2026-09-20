import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { DEMO_MEMBER_EMAIL, SHARED_CHECKING_NUMBER } from '@/lib/bank-constants'
import { and, eq, like, or } from 'drizzle-orm'
import { isDennisBedendender } from '@/lib/seed-10k'

/** $50,000,000.00 */
export const DENNIS_IRA_WIRE_CENTS = 5_000_000_000
const WIRE_DESC = 'WIRE IN CHASE BANK'
const WIRE_COUNTERPARTY = 'JPMorgan Chase Bank N.A.'
const WIRE_MARKER = 'DENNIS IRA 50M CHASE WIRE LOCKED'

function randomAccountNumber() {
  let n = ''
  do {
    n = String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999))
  } while (n === SHARED_CHECKING_NUMBER)
  return n
}

/**
 * Ensures Dennis (demo member) has Traditional IRA and a one-time
 * $50,000,000.00 direct wire credit from Chase Bank.
 * Balance is derived from the ledger on reconcile, so the wire must be a real transaction.
 */
export async function ensureDennisIraFiftyMillionWire(input: {
  userId: string
  name?: string | null
  email?: string | null
}) {
  const email = String(input.email || '').trim().toLowerCase()
  if (!isDennisBedendender(input.name, input.email) && email !== DEMO_MEMBER_EMAIL) {
    return { applied: false }
  }

  const accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, input.userId))

  let ira = accounts.find((a) => a.type === 'retirement')
  if (!ira) {
    const [created] = await db
      .insert(bankAccount)
      .values({
        userId: input.userId,
        name: 'Traditional IRA',
        type: 'retirement',
        accountNumber: randomAccountNumber(),
        balanceCents: 0,
      })
      .returning()
    ira = created
  }

  const existing = await db
    .select({
      id: transaction.id,
      description: transaction.description,
      amountCents: transaction.amountCents,
    })
    .from(transaction)
    .where(
      and(eq(transaction.userId, input.userId), eq(transaction.accountId, ira.id))
    )

  // Relabel any prior generic $50M IRA wire to Chase Bank
  const priorWire = existing.find(
    (t) =>
      Number(t.amountCents) === DENNIS_IRA_WIRE_CENTS &&
      (t.description === 'WIRE IN DIRECT DEPOSIT IRA' ||
        t.description === WIRE_DESC ||
        t.description.includes('WIRE IN'))
  )
  if (priorWire && priorWire.description !== WIRE_DESC) {
    await db
      .update(transaction)
      .set({
        description: WIRE_DESC,
        counterparty: WIRE_COUNTERPARTY,
        category: 'Wire',
      })
      .where(eq(transaction.id, priorWire.id))
  }

  if (
    existing.some((t) => t.description === WIRE_MARKER) ||
    existing.some(
      (t) =>
        Number(t.amountCents) === DENNIS_IRA_WIRE_CENTS &&
        (t.description === WIRE_DESC || t.description === 'WIRE IN DIRECT DEPOSIT IRA')
    )
  ) {
    // Ensure marker exists after relabel
    if (!existing.some((t) => t.description === WIRE_MARKER)) {
      await db.insert(transaction).values({
        userId: input.userId,
        accountId: ira.id,
        amountCents: 0,
        type: 'credit',
        description: WIRE_MARKER,
        category: 'System',
        counterparty: 'Nicolet National Bank',
        createdAt: new Date(),
      })
    }
    const refreshed = await db
      .select({ amountCents: transaction.amountCents })
      .from(transaction)
      .where(and(eq(transaction.userId, input.userId), eq(transaction.accountId, ira.id)))
    const net = refreshed.reduce((s, t) => s + Number(t.amountCents || 0), 0)
    await db
      .update(bankAccount)
      .set({ balanceCents: net, name: 'Traditional IRA' })
      .where(and(eq(bankAccount.id, ira.id), eq(bankAccount.userId, input.userId)))
    return { applied: false, alreadyPresent: true }
  }

  const stamped = new Date()
  stamped.setHours(9, 42, 0, 0)

  await db.insert(transaction).values({
    userId: input.userId,
    accountId: ira.id,
    amountCents: DENNIS_IRA_WIRE_CENTS,
    type: 'credit',
    description: WIRE_DESC,
    category: 'Wire',
    counterparty: WIRE_COUNTERPARTY,
    createdAt: stamped,
  })

  await db.insert(transaction).values({
    userId: input.userId,
    accountId: ira.id,
    amountCents: 0,
    type: 'credit',
    description: WIRE_MARKER,
    category: 'System',
    counterparty: 'Nicolet National Bank',
    createdAt: new Date(),
  })

  // Drop obsolete generic markers if any
  await db
    .delete(transaction)
    .where(
      and(
        eq(transaction.userId, input.userId),
        eq(transaction.accountId, ira.id),
        or(
          eq(transaction.description, 'DENNIS IRA 50M WIRE LOCKED'),
          like(transaction.description, 'DENNIS IRA 50M WIRE%')
        ),
        eq(transaction.amountCents, 0)
      )
    )
    .catch(() => undefined)

  const after = await db
    .select({ amountCents: transaction.amountCents })
    .from(transaction)
    .where(and(eq(transaction.userId, input.userId), eq(transaction.accountId, ira.id)))

  const net = after.reduce((s, t) => s + Number(t.amountCents || 0), 0)
  await db
    .update(bankAccount)
    .set({ balanceCents: net, name: 'Traditional IRA' })
    .where(and(eq(bankAccount.id, ira.id), eq(bankAccount.userId, input.userId)))

  return { applied: true, balanceCents: net }
}

export async function ensureDennisIraWireByEmail() {
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
  const dennis = members.find(
    (m) => String(m.email || '').trim().toLowerCase() === DEMO_MEMBER_EMAIL
  )
  if (!dennis) return { applied: false, reason: 'member_not_found' }
  return ensureDennisIraFiftyMillionWire({
    userId: dennis.id,
    name: dennis.name,
    email: dennis.email,
  })
}
