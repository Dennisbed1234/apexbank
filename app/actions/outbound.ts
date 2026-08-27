'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import {
  bankAccount,
  outboundPayment,
  transaction,
  user,
} from '@/lib/db/schema'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { and, desc, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export type OutboundResult = { ok: true; status: string } | { ok: false; error: string }

export type PendingPaymentRow = {
  id: number
  userId: string
  memberName: string
  memberEmail: string
  method: string
  amountCents: number
  status: string
  recipientName: string
  recipientBank: string | null
  zelleHandle: string | null
  memo: string | null
  createdAt: string
}

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

async function requireAdmin() {
  const sessionUser = await getSessionUser()
  const email = String(sessionUser.email || '').trim().toLowerCase()
  if (email !== ADMIN_EMAIL) throw new Error('Admin access required')
  return sessionUser
}

function dollarsToCents(amountDollars: number) {
  return Math.round(amountDollars * 100)
}

function validRouting(value: string) {
  return /^\d{9}$/.test(value.replace(/\s/g, ''))
}

function validZelleHandle(value: string) {
  const v = value.trim()
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  const phone = /^\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(v)
  return email || phone
}

function paymentLabel(method: string, name: string, memo?: string | null) {
  if (method === 'zelle') return memo ? `Zelle to ${name} — ${memo}` : `Zelle to ${name}`
  if (method === 'check') return 'Mobile check deposit'
  return memo ? `Wire to ${name} — ${memo}` : `Wire to ${name}`
}

export async function sendZelle(input: {
  fromAccountId: number
  amountDollars: number
  recipientName: string
  zelleHandle: string
  memo?: string
}): Promise<OutboundResult> {
  const sessionUser = await getSessionUser()
  await ensureUserProfileColumns()

  const handle = input.zelleHandle.trim()
  const name = input.recipientName.trim()
  if (!name) return { ok: false, error: 'Enter the recipient name.' }
  if (!validZelleHandle(handle)) {
    return { ok: false, error: 'Enter a valid Zelle email or US mobile number.' }
  }
  if (!Number.isFinite(input.amountDollars) || input.amountDollars <= 0) {
    return { ok: false, error: 'Enter a valid amount greater than zero.' }
  }

  const amountCents = dollarsToCents(input.amountDollars)
  const source = await db
    .select()
    .from(bankAccount)
    .where(
      and(
        eq(bankAccount.id, input.fromAccountId),
        eq(bankAccount.userId, sessionUser.id)
      )
    )
    .limit(1)
  if (!source[0]) return { ok: false, error: 'Account not found.' }
  if (Number(source[0].balanceCents) < amountCents) {
    return { ok: false, error: 'Insufficient funds in the source account.' }
  }

  const memo = input.memo?.trim()
  const description = paymentLabel('zelle', name, memo)

  await db.insert(outboundPayment).values({
    userId: sessionUser.id,
    fromAccountId: input.fromAccountId,
    method: 'zelle',
    amountCents,
    status: 'pending',
    scheduledFor: new Date(),
    recipientName: name,
    zelleHandle: handle,
    memo: memo || null,
  })

  await db.insert(transaction).values({
    userId: sessionUser.id,
    accountId: input.fromAccountId,
    amountCents: -amountCents,
    type: 'pending',
    description,
    category: 'Zelle',
    counterparty: `${name} (${handle})`,
  })

  revalidatePath('/dashboard')
  revalidatePath('/ops')
  return { ok: true, status: 'pending' }
}

export async function scheduleWire(input: {
  fromAccountId: number
  amountDollars: number
  recipientName: string
  recipientBank: string
  routingNumber: string
  accountNumber: string
  sendOn?: string
  memo?: string
}): Promise<OutboundResult> {
  const sessionUser = await getSessionUser()
  await ensureUserProfileColumns()

  const name = input.recipientName.trim()
  const bank = input.recipientBank.trim()
  const routing = input.routingNumber.replace(/\s/g, '')
  const acct = input.accountNumber.replace(/\s/g, '')
  const memo = input.memo?.trim()

  if (!name) return { ok: false, error: 'Enter the recipient name.' }
  if (!bank) return { ok: false, error: 'Enter the receiving bank name.' }
  if (!validRouting(routing)) {
    return { ok: false, error: 'Routing number must be 9 digits.' }
  }
  if (acct.length < 4 || acct.length > 17) {
    return { ok: false, error: 'Enter a valid account number.' }
  }
  if (!Number.isFinite(input.amountDollars) || input.amountDollars <= 0) {
    return { ok: false, error: 'Enter a valid amount greater than zero.' }
  }

  const amountCents = dollarsToCents(input.amountDollars)
  let scheduledFor = new Date()
  if (input.sendOn) {
    const parsed = new Date(`${input.sendOn}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'Choose a valid send date.' }
    }
    scheduledFor = parsed
  }

  const source = await db
    .select()
    .from(bankAccount)
    .where(
      and(
        eq(bankAccount.id, input.fromAccountId),
        eq(bankAccount.userId, sessionUser.id)
      )
    )
    .limit(1)
  if (!source[0]) return { ok: false, error: 'Account not found.' }
  if (Number(source[0].balanceCents) < amountCents) {
    return { ok: false, error: 'Insufficient funds to send this wire.' }
  }

  const last4 = acct.slice(-4)
  const description = memo
    ? `Wire to ${name} — ${memo}`
    : `Wire to ${name} / ${bank} ****${last4}`

  await db.insert(outboundPayment).values({
    userId: sessionUser.id,
    fromAccountId: input.fromAccountId,
    method: 'wire',
    amountCents,
    status: 'pending',
    scheduledFor,
    recipientName: name,
    recipientBank: bank,
    routingNumber: routing,
    accountNumber: acct,
    memo: memo || null,
  })

  await db.insert(transaction).values({
    userId: sessionUser.id,
    accountId: input.fromAccountId,
    amountCents: -amountCents,
    type: 'pending',
    description,
    category: 'Wire',
    counterparty: `${name} · ${bank}`,
  })

  revalidatePath('/dashboard')
  revalidatePath('/ops')
  return { ok: true, status: 'pending' }
}

export async function processDueWires() {
  return
}

export async function listOutboundPayments() {
  const sessionUser = await getSessionUser()
  await ensureUserProfileColumns()
  return db
    .select()
    .from(outboundPayment)
    .where(eq(outboundPayment.userId, sessionUser.id))
    .orderBy(desc(outboundPayment.createdAt))
    .limit(25)
}

export async function listPendingPaymentsForAdmin(): Promise<PendingPaymentRow[]> {
  await requireAdmin()
  await ensureUserProfileColumns()

  const rows = await db
    .select({
      id: outboundPayment.id,
      userId: outboundPayment.userId,
      method: outboundPayment.method,
      amountCents: outboundPayment.amountCents,
      status: outboundPayment.status,
      recipientName: outboundPayment.recipientName,
      recipientBank: outboundPayment.recipientBank,
      zelleHandle: outboundPayment.zelleHandle,
      memo: outboundPayment.memo,
      createdAt: outboundPayment.createdAt,
      memberName: user.name,
      memberEmail: user.email,
    })
    .from(outboundPayment)
    .leftJoin(user, eq(outboundPayment.userId, user.id))
    .orderBy(desc(outboundPayment.createdAt))
    .limit(80)

  return rows
    .filter((r) => r.status === 'pending' || r.status === 'scheduled')
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      memberName: r.memberName || 'Member',
      memberEmail: r.memberEmail || '',
      method: r.method,
      amountCents: Number(r.amountCents),
      status: r.status,
      recipientName: r.recipientName,
      recipientBank: r.recipientBank,
      zelleHandle: r.zelleHandle,
      memo: r.memo,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }))
}

export async function reviewOutboundPayment(
  id: number,
  decision: 'approved' | 'rejected'
): Promise<OutboundResult> {
  await requireAdmin()
  const rows = await db
    .select()
    .from(outboundPayment)
    .where(eq(outboundPayment.id, id))
    .limit(1)
  const payment = rows[0]
  if (!payment) return { ok: false, error: 'Payment not found.' }
  if (payment.status !== 'pending' && payment.status !== 'scheduled') {
    return { ok: false, error: 'This item is already reviewed.' }
  }

  const amount = Number(payment.amountCents)
  const isCredit = payment.method === 'check'
  const signedAmount = isCredit ? amount : -amount

  const pendingMatches = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, payment.userId),
        eq(transaction.accountId, payment.fromAccountId),
        eq(transaction.type, 'pending'),
        eq(transaction.amountCents, signedAmount)
      )
    )
    .limit(5)

  if (decision === 'rejected') {
    for (const row of pendingMatches) {
      await db.delete(transaction).where(eq(transaction.id, row.id))
    }
    await db
      .update(outboundPayment)
      .set({ status: 'cancelled', processedAt: new Date() })
      .where(eq(outboundPayment.id, id))
    revalidatePath('/dashboard')
    revalidatePath('/ops')
    return { ok: true, status: 'cancelled' }
  }

  const accountRows = await db
    .select()
    .from(bankAccount)
    .where(
      and(
        eq(bankAccount.id, payment.fromAccountId),
        eq(bankAccount.userId, payment.userId)
      )
    )
    .limit(1)
  const account = accountRows[0]
  if (!account) return { ok: false, error: 'Member account not found.' }

  if (!isCredit && Number(account.balanceCents) < amount) {
    return { ok: false, error: 'Member no longer has enough funds.' }
  }

  const nextBalance = isCredit
    ? Number(account.balanceCents) + amount
    : Number(account.balanceCents) - amount

  await db
    .update(bankAccount)
    .set({ balanceCents: nextBalance })
    .where(and(eq(bankAccount.id, account.id), eq(bankAccount.userId, payment.userId)))

  const label = paymentLabel(payment.method, payment.recipientName, payment.memo)

  if (pendingMatches[0]) {
    await db
      .update(transaction)
      .set({
        type: isCredit ? 'credit' : 'debit',
        description: label,
        amountCents: signedAmount,
      })
      .where(eq(transaction.id, pendingMatches[0].id))
    for (const extra of pendingMatches.slice(1)) {
      await db.delete(transaction).where(eq(transaction.id, extra.id))
    }
  } else {
    await db.insert(transaction).values({
      userId: payment.userId,
      accountId: account.id,
      amountCents: signedAmount,
      type: isCredit ? 'credit' : 'debit',
      description: label,
      category:
        payment.method === 'zelle'
          ? 'Zelle'
          : payment.method === 'check'
            ? 'Check deposit'
            : 'Wire',
      counterparty: payment.recipientName,
    })
  }

  await db
    .update(outboundPayment)
    .set({ status: 'sent', processedAt: new Date() })
    .where(eq(outboundPayment.id, id))

  revalidatePath('/dashboard')
  revalidatePath('/ops')
  return { ok: true, status: 'sent' }
}

export async function cancelScheduledWire(id: number): Promise<OutboundResult> {
  const sessionUser = await getSessionUser()
  const rows = await db
    .select()
    .from(outboundPayment)
    .where(
      and(eq(outboundPayment.id, id), eq(outboundPayment.userId, sessionUser.id))
    )
    .limit(1)
  const payment = rows[0]
  if (!payment) return { ok: false, error: 'Payment not found.' }
  if (payment.status !== 'pending' && payment.status !== 'scheduled') {
    return { ok: false, error: 'Only pending items can be cancelled.' }
  }

  const signedAmount = payment.method === 'check' ? Number(payment.amountCents) : -Number(payment.amountCents)
  const pendingMatches = await db
    .select({ id: transaction.id })
    .from(transaction)
    .where(
      and(
        eq(transaction.userId, sessionUser.id),
        eq(transaction.accountId, payment.fromAccountId),
        eq(transaction.type, 'pending'),
        eq(transaction.amountCents, signedAmount)
      )
    )
    .limit(5)
  for (const row of pendingMatches) {
    await db.delete(transaction).where(eq(transaction.id, row.id))
  }

  await db
    .update(outboundPayment)
    .set({ status: 'cancelled', processedAt: new Date() })
    .where(and(eq(outboundPayment.id, id), eq(outboundPayment.userId, sessionUser.id)))

  revalidatePath('/dashboard')
  return { ok: true, status: 'cancelled' }
}
