import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { DEMO_MEMBER_EMAIL, DEMO_MEMBER_NAME } from '@/lib/bank-constants'
import { isAnaMontoya } from '@/lib/seed-ana'
import { and, eq, gt, gte, like, or, sql } from 'drizzle-orm'

export const TARGET_TX_COUNT = 10_000
export const JIMMY_CHECKING_CENTS = 177_430_126 // $1,774,301.26
const MAX_INSERTS_PER_RUN = 2_400
const OPENING_BALANCE_DESC = 'Opening balance'

/** Fixed monthly amounts — identical every month */
const MONTHLY_MORTGAGE_CENTS = 8_450_00
const MONTHLY_STATE_FARM_CENTS = 1_285_00
const MONTHLY_PROGRESSIVE_CENTS = 642_00
const MONTHLY_FPL_CENTS = 3_420_00
const MONTHLY_COMCAST_CENTS = 289_00
const MONTHLY_TOAST_SUB_CENTS = 165_00

/** Weekly fixed amounts */
const WEEKLY_LINEN_CENTS = 485_00
const WEEKLY_CINTAS_CENTS = 312_00
const WEEKLY_ECOLAB_CENTS = 195_00
const WEEKLY_WASTE_CENTS = 210_00

/** Bi-weekly payroll (ADP only) */
const PAYROLL_CENTS = 18_750_00

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

const FOOD_VENDORS: CatalogRow[] = [
  ['SYSCO FOODS NAPLES', 'Supplies', 28000, 125000, false],
  ['US FOODS DISTRIBUTION', 'Supplies', 32000, 145000, false],
  ['PFG PERFORMANCE FOOD', 'Supplies', 22000, 98000, false],
  ['CHENEY BROTHERS INC', 'Supplies', 18000, 85000, false],
  ['RESTAURANT DEPOT NAPLES', 'Supplies', 9500, 48000, false],
  ['SEAFOOD ATLANTIC INC', 'Supplies', 12000, 62000, false],
  ['PRODUCE ALLIANCE FL', 'Supplies', 4500, 22000, false],
  ['BREAKTHRU BEVERAGE FL', 'Supplies', 6500, 32000, false],
  ['SOUTHERN GLAZERS WINE', 'Supplies', 8500, 42000, false],
]

const CLIENT_MEALS: CatalogRow[] = [
  ['CAMPIELLO RISTORANTE NAPLES', 'Dining', 8500, 28000, false],
  ['THE BAY HOUSE NAPLES FL', 'Dining', 9500, 32000, false],
  ['BLEU PROVENCE NAPLES FL', 'Dining', 12000, 42000, false],
  ['DORONA STEAK NAPLES FL', 'Dining', 11000, 38000, false],
  ['USS NEMO NAPLES FL', 'Dining', 8500, 28000, false],
  ['BARBATELLA 5TH AVE NAPLES', 'Dining', 6500, 22000, false],
]

const WIPE_MARKERS = [
  '%NETFLIX%',
  '%PUBLIX%',
  '%WHOLEFDS%',
  '%SPOTIFY%',
  '%UBER TRIP%',
  '%HARBOR COURT%',
  '%Zelle from Sofia%',
  '%Zelle to Elena%',
  '%WALMART%',
  '%COSTCO%',
  '%COMMERCIAL RENT%',
  '%GUSTO PAYROLL%',
]

const PERSONAL_PATTERNS = [
  'CHICK-FIL-A',
  "MCDONALD'S",
  'STARBUCKS',
  'DUNKIN',
  'CHIPOTLE',
  'TACO BELL',
  "WENDY'S",
  'POPEYES',
  'FIVE GUYS',
  'PANDA EXPRESS',
  "JERSEY MIKE'S",
  'FIREHOUSE SUBS',
  "CULVER'S",
  "RAISING CANE'S",
  "MOE'S SW",
  'SUBWAY',
  'WALMART',
  'COSTCO',
  'TARGET',
  'PUBLIX',
  'WHOLEFDS',
  'NETFLIX',
  'SPOTIFY',
  'UBER TRIP',
  'SHELL OIL',
  'EXXONMOBIL',
  'VERIZON WIRELESS',
  'APPLE.COM',
  'PANERA',
  'FIRST WATCH',
  'PINCHERS',
  'DOCKSIDE',
  'BHA BHA',
  'THE CONTINENTAL',
  'THE LOCAL',
  'COMMERCIAL RENT',
  'GENERAL LIABILITY INS',
  'PROPERTY INSURANCE',
  'WORKER COMP INSURANCE',
  'GUSTO PAYROLL',
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
  d.setHours(hour, minute, hash(base.getTime() + hour) % 60, 0)
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
    dates.push(new Date(now.getFullYear(), now.getMonth() - i, 1, 10, 15, 0, 0))
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
 * Realistic day-by-day history for a Naples hospitality LLC.
 * - Noisy POS (weekday/weekend, soft days, spikes)
 * - Single payroll (ADP bi-weekly)
 * - Weekly vendors once per week
 * - Monthly mortgage + insurance once per month
 * - Stable volume, no synthetic decay curve
 */
function buildJimmyRealisticHistory(): TxRow[] {
  const rows: TxRow[] = []
  const now = new Date()
  now.setHours(12, 0, 0, 0)

  // ~365 days back
  for (let dayOffset = 364; dayOffset >= 0; dayOffset--) {
    const day = new Date(now)
    day.setDate(day.getDate() - dayOffset)
    const dow = day.getDay() // 0 Sun … 6 Sat
    const seed = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate()

    // Skip pure Sundays for most ops (light POS only)
    const isWeekend = dow === 0 || dow === 6
    const isFriday = dow === 5

    // ——— POS / income (noisy, not monotonic) ———
    // Base by day of week; then ± noise; occasional soft day or spike
    let posBase = 145000 // ~$1,450
    if (dow === 5 || dow === 6) posBase = 210000 // Fri/Sat stronger
    if (dow === 1 || dow === 2) posBase = 98000 // Mon/Tue softer
    if (dow === 0) posBase = 72000 // Sunday light

    const noise = randBetween(seed + 1, -35000, 45000)
    const softDay = hash(seed + 2) % 17 === 0 // occasional soft day
    const spikeDay = hash(seed + 3) % 23 === 0 // occasional catering spike
    let posAmt = posBase + noise
    if (softDay) posAmt = Math.floor(posAmt * 0.45)
    if (spikeDay) posAmt = Math.floor(posAmt * 1.85) + randBetween(seed + 4, 40000, 120000)

    // Alternate Toast / Clover / Square so no single processor dominates every day
    const processor = seed % 3
    const posName =
      processor === 0
        ? 'TOAST POS SETTLEMENT NAPLES'
        : processor === 1
          ? 'CLOVER DEPOSIT NAPLES FL'
          : 'SQUARE INC PAYOUT'

    if (posAmt > 20000) {
      rows.push({
        description: posName,
        category: 'Income',
        counterparty: posName,
        amountCents: posAmt,
        createdAt: atTime(day, 6, 30),
      })
    }

    // Occasional catering / event / Zelle (not every day)
    if (hash(seed + 5) % 11 === 0) {
      rows.push({
        description: 'CATERING DEPOSIT FIFTH AVE',
        category: 'Income',
        counterparty: 'CATERING DEPOSIT FIFTH AVE',
        amountCents: randBetween(seed + 6, 28000, 145000),
        createdAt: atTime(day, 11, 0),
      })
    }
    if (hash(seed + 7) % 19 === 0) {
      rows.push({
        description: 'Zelle banquet client Naples',
        category: 'Income',
        counterparty: 'Zelle banquet client Naples',
        amountCents: randBetween(seed + 8, 12000, 68000),
        createdAt: atTime(day, 14, 20),
      })
    }
    if (hash(seed + 9) % 31 === 0) {
      rows.push({
        description: 'MOBILE CHECK DEPOSIT',
        category: 'Income',
        counterparty: 'MOBILE CHECK DEPOSIT',
        amountCents: randBetween(seed + 10, 18000, 95000),
        createdAt: atTime(day, 9, 45),
      })
    }

    // ——— Food cost: 2–4 deliveries on weekdays only ———
    if (!isWeekend) {
      const deliveries = 1 + (hash(seed + 11) % 3) // 1–3
      for (let d = 0; d < deliveries; d++) {
        const v = FOOD_VENDORS[(seed + d * 7) % FOOD_VENDORS.length]
        const [desc, cat, min, max] = v
        rows.push({
          description: desc,
          category: cat,
          counterparty: desc,
          amountCents: -randBetween(seed + 12 + d, min, max),
          createdAt: atTime(day, 8 + d, 15 + d * 10),
        })
      }
    }

    // ——— Weekly vendors (once per week on fixed weekday) ———
    if (dow === 2) {
      // Tuesday: linen
      rows.push({
        description: 'NAPLES LINEN SERVICE',
        category: 'Operations',
        counterparty: 'Naples Linen Service',
        amountCents: -WEEKLY_LINEN_CENTS,
        createdAt: atTime(day, 10, 0),
      })
    }
    if (dow === 3) {
      // Wednesday: uniforms + pest
      rows.push({
        description: 'CINTAS UNIFORM SERVICE',
        category: 'Operations',
        counterparty: 'Cintas',
        amountCents: -WEEKLY_CINTAS_CENTS,
        createdAt: atTime(day, 10, 30),
      })
      rows.push({
        description: 'ECOLAB PEST CONTROL',
        category: 'Operations',
        counterparty: 'Ecolab',
        amountCents: -WEEKLY_ECOLAB_CENTS,
        createdAt: atTime(day, 11, 0),
      })
    }
    if (dow === 4) {
      // Thursday: waste
      rows.push({
        description: 'WASTE MANAGEMENT COMM',
        category: 'Operations',
        counterparty: 'Waste Management',
        amountCents: -WEEKLY_WASTE_CENTS,
        createdAt: atTime(day, 9, 0),
      })
    }

    // ——— Payroll: ADP only, bi-weekly Fridays ———
    if (isFriday) {
      // Every other Friday
      const weekNum = Math.floor(dayOffset / 7)
      if (weekNum % 2 === 0) {
        rows.push({
          description: 'ADP PAYROLL SERVICE',
          category: 'Payroll',
          counterparty: 'ADP',
          amountCents: -PAYROLL_CENTS + randBetween(seed + 20, -80000, 120000),
          createdAt: atTime(day, 7, 0),
        })
      }
    }

    // ——— Occasional client meal (rare) ———
    if (!isWeekend && hash(seed + 21) % 14 === 0) {
      const meal = CLIENT_MEALS[hash(seed + 22) % CLIENT_MEALS.length]
      const [desc, cat, min, max] = meal
      rows.push({
        description: desc,
        category: cat,
        counterparty: desc,
        amountCents: -randBetween(seed + 23, min, max),
        createdAt: atTime(day, 19, 30),
      })
    }

    // ——— Occasional ops (Grainger, Uline, fire — monthly-ish) ———
    if (hash(seed + 24) % 28 === 0) {
      rows.push({
        description: 'GRAINGER INDUSTRIAL',
        category: 'Operations',
        counterparty: 'Grainger',
        amountCents: -randBetween(seed + 25, 4500, 22000),
        createdAt: atTime(day, 13, 0),
      })
    }
    if (hash(seed + 26) % 35 === 0) {
      rows.push({
        description: 'NAPLES FIRE PROTECTION',
        category: 'Operations',
        counterparty: 'Naples Fire Protection',
        amountCents: -randBetween(seed + 27, 4500, 12000),
        createdAt: atTime(day, 14, 0),
      })
    }
  }

  // ——— Monthly fixed costs (mortgage, insurance, utilities) ———
  for (const createdAt of monthlyFixedDates()) {
    rows.push({
      description: 'WELLS FARGO HOME MORTGAGE',
      category: 'Housing',
      counterparty: 'Wells Fargo Home Mortgage',
      amountCents: -MONTHLY_MORTGAGE_CENTS,
      createdAt,
    })
    rows.push({
      description: 'STATE FARM INSURANCE',
      category: 'Insurance',
      counterparty: 'State Farm',
      amountCents: -MONTHLY_STATE_FARM_CENTS,
      createdAt: new Date(createdAt.getTime() + 2 * 3600_000),
    })
    rows.push({
      description: 'PROGRESSIVE INSURANCE',
      category: 'Insurance',
      counterparty: 'Progressive',
      amountCents: -MONTHLY_PROGRESSIVE_CENTS,
      createdAt: new Date(createdAt.getTime() + 4 * 3600_000),
    })
    rows.push({
      description: 'FPL COMMERCIAL ELECTRIC',
      category: 'Bills',
      counterparty: 'FPL',
      amountCents: -MONTHLY_FPL_CENTS + randBetween(createdAt.getTime(), -40000, 50000),
      createdAt: new Date(createdAt.getTime() + 6 * 3600_000),
    })
    rows.push({
      description: 'COMCAST BUSINESS NAPLES',
      category: 'Bills',
      counterparty: 'Comcast',
      amountCents: -MONTHLY_COMCAST_CENTS,
      createdAt: new Date(createdAt.getTime() + 8 * 3600_000),
    })
    rows.push({
      description: 'TOAST TAB SUBSCRIPTION',
      category: 'Software',
      counterparty: 'Toast',
      amountCents: -MONTHLY_TOAST_SUB_CENTS,
      createdAt: new Date(createdAt.getTime() + 10 * 3600_000),
    })
  }

  // Quarterly tax (4 times in the year)
  for (let q = 0; q < 4; q++) {
    const d = new Date(now.getFullYear(), q * 3, 15, 11, 0, 0, 0)
    if (d.getTime() > now.getTime()) d.setFullYear(d.getFullYear() - 1)
    rows.push({
      description: 'FL DEPT OF REVENUE TAX',
      category: 'Taxes',
      counterparty: 'FL Dept of Revenue',
      amountCents: -randBetween(q * 1000 + 50, 28000, 95000),
      createdAt: d,
    })
    if (q % 2 === 1) {
      rows.push({
        description: 'IRS EFTPS QUARTERLY',
        category: 'Taxes',
        counterparty: 'IRS',
        amountCents: -randBetween(q * 1000 + 51, 45000, 145000),
        createdAt: new Date(d.getTime() + 86400_000),
      })
    }
  }

  return rows
}

function buildFillRows(
  count: number,
  offset = 0,
  catalog: CatalogRow[] = PERSONAL_MERCHANTS
) {
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
  const stale = await db
    .select({ description: transaction.description })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        or(...WIPE_MARKERS.map((p) => like(transaction.description, p)))
      )
    )
    .limit(1)
  if (stale[0]) return true

  const gusto = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        like(transaction.description, '%GUSTO%')
      )
    )
    .limit(1)
  if (gusto[0]) return true

  const credit = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        gt(transaction.amountCents, 0)
      )
    )
    .limit(1)
  return !credit[0]
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
        sql`${transaction.description} <> ${OPENING_BALANCE_DESC}`
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
    if (Number(existing[0].amountCents) === needed) return
    await db
      .update(transaction)
      .set({ amountCents: needed, type: needed >= 0 ? 'credit' : 'debit' })
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
    // Full realistic rebuild when needed
    if (await jimmyNeedsRebuild(userId, checkingId)) {
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
    }

    await fixJimmyTransferDescriptions(userId)
    await ensureJimmyOpeningBalance(userId, checkingId)
  } else {
    // Non-Jimmy large history (Dennis / Ana path uses other seeders)
    const visible = await countYearRows(userId, checkingId)
    const needed = Math.max(0, TARGET_TX_COUNT - visible)
    if (needed > 0) {
      const history = buildFillRows(Math.min(needed, MAX_INSERTS_PER_RUN), visible, PERSONAL_MERCHANTS)
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
  return { count, target: TARGET_TX_COUNT, done: count >= Math.min(TARGET_TX_COUNT, 2500) }
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
