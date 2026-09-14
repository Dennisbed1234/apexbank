import { db } from '@/lib/db'
import { bankAccount, transaction } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'

function dateDaysAgo(days: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000)
}

/** Target ledger balance for Dennis Everyday Checking */
const TARGET_BALANCE_CENTS = 70_000_000 // $700,000.00
const SEED_MARKER = 'APEX DEMO HISTORY LOCKED'
const OPENING_BALANCE_DESC = 'Opening balance'

const GROCERY = [
  'WALMART',
  'COSTCO WHSE',
  'TARGET',
  'PUBLIX',
  "TRADER JOE'S",
  'WHOLEFDS',
  'ALDI',
  "SAM'S CLUB",
]

const GAS = [
  'EXXONMOBIL',
  'SHELL OIL',
  'CHEVRON',
  '7-ELEVEN',
  'BP',
  'WAWA',
]

const DINING = [
  'STARBUCKS',
  "MCDONALD'S",
  'CHIPOTLE',
  'CHICK-FIL-A',
  'PANERA BREAD',
  "DUNKIN'",
  'TACO BELL',
  'SUBWAY',
]

const RETAIL = [
  'AMAZON.COM',
  'APPLE STORE',
  'WALGREENS',
  'CVS/PHARMACY',
  'HOME DEPOT',
  "LOWE'S",
  'BEST BUY',
]

const BILLS = [
  'APPLE.COM/BILL',
  'NETFLIX.COM',
  'SPOTIFY USA',
  'AT&T WIRELESS',
  'VERIZON WIRELESS',
  'COMCAST CABLE',
  'GEICO',
  'STATE FARM INS',
]

type SeedTx = {
  description: string
  category: string
  counterparty: string
  amountCents: number
  createdAt: Date
}

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length]
}

function spendAmount(seed: number, min: number, max: number) {
  const span = Math.max(1, max - min)
  return -(min + ((seed * 97) % span))
}

function atHour(base: Date, hour: number, minute = 0) {
  const d = new Date(base)
  d.setHours(hour, minute, (hour * 7) % 60, 0)
  return d
}

function openingBalanceDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Realistic personal Everyday Checking activity over ~2 years:
 * coffee, groceries, gas, shopping, bills, bi-weekly payroll, monthly rent.
 * Amounts vary day-to-day; no synthetic decay curve.
 */
export function buildTwoYearPersonalHistory(): SeedTx[] {
  const rows: SeedTx[] = []
  let seq = 0

  for (let day = 0; day < 730; day++) {
    const baseDate = dateDaysAgo(729 - day)
    const dow = baseDate.getDay()

    // Morning coffee most weekdays
    if (dow >= 1 && dow <= 5) {
      const coffee = pick(DINING, seq++)
      rows.push({
        description: coffee,
        category: 'Dining',
        counterparty: coffee,
        amountCents: spendAmount(seq, 350, 1600),
        createdAt: atHour(baseDate, 7, 15),
      })
    }

    // Groceries a few times per week
    if (day % 3 === 0 || dow === 6) {
      const grocery = pick(GROCERY, seq++)
      const weekend = dow === 0 || dow === 6
      rows.push({
        description: grocery,
        category: 'Groceries',
        counterparty: grocery,
        amountCents: spendAmount(seq, weekend ? 4500 : 1800, weekend ? 22000 : 12000),
        createdAt: atHour(baseDate, 11, 30),
      })
    }

    // Gas ~every 4–5 days
    if (day % 5 === 0) {
      const gas = pick(GAS, seq++)
      rows.push({
        description: gas,
        category: 'Transport',
        counterparty: gas,
        amountCents: spendAmount(seq, 2800, 7200),
        createdAt: atHour(baseDate, 16, 0),
      })
    }

    // Retail every other day-ish
    if (day % 2 === 1) {
      const shop = pick(RETAIL, seq++)
      rows.push({
        description: shop,
        category: 'Shopping',
        counterparty: shop,
        amountCents: spendAmount(seq, 900, 14500),
        createdAt: atHour(baseDate, 15, 20),
      })
    }

    // Bills scattered
    if (day % 9 === 2) {
      const bill = pick(BILLS, seq++)
      rows.push({
        description: bill,
        category: 'Bills',
        counterparty: bill,
        amountCents: spendAmount(seq, 999, 12999),
        createdAt: atHour(baseDate, 9, 0),
      })
    }

    // Bi-weekly payroll (Fridays)
    if (dow === 5 && Math.floor(day / 7) % 2 === 0) {
      rows.push({
        description: 'ACH PAYROLL DIRECT DEP',
        category: 'Income',
        counterparty: 'Payroll',
        amountCents: 485000 + ((day * 13) % 40) * 1000,
        createdAt: atHour(baseDate, 6, 0),
      })
    }

    // Monthly rent (~1st of month pattern via day % 30)
    if (day % 30 === 1) {
      rows.push({
        description: 'BILL PAY RENT HARBOR COURT',
        category: 'Housing',
        counterparty: 'HARBOR COURT',
        amountCents: -195000,
        createdAt: atHour(baseDate, 8, 0),
      })
    }

    // Occasional Zelle / Venmo
    if (day % 12 === 3) {
      rows.push({
        description: 'ZELLE FROM CHASE',
        category: 'Income',
        counterparty: 'Zelle',
        amountCents: 15000 + ((seq * 19) % 85000),
        createdAt: atHour(baseDate, 13, 0),
      })
    }
    if (day % 18 === 7) {
      rows.push({
        description: 'VENMO',
        category: 'Shopping',
        counterparty: 'Venmo',
        amountCents: spendAmount(seq, 1200, 8500),
        createdAt: atHour(baseDate, 20, 0),
      })
    }
  }

  // A few large investment wires (personal style, not every week)
  const wires = [
    { desc: 'WIRE FROM COINBASE', cp: 'COINBASE INC', amt: 8_500_000, days: 46 },
    { desc: 'INCOMING WIRE FIDELITY', cp: 'FIDELITY INV', amt: 12_000_000, days: 29 },
    { desc: 'WIRE FROM COINBASE', cp: 'COINBASE INC', amt: 9_750_000, days: 17 },
    { desc: 'INCOMING WIRE SCHWAB', cp: 'CHARLES SCHWAB', amt: 15_250_000, days: 6 },
    { desc: 'WIRE FROM COINBASE', cp: 'COINBASE INC', amt: 7_200_000, days: 0 },
  ]
  for (const w of wires) {
    rows.push({
      description: w.desc,
      category: 'Wire',
      counterparty: w.cp,
      amountCents: w.amt,
      createdAt: w.days === 0 ? minutesAgo(18) : dateDaysAgo(w.days),
    })
  }

  return rows
}

async function markSeeded(userId: string, checkingId: number) {
  const existing = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        eq(transaction.description, SEED_MARKER)
      )
    )
    .limit(1)
  if (existing[0]) return

  await db.insert(transaction).values({
    userId,
    accountId: checkingId,
    amountCents: 0,
    type: 'credit',
    description: SEED_MARKER,
    category: 'System',
    counterparty: 'Apex Bank',
    createdAt: new Date(),
  })
}

/** Opening balance so sum(all txs) = TARGET_BALANCE_CENTS */
async function ensureDennisOpeningBalance(userId: string, checkingId: number) {
  const sumRows = await db
    .select({ total: sql<number>`coalesce(sum(${transaction.amountCents}), 0)::bigint` })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        sql`${transaction.description} <> ${OPENING_BALANCE_DESC}`,
        sql`${transaction.description} <> ${SEED_MARKER}`
      )
    )

  const currentSum = Number(sumRows[0]?.total ?? 0)
  const needed = TARGET_BALANCE_CENTS - currentSum

  const existing = await db
    .select({ id: transaction.id, amountCents: transaction.amountCents })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        eq(transaction.description, OPENING_BALANCE_DESC)
      )
    )
    .limit(1)

  if (existing[0]) {
    if (Number(existing[0].amountCents) === needed) {
      await db
        .update(bankAccount)
        .set({ balanceCents: TARGET_BALANCE_CENTS })
        .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
      return
    }
    await db
      .update(transaction)
      .set({
        amountCents: needed,
        type: needed >= 0 ? 'credit' : 'debit',
      })
      .where(eq(transaction.id, existing[0].id))
  } else if (needed !== 0) {
    await db.insert(transaction).values({
      userId,
      accountId: checkingId,
      amountCents: needed,
      type: needed >= 0 ? 'credit' : 'debit',
      description: OPENING_BALANCE_DESC,
      category: 'Opening balance',
      counterparty: 'Apex Bank',
      createdAt: openingBalanceDate(),
    })
  }

  await db
    .update(bankAccount)
    .set({ balanceCents: TARGET_BALANCE_CENTS })
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
}

export async function applyTwoYearPersonalHistory(
  userId: string,
  checkingId: number
) {
  const existingTx = await db
    .select({ id: transaction.id, description: transaction.description })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))

  // Already fully seeded — only re-reconcile opening balance
  if (existingTx.some((t) => t.description === SEED_MARKER)) {
    await ensureDennisOpeningBalance(userId, checkingId)
    return
  }

  if (existingTx.length > 0) {
    await db
      .delete(transaction)
      .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))
  }

  const history = buildTwoYearPersonalHistory()
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

  await ensureDennisOpeningBalance(userId, checkingId)
  await markSeeded(userId, checkingId)
}
