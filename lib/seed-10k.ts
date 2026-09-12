import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { DEMO_MEMBER_EMAIL, DEMO_MEMBER_NAME } from '@/lib/bank-constants'
import { isAnaMontoya } from '@/lib/seed-ana'
import { and, eq, sql } from 'drizzle-orm'

export const HISTORY_10K_MARKER = 'APEX 10K HISTORY LOCKED'
export const TARGET_TX_COUNT = 10_000

const MERCHANTS: Array<[string, string, number, number, boolean]> = [
  ['STARBUCKS', 'Dining', 350, 1400, false],
  ['WALMART', 'Groceries', 1800, 16000, false],
  ['COSTCO WHSE', 'Groceries', 4500, 24000, false],
  ['SHELL OIL', 'Transport', 2800, 7200, false],
  ['UBER TRIP', 'Transport', 900, 4800, false],
  ['AMAZON.COM', 'Shopping', 800, 18500, false],
  ['NETFLIX.COM', 'Bills', 1399, 1999, false],
  ['APPLE.COM/BILL', 'Bills', 99, 2999, false],
  ['ACH PAYROLL DIRECT DEP', 'Income', 185000, 525000, true],
  ['Zelle from Sofia Alvarez', 'Zelle', 2500, 85000, true],
  ['Zelle to Elena Cruz', 'Zelle', 1500, 42000, false],
  ['Incoming wire — FIDELITY INV', 'Wire', 25000, 450000, true],
  ['Mobile check deposit', 'Check deposit', 12000, 220000, true],
  ['WHOLEFDS', 'Groceries', 2200, 14000, false],
  ['TARGET', 'Shopping', 1200, 9800, false],
  ['VERIZON WIRELESS', 'Bills', 4500, 16500, false],
  ['ACH CREDIT CHASE', 'Income', 15000, 120000, true],
  ['BILL PAY RENT HARBOR COURT', 'Housing', 165000, 245000, false],
]

function dateDaysAgo(days: number, hour = 12) {
  const d = new Date()
  d.setHours(hour, (days * 7) % 60, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

export function isDennisBedendender(name?: string | null, email?: string | null) {
  const n = String(name || '').trim().toLowerCase()
  const e = String(email || '').trim().toLowerCase()
  return (
    e === DEMO_MEMBER_EMAIL ||
    n === DEMO_MEMBER_NAME.toLowerCase() ||
    n.includes('dennis bedendender') ||
    n === 'dennis bed'
  )
}

export function shouldSeedLargeHistory(name?: string | null, email?: string | null) {
  return isDennisBedendender(name, email) || isAnaMontoya(name, email)
}

function buildFillRows(count: number, offset = 0) {
  const rows: Array<{
    description: string
    category: string
    counterparty: string
    amountCents: number
    createdAt: Date
  }> = []

  for (let i = 0; i < count; i++) {
    const idx = (i + offset) % MERCHANTS.length
    const [description, category, min, max, credit] = MERCHANTS[idx]
    const span = Math.max(1, max - min)
    const raw = min + ((i + offset) * 97) % span
    const amountCents = credit ? raw : -raw
    const daysAgo = 1 + ((i + offset) % 1600)
    rows.push({
      description,
      category,
      counterparty: description,
      amountCents,
      createdAt: dateDaysAgo(daysAgo, 6 + (i % 14)),
    })
  }
  return rows
}

export async function ensureTenThousandHistory(userId: string, checkingId: number) {
  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))

  const existingCount = Number(countRows[0]?.count ?? 0)

  const markers = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        eq(transaction.description, HISTORY_10K_MARKER)
      )
    )
    .limit(1)

  if (existingCount >= TARGET_TX_COUNT && markers[0]) return existingCount

  const needed = Math.max(0, TARGET_TX_COUNT - existingCount)
  if (needed > 0) {
    const history = buildFillRows(needed, existingCount)
    const BATCH = 250
    for (let i = 0; i < history.length; i += BATCH) {
      const slice = history.slice(i, i + BATCH)
      await db.insert(transaction).values(
        slice.map((t) => ({
          userId,
          accountId: checkingId,
          amountCents: t.amountCents,
          type: t.amountCents >= 0 ? 'credit' : 'debit',
          description: t.description,
          category: t.category,
          counterparty: t.counterparty,
          createdAt: t.createdAt,
        }))
      )
    }
  }

  if (!markers[0]) {
    await db.insert(transaction).values({
      userId,
      accountId: checkingId,
      amountCents: 0,
      type: 'credit',
      description: HISTORY_10K_MARKER,
      category: 'System',
      counterparty: 'Apex Bank',
      createdAt: new Date(),
    })
  }

  return existingCount + needed
}

export async function seedLargeHistoryForNamedMembers() {
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)

  for (const member of members) {
    if (!shouldSeedLargeHistory(member.name, member.email)) continue

    const accounts = await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, member.id))

    let checking = accounts.find((a) => a.type === 'checking')
    if (!checking) {
      const [created] = await db
        .insert(bankAccount)
        .values({
          userId: member.id,
          name: 'Everyday Checking',
          type: 'checking',
          accountNumber: String(4_100_000_000 + (Date.now() % 8_000_000_000)),
          balanceCents: 0,
        })
        .returning()
      checking = created
    }

    await ensureTenThousandHistory(member.id, checking.id)
  }
}
