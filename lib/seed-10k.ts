import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { DEMO_MEMBER_EMAIL, DEMO_MEMBER_NAME } from '@/lib/bank-constants'
import { isAnaMontoya } from '@/lib/seed-ana'
import { and, eq, gte, like, or, sql } from 'drizzle-orm'

export const TARGET_TX_COUNT = 10_000
export const JIMMY_CHECKING_CENTS = 386_107_752 // $3,861,077.52

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
  ['Incoming wire - FIDELITY INV', 'Wire', 25000, 450000, true],
  ['Mobile check deposit', 'Check deposit', 12000, 220000, true],
  ['WHOLEFDS', 'Groceries', 2200, 14000, false],
  ['TARGET', 'Shopping', 1200, 9800, false],
  ['VERIZON WIRELESS', 'Bills', 4500, 16500, false],
  ['ACH CREDIT CHASE', 'Income', 15000, 120000, true],
  ['BILL PAY RENT HARBOR COURT', 'Housing', 165000, 245000, false],
  ['PUBLIX', 'Groceries', 1600, 11000, false],
  ['CHIPOTLE', 'Dining', 900, 2800, false],
  ['EXXONMOBIL', 'Transport', 2500, 7800, false],
  ['SPOTIFY USA', 'Bills', 999, 1699, false],
]

function dateInLastYear(index: number, total: number) {
  const spanMs = 365 * 24 * 60 * 60 * 1000
  const offset = Math.floor((index / Math.max(1, total)) * spanMs)
  const d = new Date(Date.now() - offset)
  d.setHours(6 + (index % 14), (index * 11) % 60, index % 60, 0)
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

export function isJimmyMember(name?: string | null, email?: string | null) {
  const n = String(name || '').trim().toLowerCase()
  const e = String(email || '').trim().toLowerCase()
  const first = n.split(/\s+/)[0] || ''
  return first === 'jimmy' || n.startsWith('jimmy ') || e.startsWith('jimmy')
}

export function shouldSeedLargeHistory(name?: string | null, email?: string | null) {
  return (
    isDennisBedendender(name, email) ||
    isAnaMontoya(name, email) ||
    isJimmyMember(name, email)
  )
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
    rows.push({
      description,
      category,
      counterparty: description,
      amountCents: credit ? raw : -raw,
      createdAt: dateInLastYear(i + offset, TARGET_TX_COUNT),
    })
  }
  return rows
}

async function stripInternalMarkers(userId: string) {
  await db
    .delete(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        or(
          like(transaction.description, '%HISTORY LOCKED%'),
          like(transaction.description, 'APEX 10K%'),
          like(transaction.description, 'APEX DEMO%')
        )
      )
    )
}

async function countYearRows(userId: string, checkingId: number) {
  const since = new Date()
  since.setMonth(since.getMonth() - 12)
  since.setHours(0, 0, 0, 0)

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        gte(transaction.createdAt, since)
      )
    )
  return Number(rows[0]?.count ?? 0)
}

export async function applyJimmyChecking(
  userId: string,
  checkingId: number
) {
  await db
    .update(bankAccount)
    .set({
      name: 'Business Checking',
      balanceCents: JIMMY_CHECKING_CENTS,
    })
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
}

export async function ensureTenThousandHistory(userId: string, checkingId: number) {
  await stripInternalMarkers(userId)

  const visible = await countYearRows(userId, checkingId)
  const needed = Math.max(0, TARGET_TX_COUNT - visible)
  if (needed === 0) return { count: visible, target: TARGET_TX_COUNT, done: true }

  const history = buildFillRows(needed, visible)
  const BATCH = 400
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

  const count = visible + needed
  return { count, target: TARGET_TX_COUNT, done: count >= TARGET_TX_COUNT }
}

export async function seedLargeHistoryForNamedMembers() {
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)

  const results: Array<{ email: string | null; count: number; done: boolean }> = []

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
          name: isJimmyMember(member.name, member.email)
            ? 'Business Checking'
            : 'Everyday Checking',
          type: 'checking',
          accountNumber: String(4_100_000_000 + (Date.now() % 8_000_000_000)),
          balanceCents: isJimmyMember(member.name, member.email)
            ? JIMMY_CHECKING_CENTS
            : 0,
        })
        .returning()
      checking = created
    }

    if (isJimmyMember(member.name, member.email)) {
      await applyJimmyChecking(member.id, checking.id)
    }

    const result = await ensureTenThousandHistory(member.id, checking.id)
    results.push({
      email: member.email,
      count: result.count,
      done: result.done,
    })
  }

  return results
}
