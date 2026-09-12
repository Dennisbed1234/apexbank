'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bankAccount, transaction } from '@/lib/db/schema'
import { BANK_ADDRESS, ROUTING_NUMBER } from '@/lib/bank-constants'
import { buildStatementPdf } from '@/lib/pdf-statement'
import { formatCurrency, formatDate } from '@/lib/format'
import { sendMailWithAttachment } from '@/lib/mail'
import { and, desc, eq, gte, sql } from 'drizzle-orm'

export async function emailMyStatement(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.email) {
      return { ok: false, error: 'Sign in to email your statement.' }
    }

    const userId = session.user.id
    const accounts = await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId))
      .orderBy(bankAccount.id)

    const since = new Date()
    since.setMonth(since.getMonth() - 12)
    since.setHours(0, 0, 0, 0)

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transaction)
      .where(and(eq(transaction.userId, userId), gte(transaction.createdAt, since)))

    const totalInPeriod = Number(countRows[0]?.count ?? 0)

    const txs = await db
      .select()
      .from(transaction)
      .where(and(eq(transaction.userId, userId), gte(transaction.createdAt, since)))
      .orderBy(desc(transaction.createdAt), desc(transaction.id))
      .limit(400)

    const periodEnd = new Date()
    const periodLabel = `${since.toLocaleDateString('en-US')} - ${periodEnd.toLocaleDateString('en-US')}`
    const filename = `apex-12mo-statement-${new Date().toISOString().slice(0, 10)}.pdf`

    const pdf = buildStatementPdf({
      memberName: session.user.name || 'Member',
      memberEmail: session.user.email,
      routingNumber: ROUTING_NUMBER,
      bankAddress: BANK_ADDRESS,
      periodLabel,
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.type,
        accountNumber: a.accountNumber,
        balanceLabel: formatCurrency(a.balanceCents, a.currency),
      })),
      transactions: txs.map((t) => ({
        date: formatDate(t.createdAt),
        description: t.description,
        amountLabel: formatCurrency(t.amountCents),
      })),
      generatedAt: new Date().toLocaleString('en-US'),
      totalInPeriod,
    })

    const sent = await sendMailWithAttachment(
      session.user.email,
      'Your Apex Bank statement (PDF)',
      `<p>Hi ${session.user.name || 'there'},</p>
       <p>Your requested account statement is attached as a PDF.</p>
       <p>${totalInPeriod} posted items in the last 12 months are on file. The PDF lists the most recent activity.</p>`,
      {
        filename,
        contentType: 'application/pdf',
        content: pdf,
      }
    )

    if (!sent) {
      return {
        ok: false,
        error: 'Could not send email. Check mail settings and try again.',
      }
    }
    return { ok: true }
  } catch (err) {
    console.error('[statement] email failed', err)
    return { ok: false, error: 'Could not email statement.' }
  }
}
