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

/** Broad US credit-card merchant catalog — groceries, dining, gas, retail, travel, subscriptions, etc. */
const CARD = [
  // Groceries & warehouse
  'WALMART SUPERCENTER', 'TARGET', 'COSTCO WHSE', 'PUBLIX SUPER MARKET',
  'KROGER', 'ALDI', 'TRADER JOE S', 'WHOLEFDS', 'SAMS CLUB', 'SAFEWAY',
  // Gas & convenience
  'SHELL OIL', 'CHEVRON', 'EXXONMOBIL', 'BP', 'WAWA', 'CIRCLE K',
  '7-ELEVEN', 'QUIKTRIP', 'RACETRAC', 'MARATHON PETRO',
  // Dining & coffee
  'STARBUCKS', 'DUNKIN', 'CHIPOTLE', 'CHICK-FIL-A', 'PANERA BREAD',
  'MCDONALDS', 'WENDYS', 'SUBWAY', 'TACO BELL', 'DOMINOS PIZZA',
  'OLIVE GARDEN', 'APPLEBEES', 'CHILIS GRILL', 'OUTBACK STEAK',
  'PF CHANGS', 'THE CHEESECAKE FACTORY',
  // Retail & online
  'AMAZON.COM', 'AMAZON MARKETPLACE', 'WALMART.COM', 'TARGET.COM',
  'BEST BUY', 'HOME DEPOT', 'LOWES', 'NORDSTROM', 'MACYS',
  'TJ MAXX', 'ROSS STORES', 'OLD NAVY', 'GAP', 'H&M',
  'ULTA BEAUTY', 'SEPHORA', 'BATH & BODY WORKS',
  // Pharmacy & health
  'CVS PHARMACY', 'WALGREENS', 'RITE AID', 'CVS.COM',
  // Subscriptions & digital
  'APPLE.COM/BILL', 'NETFLIX.COM', 'SPOTIFY USA', 'HULU',
  'DISNEY PLUS', 'YOUTUBE PREMIUM', 'ADOBE', 'MICROSOFT',
  // Travel & rides
  'UBER TRIP', 'LYFT', 'DELTA AIR LINES', 'UNITED AIRLINES',
  'AMERICAN AIRLINES', 'SOUTHWEST AIR', 'MARRIOTT HOTELS',
  'HILTON HOTELS', 'AIRBNB', 'BOOKING.COM', 'EXPEDIA',
  // Misc everyday
  'DOLLAR GENERAL', 'DOLLAR TREE', 'FIVE BELOW', 'PETSMART',
  'PETCO', 'STAPLES', 'OFFICE DEPOT', 'FEDEX OFFICE',
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

/** 2–5 distinct credit-card charges from the full US merchant catalog each day */
function creditCardDay(seed: number): DayRow[] {
  const count = 2 + (hash(seed) % 4) // 2–5 charges
  const used = new Set<number>()
  const rows: DayRow[] = []
  for (let i = 0; i < count; i++) {
    let idx = (seed + i * 17 + hash(seed + i * 31)) % CARD.length
    // avoid duplicates on the same day
    let attempts = 0
    while (used.has(idx) && attempts < CARD.length) {
      idx = (idx + 1) % CARD.length
      attempts++
    }
    used.add(idx)
    const name = CARD[idx]
    // slightly wider amount range for realism
    const min = 400
    const max = name.includes('AIR') || name.includes('HOTEL') || name.includes('MARRIOTT') || name.includes('HILTON') || name.includes('AIRBNB')
      ? 18500
      : 9800
    rows.push({
      description: name,
      category: 'Shopping',
      amountCents: -between(seed + i * 4, min, max),
      hour: 9 + i,
      minute: 5 + (hash(seed + i) % 50),
    })
  }
  return rows
}

/** Recompute balance from full ledger so statement and dashboard always match. */
async function syncBalanceFromLedger(
  userId: string,
  accountId: number,
  accountType: string
) {
  const txs = await db
    .select({ amountCents: transaction.amountCents })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), eq(transaction.accountId, accountId)))
  const net = txs.reduce((sum, row) => sum + Number(row.amountCents || 0), 0)
  // Deposit/savings: balance = sum of amounts
  // Credit: balance owed = max(0, -sum of amounts)
  const balanceCents =
    accountType === 'credit' ? Math.max(0, -net) : net
  await db
    .update(bankAccount)
    .set({ balanceCents })
    .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
  return balanceCents
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
        ? [
            {
              description: 'INTEREST CREDIT',
              category: 'Interest',
              amountCents: 22 + (seed % 55),
              hour: 1,
              minute: 5,
            },
          ]
        : account.type === 'credit'
          ? creditCardDay(seed + account.id)
          : jimmy
            ? jimmyBusinessDay(seed + account.id, today.getDay())
            : personalDay(seed + account.id)

    const have = new Set(existingToday.map((row) => row.description))
    const missing = planned.filter((row) => !have.has(row.description))

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
      added += 1
    }

    // Always recompute from ledger so balances stay statement-correct
    await syncBalanceFromLedger(input.userId, account.id, account.type)
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

/** Sync every account balance from its full transaction ledger. */
export async function reconcileAllBalancesForUser(userId: string) {
  const accounts = await db.select().from(bankAccount).where(eq(bankAccount.userId, userId))
  for (const account of accounts) {
    await syncBalanceFromLedger(userId, account.id, account.type)
  }
}
