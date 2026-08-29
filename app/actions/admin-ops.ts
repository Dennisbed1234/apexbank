'use server'

import { auth } from '@/lib/auth'
import { db, pool } from '@/lib/db'
import { ensureUserProfileColumns, ensureKycTable } from '@/lib/db/ensure-columns'
import { bankAccount, kycSubmission, user } from '@/lib/db/schema'
import {
  ADMIN_EMAIL,
  DEMO_MEMBER_EMAIL,
  SHARED_CHECKING_NUMBER,
} from '@/lib/bank-constants'
import { applyTwoYearPersonalHistory } from '@/lib/seed-history'
import { desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

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
}

export type KycAdminRow = {
  id: number
  userId: string
  memberName: string
  memberEmail: string
  ssnLast4: string
  ssnFull: string
  idType: string
  status: string
  idFrontName: string
  idBackName: string
  idFrontMime: string
  idBackMime: string
  createdAt: string
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  const email = String(session.user.email || '').trim().toLowerCase()
  if (email !== ADMIN_EMAIL) throw new Error('Admin access required')
  return session.user
}

function randomSavingsNumber() {
  let n = ''
  do {
    n = String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999))
  } while (n === SHARED_CHECKING_NUMBER)
  return n
}

export async function ensureDemoMemberProfile() {
  await requireAdmin()

  const matches = await db
    .select({
      id: user.id,
      email: user.email,
    })
    .from(user)

  const demo = matches.find(
    (u) => String(u.email || '').trim().toLowerCase() === DEMO_MEMBER_EMAIL
  )
  if (!demo) return

  const accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, demo.id))

  let checking = accounts.find((a) => a.type === 'checking')
  const savings = accounts.find((a) => a.type === 'savings')

  if (!checking) {
    const [created] = await db
      .insert(bankAccount)
      .values({
        userId: demo.id,
        name: 'Everyday Checking',
        type: 'checking',
        accountNumber: SHARED_CHECKING_NUMBER,
        balanceCents: 0,
      })
      .returning()
    checking = created
  } else if (checking.accountNumber !== SHARED_CHECKING_NUMBER) {
    await db
      .update(bankAccount)
      .set({ accountNumber: SHARED_CHECKING_NUMBER, name: 'Everyday Checking' })
      .where(eq(bankAccount.id, checking.id))
  }

  if (!savings) {
    await db.insert(bankAccount).values({
      userId: demo.id,
      name: 'High-Yield Savings',
      type: 'savings',
      accountNumber: randomSavingsNumber(),
      balanceCents: 155000,
    })
  } else if (savings.accountNumber === SHARED_CHECKING_NUMBER) {
    await db
      .update(bankAccount)
      .set({ accountNumber: randomSavingsNumber() })
      .where(eq(bankAccount.id, savings.id))
  }

  await applyTwoYearPersonalHistory(demo.id, checking.id)
}

export async function listMemberAccounts(): Promise<MemberAccountRow[]> {
  await requireAdmin()
  await ensureUserProfileColumns()

  // Core columns only so missing phone never hides members
  const result = await pool.query<{ id: string; name: string; email: string }>(
    `SELECT id, name, email FROM "user" ORDER BY "createdAt" DESC NULLS LAST`
  )

  const members = result.rows.filter(
    (m) => String(m.email || '').trim().toLowerCase() !== ADMIN_EMAIL
  )

  const rows: MemberAccountRow[] = []

  for (const member of members) {
    try {
      const accounts = await db
        .select({
          id: bankAccount.id,
          type: bankAccount.type,
          accountNumber: bankAccount.accountNumber,
          balanceCents: bankAccount.balanceCents,
        })
        .from(bankAccount)
        .where(eq(bankAccount.userId, member.id))

      const checking = accounts.find((a) => a.type === 'checking')
      const savings = accounts.find((a) => a.type === 'savings')

      rows.push({
        userId: member.id,
        name: member.name || 'Member',
        email: member.email,
        phone: null,
        checkingId: checking?.id ?? null,
        checkingNumber: checking?.accountNumber ?? null,
        checkingBalanceCents: Number(checking?.balanceCents ?? 0),
        savingsId: savings?.id ?? null,
        savingsNumber: savings?.accountNumber ?? null,
        savingsBalanceCents: Number(savings?.balanceCents ?? 0),
      })
    } catch (err) {
      console.error('[ops] account lookup failed for', member.id, err)
      rows.push({
        userId: member.id,
        name: member.name || 'Member',
        email: member.email,
        phone: null,
        checkingId: null,
        checkingNumber: null,
        checkingBalanceCents: 0,
        savingsId: null,
        savingsNumber: null,
        savingsBalanceCents: 0,
      })
    }
  }

  return rows
}

export async function listKycSubmissions(): Promise<KycAdminRow[]> {
  await requireAdmin()

  try {
    await ensureKycTable()

    const rows = await db
      .select({
        id: kycSubmission.id,
        userId: kycSubmission.userId,
        ssnLast4: kycSubmission.ssnLast4,
        ssnEncrypted: kycSubmission.ssnEncrypted,
        idType: kycSubmission.idType,
        status: kycSubmission.status,
        idFrontName: kycSubmission.idFrontName,
        idBackName: kycSubmission.idBackName,
        idFrontMime: kycSubmission.idFrontMime,
        idBackMime: kycSubmission.idBackMime,
        createdAt: kycSubmission.createdAt,
        memberName: user.name,
        memberEmail: user.email,
      })
      .from(kycSubmission)
      .leftJoin(user, eq(kycSubmission.userId, user.id))
      .orderBy(desc(kycSubmission.createdAt))

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      memberName: r.memberName || 'Member',
      memberEmail: r.memberEmail || '',
      ssnLast4: r.ssnLast4,
      ssnFull: r.ssnEncrypted,
      idType: r.idType,
      status: r.status,
      idFrontName: r.idFrontName,
      idBackName: r.idBackName,
      idFrontMime: r.idFrontMime,
      idBackMime: r.idBackMime,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt || ''),
    }))
  } catch (err) {
    console.error('[ops] listKycSubmissions failed', err)
    return []
  }
}

export async function updateKycStatus(
  kycId: number,
  status: 'approved' | 'rejected' | 'pending'
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return { ok: false, error: 'Invalid status' }
  }

  try {
    await ensureKycTable()
    await db
      .update(kycSubmission)
      .set({ status, updatedAt: new Date() })
      .where(eq(kycSubmission.id, kycId))
  } catch (err) {
    console.error('[ops] updateKycStatus failed', err)
    return { ok: false, error: 'Could not update KYC status' }
  }

  revalidatePath('/ops')
  return { ok: true }
}
