'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { bankAccount, outboundPayment, transaction } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export type DepositResult = { ok: true; status: string } | { ok: false; error: string }

export async function depositMobileCheck(input: {
  toAccountId: number
  amountDollars: number
  hasFront: boolean
  hasBack: boolean
}): Promise<DepositResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Unauthorized' }
  await ensureUserProfileColumns()

  if (!input.hasFront || !input.hasBack) {
    return { ok: false, error: 'Photograph both the front and the back of the check.' }
  }
  if (!Number.isFinite(input.amountDollars) || input.amountDollars <= 0) {
    return { ok: false, error: 'Enter the exact amount written on the check.' }
  }
  if (input.amountDollars > 5000) {
    return { ok: false, error: 'Mobile deposit limit is $5,000 per check.' }
  }

  const amountCents = Math.round(input.amountDollars * 100)
  const rows = await db
    .select()
    .from(bankAccount)
    .where(
      and(
        eq(bankAccount.id, input.toAccountId),
        eq(bankAccount.userId, session.user.id)
      )
    )
    .limit(1)
  const account = rows[0]
  if (!account) return { ok: false, error: 'Choose an Apex account to deposit into.' }
  if (account.type === 'retirement') {
    return { ok: false, error: 'Mobile deposits go to checking or savings only.' }
  }

  await db.insert(outboundPayment).values({
    userId: session.user.id,
    fromAccountId: account.id,
    method: 'check',
    amountCents,
    status: 'pending',
    scheduledFor: new Date(),
    recipientName: session.user.name || 'Member',
    memo: 'Mobile check deposit',
  })

  await db.insert(transaction).values({
    userId: session.user.id,
    accountId: account.id,
    amountCents,
    type: 'pending',
    description: 'Mobile check deposit (processing)',
    category: 'Check deposit',
    counterparty: 'Check',
  })

  revalidatePath('/dashboard')
  revalidatePath('/ops')
  return { ok: true, status: 'pending' }
}
