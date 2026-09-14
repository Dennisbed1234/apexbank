'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import {
  ADMIN_EMAIL,
  DEMO_MEMBER_EMAIL,
  SHARED_CHECKING_NUMBER,
} from '@/lib/bank-constants'
import { applyTwoYearPersonalHistory } from '@/lib/seed-history'
import { ensureAdminLargeWires } from '@/lib/admin-wires'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

function isAdminEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL
}

function isDemoMemberEmail(email?: string | null) {
  return String(email || '').trim().toLowerCase() === DEMO_MEMBER_EMAIL
}

async function requireAdmin() {
  const sessionUser = await getSessionUser()
  if (!isAdminEmail(sessionUser.email)) {
    throw new Error('Admin access required')
  }
  return sessionUser
}

function randomSavingsNumber() {
  let n = ''
  do {
    n = String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999))
  } while (n === SHARED_CHECKING_NUMBER)
  return n
}

const ADMIN_MERCHANTS = [
  { description: 'Wire credit — client escrow', category: 'Income', counterparty: 'First Meridian LLC', amountCents: 1250000 },
  { description: 'ACH payroll batch', category: 'Income', counterparty: 'DaddyG Enterprise', amountCents: 875000 },
  { description: 'Office lease', category: 'Housing', counterparty: 'Harbor Commercial', amountCents: -420000 },
  { description: 'Cloud infrastructure', category: 'Software', counterparty: 'AWS', amountCents: -48250 },
  { description: 'Legal retainer', category: 'Professional', counterparty: 'Northbridge Law', amountCents: -150000 },
  { description: 'Vendor payment', category: 'Operations', counterparty: 'SupplyLink Co', amountCents: -67340 },
  { description: 'Client refund', category: 'Refund', counterparty: 'Westbrook Media', amountCents: -22000 },
  { description: 'Interest credit', category: 'Income', counterparty: 'Apex Bank', amountCents: 1840 },
  { description: 'Corporate card settlement', category: 'Operations', counterparty: 'Visa Settlement', amountCents: -91220 },
  { description: 'Tax payment', category: 'Taxes', counterparty: 'IRS EFTPS', amountCents: -350000 },
  { description: 'Insurance premium', category: 'Insurance', counterparty: 'Hartford Business', amountCents: -18900 },
  { description: 'Equipment purchase', category: 'Operations', counterparty: 'Dell Business', amountCents: -245600 },
  { description: 'Consulting invoice paid', category: 'Income', counterparty: 'Summit Partners', amountCents: 640000 },
  { description: 'Software subscription', category: 'Software', counterparty: 'Microsoft 365', amountCents: -9900 },
  { description: 'Wire to savings reserve', category: 'Transfer', counterparty: 'High-Yield Savings', amountCents: -500000 },
]

type RecurringRule = {
  description: string
  category: string
  counterparty: string
  amountCents: number
  intervalDays: number
}

const ADMIN_RECURRING: RecurringRule[] = [
  { description: 'Recurring — ACH payroll', category: 'Income', counterparty: 'DaddyG Enterprise', amountCents: 875000, intervalDays: 14 },
  { description: 'Recurring — office lease', category: 'Housing', counterparty: 'Harbor Commercial', amountCents: -420000, intervalDays: 30 },
  { description: 'Recurring — cloud infrastructure', category: 'Software', counterparty: 'AWS', amountCents: -48250, intervalDays: 30 },
  { description: 'Recurring — Microsoft 365', category: 'Software', counterparty: 'Microsoft 365', amountCents: -9900, intervalDays: 30 },
  { description: 'Recurring — interest credit', category: 'Income', counterparty: 'Apex Bank', amountCents: 1840, intervalDays: 30 },
  { description: 'Recurring — insurance premium', category: 'Insurance', counterparty: 'Hartford Business', amountCents: -18900, intervalDays: 30 },
]

function dateDaysAgo(days: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  d.setHours(12, 0, 0, 0)
  return d
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  return d
}

function buildAdminSixMonthHistory() {
  const rows: Array<{
    description: string
    category: string
    counterparty: string
    amountCents: number
    createdAt: Date
  }> = []

  for (let day = 1; day <= 180; day += 3) {
    const template = ADMIN_MERCHANTS[day % ADMIN_MERCHANTS.length]
    const jitter = ((day * 37) % 7) * 100
    const signed =
      template.amountCents > 0
        ? template.amountCents + jitter
        : template.amountCents - jitter
    rows.push({
      ...template,
      amountCents: signed,
      createdAt: dateDaysAgo(day),
    })
  }

  return rows
}

async function applyAdminHistory(userId: string, checkingId: number) {
  const existingTx = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))

  if (existingTx.length >= 40) return

  const history = buildAdminSixMonthHistory()
  let checkingBalance = 0

  for (const t of history) {
    checkingBalance += t.amountCents
    await db.insert(transaction).values({
      userId,
      accountId: checkingId,
      amountCents: t.amountCents,
      type: t.amountCents >= 0 ? 'credit' : 'debit',
      description: t.description,
      category: t.category,
      counterparty: t.counterparty,
      createdAt: t.createdAt,
    })
  }

  if (checkingBalance < 50_000) {
    const topUp = 250_000 - checkingBalance
    checkingBalance += topUp
    await db.insert(transaction).values({
      userId,
      accountId: checkingId,
      amountCents: topUp,
      type: 'credit',
      description: 'Opening operating balance',
      category: 'Income',
      counterparty: 'Apex Bank',
      createdAt: dateDaysAgo(175),
    })
  }

  await db
    .update(bankAccount)
    .set({ balanceCents: checkingBalance })
    .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
}

async function applyRecurringSeeds(
  userId: string,
  checkingId: number,
  rules: RecurringRule[]
) {
  const existing = await db
    .select({
      description: transaction.description,
      createdAt: transaction.createdAt,
    })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), eq(transaction.accountId, checkingId)))
    .orderBy(desc(transaction.createdAt))

  const lastByDescription = new Map<string, Date>()
  for (const row of existing) {
    if (!lastByDescription.has(row.description)) {
      lastByDescription.set(row.description, new Date(row.createdAt))
    }
  }

  const today = startOfDay(new Date())
  let addedCents = 0
  let inserted = 0

  for (const rule of rules) {
    const last = lastByDescription.get(rule.description)
    let next = last ? addDays(last, rule.intervalDays) : dateDaysAgo(rule.intervalDays)

    while (next.getTime() <= today.getTime() && inserted < 80) {
      await db.insert(transaction).values({
        userId,
        accountId: checkingId,
        amountCents: rule.amountCents,
        type: rule.amountCents >= 0 ? 'credit' : 'debit',
        description: rule.description,
        category: rule.category,
        counterparty: rule.counterparty,
        createdAt: next,
      })
      addedCents += rule.amountCents
      inserted += 1
      lastByDescription.set(rule.description, next)
      next = addDays(next, rule.intervalDays)
    }
  }

  if (addedCents !== 0) {
    await db
      .update(bankAccount)
      .set({
        balanceCents: sql`${bankAccount.balanceCents} + ${addedCents}`,
      })
      .where(and(eq(bankAccount.id, checkingId), eq(bankAccount.userId, userId)))
  }
}

export async function ensureSeeded() {
  const sessionUser = await getSessionUser()
  const userId = sessionUser.id
  const isAdmin = isAdminEmail(sessionUser.email)
  const isDemo = isDemoMemberEmail(sessionUser.email)

  let accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, userId))
    .orderBy(bankAccount.id)

  if (accounts.length === 0) {
    const [checking] = await db
      .insert(bankAccount)
      .values({
        userId,
        name: isAdmin ? 'Business Checking' : 'Everyday Checking',
        type: 'checking',
        accountNumber: SHARED_CHECKING_NUMBER,
        balanceCents: 0,
      })
      .returning()

    await db.insert(bankAccount).values({
      userId,
      name: isAdmin ? 'Operating Reserve' : 'High-Yield Savings',
      type: 'savings',
      accountNumber: randomSavingsNumber(),
      balanceCents: isAdmin ? 5_500_000 : isDemo ? 155000 : 0,
    })

    if (isAdmin) {
      await applyAdminHistory(userId, checking.id)
    }
    if (isDemo) {
      await applyTwoYearPersonalHistory(userId, checking.id)
    }

    accounts = await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId))
      .orderBy(bankAccount.id)
  }

  const checking = accounts.find((a) => a.type === 'checking') ?? accounts[0]
  const savings = accounts.find((a) => a.type === 'savings')

  await db
    .update(bankAccount)
    .set({
      accountNumber: SHARED_CHECKING_NUMBER,
      name: isAdmin ? 'Business Checking' : checking.name,
    })
    .where(and(eq(bankAccount.id, checking.id), eq(bankAccount.userId, userId)))

  if (savings && savings.accountNumber === SHARED_CHECKING_NUMBER) {
    await db
      .update(bankAccount)
      .set({ accountNumber: randomSavingsNumber() })
      .where(and(eq(bankAccount.id, savings.id), eq(bankAccount.userId, userId)))
  }

  if (isAdmin) {
    await applyAdminHistory(userId, checking.id)
    await applyRecurringSeeds(userId, checking.id, ADMIN_RECURRING)
    await ensureAdminLargeWires(userId, checking.id)
  }

  if (isDemo) {
    await applyTwoYearPersonalHistory(userId, checking.id)
  }
}

export async function getAccounts() {
  const sessionUser = await getSessionUser()
  return db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, sessionUser.id))
    .orderBy(bankAccount.id)
}

export async function getTransactions(limit = 100) {
  const sessionUser = await getSessionUser()
  return db
    .select()
    .from(transaction)
    .where(eq(transaction.userId, sessionUser.id))
    .orderBy(desc(transaction.createdAt), desc(transaction.id))
    .limit(limit)
}

export type TransferResult = { ok: true } | { ok: false; error: string }

export async function transferFunds(input: {
  fromAccountId: number
  toAccountId: number
  amountDollars: number
  note?: string
}): Promise<TransferResult> {
  const sessionUser = await getSessionUser()
  const userId = sessionUser.id

  const { fromAccountId, toAccountId, amountDollars, note } = input

  if (fromAccountId === toAccountId) {
    return { ok: false, error: 'Choose two different accounts.' }
  }
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, error: 'Enter a valid amount greater than zero.' }
  }

  const amountCents = Math.round(amountDollars * 100)

  const accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, userId))

  const from = accounts.find((a) => a.id === fromAccountId)
  const to = accounts.find((a) => a.id === toAccountId)

  if (!from || !to) {
    return { ok: false, error: 'Account not found.' }
  }
  if (from.balanceCents < amountCents) {
    return { ok: false, error: 'Insufficient funds in the source account.' }
  }

  // Debit side (source account): standard "Transfer to [destination]"
  const debitDescription = note?.trim() ? note.trim() : `Transfer to ${to.name}`

  await db
    .update(bankAccount)
    .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amountCents}` })
    .where(and(eq(bankAccount.id, from.id), eq(bankAccount.userId, userId)))

  await db
    .update(bankAccount)
    .set({ balanceCents: sql`${bankAccount.balanceCents} + ${amountCents}` })
    .where(and(eq(bankAccount.id, to.id), eq(bankAccount.userId, userId)))

  await db.insert(transaction).values({
    userId,
    accountId: from.id,
    amountCents: -amountCents,
    type: 'transfer',
    description: debitDescription,
    category: 'Transfer',
    counterparty: to.name,
  })

  // Credit side (destination account): "Transfer from [destination]"
  // as requested so IRA credits read "Transfer from Traditional IRA"
  // and Savings credits read "Transfer from High-Yield Savings"
  await db.insert(transaction).values({
    userId,
    accountId: to.id,
    amountCents: amountCents,
    type: 'transfer',
    description: `Transfer from ${to.name}`,
    category: 'Transfer',
    counterparty: from.name,
  })

  revalidatePath('/dashboard')
  return { ok: true }
}

export type MemberAccountRow = {
  userId: string
  name: string
  email: string
  phone: string | null
  checkingId: number | null
  checkingNumber: string | null
  checkingBalanceCents: number
  savingsId: number | null
  savingsNumber: string | null
  savingsBalanceCents: number
  createdAt: Date
}

export async function listMemberAccounts(): Promise<MemberAccountRow[]> {
  await requireAdmin()

  const members = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(ne(user.email, ADMIN_EMAIL))
    .orderBy(desc(user.createdAt))

  const rows: MemberAccountRow[] = []

  for (const member of members) {
    const accounts = await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, member.id))

    const checking = accounts.find((a) => a.type === 'checking')
    const savings = accounts.find((a) => a.type === 'savings')

    rows.push({
      userId: member.id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      checkingId: checking?.id ?? null,
      checkingNumber: checking?.accountNumber ?? null,
      checkingBalanceCents: checking?.balanceCents ?? 0,
      savingsId: savings?.id ?? null,
      savingsNumber: savings?.accountNumber ?? null,
      savingsBalanceCents: savings?.balanceCents ?? 0,
      createdAt: member.createdAt,
    })
  }

  return rows
}

export async function adminSendToUser(input: {
  targetUserId: string
  amountDollars: number
  note?: string
}): Promise<TransferResult> {
  const admin = await requireAdmin()
  const { targetUserId, amountDollars, note } = input

  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, error: 'Enter a valid amount greater than zero.' }
  }
  if (targetUserId === admin.id) {
    return { ok: false, error: 'Choose a member account, not your own.' }
  }

  const amountCents = Math.round(amountDollars * 100)

  const adminAccounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, admin.id))
  const adminChecking =
    adminAccounts.find((a) => a.type === 'checking') ?? adminAccounts[0]

  if (!adminChecking) {
    return { ok: false, error: 'Admin checking account not found.' }
  }

  let targetAccounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, targetUserId))

  let targetChecking = targetAccounts.find((a) => a.type === 'checking')

  if (!targetChecking) {
    const [created] = await db
      .insert(bankAccount)
      .values({
        userId: targetUserId,
        name: 'Everyday Checking',
        type: 'checking',
        accountNumber: SHARED_CHECKING_NUMBER,
        balanceCents: 0,
      })
      .returning()
    await db.insert(bankAccount).values({
      userId: targetUserId,
      name: 'High-Yield Savings',
      type: 'savings',
      accountNumber: randomSavingsNumber(),
      balanceCents: 0,
    })
    targetChecking = created
  }

  const targetUser = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1)

  const targetLabel =
    targetUser[0]?.name || targetUser[0]?.email || 'Member account'

  const fundedFromBalance = adminChecking.balanceCents >= amountCents
  const description =
    note?.trim() ||
    (fundedFromBalance
      ? `Transfer to ${targetLabel}`
      : `Admin credit to ${targetLabel}`)

  if (fundedFromBalance) {
    await db
      .update(bankAccount)
      .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amountCents}` })
      .where(
        and(
          eq(bankAccount.id, adminChecking.id),
          eq(bankAccount.userId, admin.id)
        )
      )

    await db.insert(transaction).values({
      userId: admin.id,
      accountId: adminChecking.id,
      amountCents: -amountCents,
      type: 'transfer',
      description,
      category: 'Transfer',
      counterparty: targetLabel,
    })
  } else {
    await db.insert(transaction).values({
      userId: admin.id,
      accountId: adminChecking.id,
      amountCents: 0,
      type: 'credit',
      description: `System-funded credit issued to ${targetLabel}`,
      category: 'Admin',
      counterparty: targetLabel,
    })
  }

  await db
    .update(bankAccount)
    .set({ balanceCents: sql`${bankAccount.balanceCents} + ${amountCents}` })
    .where(
      and(
        eq(bankAccount.id, targetChecking.id),
        eq(bankAccount.userId, targetUserId)
      )
    )

  await db.insert(transaction).values({
    userId: targetUserId,
    accountId: targetChecking.id,
    amountCents,
    type: 'credit',
    description: note?.trim() || 'Deposit from Apex Bank / DaddyG Enterprise',
    category: 'Deposit',
    counterparty: 'DaddyG Enterprise',
  })

  revalidatePath('/dashboard')
  revalidatePath('/ops')
  return { ok: true }
}
