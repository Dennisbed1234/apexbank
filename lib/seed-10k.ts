import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { DEMO_MEMBER_EMAIL, DEMO_MEMBER_NAME } from '@/lib/bank-constants'
import { isAnaMontoya } from '@/lib/seed-ana'
import { and, eq, gt, gte, like, or, sql, inArray } from 'drizzle-orm'

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

/** Core business income & expense merchants for a Naples hospitality / catering operation */
const BUSINESS_MERCHANTS: CatalogRow[] = [
  // Income / settlements
  ['TOAST POS SETTLEMENT NAPLES', 'Income', 42000, 168000, true],
  ['CLOVER DEPOSIT NAPLES FL', 'Income', 28000, 94000, true],
  ['SQUARE INC PAYOUT', 'Income', 18000, 76000, true],
  ['STRIPE PAYOUT CATERING', 'Income', 12000, 88000, true],
  ['CATERING DEPOSIT FIFTH AVE', 'Income', 15000, 88000, true],
  ['ACH CREDIT VENDOR REBATE', 'Income', 6500, 24000, true],
  ['Zelle banquet client Naples', 'Income', 8000, 45000, true],
  ['MOBILE CHECK DEPOSIT', 'Income', 12000, 76000, true],
  ['ACH CREDIT EVENT DEPOSIT', 'Income', 25000, 120000, true],
  ['WIRE FROM CORPORATE CLIENT', 'Income', 45000, 250000, true],

  // Food & beverage suppliers
  ['SYSCO FOODS NAPLES', 'Supplies', 18000, 95000, false],
  ['US FOODS DISTRIBUTION', 'Supplies', 22000, 110000, false],
  ['RESTAURANT DEPOT NAPLES', 'Supplies', 8500, 42000, false],
  ['CHENEY BROTHERS INC', 'Supplies', 12000, 68000, false],
  ['PFG PERFORMANCE FOOD', 'Supplies', 15000, 78000, false],
  ['PRODUCE ALLIANCE FL', 'Supplies', 4500, 22000, false],
  ['SEAFOOD ATLANTIC INC', 'Supplies', 6800, 35000, false],

  // Operations & overhead
  ['COMMERCIAL RENT FIFTH AVE', 'Housing', 185000, 245000, false],
  ['NAPLES LINEN SERVICE', 'Operations', 3200, 9800, false],
  ['COMCAST BUSINESS NAPLES', 'Bills', 4500, 12500, false],
  ['FPL COMMERCIAL ELECTRIC', 'Bills', 8900, 28000, false],
  ['WASTE MANAGEMENT COMM', 'Operations', 2100, 6500, false],
  ['ADP PAYROLL SERVICE', 'Payroll', 45000, 185000, false],
  ['GUSTO PAYROLL NAPLES', 'Payroll', 38000, 160000, false],
  ['QUICKBOOKS ONLINE', 'Software', 999, 2999, false],
  ['TOAST TAB SUBSCRIPTION', 'Software', 1650, 4500, false],
  ['SQUARE HARDWARE LEASE', 'Equipment', 4500, 12000, false],
  ['GRAINGER INDUSTRIAL', 'Operations', 2800, 18500, false],
  ['ULINE SHIPPING SUPPLY', 'Operations', 1900, 9800, false],
  ['OFFICE DEPOT BUSINESS', 'Operations', 1200, 6500, false],
  ['STAPLES BUSINESS ADV', 'Operations', 900, 4800, false],
  ['CINTAS UNIFORM SERVICE', 'Operations', 2400, 7200, false],
  ['ECOLAB PEST CONTROL', 'Operations', 1800, 4500, false],
  ['TERMINIX COMMERCIAL', 'Operations', 1600, 4200, false],
  ['NAPLES FIRE PROTECTION', 'Operations', 3500, 9800, false],
  ['FL DEPT OF REVENUE TAX', 'Taxes', 12000, 85000, false],
  ['IRS EFTPS QUARTERLY', 'Taxes', 25000, 120000, false],
  ['WORKER COMP INSURANCE', 'Insurance', 8500, 32000, false],
  ['GENERAL LIABILITY INS', 'Insurance', 6200, 28000, false],
  ['PROPERTY INSURANCE FL', 'Insurance', 9800, 35000, false],
  ['EQUIPMENT LEASE KITCHEN', 'Equipment', 4500, 15000, false],
  ['POS TERMINAL LEASE', 'Equipment', 2100, 6500, false],
  ['GAS DELIVERY COMMERCIAL', 'Utilities', 1800, 7200, false],
  ['WATER SEWER NAPLES UTIL', 'Utilities', 1200, 4800, false],

  // Client entertainment / business meals (minority)
  ['CAMPIELLO RISTORANTE NAPLES', 'Dining', 4200, 18500, false],
  ['THE BAY HOUSE NAPLES FL', 'Dining', 6200, 24800, false],
  ['BLEU PROVENCE NAPLES FL', 'Dining', 8900, 34000, false],
  ['DORONA STEAK NAPLES FL', 'Dining', 7200, 28600, false],
  ['USS NEMO NAPLES FL', 'Dining', 5400, 21000, false],
  ['BARBATELLA 5TH AVE NAPLES', 'Dining', 3600, 14200, false],
]

/** Keep a smaller set of local dining for client entertainment (~40% max) */
const CLIENT_ENTERTAINMENT: CatalogRow[] = [
  ['THE LOCAL NAPLES FL', 'Dining', 2800, 9600, false],
  ['THE CONTINENTAL NAPLES FL', 'Dining', 3900, 16800, false],
  ['PINCHERS CRAB SHACK NAPLES', 'Dining', 3100, 12800, false],
  ['DOCKSIDE CRAYTON COVE NAPLES', 'Dining', 3400, 15200, false],
  ['BHA BHA PERSIAN BISTRO NAPLES', 'Dining', 3800, 14600, false],
  ['VERGINA RISTORANTE NAPLES', 'Dining', 4100, 17600, false],
  ['FIRST WATCH VANDERBILT NAPLES', 'Dining', 1650, 4800, false],
  ['PANERA BREAD MERCATO NAPLES', 'Dining', 1180, 3420, false],
]

const JIMMY_BUSINESS_CATALOG: CatalogRow[] = [
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

/** Personal-looking names we will rewrite to business style */
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
  // +$405,331.96 on Traditional IRA
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

  // +$325,700.11 on High-Yield Savings
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

  // +$1,200.00 on High-Yield Savings
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

/** Rewrite ~60% of personal-looking merchants to business style (in place) */
async function rewriteJimmyToBusinessStyle(userId: string, checkingId: number) {
  const rows = await db
    .select({
      id: transaction.id,
      description: transaction.description,
      amountCents: transaction.amountCents,
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

  const personal = rows.filter((r) =>
    PERSONAL_PATTERNS.some((p) =>
      String(r.description || '')
        .toUpperCase()
        .includes(p.toUpperCase())
    )
  )

  // Target ~60% of the personal ones
  const targetCount = Math.floor(personal.length * 0.6)
  if (targetCount === 0) return

  const toRewrite = personal.slice(0, targetCount)
  const businessPool = BUSINESS_MERCHANTS.filter((m) => !m[4]) // expenses only for rewrites

  for (let i = 0; i < toRewrite.length; i++) {
    const row = toRewrite[i]
    const [desc, category] = businessPool[i % businessPool.length]
    await db
      .update(transaction)
      .set({
        description: desc,
        category,
        counterparty: desc,
      })
      .where(eq(transaction.id, row.id))
  }
}

/** Force sum(all txs on checking) + Opening balance = JIMMY_CHECKING_CENTS */
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
    // One-time data fixes for existing live data
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
