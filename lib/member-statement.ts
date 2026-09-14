import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { BANK_ADDRESS, ROUTING_NUMBER } from '@/lib/bank-constants'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { buildStatementPdf, type StatementMonth } from '@/lib/pdf-statement'
import {
  chicagoMonthKey,
  formatCurrency,
  formatMailingAddress,
  formatMonthYear,
  formatStatementStamp,
  lastFour,
} from '@/lib/format'
import { isHiddenLedgerRow } from '@/lib/ledger-privacy'
import { and, asc, eq, gte } from 'drizzle-orm'

export function clampStatementMonths(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 12
  return Math.min(12, Math.max(1, Math.round(n)))
}

export function statementWindow(months = 12) {
  const span = clampStatementMonths(months)
  const since = new Date()
  since.setMonth(since.getMonth() - span)
  since.setHours(0, 0, 0, 0)
  const until = new Date()
  return { since, until, months: span }
}

function buildMonthlySections(
  txs: Array<{
    createdAt: Date
    description: string
    amountCents: number
  }>,
  openingCents: number
): StatementMonth[] {
  const groups = new Map<
    string,
    {
      label: string
      sort: string
      txs: Array<{ postedAt: string; description: string; amountLabel: string; amountCents: number }>
    }
  >()

  for (const t of txs) {
    const key = chicagoMonthKey(t.createdAt)
    let group = groups.get(key)
    if (!group) {
      group = {
        label: formatMonthYear(t.createdAt),
        sort: key,
        txs: [],
      }
      groups.set(key, group)
    }
    group.txs.push({
      postedAt: formatStatementStamp(t.createdAt),
      description: t.description,
      amountLabel: formatCurrency(t.amountCents),
      amountCents: t.amountCents,
    })
  }

  const months = [...groups.values()].sort((a, b) => a.sort.localeCompare(b.sort))
  let running = openingCents
  return months.map((month) => {
    const creditsCents = month.txs
      .filter((t) => t.amountCents > 0)
      .reduce((sum, t) => sum + t.amountCents, 0)
    const debitsCents = month.txs
      .filter((t) => t.amountCents < 0)
      .reduce((sum, t) => sum + t.amountCents, 0)
    const netCents = creditsCents + debitsCents
    const beginningCents = running
    const closingCents = beginningCents + netCents
    running = closingCents
    return {
      label: month.label,
      beginningLabel: formatCurrency(beginningCents),
      closingLabel: formatCurrency(closingCents),
      creditsLabel: formatCurrency(creditsCents),
      debitsLabel: formatCurrency(debitsCents),
      netLabel: formatCurrency(netCents),
      count: month.txs.length,
      transactions: month.txs.map(({ postedAt, description, amountLabel }) => ({
        postedAt,
        description,
        amountLabel,
      })),
    }
  })
}

export async function buildMemberStatementPdf(input: {
  userId: string
  memberName: string
  memberEmail?: string
  months?: number
}) {
  const { since, until, months } = statementWindow(input.months)

  await ensureUserProfileColumns()

  const accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, input.userId))
    .orderBy(bankAccount.id)

  let mailingAddress = 'Not on file'
  try {
    const rows = await db
      .select({
        addressLine1: user.addressLine1,
        addressLine2: user.addressLine2,
        city: user.city,
        state: user.state,
        postalCode: user.postalCode,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1)
    const row = rows[0]
    if (row) {
      const formatted = formatMailingAddress({
        addressLine1: row.addressLine1 || '',
        addressLine2: row.addressLine2 || '',
        city: row.city || '',
        state: row.state || '',
        postalCode: row.postalCode || '',
      })
      if (formatted) mailingAddress = formatted
    }
  } catch (err) {
    console.error('[statement] address lookup', err)
  }

  const checking =
    accounts.find((a) => a.type === 'checking') ?? accounts[0] ?? null

  const raw = await db
    .select()
    .from(transaction)
    .where(
      checking
        ? and(
            eq(transaction.userId, input.userId),
            eq(transaction.accountId, checking.id),
            gte(transaction.createdAt, since)
          )
        : and(eq(transaction.userId, input.userId), gte(transaction.createdAt, since))
    )
    .orderBy(asc(transaction.createdAt), asc(transaction.id))

  const txs = raw.filter((t) => !isHiddenLedgerRow(t.description, t.amountCents))
  const periodNet = txs.reduce((sum, t) => sum + t.amountCents, 0)
  const closingCents = checking?.balanceCents ?? 0
  const openingCents = closingCents - periodNet

  const monthSections = buildMonthlySections(
    txs.map((t) => ({
      createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
      description: t.description,
      amountCents: t.amountCents,
    })),
    openingCents
  )

  const lastClose =
    monthSections.length > 0
      ? monthSections[monthSections.length - 1].closingLabel
      : formatCurrency(closingCents)

  const periodLabel = `${formatStatementStamp(since)} - ${formatStatementStamp(until)}`
  const filename = `apex-${months}mo-statement-${until.toISOString().slice(0, 10)}.pdf`

  const pdf = buildStatementPdf({
    memberName: input.memberName || 'Member',
    mailingAddress,
    routingNumber: ROUTING_NUMBER,
    bankAddress: BANK_ADDRESS,
    periodLabel,
    months,
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      lastFour: lastFour(a.accountNumber),
      balanceLabel: formatCurrency(a.balanceCents, a.currency),
    })),
    monthSections,
    generatedAt: formatStatementStamp(until),
    totalInPeriod: txs.length,
    periodOpeningLabel: formatCurrency(openingCents),
    periodClosingLabel: formatCurrency(closingCents),
    lastMonthClosingLabel: lastClose,
  })

  return { pdf, filename, totalInPeriod: txs.length, months }
}
