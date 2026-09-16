import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { and, eq, gte } from 'drizzle-orm'
import { isDennisBedendender, isJimmyMember } from '@/lib/seed-10k'
import { isAnaMontoya } from '@/lib/seed-ana'

const PERSONAL = [
  'PUBLIX SUPER MARKET', 'WALMART SUPERCENTER', 'TARGET', 'COSTCO WHSE',
  'SHELL OIL', 'CHEVRON', 'WAWA', 'CIRCLE K', 'STARBUCKS', 'DUNKIN',
  'CHIPOTLE', 'PANERA BREAD', 'CHICK-FIL-A', 'MCDONALDS', 'WENDYS',
  'AMAZON.COM', 'APPLE.COM/BILL', 'NETFLIX.COM', 'SPOTIFY USA',
  'CVS PHARMACY', 'WALGREENS', 'HOME DEPOT', 'LOWES', 'BEST BUY',
]

const BUSINESS = [
  'SYSCO FOODS NAPLES FL', 'US FOODS TAMPA FL', 'RESTAURANT DEPOT NAPLES',
  'GORDON FOOD SERVICE FL', 'CINTAS UNIFORM NAPLES', 'ECOLAB PEST CONTROL FL',
  'WASTE MANAGEMENT NAPLES', 'FPL COMMERCIAL NAPLES', 'COMCAST BUSINESS NAPLES',
  'TOAST INC NAPLES FL', 'CLOVER NETWORK NAPLES', 'FEDEX COMMERCIAL NAPLES',
  'AMAZON BUSINESS', 'GRAINGER INDUSTRIAL FL', 'ULINE SHIPPING SUPPLY',
]

const CARD = [
  'AMAZON.COM', 'TARGET', 'UBER TRIP', 'DELTA AIR LINES', 'STARBUCKS',
  'WHOLEFDS', 'APPLE.COM/BILL', 'NETFLIX.COM', 'SHELL OIL', 'CHICK-FIL-A',
]

function pick(list: string[], seed: number) {
  return list[Math.abs(seed) % list.length]
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
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
  let added = 0

  for (const account of accounts) {
    if (!['checking', 'credit', 'savings'].includes(account.type)) continue
    const existingToday = await db
      .select({ id: transaction.id })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, input.userId),
          eq(transaction.accountId, account.id),
          gte(transaction.createdAt, today)
        )
      )
      .limit(1)
    if (existingToday[0]) continue

    const seed =
      today.getFullYear() * 10000 +
      (today.getMonth() + 1) * 100 +
      today.getDate() +
      account.id
    const catalog = account.type === 'credit' ? CARD : jimmy ? BUSINESS : PERSONAL
    const debitName = pick(catalog, seed)
    const debitCents =
      account.type === 'savings'
        ? 18 + (seed % 40)
        : jimmy
          ? -(2800 + (seed % 18000))
          : -(450 + (seed % 4200))
    const now = new Date()

    await db.insert(transaction).values({
      userId: input.userId,
      accountId: account.id,
      amountCents: debitCents,
      type: debitCents >= 0 ? 'credit' : 'debit',
      description: account.type === 'savings' ? 'INTEREST CREDIT' : debitName,
      category: debitCents >= 0 ? 'Interest' : jimmy ? 'Operations' : 'Shopping',
      counterparty: debitName,
      createdAt: now,
    })
    await db
      .update(bankAccount)
      .set({ balanceCents: account.balanceCents + debitCents })
      .where(and(eq(bankAccount.id, account.id), eq(bankAccount.userId, input.userId)))
    added += 1
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
