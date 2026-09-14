import { db } from '@/lib/db'
import { bankAccount, transaction, user } from '@/lib/db/schema'
import { BANK_ADDRESS, BANK_NAME, ROUTING_NUMBER } from '@/lib/bank-constants'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import {
  displayCheckingName,
  ensureCheckingProductName,
} from '@/lib/account-products'
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
import { and, asc, eq, gte, lt } from 'drizzle-orm'

export function clampStatementMonths(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 12
  return Math.min(12, Math.max(1, Math.round(n)))
}

export function parseMonthKey(monthKey: string): { since: Date; until: Date; label: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  if (!Number.isFinite(year) || month < 0 || month > 11) return null
  const since = new Date(year, month, 1, 0, 0, 0, 0)
  const until = new Date(year, month + 1, 1, 0, 0, 0, 0)
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: BANK_TIMEZONE,
  }).format(new Date(year, month, 15))
  return { since, until, label }
}

export function availableStatementMonths(count = 12) {
  const out: Array<{ key: string; label: string }> = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: BANK_TIMEZONE,
    }).format(d)
    out.push({ key, label })
  }
  return out
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

function safeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9 ._-]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function buildMemberStatementPdf(input: {
  userId: string
  memberName: string
  memberEmail?: string
  months?: number
  monthKey?: string
}) {
  const single = input.monthKey ? parseMonthKey(input.monthKey) : null

  let since: Date
  let until: Date
  let months: number
  let statementTitle: string
  let periodLabel: string
  let filename: string

  const productName = displayCheckingName(
    null,
    input.memberName,
    input.memberEmail
  )

  if (single) {
    since = single.since
    until = single.until
    months = 1
    const monthName = single.label.replace(/\s+\d{4}$/, '')
    statementTitle = `${BANK_NAME} ${productName} ${monthName} Statement`
    periodLabel = `${formatUsDate(since)} through ${formatUsDate(new Date(until.getTime() - 1))}`
    filename = `${safeFileName(statementTitle)}.pdf`
  } else {
    const window = statementWindow(input.months)
    since = window.since
    until = window.until
    months = window.months
    const monthWord = months === 1 ? '1 Month' : `${months} Month`
    statementTitle = `${BANK_NAME} ${productName} ${monthWord} Statement`
    periodLabel = `${formatUsDate(since)} through ${formatUsDate(until)}`
    filename = `${safeFileName(statementTitle)}.pdf`
  }

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

  if (checking) {
    await ensureCheckingProductName({
      userId: input.userId,
      checkingId: checking.id,
      memberName: input.memberName,
      memberEmail: input.memberEmail,
    })
    checking.name = productName
  }

  const historySince = new Date(since)
  historySince.setFullYear(historySince.getFullYear() - 2)

  const raw = await db
    .select()
    .from(transaction)
    .where(
      checking
        ? and(
            eq(transaction.userId, input.userId),
            eq(transaction.accountId, checking.id),
            gte(transaction.createdAt, historySince),
            single ? lt(transaction.createdAt, until) : gte(transaction.createdAt, since)
          )
        : and(
            eq(transaction.userId, input.userId),
            gte(transaction.createdAt, historySince),
            single ? lt(transaction.createdAt, until) : gte(transaction.createdAt, since)
          )
    )
    .orderBy(asc(transaction.createdAt), asc(transaction.id))

  const allVisible = raw.filter((t) => !isHiddenLedgerRow(t.description, t.amountCents))

  const inPeriod = allVisible.filter((t) => {
    const d = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)
    return d >= since && d < until
  })

  const closingCents = checking?.balanceCents ?? 0
  const fromSinceOnward = allVisible.filter((t) => {
    const d = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)
    return d >= since
  })
  const afterPeriod = allVisible.filter((t) => {
    const d = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)
    return d >= until
  })
  const netAfter = afterPeriod.reduce((s, t) => s + t.amountCents, 0)
  const periodNet = inPeriod.reduce((s, t) => s + t.amountCents, 0)
  const openingCents = closingCents - periodNet - netAfter

  const grouped = new Map<string, typeof inPeriod>()
  for (const t of inPeriod) {
    const created = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt)
    const key = chicagoMonthKey(created)
    const list = grouped.get(key) || []
    list.push(t)
    grouped.set(key, list)
  }

  let running = openingCents
  const catalog = single
    ? [{ key: chicagoMonthKey(new Date(since.getFullYear(), since.getMonth(), 15)), label: single.label }]
    : monthCatalog(since, until)

  const monthSections: StatementMonth[] = catalog.map((month) => {
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

    return {
      label: month.label,
      beginningLabel: formatCurrency(beginningCents),
      closingLabel: formatCurrency(running),
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

  const statementAccounts = checking
    ? [
        {
          name: productName,
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
    statementTitle,
    accounts: statementAccounts,
    monthSections,
    generatedAt: formatStatementStamp(new Date()),
    totalInPeriod: inPeriod.length,
    periodOpeningLabel: formatCurrency(openingCents),
    periodClosingLabel:
      monthSections.length > 0
        ? monthSections[monthSections.length - 1].closingLabel
        : formatCurrency(openingCents),
    lastMonthClosingLabel: lastClose,
  })

  return {
    pdf,
    filename,
    totalInPeriod: inPeriod.length,
    months,
    statementTitle,
    periodLabel,
  }
}
