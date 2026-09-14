import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { BANK_ADDRESS, ROUTING_NUMBER } from '@/lib/bank-constants'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { buildStatementPdf, type StatementMonth, type StatementLine } from '@/lib/pdf-statement'
import {
  BANK_TIMEZONE,
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
  since.setDate(1)
  since.setHours(0, 0, 0, 0)
  const until = new Date()
  return { since, until, months: span }
}

function formatUsDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BANK_TIMEZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(d)
}

function monthCatalog(since: Date, until: Date) {
  const keys: Array<{ key: string; label: string }> = []
  const cursor = new Date(since.getFullYear(), since.getMonth(), 1)
  const end = new Date(until.getFullYear(), until.getMonth(), 1)
  while (cursor <= end) {
    const sample = new Date(cursor.getFullYear(), cursor.getMonth(), 15)
    keys.push({
      key: chicagoMonthKey(sample),
      label: formatMonthYear(sample),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  const current = chicagoMonthKey(until)
  if (!keys.some((k) => k.key === current)) {
    keys.push({ key: current, label: formatMonthYear(until) })
  }
  return keys
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
      const formatted = formatMailingAddress(row)
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

  const grouped = new Map<string, typeof txs>()
  for (const t of txs) {
    const created = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)
    const key = chicagoMonthKey(created)
    const list = grouped.get(key) || []
    list.push(t)
    grouped.set(key, list)
  }

  let running = openingCents
  const monthSections: StatementMonth[] = monthCatalog(since, until).map((month) => {
    const rows = grouped.get(month.key) || []
    const beginningCents = running
    const lines: StatementLine[] = []
    let creditsCents = 0
    let debitsCents = 0

    for (const t of rows) {
      running += t.amountCents
      if (t.amountCents >= 0) creditsCents += t.amountCents
      else debitsCents += t.amountCents
      const created = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)
      lines.push({
        date: formatUsDate(created),
        reference: String(t.id).padStart(8, '0'),
        description: t.description,
        depositLabel: t.amountCents >= 0 ? formatCurrency(t.amountCents) : '',
        withdrawalLabel: t.amountCents < 0 ? formatCurrency(t.amountCents) : '',
        balanceLabel: formatCurrency(running),
      })
    }

    const closingMonth = running
    return {
      label: month.label,
      beginningLabel: formatCurrency(beginningCents),
      closingLabel: formatCurrency(closingMonth),
      creditsLabel: formatCurrency(creditsCents),
      debitsLabel: formatCurrency(debitsCents),
      netLabel: formatCurrency(creditsCents + debitsCents),
      count: lines.length,
      transactions: lines,
    }
  })

  const lastClose =
    monthSections.length > 0
      ? monthSections[monthSections.length - 1].closingLabel
      : formatCurrency(closingCents)

  const periodLabel = `${formatUsDate(since)} - ${formatUsDate(until)}`
  const filename = `nicolet-checking-${months}mo-${until.toISOString().slice(0, 10)}.pdf`

  const statementAccounts = checking
    ? [
        {
          name: checking.name,
          type: checking.type,
          lastFour: lastFour(checking.accountNumber),
          balanceLabel: formatCurrency(checking.balanceCents, checking.currency),
        },
      ]
    : []

  const pdf = buildStatementPdf({
    memberName: input.memberName || 'Member',
    mailingAddress,
    routingNumber: ROUTING_NUMBER,
    bankAddress: BANK_ADDRESS,
    periodLabel,
    months,
    accounts: statementAccounts,
    monthSections,
    generatedAt: formatStatementStamp(until),
    totalInPeriod: txs.length,
    periodOpeningLabel: formatCurrency(openingCents),
    periodClosingLabel: formatCurrency(closingCents),
    lastMonthClosingLabel: lastClose,
  })

  return { pdf, filename, totalInPeriod: txs.length, months }
}
