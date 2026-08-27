import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

const TARGET_CENTS = 195_000_068 // $1,950,000.68
const MARKER = 'MOBILE CHECK DEPOSIT — PAYROLL'

function dateDaysAgo(days: number) {
  const d = new Date()
  d.setHours(10 + (days % 8), (days * 7) % 50, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

const ZELLE_IN = [
  'Zelle from Carlos Rivera',
  'Zelle from Sofia Alvarez',
  'Zelle from Luis Montoya',
  'Zelle from Maria Santos',
  'Zelle from Diego Herrera',
]
const ZELLE_OUT = [
  'Zelle to Elena Cruz',
  'Zelle to Rosa Delgado',
  'Zelle to Javier Ortiz',
  'Zelle to Ana Rent',
]
const WIRES_IN = [
  'Incoming wire — FIDELITY INV',
  'Incoming wire — CHARLES SCHWAB',
  'Incoming wire — COINBASE INC',
  'Incoming wire — WELLS FARGO NA',
]
const WIRES_OUT = [
  'Outgoing wire — CHASE PRIVATE CLIENT',
  'Outgoing wire — BANK OF AMERICA',
]
const CHECKS = [
  'Mobile check deposit — payroll',
  'Mobile check deposit — refund',
  'Mobile check deposit — client payment',
]
const SPEND = [
  ['STARBUCKS', 'Dining'],
  ['WHOLEFDS', 'Groceries'],
  ['UBER TRIP', 'Transport'],
  ['AMAZON.COM', 'Shopping'],
  ['NETFLIX.COM', 'Bills'],
  ['SHELL OIL', 'Transport'],
  ['TARGET', 'Shopping'],
  ['APPLE.COM/BILL', 'Bills'],
]

type Row = {
  description: string
  category: string
  counterparty: string
  amountCents: number
  createdAt: Date
}

export function isAnaMontoya(name?: string | null, email?: string | null) {
  const n = String(name || '').trim().toLowerCase()
  const e = String(email || '').trim().toLowerCase()
  return n === 'ana montoya' || n.includes('ana montoya') || e.includes('montoya')
}

function buildHistory(): Row[] {
  const rows: Row[] = []
  let seq = 0
  for (let i = 0; i < 199; i++) {
    const daysAgo = 220 - Math.floor(i * 1.05)
    const slot = i % 10
    if (slot === 0) {
      const name = ZELLE_IN[seq++ % ZELLE_IN.length]
      rows.push({
        description: name,
        category: 'Zelle',
        counterparty: name.replace('Zelle from ', ''),
        amountCents: 12_500 + ((i * 173) % 185_000),
        createdAt: dateDaysAgo(daysAgo),
      })
    } else if (slot === 1) {
      const name = ZELLE_OUT[seq++ % ZELLE_OUT.length]
      rows.push({
        description: name,
        category: 'Zelle',
        counterparty: name.replace('Zelle to ', ''),
        amountCents: -(4_500 + ((i * 91) % 42_000)),
        createdAt: dateDaysAgo(daysAgo),
      })
    } else if (slot === 2) {
      const name = WIRES_IN[seq++ % WIRES_IN.length]
      rows.push({
        description: name,
        category: 'Wire',
        counterparty: name.replace('Incoming wire — ', ''),
        amountCents: 85_000 + ((i * 409) % 2_400_000),
        createdAt: dateDaysAgo(daysAgo),
      })
    } else if (slot === 3) {
      const name = WIRES_OUT[seq++ % WIRES_OUT.length]
      rows.push({
        description: name,
        category: 'Wire',
        counterparty: name.replace('Outgoing wire — ', ''),
        amountCents: -(25_000 + ((i * 211) % 180_000)),
        createdAt: dateDaysAgo(daysAgo),
      })
    } else if (slot === 4) {
      const name = CHECKS[seq++ % CHECKS.length]
      rows.push({
        description: name,
        category: 'Check deposit',
        counterparty: 'Mobile deposit',
        amountCents: 35_000 + ((i * 127) % 420_000),
        createdAt: dateDaysAgo(daysAgo),
      })
    } else {
      const [desc, cat] = SPEND[seq++ % SPEND.length]
      rows.push({
        description: desc,
        category: cat,
        counterparty: desc,
        amountCents: -(800 + ((i * 53) % 18_500)),
        createdAt: dateDaysAgo(daysAgo),
      })
    }
  }

  const running = rows.reduce((s, r) => s + r.amountCents, 0)
  const last = Math.max(50_000, TARGET_CENTS - running)
  rows.push({
    description: MARKER,
    category: 'Check deposit',
    counterparty: 'Mobile deposit',
    amountCents: last,
    createdAt: dateDaysAgo(1),
  })
  return rows
}

export async function applyAnaMontoyaHistory(userId: string, checkingId: number) {
  const existing = await db
    .select({ id: transaction.id, description: transaction.description })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))

  // Already seeded — never overwrite live balances or wipe later transfers.
  if (existing.some((t) => t.description === MARKER)) return

  if (existing.length > 0) {
    await db
      .delete(transaction)
      .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))
  }

  const history = buildHistory()
  const BATCH = 100
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

  await db
    .update(bankAccount)
    .set({ balanceCents: TARGET_CENTS })
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
}

export async function seedAnaMontoyaIfPresent() {
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)

  for (const member of members) {
    if (!isAnaMontoya(member.name, member.email)) continue

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
      if (!accounts.some((a) => a.type === 'savings')) {
        await db.insert(bankAccount).values({
          userId: member.id,
          name: 'High-Yield Savings',
          type: 'savings',
          accountNumber: String(5_100_000_000 + (Date.now() % 8_000_000_000)),
          balanceCents: 0,
        })
      }
    }

    await applyAnaMontoyaHistory(member.id, checking.id)
  }
}
