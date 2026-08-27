'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { bankAccount, outboundPayment, transaction } from '@/lib/db/schema'
import { and, desc, eq, lte } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export type OutboundResult = { ok: true; status: string } | { ok: false; error: string }

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
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

async function debitIfPossible(
  userId: string,
  accountId: number,
  amountCents: number,
  description: string,
  counterparty: string,
  category: string
) {
  const rows = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.id, accountId), eq(bankAccount.userId, userId)))
    .limit(1)
  const account = rows[0]
  if (!account) return { ok: false as const, error: 'Account not found.' }
  if (Number(account.balanceCents) < amountCents) {
    return { ok: false as const, error: 'Insufficient funds in the source account.' }
  }

  await db
    .update(bankAccount)
    .set({ balanceCents: Number(account.balanceCents) - amountCents })
    .where(and(eq(bankAccount.id, account.id), eq(bankAccount.userId, userId)))

  await db.insert(transaction).values({
    userId,
    accountId: account.id,
    amountCents: -amountCents,
    type: 'debit',
    description,
    category,
    counterparty,
  })

  return { ok: true as const, account }
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
  const memo = input.memo?.trim()
  const description = memo
    ? `Zelle to ${name} — ${memo}`
    : `Zelle to ${name}`

  const debit = await debitIfPossible(
    sessionUser.id,
    input.fromAccountId,
    amountCents,
    description,
    `${name} (${handle})`,
    'Zelle'
  )
  if (!debit.ok) return debit

  await db.insert(outboundPayment).values({
    userId: sessionUser.id,
    fromAccountId: input.fromAccountId,
    method: 'zelle',
    amountCents,
    status: 'sent',
    scheduledFor: new Date(),
    recipientName: name,
    zelleHandle: handle,
    memo: memo || null,
    processedAt: new Date(),
  })

  revalidatePath('/dashboard')
  return { ok: true, status: 'sent' }
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
  const now = new Date()
  let scheduledFor = now
  if (input.sendOn) {
    const parsed = new Date(`${input.sendOn}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: 'Choose a valid send date.' }
    }
    scheduledFor = parsed
  }

  const sendNow = scheduledFor.getTime() <= now.getTime() + 60 * 60 * 1000
  const last4 = acct.slice(-4)
  const description = memo
    ? `Wire to ${name} — ${memo}`
    : `Wire to ${name} / ${bank} ****${last4}`

  if (sendNow) {
    const debit = await debitIfPossible(
      sessionUser.id,
      input.fromAccountId,
      amountCents,
      description,
      `${name} · ${bank}`,
      'Wire'
    )
    if (!debit.ok) return debit

    await db.insert(outboundPayment).values({
      userId: sessionUser.id,
      fromAccountId: input.fromAccountId,
      method: 'wire',
      amountCents,
      status: 'sent',
      scheduledFor,
      recipientName: name,
      recipientBank: bank,
      routingNumber: routing,
      accountNumber: acct,
      memo: memo || null,
      processedAt: new Date(),
    })

    revalidatePath('/dashboard')
    return { ok: true, status: 'sent' }
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
    return { ok: false, error: 'Insufficient funds to schedule this wire.' }
  }

  await db.insert(outboundPayment).values({
    userId: sessionUser.id,
    fromAccountId: input.fromAccountId,
    method: 'wire',
    amountCents,
    status: 'scheduled',
    scheduledFor,
    recipientName: name,
    recipientBank: bank,
    routingNumber: routing,
    accountNumber: acct,
    memo: memo || null,
  })

  revalidatePath('/dashboard')
  return { ok: true, status: 'scheduled' }
}

export async function processDueWires() {
  const sessionUser = await getSessionUser()
  await ensureUserProfileColumns()

  const due = await db
    .select()
    .from(outboundPayment)
    .where(
      and(
        eq(outboundPayment.userId, sessionUser.id),
        eq(outboundPayment.status, 'scheduled'),
        lte(outboundPayment.scheduledFor, new Date())
      )
    )

  for (const payment of due) {
    const last4 = (payment.accountNumber || '').slice(-4)
    const description = payment.memo
      ? `Wire to ${payment.recipientName} — ${payment.memo}`
      : `Wire to ${payment.recipientName} / ${payment.recipientBank || 'bank'} ****${last4}`

    const debit = await debitIfPossible(
      sessionUser.id,
      payment.fromAccountId,
      Number(payment.amountCents),
      description,
      `${payment.recipientName} · ${payment.recipientBank || 'Wire'}`,
      'Wire'
    )

    await db
      .update(outboundPayment)
      .set({
        status: debit.ok ? 'sent' : 'failed',
        processedAt: new Date(),
      })
      .where(
        and(
          eq(outboundPayment.id, payment.id),
          eq(outboundPayment.userId, sessionUser.id)
        )
      )
  }
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
  if (payment.status !== 'scheduled') {
    return { ok: false, error: 'Only scheduled wires can be cancelled.' }
  }

  await db
    .update(outboundPayment)
    .set({ status: 'cancelled', processedAt: new Date() })
    .where(and(eq(outboundPayment.id, id), eq(outboundPayment.userId, sessionUser.id)))

  revalidatePath('/dashboard')
  return { ok: true, status: 'cancelled' }
}
