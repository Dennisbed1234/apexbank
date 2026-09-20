'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { ADMIN_EMAIL, SHARED_CHECKING_NUMBER } from '@/lib/bank-constants'
import { ensureRetirementAccount } from '@/lib/ensure-retirement'
import { and, eq, sql } from 'drizzle-orm'
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
  /** Default checking. Pass 'retirement' to credit IRA. */
  targetType?: 'checking' | 'savings' | 'retirement'
}): Promise<TransferResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { ok: false, error: 'Unauthorized' }
  if (String(session.user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return { ok: false, error: 'Admin access required' }
  }

  const { targetUserId, amountDollars, note } = input
  const targetType = input.targetType || 'checking'

  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { ok: false, error: 'Enter a valid amount greater than zero.' }
  }
  if (targetUserId === session.user.id) {
    return { ok: false, error: 'Choose a member account, not your own.' }
  }

  const amountCents = Math.round(amountDollars * 100)
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: 'Amount is too large or invalid.' }
  }

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

  let target =
    targetAccounts.find((a) => a.type === targetType) ||
    (targetType === 'checking'
      ? targetAccounts.find((a) => a.type === 'checking')
      : null)

  if (!target && targetType === 'checking') {
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
    if (!targetAccounts.some((a) => a.type === 'savings')) {
      await db.insert(bankAccount).values({
        userId: targetUserId,
        name: 'High-Yield Savings',
        type: 'savings',
        accountNumber: randomSavingsNumber(),
        balanceCents: 0,
      })
    }
    target = created
  }

  if (!target && targetType === 'retirement') {
    target = await ensureRetirementAccount({ userId: targetUserId })
  }

  if (!target && targetType === 'savings') {
    const [created] = await db
      .insert(bankAccount)
      .values({
        userId: targetUserId,
        name: 'High-Yield Savings',
        type: 'savings',
        accountNumber: randomSavingsNumber(),
        balanceCents: 0,
      })
      .returning()
    target = created
  }

  if (!target) {
    return { ok: false, error: 'Target account not found.' }
  }

  const targetUser = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1)
  const targetLabel =
    targetUser[0]?.name || targetUser[0]?.email || 'Member account'

  const memberDescription =
    note?.trim() ||
    (targetType === 'retirement'
      ? 'WIRE IN DIRECT DEPOSIT IRA'
      : 'WIRE IN FROM NICOLET / DADDYG ENTERPRISE')

  const fundedFromBalance = Number(adminChecking.balanceCents || 0) >= amountCents

  if (fundedFromBalance) {
    await db
      .update(bankAccount)
      .set({ balanceCents: sql`${bankAccount.balanceCents} - ${amountCents}` })
      .where(
        and(
          eq(bankAccount.id, adminChecking.id),
          eq(bankAccount.userId, session.user.id)
        )
      )
    await db.insert(transaction).values({
      userId: session.user.id,
      accountId: adminChecking.id,
      amountCents: -amountCents,
      type: 'transfer',
      description: note?.trim() || `Wire to ${targetLabel}`,
      category: 'Wire',
      counterparty: targetLabel,
      createdAt: stamped,
    })
  } else {
    // System-funded: still record admin memo so ops history is complete
    await db.insert(transaction).values({
      userId: session.user.id,
      accountId: adminChecking.id,
      amountCents: 0,
      type: 'credit',
      description: `System-funded wire to ${targetLabel}`,
      category: 'Admin',
      counterparty: targetLabel,
      createdAt: stamped,
    })
  }

  // Member credit first as a real ledger row, then bump balance
  await db.insert(transaction).values({
    userId: targetUserId,
    accountId: target.id,
    amountCents,
    type: 'credit',
    description: memberDescription,
    category: 'Wire',
    counterparty: 'DaddyG Enterprise',
    createdAt: stamped,
  })

  await db
    .update(bankAccount)
    .set({ balanceCents: sql`${bankAccount.balanceCents} + ${amountCents}` })
    .where(
      and(eq(bankAccount.id, target.id), eq(bankAccount.userId, targetUserId))
    )

  revalidatePath('/dashboard', 'layout')
  revalidatePath('/ops', 'layout')
  return { ok: true }
}
