import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { and, eq, gte } from 'drizzle-orm'
import { isJimmyMember } from '@/lib/seed-10k'

const PERSONAL = [
  'PUBLIX SUPER MARKET', 'WALMART SUPERCENTER', 'TARGET', 'COSTCO WHSE',
  'SHELL OIL', 'CHEVRON', 'WAWA', 'CIRCLE K', 'STARBUCKS', 'DUNKIN',
  'CHIPOTLE', 'PANERA BREAD', 'CHICK-FIL-A', 'MCDONALDS', 'WENDYS',
  'AMAZON.COM', 'APPLE.COM/BILL', 'NETFLIX.COM', 'SPOTIFY USA',
  'CVS PHARMACY', 'WALGREENS', 'HOME DEPOT', 'LOWES', 'BEST BUY',
  'KROGER', 'TRADER JOE S', 'WHOLEFDS', 'UBER TRIP', 'LYFT',
]

const CARD = [
  'AMAZON.COM', 'TARGET', 'UBER TRIP', 'DELTA AIR LINES', 'STARBUCKS',
  'WHOLEFDS', 'APPLE.COM/BILL', 'NETFLIX.COM', 'SHELL OIL', 'CHICK-FIL-A',
]

type DayRow = {
  description: string
  category: string
  amountCents: number
  hour: number
  minute: number
}

function hash(n: number) {
  let x = n | 0
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  return Math.abs((x >>> 16) ^ x)
}

function between(seed: number, min: number, max: number) {
  return min + (hash(seed) % Math.max(1, max - min))
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function atToday(hour: number, minute: number) {
  const d = new Date()
  d.setHours(hour, minute, hash(hour * 60 + minute) % 50, 0)
  return d
}

function jimmyBusinessDay(seed: number, weekday: number): DayRow[] {
  const weekend = weekday === 0 || weekday === 6
  const rows: DayRow[] = [
    {
      description: 'TOAST POS SETTLEMENT NAPLES',
      category: 'Income',
      amountCents: weekend ? between(seed + 1, 245000, 420000) : between(seed + 1, 168000, 312000),
      hour: 5,
      minute: 42,
    },
    {
      description: 'CLOVER DEPOSIT NAPLES FL',
      category: 'Income',
      amountCents: weekend ? between(seed + 2, 98000, 210000) : between(seed + 2, 62000, 154000),
      hour: 6,
      minute: 18,
    },
    {
      description: 'SYSCO FOODS NAPLES FL',
      category: 'Supplies',
      amountCents: -between(seed + 3, 86000, 188000),
      hour: 7,
      minute: 10,
    },
    {
      description: 'RESTAURANT DEPOT NAPLES',
      category: 'Supplies',
      amountCents: -between(seed + 4, 24000, 72000),
      hour: 8,
      minute: 5,
    },
    {
      description: 'FRESHPOINT PRODUCE FL',
      category: 'Supplies',
      amountCents: -between(seed + 5, 18000, 46000),
      hour: 8,
      minute: 40,
    },
    {
      description: 'CINTAS UNIFORM SERVICE',
      category: 'Operations',
      amountCents: -between(seed + 6, 28000, 42000),
      hour: 9,
      minute: 15,
    },
    {
      description: 'NAPLES LINEN SERVICE',
      category: 'Operations',
      amountCents: -between(seed + 7, 32000, 56000),
      hour: 10,
      minute: 2,
    },
    {
      description: 'ECOLAB PEST CONTROL FL',
      category: 'Operations',
      amountCents: -between(seed + 8, 16500, 24800),
      hour: 11,
      minute: 20,
    },
  ]

  if (weekday === 5) {
    rows.push({
      description: 'ADP PAYROLL SERVICE',
      category: 'Payroll',
      amountCents: -between(seed + 9, 1650000, 2120000),
      hour: 6,
      minute: 5,
    })
  }
  if (weekday === 2) {
    rows.push({
      description: 'WASTE MANAGEMENT COMM',
      category: 'Operations',
      amountCents: -between(seed + 10, 18000, 26000),
      hour: 9,
      minute: 40,
    })
  }
  if (hash(seed + 11) % 3 === 0) {
    rows.push({
      description: 'COMCAST BUSINESS NAPLES',
      category: 'Bills',
      amountCents: -28900,
      hour: 13,
      minute: 12,
    })
  }
  if (hash(seed + 12) % 4 === 0) {
    rows.push({
      description: 'SQUARE INC PAYOUT',
      category: 'Income',
      amountCents: between(seed + 13, 48000, 126000),
      hour: 14,
      minute: 8,
    })
  }
  if (hash(seed + 14) % 5 === 0) {
    rows.push({
      description: 'AMAZON BUSINESS',
      category: 'Operations',
      amountCents: -between(seed + 15, 4200, 18600),
      hour: 15,
      minute: 33,
    })
  }
  return rows
}

function personalDay(seed: number): DayRow[] {
  const count = 4 + (hash(seed) % 4)
  const rows: DayRow[] = []
  for (let i = 0; i < count; i++) {
    const name = PERSONAL[(seed + i * 13) % PERSONAL.length]
    rows.push({
      description: name,
      category: 'Shopping',
      amountCents: -between(seed + i * 9, 650, 8600),
      hour: 8 + i,
      minute: 10 + i * 7,
    })
  }
  if (hash(seed + 80) % 4 === 0) {
    rows.push({
      description: 'ACH PAYROLL DIRECT DEP',
      category: 'Income',
      amountCents: between(seed + 81, 185000, 420000),
      hour: 7,
      minute: 5,
    })
  }
  return rows
}

export async function generateDailyActivityForUser(input: {
  userId: string
  name?: string | null
  email?: string | null
}) {
  const accounts = await db.select().from(bankAccount).where(eq(bankAccount.userId, input.userId))
  if (!accounts.length) return { added: 0 }
  const today = startOfToday()
  const jimmy = isJimmyMember(input.name, input.email)
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
  let added = 0

  for (const account of accounts) {
    if (!['checking', 'credit', 'savings'].includes(account.type)) continue

    const existingToday = await db
      .select({ id: transaction.id, description: transaction.description })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, input.userId),
          eq(transaction.accountId, account.id),
          gte(transaction.createdAt, today)
        )
      )

    const planned: DayRow[] =
      account.type === 'savings'
        ? [{ description: 'INTEREST CREDIT', category: 'Interest', amountCents: 22 + (seed % 55), hour: 1, minute: 5 }]
        : account.type === 'credit'
          ? CARD.slice(0, 3).map((name, i) => ({
              description: name,
              category: 'Shopping',
              amountCents: -between(seed + i * 4, 1200, 9800),
              hour: 11 + i,
              minute: 20,
            }))
          : jimmy
            ? jimmyBusinessDay(seed + account.id, today.getDay())
            : personalDay(seed + account.id)

    const have = new Set(existingToday.map((row) => row.description))
    const missing = planned.filter((row) => !have.has(row.description))
    if (!missing.length) continue

    let delta = 0
    for (const row of missing) {
      await db.insert(transaction).values({
        userId: input.userId,
        accountId: account.id,
        amountCents: row.amountCents,
        type: row.amountCents >= 0 ? 'credit' : 'debit',
        description: row.description,
        category: row.category,
        counterparty: row.description,
        createdAt: atToday(row.hour, row.minute),
      })
      delta += row.amountCents
      added += 1
    }
    if (delta !== 0) {
      await db
        .update(bankAccount)
        .set({ balanceCents: account.balanceCents + delta })
        .where(and(eq(bankAccount.id, account.id), eq(bankAccount.userId, input.userId)))
    }
  }
  return { added }
}

export async function generateDailyActivityForNamedMembers() {
  const members = await db.select({ id: user.id, name: user.name, email: user.email }).from(user)
  const results = []
  for (const member of members) {
    results.push({
      email: member.email,
      ...(await generateDailyActivityForUser({
        userId: member.id,
        name: member.name,
        email: member.email,
      })),
    })
  }
  return results
}
