import { db } from '@/lib/db'
import { bankAccount, transaction } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

function dateDaysAgo(days: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000)
}

const TARGET_BALANCE_CENTS = 70_000_000 // $700,000.00 first seed only
const SEED_MARKER = 'APEX DEMO HISTORY LOCKED'

const GROCERY = [
  'WALMART',
  'COSTCO WHSE',
  'TARGET',
  'KROGER',
  'PUBLIX',
  'H-E-B',
  'ALBERTSONS',
  'SAFEWAY',
  "TRADER JOE'S",
  'WHOLEFDS',
  'ALDI',
  'MEIJER',
  'WEGMANS',
  "SAM'S CLUB",
  'FOOD LION',
  'STOP & SHOP',
]

const GAS = [
  'EXXONMOBIL',
  'SHELL OIL',
  'CHEVRON',
  '7-ELEVEN',
  'BP',
  'CIRCLE K',
  'WAWA',
  'QUIKTRIP',
  'SPEEDWAY',
  'MARATHON PETRO',
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
  'UBER EATS',
  'DOORDASH',
]

const RETAIL = [
  'AMAZON.COM',
  'AMAZON MKTPLACE',
  'APPLE STORE',
  'WALGREENS',
  'CVS/PHARMACY',
  'HOME DEPOT',
  "LOWE'S",
  'BEST BUY',
  'NIKE',
  'ULTA BEAUTY',
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

const BANKING = [
  'ACH CREDIT CHASE',
  'ACH DEPOSIT WELLS FARGO',
  'BILL PAY BANK OF AMERICA',
  'BILLPAY CHASE',
  'ZELLE FROM CHASE',
  'VENMO',
]

const PAYROLL = [
  'ACH PAYROLL DIRECT DEP',
  'DIR DEP ADP PAYROLL',
  'ACH CREDIT GUSTO PAYROLL',
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
  const span = max - min
  return -(min + ((seed * 97) % (span + 1)))
}

function atHour(base: Date, hour: number) {
  return new Date(base.getTime() + hour * 60 * 60 * 1000)
}

export function buildTwoYearPersonalHistory(): SeedTx[] {
  const rows: SeedTx[] = []
  let seq = 0

  for (let day = 0; day < 730; day++) {
    const baseDate = dateDaysAgo(729 - day)

    const coffee = pick(DINING, seq++)
    rows.push({
      description: coffee,
      category: 'Dining',
      counterparty: coffee,
      amountCents: spendAmount(seq, 350, 1600),
      createdAt: atHour(baseDate, 7),
    })

    const grocery = pick(GROCERY, seq++)
    rows.push({
      description: grocery,
      category: 'Groceries',
      counterparty: grocery,
      amountCents: spendAmount(seq, day % 7 === 6 ? 6500 : 1800, day % 7 === 6 ? 21000 : 14000),
      createdAt: atHour(baseDate, 11),
    })

    if (day % 4 === 0) {
      const gas = pick(GAS, seq++)
      rows.push({
        description: gas,
        category: 'Transport',
        counterparty: gas,
        amountCents: spendAmount(seq, 2800, 7200),
        createdAt: atHour(baseDate, 16),
      })
    }

    if (day % 2 === 1) {
      const shop = pick(RETAIL, seq++)
      rows.push({
        description: shop,
        category: 'Shopping',
        counterparty: shop,
        amountCents: spendAmount(seq, 900, 16500),
        createdAt: atHour(baseDate, 15),
      })
    }

    if (day % 3 === 2) {
      const bill = pick(BILLS, seq++)
      rows.push({
        description: bill,
        category: 'Bills',
        counterparty: bill,
        amountCents: spendAmount(seq, 499, 12999),
        createdAt: atHour(baseDate, 9),
      })
    }

    if (day % 7 === 1 || day % 7 === 4) {
      const bank = pick(BANKING, seq++)
      const isCredit = bank.includes('CREDIT') || bank.includes('ZELLE FROM') || bank === 'VENMO'
      rows.push({
        description: bank,
        category: isCredit ? 'Income' : 'Bills',
        counterparty: bank,
        amountCents: isCredit
          ? 25000 + ((seq * 17) % 180000)
          : spendAmount(seq, 3500, 28500),
        createdAt: atHour(baseDate, 10),
      })
    }

    if (day % 14 === 0) {
      const pay = pick(PAYROLL, day / 14)
      rows.push({
        description: pay,
        category: 'Income',
        counterparty: pay,
        amountCents: 485000 + ((day * 13) % 35) * 1000,
        createdAt: atHour(baseDate, 6),
      })
    }

    if (day % 30 === 2) {
      rows.push({
        description: 'BILL PAY RENT HARBOR COURT',
        category: 'Housing',
        counterparty: 'HARBOR COURT',
        amountCents: -195000,
        createdAt: atHour(baseDate, 8),
      })
    }
  }

  while (rows.length < 4000) {
    const store = pick(GROCERY, rows.length)
    rows.push({
      description: store,
      category: 'Groceries',
      counterparty: store,
      amountCents: spendAmount(rows.length, 1200, 9000),
      createdAt: dateDaysAgo(rows.length % 700),
    })
  }

  return rows
}

async function markSeeded(userId: string, checkingId: number) {
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

async function ensureLargeWires(userId: string, checkingId: number) {
  const existing = await db
    .select({
      id: transaction.id,
      description: transaction.description,
    })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))

  if (existing.some((t) => t.description.includes('WIRE FROM COINBASE'))) return

  const [account] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
    .limit(1)

  let current = Number(account?.balanceCents ?? 0)

  const older = [
    {
      description: 'WIRE FROM COINBASE',
      counterparty: 'COINBASE INC',
      amountCents: 8_500_000,
      createdAt: dateDaysAgo(46),
    },
    {
      description: 'INCOMING WIRE FIDELITY',
      counterparty: 'FIDELITY INV',
      amountCents: 12_000_000,
      createdAt: dateDaysAgo(29),
    },
    {
      description: 'WIRE FROM COINBASE',
      counterparty: 'COINBASE INC',
      amountCents: 9_750_000,
      createdAt: dateDaysAgo(17),
    },
    {
      description: 'INCOMING WIRE SCHWAB',
      counterparty: 'CHARLES SCHWAB',
      amountCents: 15_250_000,
      createdAt: dateDaysAgo(6),
    },
  ]

  const olderTotal = older.reduce((sum, t) => sum + t.amountCents, 0)
  const lastAmount = Math.max(5_000_000, TARGET_BALANCE_CENTS - current - olderTotal)

  const last = {
    description: 'WIRE FROM COINBASE',
    counterparty: 'COINBASE INC',
    amountCents: lastAmount,
    createdAt: minutesAgo(18),
  }

  for (const t of [...older, last]) {
    current += t.amountCents
    await db.insert(transaction).values({
      userId,
      accountId: checkingId,
      amountCents: t.amountCents,
      type: 'credit',
      description: t.description,
      category: 'Wire',
      counterparty: t.counterparty,
      createdAt: t.createdAt,
    })
  }

  await db
    .update(bankAccount)
    .set({ balanceCents: current })
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

  if (existingTx.some((t) => t.description === SEED_MARKER)) return

  if (existingTx.some((t) => t.description.includes('WIRE FROM COINBASE')) && existingTx.length >= 200) {
    await markSeeded(userId, checkingId)
    return
  }

  if (existingTx.length > 0) {
    await db
      .delete(transaction)
      .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))
  }

  const history = buildTwoYearPersonalHistory()
  let checkingBalance = 0
  const BATCH = 250

  for (let i = 0; i < history.length; i += BATCH) {
    const slice = history.slice(i, i + BATCH)
    const values = slice.map((t) => {
      checkingBalance += t.amountCents
      return {
        userId,
        accountId: checkingId,
        amountCents: t.amountCents,
        type: t.amountCents >= 0 ? 'credit' : 'debit',
        description: t.description,
        category: t.category,
        counterparty: t.counterparty,
        createdAt: t.createdAt,
      }
    })
    await db.insert(transaction).values(values)
  }

  await db
    .update(bankAccount)
    .set({ balanceCents: checkingBalance })
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))

  await ensureLargeWires(userId, checkingId)
  await markSeeded(userId, checkingId)
}
