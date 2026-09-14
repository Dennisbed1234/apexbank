import { db } from '@/lib/db'
import { bankAccount, transaction } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'

function dateDaysAgo(days: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

/** Target ledger balance for Dennis Everyday Checking */
const TARGET_BALANCE_CENTS = 3_974_906 // $39,749.06
const SEED_MARKER = 'APEX DEMO HISTORY LOCKED'
const OPENING_BALANCE_DESC = 'Opening balance'

/** ~$112,750/month max self-employed farm income */
const MONTHLY_INCOME_CAP_CENTS = 11_275_000

type SeedTx = {
  description: string
  category: string
  counterparty: string
  amountCents: number
  createdAt: Date
}

function hash(n: number) {
  let x = n | 0
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = ((x >>> 16) ^ x) * 0x45d9f3b
  x = (x >>> 16) ^ x
  return Math.abs(x)
}

function randBetween(seed: number, min: number, max: number) {
  const span = Math.max(1, max - min)
  return min + (hash(seed) % span)
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

const GROCERY = ['WALMART', 'COSTCO WHSE', 'TARGET', 'PUBLIX', "TRADER JOE'S", 'WHOLEFDS', 'ALDI']
const GAS = ['EXXONMOBIL', 'SHELL OIL', 'CHEVRON', '7-ELEVEN', 'BP', 'WAWA']
const DINING = ['STARBUCKS', "MCDONALD'S", 'CHIPOTLE', 'CHICK-FIL-A', 'PANERA BREAD', "DUNKIN'", 'SUBWAY']
const RETAIL = ['AMAZON.COM', 'WALGREENS', 'CVS/PHARMACY', 'HOME DEPOT', "LOWE'S", 'BEST BUY']
const BILLS = ['APPLE.COM/BILL', 'NETFLIX.COM', 'SPOTIFY USA', 'AT&T WIRELESS', 'VERIZON WIRELESS', 'COMCAST CABLE']

const FARM_INCOME = [
  'ACH CROP SALE LOCAL COOP',
  'CATTLE SALE LIVESTOCK MKT',
  'USDA FARM SERVICE PAYMENT',
  'GRAIN ELEVATOR SETTLEMENT',
  'HAY SALE LOCAL BUYER',
  'PRODUCE MARKET SALES',
  'FARMERS MARKET DEPOSIT',
  'ACH DAIRY COOP PAYMENT',
]

const FARM_EXPENSE = [
  ['TRACTOR SUPPLY CO', 'Farm supplies', 4500, 28000],
  ['JOHN DEERE FINANCIAL', 'Equipment', 18500, 65000],
  ['FEED STORE BULK FEED', 'Farm supplies', 8500, 42000],
  ['FERTILIZER CO OP', 'Farm supplies', 12000, 55000],
  ['SEED COMPANY ORDER', 'Farm supplies', 9500, 48000],
  ['FARM FUEL BULK DIESEL', 'Transport', 15000, 65000],
  ['IRRIGATION SUPPLY CO', 'Farm supplies', 3500, 22000],
  ['VET CLINIC LIVESTOCK', 'Farm', 2800, 18000],
  ['FENCE SUPPLY LUMBER', 'Farm supplies', 4500, 25000],
  ['AGRI CHEMICALS INC', 'Farm supplies', 6500, 32000],
  ['FARM BUREAU INSURANCE', 'Insurance', 8500, 18500],
  ['COUNTY PROPERTY TAX FARM', 'Taxes', 12000, 45000],
] as const

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length]
}

function spendAmount(seed: number, min: number, max: number) {
  const span = Math.max(1, max - min)
  return -(min + ((seed * 97) % span))
}

/**
 * Self-employed farmer personal checking (~2 years):
 * - Farm income streams (crop, livestock, USDA, coop) totaling ≤ ~$112,750/mo
 * - Farm operating expenses
 * - Personal daily spend
 * - No large investment wires
 */
export function buildTwoYearPersonalHistory(): SeedTx[] {
  const rows: SeedTx[] = []
  let seq = 0

  // Track monthly income so we never exceed the cap
  const incomeByMonth = new Map<string, number>()

  function monthKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}`
  }

  function canAddIncome(d: Date, amount: number) {
    const k = monthKey(d)
    const soFar = incomeByMonth.get(k) ?? 0
    if (soFar + amount > MONTHLY_INCOME_CAP_CENTS) return false
    incomeByMonth.set(k, soFar + amount)
    return true
  }

  for (let day = 0; day < 730; day++) {
    const baseDate = dateDaysAgo(729 - day)
    const dow = baseDate.getDay()
    const seed = baseDate.getFullYear() * 10000 + (baseDate.getMonth() + 1) * 100 + baseDate.getDate()

    // ——— Farm income (self-employed) ———
    // Crop/coop settlements a few times per week
    if (! (dow === 0) && hash(seed + 1) % 4 === 0) {
      const name = pick(FARM_INCOME, seq++)
      const amt = randBetween(seed + 2, 85000, 485000) // $850–$4,850 typical deposit
      if (canAddIncome(baseDate, amt)) {
        rows.push({
          description: name,
          category: 'Income',
          counterparty: name,
          amountCents: amt,
          createdAt: atHour(baseDate, 8, 15),
        })
      }
    }

    // Larger livestock / grain settlement ~twice a month
    if (day % 16 === 3) {
      const amt = randBetween(seed + 3, 350000, 1_250_000) // $3.5k–$12.5k
      if (canAddIncome(baseDate, amt)) {
        rows.push({
          description: 'CATTLE SALE LIVESTOCK MKT',
          category: 'Income',
          counterparty: 'Livestock Market',
          amountCents: amt,
          createdAt: atHour(baseDate, 9, 0),
        })
      }
    }

    // USDA / government farm payment monthly-ish
    if (day % 30 === 5) {
      const amt = randBetween(seed + 4, 180000, 650000)
      if (canAddIncome(baseDate, amt)) {
        rows.push({
          description: 'USDA FARM SERVICE PAYMENT',
          category: 'Income',
          counterparty: 'USDA',
          amountCents: amt,
          createdAt: atHour(baseDate, 10, 0),
        })
      }
    }

    // ——— Farm expenses ———
    if (dow >= 1 && dow <= 5 && hash(seed + 10) % 3 === 0) {
      const exp = FARM_EXPENSE[hash(seed + 11) % FARM_EXPENSE.length]
      const [desc, cat, min, max] = exp
      rows.push({
        description: desc,
        category: cat,
        counterparty: desc,
        amountCents: -randBetween(seed + 12, min, max),
        createdAt: atHour(baseDate, 11, 20),
      })
    }

    // Bulk diesel more often
    if (day % 9 === 2) {
      rows.push({
        description: 'FARM FUEL BULK DIESEL',
        category: 'Transport',
        counterparty: 'Farm Fuel',
        amountCents: -randBetween(seed + 13, 12000, 55000),
        createdAt: atHour(baseDate, 14, 0),
      })
    }

    // ——— Personal daily expenses ———
    if (dow >= 1 && dow <= 5 && hash(seed + 20) % 2 === 0) {
      const coffee = pick(DINING, seq++)
      rows.push({
        description: coffee,
        category: 'Dining',
        counterparty: coffee,
        amountCents: spendAmount(seq, 350, 1600),
        createdAt: atHour(baseDate, 7, 10),
      })
    }

    if (day % 3 === 0 || dow === 6) {
      const grocery = pick(GROCERY, seq++)
      const weekend = dow === 0 || dow === 6
      rows.push({
        description: grocery,
        category: 'Groceries',
        counterparty: grocery,
        amountCents: spendAmount(seq, weekend ? 4500 : 1800, weekend ? 18000 : 11000),
        createdAt: atHour(baseDate, 12, 30),
      })
    }

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

    if (day % 4 === 1) {
      const shop = pick(RETAIL, seq++)
      rows.push({
        description: shop,
        category: 'Shopping',
        counterparty: shop,
        amountCents: spendAmount(seq, 900, 12000),
        createdAt: atHour(baseDate, 15, 20),
      })
    }

    if (day % 10 === 2) {
      const bill = pick(BILLS, seq++)
      rows.push({
        description: bill,
        category: 'Bills',
        counterparty: bill,
        amountCents: spendAmount(seq, 999, 12999),
        createdAt: atHour(baseDate, 9, 0),
      })
    }

    // Monthly rent / housing
    if (day % 30 === 1) {
      rows.push({
        description: 'BILL PAY RENT HARBOR COURT',
        category: 'Housing',
        counterparty: 'HARBOR COURT',
        amountCents: -145000, // $1,450 rent — fits modest farmer household
        createdAt: atHour(baseDate, 8, 0),
      })
    }

    // Occasional personal Zelle
    if (day % 14 === 6) {
      rows.push({
        description: 'ZELLE FROM FAMILY',
        category: 'Income',
        counterparty: 'Zelle',
        amountCents: randBetween(seed + 30, 5000, 35000),
        createdAt: atHour(baseDate, 13, 0),
      })
    }
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

async function ensureDennisOpeningBalance(userId: string, checkingId: number) {
  // Strip any leftover large wires from older seeds
  await db
    .delete(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        orWireDescriptions()
      )
    )

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
    if (Number(existing[0].amountCents) !== needed) {
      await db
        .update(transaction)
        .set({
          amountCents: needed,
          type: needed >= 0 ? 'credit' : 'debit',
        })
        .where(eq(transaction.id, existing[0].id))
    }
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

function orWireDescriptions() {
  return sql`(
    ${transaction.description} ILIKE '%WIRE FROM COINBASE%'
    OR ${transaction.description} ILIKE '%INCOMING WIRE FIDELITY%'
    OR ${transaction.description} ILIKE '%INCOMING WIRE SCHWAB%'
    OR ${transaction.description} ILIKE '%WIRE FROM COINBASE%'
    OR ${transaction.description} ILIKE '%CHARLES SCHWAB%'
    OR ${transaction.description} ILIKE '%FIDELITY INV%'
  )`
}

export async function applyTwoYearPersonalHistory(
  userId: string,
  checkingId: number
) {
  const existingTx = await db
    .select({ id: transaction.id, description: transaction.description })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))

  const hasOldWires = existingTx.some(
    (t) =>
      /COINBASE|FIDELITY|SCHWAB/i.test(String(t.description || '')) ||
      /WIRE FROM COINBASE|INCOMING WIRE/i.test(String(t.description || ''))
  )
  const hasMarker = existingTx.some((t) => t.description === SEED_MARKER)
  const hasFarm = existingTx.some((t) =>
    /USDA|CATTLE SALE|CROP SALE|TRACTOR SUPPLY|FARM FUEL|GRAIN ELEVATOR/i.test(
      String(t.description || '')
    )
  )

  // Rebuild if: no marker, or still has large wires, or missing farm activity
  const needsRebuild = !hasMarker || hasOldWires || !hasFarm

  if (!needsRebuild) {
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
