import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { DEMO_MEMBER_EMAIL, DEMO_MEMBER_NAME } from '@/lib/bank-constants'
import { isAnaMontoya } from '@/lib/seed-ana'
import { and, eq, gte, like, or, sql } from 'drizzle-orm'

export const TARGET_TX_COUNT = 10_000
export const JIMMY_CHECKING_CENTS = 177_430_126 // $1,774,301.26
const OPENING_BALANCE_DESC = 'Opening balance'
const REALISM_MARKER = 'APEX JIMMY REALISM V2'

const MONTHLY_MORTGAGE_BASE = 8_450_00
const MONTHLY_STATE_FARM = 1_285_00
const MONTHLY_PROGRESSIVE = 642_00
const MONTHLY_COMCAST = 289_00
const MONTHLY_TOAST_SUB = 165_00
const WEEKLY_LINEN = 485_00
const WEEKLY_CINTAS = 312_00
const WEEKLY_ECOLAB = 195_00
const WEEKLY_WASTE = 210_00
const PAYROLL_BASE = 18_750_00

type CatalogRow = [string, string, number, number, boolean]
type TxRow = {
  description: string
  category: string
  counterparty: string
  amountCents: number
  createdAt: Date
}

const PERSONAL_MERCHANTS: CatalogRow[] = [
  ['STARBUCKS', 'Dining', 350, 1400, false],
  ['WALMART', 'Groceries', 1800, 16000, false],
  ['COSTCO WHSE', 'Groceries', 4500, 24000, false],
  ['SHELL OIL', 'Transport', 2800, 7200, false],
  ['UBER TRIP', 'Transport', 900, 4800, false],
  ['AMAZON.COM', 'Shopping', 800, 18500, false],
  ['NETFLIX.COM', 'Bills', 1399, 1999, false],
  ['APPLE.COM/BILL', 'Bills', 99, 2999, false],
  ['ACH PAYROLL DIRECT DEP', 'Income', 185000, 525000, true],
  ['PUBLIX', 'Groceries', 1600, 11000, false],
  ['CHIPOTLE', 'Dining', 900, 2800, false],
]

/** Expanded food / beverage suppliers — Florida + national */
const FOOD_VENDORS: CatalogRow[] = [
  ['SYSCO FOODS NAPLES', 'Supplies', 22000, 145000, false],
  ['US FOODS DISTRIBUTION', 'Supplies', 28000, 165000, false],
  ['PFG PERFORMANCE FOOD', 'Supplies', 18000, 110000, false],
  ['CHENEY BROTHERS INC', 'Supplies', 15000, 95000, false],
  ['RESTAURANT DEPOT NAPLES', 'Supplies', 8500, 52000, false],
  ['SEAFOOD ATLANTIC INC', 'Supplies', 12000, 68000, false],
  ['PRODUCE ALLIANCE FL', 'Supplies', 4500, 28000, false],
  ['BREAKTHRU BEVERAGE FL', 'Supplies', 6500, 38000, false],
  ['SOUTHERN GLAZERS WINE', 'Supplies', 8500, 48000, false],
  ['GORDON FOOD SERVICE', 'Supplies', 16000, 98000, false],
  ['SHAMROCK FOODS CO', 'Supplies', 14000, 82000, false],
  ['BEN E KEITH FOODS', 'Supplies', 12000, 75000, false],
  ['SYSCO SOUTHEAST FL', 'Supplies', 20000, 120000, false],
  ['FRESHPOINT PRODUCE', 'Supplies', 5500, 32000, false],
  ['KEYSTONE MEATS FL', 'Supplies', 9000, 55000, false],
  ['SYSCO CENTRAL FL', 'Supplies', 18000, 105000, false],
  ['FLORIDA BEVERAGE LLC', 'Supplies', 4000, 22000, false],
  ['NAPLES WATER ICE CO', 'Supplies', 1800, 8500, false],
]

/** Client entertainment — occasional only */
const CLIENT_MEALS: CatalogRow[] = [
  ['CAMPIELLO RISTORANTE NAPLES', 'Dining', 8500, 32000, false],
  ['THE BAY HOUSE NAPLES FL', 'Dining', 9500, 38000, false],
  ['BLEU PROVENCE NAPLES FL', 'Dining', 12000, 45000, false],
  ['DORONA STEAK NAPLES FL', 'Dining', 11000, 42000, false],
  ['USS NEMO NAPLES FL', 'Dining', 8500, 30000, false],
  ['BARBATELLA 5TH AVE NAPLES', 'Dining', 6500, 25000, false],
  ['THE CONTINENTAL NAPLES', 'Dining', 9000, 35000, false],
  ['OCEAN PRIME NAPLES', 'Dining', 14000, 48000, false],
  ['BONEFISH GRILL NAPLES', 'Dining', 5500, 18000, false],
  ['SEASONS 52 NAPLES', 'Dining', 7000, 22000, false],
]

/** Misc ops / national vendors */
const OPS_VENDORS: CatalogRow[] = [
  ['GRAINGER INDUSTRIAL', 'Operations', 3500, 28000, false],
  ['ULINE SHIPPING SUPPLY', 'Operations', 2200, 15000, false],
  ['NAPLES FIRE PROTECTION', 'Operations', 4500, 14000, false],
  ['HOME DEPOT COMMERCIAL', 'Operations', 2800, 18000, false],
  ['LOWES BUSINESS ACCOUNT', 'Operations', 2500, 16000, false],
  ['STAPLES BUSINESS ADV', 'Operations', 1200, 8500, false],
  ['OFFICE DEPOT BUSINESS', 'Operations', 900, 6500, false],
  ['AMAZON BUSINESS', 'Operations', 1500, 12000, false],
  ['FEDEX COMMERCIAL', 'Operations', 1800, 9500, false],
  ['UPS STORE SHIPPING', 'Operations', 1200, 7500, false],
  ['QUILL CORP SUPPLIES', 'Operations', 800, 5500, false],
  ['WEBSTAURANTSTORE', 'Operations', 3500, 22000, false],
  ['KITCHEN EQUIPMENT CO', 'Equipment', 4500, 35000, false],
  ['HOBART SERVICE FL', 'Equipment', 2800, 15000, false],
]

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

function atTime(base: Date, hour: number, minute = 0) {
  const d = new Date(base)
  d.setHours(hour, minute, hash(base.getTime() + hour * 97) % 60, 0)
  return d
}

function openingBalanceDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function monthlyFixedDates(): Date[] {
  const dates: Date[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    // Mortgage often posts between 1st–5th
    const dayOfMonth = 1 + (hash(now.getFullYear() * 100 + now.getMonth() - i) % 4)
    dates.push(new Date(now.getFullYear(), now.getMonth() - i, dayOfMonth, 10, 15, 0, 0))
  }
  return dates
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
  return (
    first === 'jimmy' ||
    n.startsWith('jimmy ') ||
    n.includes('jimmy ps') ||
    e.startsWith('jimmy')
  )
}

export function shouldSeedLargeHistory(name?: string | null, email?: string | null) {
  return (
    isDennisBedendender(name, email) ||
    isAnaMontoya(name, email) ||
    isJimmyMember(name, email)
  )
}

/**
 * Independent, noisy POS per processor — different bases, different noise,
 * different soft/spike days so streams do not lockstep-decline.
 */
function pushPosForDay(rows: TxRow[], day: Date, seed: number, dow: number) {
  // Toast — primary, posts most days
  if (hash(seed + 100) % 7 !== 0) {
    // skip ~1/7 days (missed batch)
    let base = 155000
    if (dow === 5 || dow === 6) base = 225000
    if (dow === 1) base = 105000
    if (dow === 0) base = 78000
    let amt = base + randBetween(seed + 101, -52000, 68000)
    if (hash(seed + 102) % 19 === 0) amt = Math.floor(amt * 0.4) // soft
    if (hash(seed + 103) % 29 === 0) amt = Math.floor(amt * 1.7) + randBetween(seed + 104, 30000, 90000)
    if (amt > 15000) {
      rows.push({
        description: 'TOAST POS SETTLEMENT NAPLES',
        category: 'Income',
        counterparty: 'Toast',
        amountCents: amt,
        createdAt: atTime(day, 5, 45 + (hash(seed) % 30)),
      })
    }
  }

  // Clover — different cadence, often next morning, independent noise
  if (hash(seed + 200) % 5 !== 0) {
    let base = 98000
    if (dow === 5 || dow === 6) base = 148000
    if (dow === 2 || dow === 3) base = 72000
    let amt = base + randBetween(seed + 201, -38000, 55000)
    if (hash(seed + 202) % 13 === 0) amt = Math.floor(amt * 0.35)
    if (hash(seed + 203) % 31 === 0) amt = Math.floor(amt * 1.9) + randBetween(seed + 204, 20000, 80000)
    if (amt > 12000) {
      rows.push({
        description: 'CLOVER DEPOSIT NAPLES FL',
        category: 'Income',
        counterparty: 'Clover',
        amountCents: amt,
        createdAt: atTime(day, 7, 10 + (hash(seed + 5) % 40)),
      })
    }
  }

  // Square — less frequent, event/catering oriented
  if (hash(seed + 300) % 4 === 0) {
    let amt = randBetween(seed + 301, 45000, 195000)
    if (hash(seed + 302) % 11 === 0) amt = Math.floor(amt * 2.1)
    rows.push({
      description: 'SQUARE INC PAYOUT',
      category: 'Income',
      counterparty: 'Square',
      amountCents: amt,
      createdAt: atTime(day, 8, 20),
    })
  }

  // Stripe catering — sparse, event-driven
  if (hash(seed + 400) % 9 === 0) {
    rows.push({
      description: 'STRIPE PAYOUT CATERING',
      category: 'Income',
      counterparty: 'Stripe',
      amountCents: randBetween(seed + 401, 35000, 220000),
      createdAt: atTime(day, 9, 5),
    })
  }

  // Corporate wire — rare
  if (hash(seed + 500) % 27 === 0) {
    rows.push({
      description: 'WIRE FROM CORPORATE CLIENT',
      category: 'Income',
      counterparty: 'Corporate Client',
      amountCents: randBetween(seed + 501, 85000, 420000),
      createdAt: atTime(day, 11, 0),
    })
  }

  // Catering deposit — occasional
  if (hash(seed + 600) % 12 === 0) {
    rows.push({
      description: 'CATERING DEPOSIT FIFTH AVE',
      category: 'Income',
      counterparty: 'Catering Client',
      amountCents: randBetween(seed + 601, 28000, 165000),
      createdAt: atTime(day, 12, 30),
    })
  }

  // Vendor rebate — rare
  if (hash(seed + 700) % 22 === 0) {
    rows.push({
      description: 'ACH CREDIT VENDOR REBATE',
      category: 'Income',
      counterparty: 'Vendor Rebate',
      amountCents: randBetween(seed + 701, 6500, 38000),
      createdAt: atTime(day, 14, 0),
    })
  }

  // Zelle / mobile check — sparse
  if (hash(seed + 800) % 16 === 0) {
    rows.push({
      description: 'Zelle banquet client Naples',
      category: 'Income',
      counterparty: 'Banquet Client',
      amountCents: randBetween(seed + 801, 12000, 72000),
      createdAt: atTime(day, 15, 40),
    })
  }
  if (hash(seed + 900) % 25 === 0) {
    rows.push({
      description: 'MOBILE CHECK DEPOSIT',
      category: 'Income',
      counterparty: 'Mobile Deposit',
      amountCents: randBetween(seed + 901, 18000, 98000),
      createdAt: atTime(day, 10, 15),
    })
  }
}

function buildJimmyRealisticHistory(): TxRow[] {
  const rows: TxRow[] = []
  const now = new Date()
  now.setHours(12, 0, 0, 0)

  for (let dayOffset = 364; dayOffset >= 0; dayOffset--) {
    const day = new Date(now)
    day.setDate(day.getDate() - dayOffset)
    const dow = day.getDay()
    const seed = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate()
    const isWeekend = dow === 0 || dow === 6
    const isFriday = dow === 5

    // Independent POS streams
    pushPosForDay(rows, day, seed, dow)

    // Food cost — weekdays, irregular count and which vendors
    if (!isWeekend) {
      const deliveries = hash(seed + 11) % 4 // 0–3 (sometimes no delivery)
      const used = new Set<number>()
      for (let d = 0; d < deliveries; d++) {
        let idx = (seed + d * 17 + hash(seed + d)) % FOOD_VENDORS.length
        if (used.has(idx)) idx = (idx + 3) % FOOD_VENDORS.length
        used.add(idx)
        const [desc, cat, min, max] = FOOD_VENDORS[idx]
        rows.push({
          description: desc,
          category: cat,
          counterparty: desc,
          amountCents: -randBetween(seed + 12 + d * 3, min, max),
          createdAt: atTime(day, 7 + d, 20 + d * 12),
        })
      }
    }

    // Weekly vendors — sometimes skip a week
    if (dow === 2 && hash(seed + 30) % 6 !== 0) {
      rows.push({
        description: 'NAPLES LINEN SERVICE',
        category: 'Operations',
        counterparty: 'Naples Linen',
        amountCents: -(WEEKLY_LINEN + randBetween(seed + 31, -2500, 3500)),
        createdAt: atTime(day, 10, 5),
      })
    }
    if (dow === 3 && hash(seed + 32) % 7 !== 0) {
      rows.push({
        description: 'CINTAS UNIFORM SERVICE',
        category: 'Operations',
        counterparty: 'Cintas',
        amountCents: -(WEEKLY_CINTAS + randBetween(seed + 33, -1800, 2200)),
        createdAt: atTime(day, 10, 40),
      })
      if (hash(seed + 34) % 3 !== 0) {
        rows.push({
          description: 'ECOLAB PEST CONTROL',
          category: 'Operations',
          counterparty: 'Ecolab',
          amountCents: -(WEEKLY_ECOLAB + randBetween(seed + 35, -1200, 1800)),
          createdAt: atTime(day, 11, 15),
        })
      }
    }
    if (dow === 4 && hash(seed + 36) % 5 !== 0) {
      rows.push({
        description: 'WASTE MANAGEMENT COMM',
        category: 'Operations',
        counterparty: 'Waste Management',
        amountCents: -(WEEKLY_WASTE + randBetween(seed + 37, -1500, 2000)),
        createdAt: atTime(day, 9, 10),
      })
    }

    // Payroll — ADP only, bi-weekly Fridays, small variance
    if (isFriday) {
      const weekNum = Math.floor(dayOffset / 7)
      if (weekNum % 2 === 0) {
        rows.push({
          description: 'ADP PAYROLL SERVICE',
          category: 'Payroll',
          counterparty: 'ADP',
          amountCents: -(PAYROLL_BASE + randBetween(seed + 40, -95000, 125000)),
          createdAt: atTime(day, 6, 5),
        })
      }
    }

    // Client meals — rare
    if (!isWeekend && hash(seed + 50) % 16 === 0) {
      const meal = CLIENT_MEALS[hash(seed + 51) % CLIENT_MEALS.length]
      const [desc, cat, min, max] = meal
      rows.push({
        description: desc,
        category: cat,
        counterparty: desc,
        amountCents: -randBetween(seed + 52, min, max),
        createdAt: atTime(day, 19, 20 + (hash(seed) % 40)),
      })
    }

    // Ops vendors — irregular
    if (hash(seed + 60) % 18 === 0) {
      const op = OPS_VENDORS[hash(seed + 61) % OPS_VENDORS.length]
      const [desc, cat, min, max] = op
      rows.push({
        description: desc,
        category: cat,
        counterparty: desc,
        amountCents: -randBetween(seed + 62, min, max),
        createdAt: atTime(day, 13, 30),
      })
    }
  }

  // Monthly fixed + small escrow variance on mortgage
  for (const createdAt of monthlyFixedDates()) {
    const mSeed = createdAt.getFullYear() * 100 + createdAt.getMonth()
    const escrowAdj = randBetween(mSeed + 1, -8500, 12000) // ±$85–$120 escrow noise
    rows.push({
      description: 'WELLS FARGO HOME MORTGAGE',
      category: 'Housing',
      counterparty: 'Wells Fargo Home Mortgage',
      amountCents: -(MONTHLY_MORTGAGE_BASE + escrowAdj),
      createdAt,
    })
    rows.push({
      description: 'STATE FARM INSURANCE',
      category: 'Insurance',
      counterparty: 'State Farm',
      amountCents: -MONTHLY_STATE_FARM,
      createdAt: new Date(createdAt.getTime() + 2 * 3600_000),
    })
    rows.push({
      description: 'PROGRESSIVE INSURANCE',
      category: 'Insurance',
      counterparty: 'Progressive',
      amountCents: -MONTHLY_PROGRESSIVE,
      createdAt: new Date(createdAt.getTime() + 4 * 3600_000),
    })
    rows.push({
      description: 'FPL COMMERCIAL ELECTRIC',
      category: 'Bills',
      counterparty: 'FPL',
      amountCents: -(3_200_00 + randBetween(mSeed + 2, -45000, 85000)),
      createdAt: new Date(createdAt.getTime() + 6 * 3600_000),
    })
    rows.push({
      description: 'COMCAST BUSINESS NAPLES',
      category: 'Bills',
      counterparty: 'Comcast',
      amountCents: -MONTHLY_COMCAST,
      createdAt: new Date(createdAt.getTime() + 8 * 3600_000),
    })
    rows.push({
      description: 'TOAST TAB SUBSCRIPTION',
      category: 'Software',
      counterparty: 'Toast',
      amountCents: -MONTHLY_TOAST_SUB,
      createdAt: new Date(createdAt.getTime() + 10 * 3600_000),
    })
  }

  // Tax — quarterly only
  const now2 = new Date()
  for (let q = 0; q < 4; q++) {
    const d = new Date(now2.getFullYear(), q * 3 + 1, 15, 11, 0, 0, 0)
    if (d.getTime() > now2.getTime()) d.setFullYear(d.getFullYear() - 1)
    rows.push({
      description: 'FL DEPT OF REVENUE TAX',
      category: 'Taxes',
      counterparty: 'FL Dept of Revenue',
      amountCents: -randBetween(q * 1000 + 50, 32000, 98000),
      createdAt: d,
    })
    if (q === 0 || q === 2) {
      rows.push({
        description: 'IRS EFTPS QUARTERLY',
        category: 'Taxes',
        counterparty: 'IRS',
        amountCents: -randBetween(q * 1000 + 51, 55000, 165000),
        createdAt: new Date(d.getTime() + 86400_000),
      })
    }
  }

  return rows
}

function buildFillRows(count: number, offset = 0, catalog: CatalogRow[] = PERSONAL_MERCHANTS) {
  const rows: TxRow[] = []
  for (let i = 0; i < count; i++) {
    const idx = (i + offset) % catalog.length
    const [description, category, min, max, credit] = catalog[idx]
    const span = Math.max(1, max - min)
    const raw = min + ((i + offset) * 97) % span
    const d = new Date()
    d.setDate(d.getDate() - ((i + offset) % 365))
    d.setHours(8 + (i % 10), (i * 7) % 60, 0, 0)
    rows.push({
      description,
      category,
      counterparty: description,
      amountCents: credit ? raw : -raw,
      createdAt: d,
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

async function jimmyNeedsRebuild(userId: string, checkingId: number) {
  const marker = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        eq(transaction.description, REALISM_MARKER)
      )
    )
    .limit(1)
  // No V2 marker → force full rebuild
  return !marker[0]
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

async function fixJimmyTransferDescriptions(userId: string) {
  await db
    .update(transaction)
    .set({ description: 'Transfer from Traditional IRA', counterparty: 'Business Checking' })
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.amountCents, 40_533_196),
        like(transaction.description, 'Transfer from Business Checking%')
      )
    )
  await db
    .update(transaction)
    .set({ description: 'Transfer from High-Yield Savings', counterparty: 'Business Checking' })
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.amountCents, 32_570_011),
        like(transaction.description, 'Transfer from Business Checking%')
      )
    )
  await db
    .update(transaction)
    .set({ description: 'Transfer from High-Yield Savings', counterparty: 'Business Checking' })
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.amountCents, 120_000),
        like(transaction.description, 'Transfer from Business Checking%')
      )
    )
}

async function ensureJimmyOpeningBalance(userId: string, checkingId: number) {
  const sumRows = await db
    .select({ total: sql<number>`coalesce(sum(${transaction.amountCents}), 0)::bigint` })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        sql`${transaction.description} <> ${OPENING_BALANCE_DESC}`,
        sql`${transaction.description} <> ${REALISM_MARKER}`
      )
    )
  const currentSum = Number(sumRows[0]?.total ?? 0)
  const needed = JIMMY_CHECKING_CENTS - currentSum

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
        .set({ amountCents: needed, type: needed >= 0 ? 'credit' : 'debit' })
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
    .set({ balanceCents: JIMMY_CHECKING_CENTS })
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
}

export async function applyJimmyChecking(userId: string, checkingId: number) {
  await db
    .update(bankAccount)
    .set({ name: 'Business Checking', balanceCents: JIMMY_CHECKING_CENTS })
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
}

export async function ensureTenThousandHistory(
  userId: string,
  checkingId: number,
  opts?: { restaurants?: boolean }
) {
  await stripInternalMarkers(userId)

  if (opts?.restaurants) {
    if (await jimmyNeedsRebuild(userId, checkingId)) {
      // Full wipe + realism v2 history
      await db
        .delete(transaction)
        .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))

      const history = buildJimmyRealisticHistory()
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

      await db.insert(transaction).values({
        userId,
        accountId: checkingId,
        amountCents: 0,
        type: 'credit',
        description: REALISM_MARKER,
        category: 'System',
        counterparty: 'Apex Bank',
        createdAt: new Date(),
      })
    }

    await fixJimmyTransferDescriptions(userId)
    await ensureJimmyOpeningBalance(userId, checkingId)
  } else {
    const visible = await countYearRows(userId, checkingId)
    const needed = Math.max(0, TARGET_TX_COUNT - visible)
    if (needed > 0) {
      const history = buildFillRows(Math.min(needed, 2400), visible, PERSONAL_MERCHANTS)
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
    }
  }

  const count = await countYearRows(userId, checkingId)
  return { count, target: TARGET_TX_COUNT, done: true }
}

async function seedMember(member: { id: string; name: string | null; email: string | null }) {
  const accounts = await db.select().from(bankAccount).where(eq(bankAccount.userId, member.id))
  const jimmy = isJimmyMember(member.name, member.email)

  let checking = accounts.find((a) => a.type === 'checking')
  if (!checking) {
    const [created] = await db
      .insert(bankAccount)
      .values({
        userId: member.id,
        name: jimmy ? 'Business Checking' : 'Everyday Checking',
        type: 'checking',
        accountNumber: String(4_100_000_000 + (Date.now() % 8_000_000_000)),
        balanceCents: jimmy ? JIMMY_CHECKING_CENTS : 0,
      })
      .returning()
    checking = created
  }

  if (jimmy) await applyJimmyChecking(member.id, checking.id)

  const result = await ensureTenThousandHistory(member.id, checking.id, { restaurants: jimmy })
  return { email: member.email, count: result.count, done: result.done }
}

export async function seedLargeHistoryForUser(
  userId: string,
  name?: string | null,
  email?: string | null
) {
  if (!shouldSeedLargeHistory(name, email)) return null
  return seedMember({ id: userId, name: name ?? null, email: email ?? null })
}

export async function seedLargeHistoryForNamedMembers() {
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
  const results: Array<{ email: string | null; count: number; done: boolean }> = []
  for (const member of members) {
    if (!shouldSeedLargeHistory(member.name, member.email)) continue
    results.push(await seedMember(member))
  }
  return results
}
