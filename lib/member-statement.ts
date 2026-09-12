import { db } from '@/lib/db'
import { bankAccount, transaction } from '@/lib/db/schema'
import { BANK_ADDRESS, ROUTING_NUMBER } from '@/lib/bank-constants'
import { buildStatementPdf } from '@/lib/pdf-statement'
import {
  formatCurrency,
  formatStatementStamp,
  lastFour,
} from '@/lib/format'
import { isHiddenLedgerRow } from '@/lib/ledger-privacy'
import { and, desc, eq, gte } from 'drizzle-orm'

export function statementWindow() {
  const since = new Date()
  since.setMonth(since.getMonth() - 12)
  since.setHours(0, 0, 0, 0)
  const until = new Date()
  return { since, until }
}

export async function buildMemberStatementPdf(input: {
  userId: string
  memberName: string
  memberEmail?: string
}) {
  const { since, until } = statementWindow()

  const accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, input.userId))
    .orderBy(bankAccount.id)

  const raw = await db
    .select()
    .from(transaction)
    .where(and(eq(transaction.userId, input.userId), gte(transaction.createdAt, since)))
    .orderBy(desc(transaction.createdAt), desc(transaction.id))

  const txs = raw.filter((t) => !isHiddenLedgerRow(t.description, t.amountCents))

  const periodLabel = `${formatStatementStamp(since)} - ${formatStatementStamp(until)}`
  const filename = `apex-12mo-statement-${until.toISOString().slice(0, 10)}.pdf`

  const pdf = buildStatementPdf({
    memberName: input.memberName || 'Member',
    routingNumber: ROUTING_NUMBER,
    bankAddress: BANK_ADDRESS,
    periodLabel,
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      lastFour: lastFour(a.accountNumber),
      balanceLabel: formatCurrency(a.balanceCents, a.currency),
    })),
    transactions: txs.map((t) => ({
      postedAt: formatStatementStamp(t.createdAt),
      description: t.description,
      amountLabel: formatCurrency(t.amountCents),
    })),
    generatedAt: formatStatementStamp(until),
    totalInPeriod: txs.length,
  })

  return { pdf, filename, totalInPeriod: txs.length }
}
