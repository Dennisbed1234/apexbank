/** US-style multi-page account statement with Nicolet logo header. */

import {
  NICOLET_LOGO_HEIGHT,
  NICOLET_LOGO_JPEG_B64,
  NICOLET_LOGO_WIDTH,
} from '@/lib/nicolet-logo-jpeg'

/** Map common smart punctuation to ASCII so names like Jimmy P's stay intact. */
function toAscii(value: string) {
  return String(value || '')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapePdf(value: string) {
  return toAscii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function clip(value: string, maxChars: number) {
  const text = toAscii(value)
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 2))}..`
}

function jpegBytes() {
  return Buffer.from(NICOLET_LOGO_JPEG_B64, 'base64')
}

const COL = {
  date: 36,
  desc: 108,
  amount: 400,
  balance: 510,
  rightEdge: 576,
} as const

type PdfLine =
  | { kind: 'text'; text: string; bold?: boolean }
  | {
      kind: 'ledger'
      date: string
      description: string
      amount: string
      balance: string
      bold?: boolean
    }

function pageStream(lines: PdfLine[]) {
  const logoW = 56
  const logoH = (logoW * NICOLET_LOGO_HEIGHT) / NICOLET_LOGO_WIDTH
  const logoY = 792 - 20 - logoH
  let y = logoY - 14
  const lineH = 14

  const cmds: string[] = [
    'q',
    `${logoW.toFixed(2)} 0 0 ${logoH.toFixed(2)} 36 ${logoY.toFixed(2)} cm`,
    '/Im1 Do',
    'Q',
  ]

  for (const line of lines) {
    if (line.kind === 'text') {
      const font = line.bold ? '/F2 10 Tf' : '/F1 10 Tf'
      cmds.push('BT', font, `${COL.date} ${y.toFixed(2)} Td`, `(${escapePdf(line.text)}) Tj`, 'ET')
    } else {
      const font = line.bold ? '/F2 10 Tf' : '/F1 10 Tf'
      const date = clip(line.date, 12)
      const desc = clip(line.description, 48)
      const amount = toAscii(line.amount)
      const balance = toAscii(line.balance)
      const amountX = COL.amount - amount.length * 5.5
      const balanceX = COL.balance - balance.length * 5.5

      cmds.push('BT', font)
      cmds.push(`${COL.date} ${y.toFixed(2)} Td`, `(${escapePdf(date)}) Tj`)
      cmds.push(`${(COL.desc - COL.date).toFixed(2)} 0 Td`, `(${escapePdf(desc)}) Tj`)
      cmds.push(`${(amountX - COL.desc).toFixed(2)} 0 Td`, `(${escapePdf(amount)}) Tj`)
      cmds.push(`${(balanceX - amountX).toFixed(2)} 0 Td`, `(${escapePdf(balance)}) Tj`)
      cmds.push('ET')
    }
    y -= lineH
  }

  return cmds.join('\n')
}

export type StatementLine = {
  date: string
  reference: string
  description: string
  depositLabel: string
  withdrawalLabel: string
  balanceLabel: string
}

export type StatementMonth = {
  label: string
  beginningLabel: string
  closingLabel: string
  creditsLabel: string
  debitsLabel: string
  netLabel: string
  count: number
  transactions: StatementLine[]
}

function amountLabel(line: StatementLine) {
  if (line.depositLabel) return line.depositLabel
  if (line.withdrawalLabel) return line.withdrawalLabel
  return ''
}

export function buildStatementPdf(input: {
  memberName: string
  mailingAddress?: string
  routingNumber: string
  bankAddress: string
  periodLabel: string
  months?: number
  /** e.g. "Nicolet National Bank August Statement" */
  statementTitle?: string
  isCredit?: boolean
  accounts: Array<{
    name: string
    type: string
    lastFour: string
    balanceLabel: string
    creditLimitLabel?: string
    availableCreditLabel?: string
  }>
  monthSections: StatementMonth[]
  generatedAt: string
  totalInPeriod: number
  periodOpeningLabel: string
  periodClosingLabel: string
  lastMonthClosingLabel: string
  creditLimitLabel?: string
  availableCreditLabel?: string
}): Uint8Array {
  const months = input.months ?? 12
  const isCredit = !!input.isCredit
  const title =
    input.statementTitle ||
    (months === 1
      ? 'Nicolet National Bank Statement'
      : `Nicolet National Bank ${months} Month Statement`)

  const balanceWord = isCredit ? 'balance' : 'balance'
  const creditsWord = isCredit ? 'Total payments / credits' : 'Total deposits'
  const debitsWord = isCredit ? 'Total purchases / charges' : 'Total withdrawals'
  const endingWord = isCredit ? 'Ending balance' : 'Ending balance'
  const beginningWord = isCredit ? 'Beginning balance' : 'Beginning balance'

  const body: PdfLine[] = []
  for (const month of input.monthSections) {
    body.push({ kind: 'text', text: '' })
    body.push({ kind: 'text', text: month.label.toUpperCase(), bold: true })
    body.push({
      kind: 'text',
      text: `${beginningWord}                                    ${month.beginningLabel}`,
    })
    body.push({
      kind: 'ledger',
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      balance: isCredit ? 'Balance' : 'Balance',
      bold: true,
    })
    if (month.transactions.length === 0) {
      body.push({ kind: 'text', text: 'No posted items this month.' })
    } else {
      for (const t of month.transactions) {
        body.push({
          kind: 'ledger',
          date: t.date,
          description: t.description,
          amount: amountLabel(t),
          balance: t.balanceLabel,
        })
      }
    }
    body.push({
      kind: 'text',
      text: `${creditsWord}                               ${month.creditsLabel}`,
    })
    body.push({
      kind: 'text',
      text: `${debitsWord}                              ${month.debitsLabel}`,
    })
    body.push({
      kind: 'text',
      text: `Posted items                                         ${month.count}`,
    })
    body.push({
      kind: 'text',
      text: `${endingWord}                                       ${month.closingLabel}`,
    })
  }

  const account = input.accounts[0]
  const header: PdfLine[] = [
    { kind: 'text', text: input.bankAddress },
    { kind: 'text', text: '' },
    { kind: 'text', text: title.toUpperCase(), bold: true },
    { kind: 'text', text: `Statement period  ${input.periodLabel}` },
    { kind: 'text', text: `Generated ${input.generatedAt} CT` },
    { kind: 'text', text: '' },
    { kind: 'text', text: `Account holder    ${input.memberName}`, bold: true },
    {
      kind: 'text',
      text: `Mailing address   ${input.mailingAddress || 'Not on file'}`,
      bold: true,
    },
  ]

  if (!isCredit && input.routingNumber) {
    header.push({ kind: 'text', text: `Routing number    ${input.routingNumber}` })
  }

  if (account) {
    header.push({
      kind: 'text',
      text: isCredit
        ? `Card              ${account.name}  ****${account.lastFour}`
        : `Account           ${account.name}  ****${account.lastFour}`,
    })
    if (isCredit) {
      const limit = account.creditLimitLabel || input.creditLimitLabel || '$10,000.00'
      const available =
        account.availableCreditLabel || input.availableCreditLabel || ''
      header.push({ kind: 'text', text: `Credit limit      ${limit}`, bold: true })
      if (available) {
        header.push({ kind: 'text', text: `Available credit  ${available}`, bold: true })
      }
      header.push({
        kind: 'text',
        text: `Current balance   ${account.balanceLabel}`,
        bold: true,
      })
    } else {
      header.push({ kind: 'text', text: `Current balance   ${account.balanceLabel}` })
    }
  } else {
    header.push({ kind: 'text', text: 'Account           Checking' })
  }

  header.push({ kind: 'text', text: '' })
  header.push({ kind: 'text', text: `Posted items      ${input.totalInPeriod}` })
  header.push({
    kind: 'text',
    text: `${beginningWord} ${input.periodOpeningLabel}`,
  })
  header.push({
    kind: 'text',
    text: `${endingWord}    ${input.periodClosingLabel}`,
  })
  if (isCredit) {
    header.push({
      kind: 'text',
      text: 'Balance is the amount owed. Available credit = credit limit minus current balance.',
    })
  } else {
    header.push({
      kind: 'text',
      text: 'Each running balance equals prior balance plus that item.',
    })
  }

  const footer: PdfLine[] = [
    { kind: 'text', text: '' },
    { kind: 'text', text: `End of statement. ${input.totalInPeriod} posted items.` },
    {
      kind: 'text',
      text: isCredit
        ? `Final ending balance ${input.lastMonthClosingLabel}. Credit limit $10,000.00.`
        : `Final ending balance ${input.lastMonthClosingLabel}.`,
    },
    { kind: 'text', text: 'Dates use Central Time. Member FDIC.' },
  ]

  const all = [...header, ...body, ...footer]
  const PER = 42
  const pages: PdfLine[][] = []
  for (let i = 0; i < all.length; i += PER) {
    const chunk = all.slice(i, i + PER)
    if (pages.length > 0) chunk.push({ kind: 'text', text: `Page ${pages.length + 1}` })
    pages.push(chunk)
  }
  if (!pages.length) pages.push([{ kind: 'text', text: 'Nicolet National Bank statement' }])

  const n = pages.length
  const streams = pages.map(pageStream)
  const image = jpegBytes()
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = [0]
  let size = 0

  function push(str: string) {
    const bytes = encoder.encode(str)
    chunks.push(bytes)
    size += bytes.length
  }

  function pushBytes(bytes: Uint8Array) {
    chunks.push(bytes)
    size += bytes.length
  }

  push('%PDF-1.4\n')
  offsets.push(size)
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  const kids = Array.from({ length: n }, (_, i) => `${3 + i} 0 R`).join(' ')
  offsets.push(size)
  push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`)

  const fontRegularId = 3 + 2 * n
  const fontBoldId = fontRegularId + 1
  const imageId = fontBoldId + 1

  for (let i = 0; i < n; i++) {
    const contentId = 3 + n + i
    offsets.push(size)
    push(
      `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >> >>\nendobj\n`
    )
  }

  for (let i = 0; i < n; i++) {
    const stream = streams[i]
    const len = encoder.encode(stream).length
    offsets.push(size)
    push(`${3 + n + i} 0 obj\n<< /Length ${len} >>\nstream\n${stream}\nendstream\nendobj\n`)
  }

  offsets.push(size)
  push(
    `${fontRegularId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  )

  offsets.push(size)
  push(
    `${fontBoldId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`
  )

  offsets.push(size)
  push(
    `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${NICOLET_LOGO_WIDTH} /Height ${NICOLET_LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`
  )
  pushBytes(image)
  push('\nendstream\nendobj\n')

  const xrefStart = size
  const objCount = imageId
  push(`xref\n0 ${objCount + 1}\n`)
  push('0000000000 65535 f \n')
  for (let i = 1; i <= objCount; i++) {
    push(`${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`)
  }
  push(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\n`)
  push(`startxref\n${xrefStart}\n%%EOF\n`)

  const out = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}
