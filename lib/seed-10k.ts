import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { DEMO_MEMBER_EMAIL, DEMO_MEMBER_NAME } from '@/lib/bank-constants'
import { isAnaMontoya } from '@/lib/seed-ana'
import { and, eq, gte, like, or, sql } from 'drizzle-orm'

export const TARGET_TX_COUNT = 10_000
export const JIMMY_CHECKING_CENTS = 386_107_752 // $3,861,077.52

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

const BUSINESS_MERCHANTS: CatalogRow[] = [
  ['ACH CREDIT STRIPE TRANSFER', 'Merchant deposits', 185000, 2_450_000, true],
  ['ACH CREDIT SQUARE INC', 'Merchant deposits', 92000, 1_180_000, true],
  ['ACH CREDIT PAYPAL *SALES', 'Merchant deposits', 64000, 860000, true],
  ['Incoming wire — ACME DISTRIBUTORS INV', 'Wire', 250000, 3_200_000, true],
  ['Incoming wire — NORTHSTAR WHOLESALE', 'Wire', 180000, 2_800_000, true],
  ['Client invoice payment — WIRE', 'Receivables', 125000, 1_650_000, true],
  ['ACH CREDIT CUSTOMER LOCKBOX', 'Receivables', 88000, 740000, true],
  ['Mobile check deposit — client remittance', 'Check deposit', 45000, 520000, true],
  ['ADP PAYROLL GARNISH / WAGES', 'Payroll', 420000, 980000, false],
  ['ADP TAX / FEDERAL 941', 'Payroll tax', 86000, 265000, false],
  ['GUSTO PAYROLL', 'Payroll', 310000, 720000, false],
  ['VENDOR ACH — OFFICE DEPOT BIZ', 'Vendors', 12000, 86000, false],
  ['VENDOR ACH — STAPLES ADVANTAGE', 'Vendors', 8500, 64000, false],
  ['VENDOR ACH — GRAINGER', 'Vendors', 18000, 145000, false],
  ['VENDOR ACH — ULINE SHIPPING', 'Vendors', 22000, 98000, false],
  ['BILL PAY — COMMERCIAL RENT LLC', 'Occupancy', 480000, 920000, false],
  ['BILL PAY — CINTAS FACILITY', 'Operations', 18000, 42000, false],
  ['BILL PAY — THE HARTFORD BIZ INS', 'Insurance', 42000, 128000, false],
  ['ACH DEBIT IRS USATAXPYMT', 'Taxes', 75000, 410000, false],
  ['ACH DEBIT STATE TREASURER SUTA', 'Taxes', 18000, 86000, false],
  ['FEDEX FREIGHT', 'Shipping', 6500, 48000, false],
  ['UPS FREIGHT', 'Shipping', 4200, 36000, false],
  ['AT&T BUSINESS', 'Utilities', 18000, 54000, false],
  ['COMCAST BUSINESS', 'Utilities', 14000, 38000, false],
  ['AWS *AMAZON WEB SERVICES', 'Software', 12000, 89000, false],
  ['QUICKBOOKS.INTUIT', 'Software', 4500, 18000, false],
  ['Outgoing wire — SUPPLIER SETTLEMENT', 'Wire', 95000, 1_200_000, false],
  ['Outgoing wire — EQUIPMENT LEASE', 'Wire', 64000, 380000, false],
  ['ACH DEBIT FLEET FUEL WEX', 'Fleet', 18000, 72000, false],
  ['ACH DEBIT ADP WORKFORCE NOW', 'Payroll', 8900, 24000, false],
]

const PERSONAL_MARKERS = [
  '%STARBUCKS%',
  '%NETFLIX%',
  '%CHIPOTLE%',
  '%PUBLIX%',
  '%WHOLEFDS%',
  '%SPOTIFY%',
  '%UBER TRIP%',
  '%HARBOR COURT%',
  '%Zelle from Sofia%',
  '%Zelle to Elena%',
]

function dateInLastYear(index: number, total: number) {
  const spanMs = 365 * 24 * 60 * 60 * 1000
  const offset = Math.floor((index / Math.max(1, total)) * spanMs)
  const d = new Date(Date.now() - offset)
  d.setHours(6 + (index % 14), (index * 11) % 60, index % 60, 0)
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
  return first === 'jimmy' || n.startsWith('jimmy ') || e.startsWith('jimmy')
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

async function jimmyLedgerLooksPersonal(userId: string, checkingId: number) {
  const rows = await db
    .select({ description: transaction.description })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.accountId, checkingId),
        or(...PERSONAL_MARKERS.map((p) => like(transaction.description, p)))
      )
    )
    .limit(1)
  return Boolean(rows[0])
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
  opts?: { business?: boolean }
) {
  await stripInternalMarkers(userId)

  if (opts?.business && (await jimmyLedgerLooksPersonal(userId, checkingId))) {
    await db
      .delete(transaction)
      .where(
        and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId))
      )
  }

  const visible = await countYearRows(userId, checkingId)
  const needed = Math.max(0, TARGET_TX_COUNT - visible)
  if (needed === 0) return { count: visible, target: TARGET_TX_COUNT, done: true }

  const catalog = opts?.business ? BUSINESS_MERCHANTS : PERSONAL_MERCHANTS
  const history = buildFillRows(needed, visible, catalog)
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

  const count = visible + needed
  return { count, target: TARGET_TX_COUNT, done: count >= TARGET_TX_COUNT }
}

export async function seedLargeHistoryForNamedMembers() {
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)

  const results: Array<{ email: string | null; count: number; done: boolean }> = []

  for (const member of members) {
    if (!shouldSeedLargeHistory(member.name, member.email)) continue

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
      business: jimmy,
    })
    results.push({
      email: member.email,
      count: result.count,
      done: result.done,
    })
  }

  return results
}
