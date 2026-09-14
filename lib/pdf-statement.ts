/** US-style multi-page checking statement with Nicolet logo header. */

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

function clip(value: string, width: number) {
  const text = toAscii(value)
  if (text.length <= width) return text.padEnd(width)
  return `${text.slice(0, Math.max(0, width - 2))}..`
}

function jpegBytes() {
  return Buffer.from(NICOLET_LOGO_JPEG_B64, 'base64')
}

function pageStream(lines: string[]) {
  const logoW = 168
  const logoH = (logoW * NICOLET_LOGO_HEIGHT) / NICOLET_LOGO_WIDTH
  const logoY = 792 - 28 - logoH
  const textY = logoY - 18
  const cmds = [
    'q',
    `${logoW.toFixed(2)} 0 0 ${logoH.toFixed(2)} 36 ${logoY.toFixed(2)} cm`,
    '/Im1 Do',
    'Q',
    'BT',
    '/F1 10 Tf',
    `36 ${textY.toFixed(2)} Td`,
    '14 TL',
  ]
  lines.forEach((line, i) => {
    if (i > 0) cmds.push('T*')
    cmds.push(`(${escapePdf(line)}) Tj`)
  })
  cmds.push('ET')
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

/** Single signed amount column for a cleaner ledger. */
function amountLabel(line: StatementLine) {
  if (line.depositLabel) return line.depositLabel
  if (line.withdrawalLabel) return line.withdrawalLabel
  return ''
}

function ledgerRow(line: StatementLine) {
  return [
    clip(line.date, 10),
    clip(line.description, 34),
    clip(amountLabel(line), 12).padStart(12),
    clip(line.balanceLabel, 14).padStart(14),
  ].join('  ')
}

export function buildStatementPdf(input: {
  memberName: string
  mailingAddress?: string
  routingNumber: string
  bankAddress: string
  periodLabel: string
  months?: number
  accounts: Array<{ name: string; type: string; lastFour: string; balanceLabel: string }>
  monthSections: StatementMonth[]
  generatedAt: string
  totalInPeriod: number
  periodOpeningLabel: string
  periodClosingLabel: string
  lastMonthClosingLabel: string
}): Uint8Array {
  const months = input.months ?? 12
  const colHead = [
    clip('Date', 10),
    clip('Description', 34),
    clip('Amount', 12).padStart(12),
    clip('Balance', 14).padStart(14),
  ].join('  ')

  const body: string[] = []
  for (const month of input.monthSections) {
    body.push('')
    body.push(month.label.toUpperCase())
    body.push(`Beginning balance                         ${month.beginningLabel}`)
    body.push(colHead)
    if (month.transactions.length === 0) {
      body.push('No posted items this month.')
    } else {
      for (const t of month.transactions) body.push(ledgerRow(t))
    }
    body.push(`Total deposits                            ${month.creditsLabel}`)
    body.push(`Total withdrawals                         ${month.debitsLabel}`)
    body.push(`Posted items                              ${month.count}`)
    body.push(`Ending balance                            ${month.closingLabel}`)
  }

  const account = input.accounts[0]
  const header = [
    'BUSINESS CHECKING STATEMENT',
    `${months}-month period  ${input.periodLabel}`,
    `Generated ${input.generatedAt} CT`,
    '',
    `Account holder    ${input.memberName}`,
    `Mailing address   ${input.mailingAddress || 'Not on file'}`,
    `Routing number    ${input.routingNumber}`,
    account
      ? `Account           ${account.name}  ****${account.lastFour}`
      : 'Account           Business Checking',
    account ? `Current balance   ${account.balanceLabel}` : '',
    `Bank              ${input.bankAddress}`,
    '',
    `Posted items      ${input.totalInPeriod}`,
    `Beginning balance ${input.periodOpeningLabel}`,
    `Ending balance    ${input.periodClosingLabel}`,
    'Each running balance = prior balance + that item.',
  ].filter((line) => line !== undefined)

  const footer = [
    '',
    `End of statement. ${input.totalInPeriod} posted items.`,
    `Final ending balance ${input.lastMonthClosingLabel} equals current balance ${input.periodClosingLabel}.`,
    'Dates use Central Time. Member FDIC.',
  ]

  const all = [...header, ...body, ...footer]
  const PER = 42
  const pages: string[][] = []
  for (let i = 0; i < all.length; i += PER) {
    const chunk = all.slice(i, i + PER)
    if (pages.length > 0) chunk.push(`Page ${pages.length + 1}`)
    pages.push(chunk)
  }
  if (!pages.length) pages.push(['Nicolet National Bank statement'])

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

  const fontId = 3 + 2 * n
  const imageId = fontId + 1

  for (let i = 0; i < n; i++) {
    const contentId = 3 + n + i
    offsets.push(size)
    push(
      `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> /XObject << /Im1 ${imageId} 0 R >> >> >>\nendobj\n`
    )
  }

  for (let i = 0; i < n; i++) {
    const stream = streams[i]
    const len = encoder.encode(stream).length
    offsets.push(size)
    push(`${3 + n + i} 0 obj\n<< /Length ${len} >>\nstream\n${stream}\nendstream\nendobj\n`)
  }

  offsets.push(size)
  push(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)

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
