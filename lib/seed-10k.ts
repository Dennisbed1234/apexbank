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

const NAPLES_RESTAURANTS: CatalogRow[] = [
  ['CHICK-FIL-A US 41 NAPLES FL', 'Dining', 890, 2850, false],
  ['MCDONALD\'S TAMIAMI TRL NAPLES', 'Dining', 620, 2140, false],
  ['STARBUCKS 5TH AVE S NAPLES', 'Dining', 480, 1680, false],
  ['DUNKIN #339184 NAPLES FL', 'Dining', 390, 1290, false],
  ['CHIPOTLE 2210 PINE RIDGE NAPLES', 'Dining', 1100, 3200, false],
  ['TACO BELL 9TH ST N NAPLES', 'Dining', 740, 2210, false],
  ['WENDY\'S AIRPORT PULLING NAPLES', 'Dining', 680, 1980, false],
  ['POPEYES LOUISIANA NAPLES FL', 'Dining', 910, 2460, false],
  ['FIVE GUYS PINE RIDGE NAPLES', 'Dining', 1250, 3100, false],
  ['PANDA EXPRESS COASTLAND NAPLES', 'Dining', 980, 2650, false],
  ['JERSEY MIKE\'S NAPLES FL', 'Dining', 1050, 2480, false],
  ['FIREHOUSE SUBS NAPLES FL', 'Dining', 990, 2390, false],
  ['CULVER\'S IMMOKALEE RD NAPLES', 'Dining', 1020, 2740, false],
  ['RAISING CANE\'S NAPLES FL', 'Dining', 1110, 2680, false],
  ['MOE\'S SW GRILL NAPLES FL', 'Dining', 1080, 2550, false],
  ['SUBWAY 9TH ST NAPLES FL', 'Dining', 720, 1890, false],
  ['PANERA BREAD MERCATO NAPLES', 'Dining', 1180, 3420, false],
  ['FIRST WATCH VANDERBILT NAPLES', 'Dining', 1650, 4800, false],
  ['THE LOCAL NAPLES FL', 'Dining', 2800, 9600, false],
  ['CAMPIELLO RISTORANTE NAPLES', 'Dining', 4200, 18500, false],
  ['BARBATELLA 5TH AVE NAPLES', 'Dining', 3600, 14200, false],
  ['THE CONTINENTAL NAPLES FL', 'Dining', 3900, 16800, false],
  ['USS NEMO NAPLES FL', 'Dining', 5400, 21000, false],
  ['THE BAY HOUSE NAPLES FL', 'Dining', 6200, 24800, false],
  ['PINCHERS CRAB SHACK NAPLES', 'Dining', 3100, 12800, false],
  ['DOCK AT CRAYTON COVE NAPLES', 'Dining', 3400, 15200, false],
  ['JANE\'S CAFE 3RD ST NAPLES', 'Dining', 1450, 4200, false],
  ['BHA BHA PERSIAN BISTRO NAPLES', 'Dining', 3800, 14600, false],
  ['DORONA STEAK NAPLES FL', 'Dining', 7200, 28600, false],
  ['BLEU PROVENCE NAPLES FL', 'Dining', 8900, 34000, false],
  ['VERGINA RISTORANTE NAPLES', 'Dining', 4100, 17600, false],
]

const TRAVEL_RESTAURANTS: CatalogRow[] = [
  ['MCDONALD\'S RSW AIRPORT FTMYERS', 'Dining', 790, 2400, false],
  ['STARBUCKS MIA AIRPORT MIAMI', 'Dining', 540, 1750, false],
  ['CHICK-FIL-A FORT MYERS FL', 'Dining', 910, 2700, false],
  ['TOOJAYS SARASOTA FL', 'Dining', 1800, 5400, false],
  ['COLUMBIA RESTAURANT TAMPA', 'Dining', 3600, 12800, false],
  ['JOE\'S STONE CRAB MIAMI BCH', 'Dining', 8900, 32000, false],
  ['IN-N-OUT BURGER ATL AIRPORT', 'Dining', 980, 2600, false],
  ['SHAKE SHACK NYC HERALD SQ', 'Dining', 1400, 3800, false],
]

const JIMMY_RESTAURANTS: CatalogRow[] = [
  ...NAPLES_RESTAURANTS,
  ...NAPLES_RESTAURANTS,
  ...NAPLES_RESTAURANTS,
  ...TRAVEL_RESTAURANTS,
]

const WIPE_MARKERS = [
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
  '%STRIPE%',
  '%SQUARE INC%',
  '%ADP %',
  '%GRAINGER%',
  '%ULINE%',
  '%GUSTO PAYROLL%',
  '%QUICKBOOKS%',
  '%COMMERCIAL RENT%',
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
  if (needed === 0) return { count: visible, target: TARGET_TX_COUNT, done: true }

  const catalog = opts?.restaurants ? JIMMY_RESTAURANTS : PERSONAL_MERCHANTS
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
      restaurants: jimmy,
    })
    results.push({
      email: member.email,
      count: result.count,
      done: result.done,
    })
  }

  return results
}
