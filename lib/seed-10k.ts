import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { DEMO_MEMBER_EMAIL, DEMO_MEMBER_NAME } from '@/lib/bank-constants'
import { isAnaMontoya } from '@/lib/seed-ana'
import { and, eq, gt, gte, like, or, sql } from 'drizzle-orm'

export const TARGET_TX_COUNT = 10_000
export const JIMMY_CHECKING_CENTS = 177_430_126 // $1,774,301.26
const MAX_INSERTS_PER_RUN = 2_400
const OPENING_BALANCE_DESC = 'Opening balance'

type CatalogRow = [string, string, number, number, boolean]

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

/**
 * Realistic operating activity for a Naples hospitality / catering LLC
 * holding ~$1.7M. Larger individual amounts, strong food-cost & payroll
 * weight, limited client-entertainment dining.
 */
const BUSINESS_MERCHANTS: CatalogRow[] = [
  // ——— Income (daily / weekly settlements & deposits) ———
  ['TOAST POS SETTLEMENT NAPLES', 'Income', 85000, 320000, true],
  ['CLOVER DEPOSIT NAPLES FL', 'Income', 62000, 245000, true],
  ['SQUARE INC PAYOUT', 'Income', 48000, 190000, true],
  ['STRIPE PAYOUT CATERING', 'Income', 35000, 165000, true],
  ['CATERING DEPOSIT FIFTH AVE', 'Income', 28000, 145000, true],
  ['ACH CREDIT EVENT DEPOSIT', 'Income', 45000, 220000, true],
  ['WIRE FROM CORPORATE CLIENT', 'Income', 95000, 480000, true],
  ['MOBILE CHECK DEPOSIT', 'Income', 22000, 125000, true],
  ['Zelle banquet client Naples', 'Income', 15000, 85000, true],
  ['ACH CREDIT VENDOR REBATE', 'Income', 8500, 42000, true],

  // ——— Food & beverage cost (largest expense category) ———
  ['SYSCO FOODS NAPLES', 'Supplies', 45000, 185000, false],
  ['US FOODS DISTRIBUTION', 'Supplies', 52000, 210000, false],
  ['PFG PERFORMANCE FOOD', 'Supplies', 38000, 165000, false],
  ['CHENEY BROTHERS INC', 'Supplies', 28000, 125000, false],
  ['RESTAURANT DEPOT NAPLES', 'Supplies', 18000, 85000, false],
  ['SEAFOOD ATLANTIC INC', 'Supplies', 22000, 98000, false],
  ['PRODUCE ALLIANCE FL', 'Supplies', 9500, 42000, false],
  ['BREAKTHRU BEVERAGE FL', 'Supplies', 12000, 55000, false],
  ['SOUTHERN GLAZERS WINE', 'Supplies', 15000, 68000, false],

  // ——— Occupancy & major fixed costs ———
  ['COMMERCIAL RENT FIFTH AVE', 'Housing', 195000, 265000, false],
  ['FPL COMMERCIAL ELECTRIC', 'Bills', 18000, 52000, false],
  ['COMCAST BUSINESS NAPLES', 'Bills', 6500, 14500, false],
  ['WATER SEWER NAPLES UTIL', 'Utilities', 3500, 12000, false],
  ['GAS DELIVERY COMMERCIAL', 'Utilities', 4200, 15000, false],
  ['WASTE MANAGEMENT COMM', 'Operations', 3800, 9800, false],

  // ——— Payroll & labor ———
  ['ADP PAYROLL SERVICE', 'Payroll', 85000, 285000, false],
  ['GUSTO PAYROLL NAPLES', 'Payroll', 72000, 245000, false],
  ['WORKER COMP INSURANCE', 'Insurance', 18500, 52000, false],

  // ——— Insurance, tax, compliance ———
  ['GENERAL LIABILITY INS', 'Insurance', 12000, 38000, false],
  ['PROPERTY INSURANCE FL', 'Insurance', 16500, 48000, false],
  ['FL DEPT OF REVENUE TAX', 'Taxes', 28000, 125000, false],
  ['IRS EFTPS QUARTERLY', 'Taxes', 45000, 185000, false],

  // ——— Equipment, software, ops ———
  ['EQUIPMENT LEASE KITCHEN', 'Equipment', 8500, 22000, false],
  ['POS TERMINAL LEASE', 'Equipment', 3200, 8500, false],
  ['SQUARE HARDWARE LEASE', 'Equipment', 4500, 12000, false],
  ['TOAST TAB SUBSCRIPTION', 'Software', 2800, 6500, false],
  ['QUICKBOOKS ONLINE', 'Software', 1650, 4500, false],
  ['NAPLES LINEN SERVICE', 'Operations', 4800, 14500, false],
  ['CINTAS UNIFORM SERVICE', 'Operations', 3500, 9800, false],
  ['ECOLAB PEST CONTROL', 'Operations', 2800, 6500, false],
  ['GRAINGER INDUSTRIAL', 'Operations', 4500, 22000, false],
  ['ULINE SHIPPING SUPPLY', 'Operations', 2800, 12500, false],
  ['NAPLES FIRE PROTECTION', 'Operations', 4500, 12000, false],

  // ——— Occasional client entertainment (small minority) ———
  ['CAMPIELLO RISTORANTE NAPLES', 'Dining', 8500, 28000, false],
  ['THE BAY HOUSE NAPLES FL', 'Dining', 9500, 32000, false],
  ['BLEU PROVENCE NAPLES FL', 'Dining', 12000, 42000, false],
  ['DORONA STEAK NAPLES FL', 'Dining', 11000, 38000, false],
]

/** Very light client-entertainment mix so fine dining never dominates */
const CLIENT_ENTERTAINMENT: CatalogRow[] = [
  ['THE LOCAL NAPLES FL', 'Dining', 4200, 14500, false],
  ['USS NEMO NAPLES FL', 'Dining', 8500, 28000, false],
  ['BARBATELLA 5TH AVE NAPLES', 'Dining', 6500, 22000, false],
  ['VERGINA RISTORANTE NAPLES', 'Dining', 7200, 25000, false],
]

// Heavy weight on real operating merchants; dining is a small tail
const JIMMY_BUSINESS_CATALOG: CatalogRow[] = [
  ...BUSINESS_MERCHANTS,
  ...BUSINESS_MERCHANTS,
  ...BUSINESS_MERCHANTS,
  ...CLIENT_ENTERTAINMENT,
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
  '%STRIPE%',
  '%SQUARE INC%',
  '%ADP %',
  '%GRAINGER%',
  '%ULINE%',
  '%GUSTO PAYROLL%',
  '%QUICKBOOKS%',
  '%COMMERCIAL RENT%',
  '%WALMART%',
  '%COSTCO%',
]

/** Any description containing these is treated as personal / too retail and rewritten */
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
  'TOOJAYS',
  'COLUMBIA RESTAURANT',
  "JOE'S STONE CRAB",
  'IN-N-OUT',
  'SHAKE SHACK',
]

function dateInLastYear(index: number, total: number) {
  const spanMs = 365 * 24 * 60 * 60 * 1000
  const offset = Math.floor((index / Math.max(1, total)) * spanMs)
  const d = new Date(Date.now() - offset)
  d.setHours(6 + (index % 14), (index * 11) % 60, index % 60, 0)
  return d
}

function openingBalanceDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
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

function buildFillRows(
  count: number,
  offset = 0,
  catalog: CatalogRow[] = PERSONAL_MERCHANTS
) {
  const rows: Array<{
    description: string
    category: string
    counterparty: string
    amountCents: number
    createdAt: Date
  }> = []

  for (let i = 0; i < count; i++) {
    const idx = (i + offset) % catalog.length
    const [description, category, min, max, credit] = catalog[idx]
    const span = Math.max(1, max - min)
    // Slight jitter so same-day near-duplicates are rare
    const jitter = ((i * 13) % 17) - 8
    const raw = Math.max(min, min + ((i + offset) * 97 + jitter) % span)
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

async function jimmyNeedsRestaurantRebuild(userId: string, checkingId: number) {
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
  if (!credit[0]) return true

  const naples = await db
    .select({ description: transaction.description })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        like(transaction.description, '%NAPLES%')
      )
    )
    .limit(1)
  return !naples[0]
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

/** One-time fix: rewrite the three reversed transfer credit descriptions */
async function fixJimmyTransferDescriptions(userId: string) {
  await db
    .update(transaction)
    .set({
      description: 'Transfer from Traditional IRA',
      counterparty: 'Business Checking',
    })
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.amountCents, 40_533_196),
        like(transaction.description, 'Transfer from Business Checking%')
      )
    )

  await db
    .update(transaction)
    .set({
      description: 'Transfer from High-Yield Savings',
      counterparty: 'Business Checking',
    })
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.amountCents, 32_570_011),
        like(transaction.description, 'Transfer from Business Checking%')
      )
    )

  await db
    .update(transaction)
    .set({
      description: 'Transfer from High-Yield Savings',
      counterparty: 'Business Checking',
    })
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.amountCents, 120_000),
        like(transaction.description, 'Transfer from Business Checking%')
      )
    )
}

/** Rewrite the majority of personal / fine-dining rows to real business merchants */
async function rewriteJimmyToBusinessStyle(userId: string, checkingId: number) {
  const rows = await db
    .select({
      id: transaction.id,
      description: transaction.description,
    })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        sql`${transaction.description} <> ${OPENING_BALANCE_DESC}`,
        sql`${transaction.type} <> 'transfer'`
      )
    )

  const toRewrite = rows.filter((r) =>
    PERSONAL_PATTERNS.some((p) =>
      String(r.description || '')
        .toUpperCase()
        .includes(p.toUpperCase())
    )
  )

  // Rewrite ~75% of the personal/dining-looking rows
  const targetCount = Math.floor(toRewrite.length * 0.75)
  if (targetCount === 0) return

  const pool = BUSINESS_MERCHANTS.filter((m) => !m[4]) // expenses
  const selected = toRewrite.slice(0, targetCount)

  for (let i = 0; i < selected.length; i++) {
    const [desc, category] = pool[i % pool.length]
    await db
      .update(transaction)
      .set({
        description: desc,
        category,
        counterparty: desc,
      })
      .where(eq(transaction.id, selected[i].id))
  }
}

/** Opening balance = target − sum of every other transaction */
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
    .set({ balanceCents: JIMMY_CHECKING_CENTS })
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
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

export async function ensureTenThousandHistory(
  userId: string,
  checkingId: number,
  opts?: { restaurants?: boolean }
) {
  await stripInternalMarkers(userId)

  if (opts?.restaurants && (await jimmyNeedsRestaurantRebuild(userId, checkingId))) {
    await db
      .delete(transaction)
      .where(
        and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId))
      )
  }

  const visible = await countYearRows(userId, checkingId)
  const needed = Math.max(0, TARGET_TX_COUNT - visible)

  if (needed > 0) {
    const catalog = opts?.restaurants ? JIMMY_BUSINESS_CATALOG : PERSONAL_MERCHANTS
    const insertCount = Math.min(needed, MAX_INSERTS_PER_RUN)
    const history = buildFillRows(insertCount, visible, catalog)
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

  if (opts?.restaurants) {
    await fixJimmyTransferDescriptions(userId)
    await rewriteJimmyToBusinessStyle(userId, checkingId)
    await ensureJimmyOpeningBalance(userId, checkingId)
  }

  const count = await countYearRows(userId, checkingId)
  return { count, target: TARGET_TX_COUNT, done: count >= TARGET_TX_COUNT }
}

async function seedMember(member: { id: string; name: string | null; email: string | null }) {
  const accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, member.id))

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

  if (jimmy) {
    await applyJimmyChecking(member.id, checking.id)
  }

  const result = await ensureTenThousandHistory(member.id, checking.id, {
    restaurants: jimmy,
  })
  return {
    email: member.email,
    count: result.count,
    done: result.done,
  }
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
