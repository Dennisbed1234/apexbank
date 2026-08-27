'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { ADMIN_EMAIL, SHARED_CHECKING_NUMBER } from '@/lib/bank-constants'
import { ensureRetirementAccount } from '@/lib/ensure-retirement'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export type TransferResult = { ok: true } | { ok: false; error: string }

function randomSavingsNumber() {
  let n = ''
  do {
    n = String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999))
  } while (n === SHARED_CHECKING_NUMBER)
  return n
}

export async function adminSendToUser(input: {
  targetUserId: string
  amountDollars: number
  note?: string
}): Promise<TransferResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Unauthorized' }
  if (String(session.user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return { ok: false, error: 'Admin access required' }
  }

  const { targetUserId, amountDollars, note } = input
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, error: 'Enter a valid amount greater than zero.' }
  }
  if (targetUserId === session.user.id) {
    return { ok: false, error: 'Choose a member account, not your own.' }
  }

  const amountCents = Math.round(amountDollars * 100)
  const stamped = new Date()

  const adminAccounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, session.user.id))
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

  await ensureRetirementAccount({ userId: targetUserId })

  const targetUser = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1)
  const targetLabel =
    targetUser[0]?.name || targetUser[0]?.email || 'Member account'

  const description = note?.trim() || `Transfer to ${targetLabel}`

  const currentAdmin = Number(adminChecking.balanceCents || 0)
  await db
    .update(bankAccount)
    .set({ balanceCents: currentAdmin - amountCents })
    .where(
      and(eq(bankAccount.id, adminChecking.id), eq(bankAccount.userId, session.user.id))
    )

  await db.insert(transaction).values({
    userId: session.user.id,
    accountId: adminChecking.id,
    amountCents: -amountCents,
    type: 'transfer',
    description,
    category: 'Transfer',
    counterparty: targetLabel,
    createdAt: stamped,
  })

  const currentMember = Number(targetChecking.balanceCents || 0)
  await db
    .update(bankAccount)
    .set({ balanceCents: currentMember + amountCents })
    .where(
      and(eq(bankAccount.id, targetChecking.id), eq(bankAccount.userId, targetUserId))
    )

  await db.insert(transaction).values({
    userId: targetUserId,
    accountId: targetChecking.id,
    amountCents,
    type: 'credit',
    description: note?.trim() || 'Deposit from Apex Bank / DaddyG Enterprise',
    category: 'Deposit',
    counterparty: 'DaddyG Enterprise',
    createdAt: stamped,
  })

  revalidatePath('/dashboard', 'layout')
  revalidatePath('/ops', 'layout')
  return { ok: true }
}
