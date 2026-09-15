import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
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

function pick(list: string[], seed: number) {
  return list[Math.abs(seed) % list.length]
}

export async function generateDailyActivityForUser(input: {
  userId: string
  name?: string | null
  email?: string | null
}) {
  const accounts = await db.select().from(bankAccount).where(eq(bankAccount.userId, input.userId))
  const checking = accounts.find((a) => a.type === 'checking')
  if (!checking) return { added: 0 }

  const latest = await db
    .select({ createdAt: transaction.createdAt })
    .from(transaction)
    .where(and(eq(transaction.userId, input.userId), eq(transaction.accountId, checking.id)))
    .orderBy(desc(transaction.createdAt))
    .limit(1)

  const last = latest[0]?.createdAt ? new Date(latest[0].createdAt) : null
  const now = new Date()
  if (last && now.getTime() - last.getTime() < 18 * 60 * 60 * 1000) {
    return { added: 0 }
  }

  const jimmy = isJimmyMember(input.name, input.email)
  const catalog = jimmy ? BUSINESS : PERSONAL
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
  const debitName = pick(catalog, seed + checking.id)
  const debitCents = jimmy ? -(2800 + (seed % 18000)) : -(450 + (seed % 4200))

  await db.insert(transaction).values({
    userId: input.userId,
    accountId: checking.id,
    amountCents: debitCents,
    type: 'debit',
    description: debitName,
    category: jimmy ? 'Operations' : 'Shopping',
    counterparty: debitName,
    createdAt: now,
  })

  await db
    .update(bankAccount)
    .set({ balanceCents: checking.balanceCents + debitCents })
    .where(and(eq(bankAccount.id, checking.id), eq(bankAccount.userId, input.userId)))

  return { added: 1 }
}

export async function generateDailyActivityForNamedMembers() {
  const members = await db.select({ id: user.id, name: user.name, email: user.email }).from(user)
  const results = []
  for (const member of members) {
    if (
      !isDennisBedendender(member.name, member.email) &&
      !isAnaMontoya(member.name, member.email) &&
      !isJimmyMember(member.name, member.email)
    ) {
      continue
    }
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
