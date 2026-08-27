'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bankAccount, transaction } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export type DepositResult = { ok: true } | { ok: false; error: string }

export async function depositMobileCheck(input: {
  toAccountId: number
  amountDollars: number
  hasFront: boolean
  hasBack: boolean
}): Promise<DepositResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Unauthorized' }

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

  await db
    .update(bankAccount)
    .set({ balanceCents: Number(account.balanceCents) + amountCents })
    .where(and(eq(bankAccount.id, account.id), eq(bankAccount.userId, session.user.id)))

  await db.insert(transaction).values({
    userId: session.user.id,
    accountId: account.id,
    amountCents,
    type: 'credit',
    description: 'Mobile check deposit',
    category: 'Mobile deposit',
    counterparty: 'Check',
  })

  revalidatePath('/dashboard')
  return { ok: true }
}
