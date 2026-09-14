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

type PdfLine = { text: string; bold?: boolean }

function pageStream(lines: PdfLine[]) {
  // Small header logo
  const logoW = 56
  const logoH = (logoW * NICOLET_LOGO_HEIGHT) / NICOLET_LOGO_WIDTH
  const logoY = 792 - 20 - logoH
  const textY = logoY - 14
  const cmds = [
    'q',
    `${logoW.toFixed(2)} 0 0 ${logoH.toFixed(2)} 36 ${logoY.toFixed(2)} cm`,
    '/Im1 Do',
    'Q',
    'BT',
    `36 ${textY.toFixed(2)} Td`,
    '14 TL',
  ]
  let currentBold: boolean | null = null
  lines.forEach((line, i) => {
    if (i > 0) cmds.push('T*')
    const wantBold = !!line.bold
    if (currentBold !== wantBold) {
      cmds.push(wantBold ? '/F2 10 Tf' : '/F1 10 Tf')
      currentBold = wantBold
    } else if (i === 0) {
      cmds.push(wantBold ? '/F2 10 Tf' : '/F1 10 Tf')
      currentBold = wantBold
    }
    cmds.push(`(${escapePdf(line.text)}) Tj`)
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

/**
 * Wider columns so the ledger uses the full page instead of clustering on the left.
 * Approx usable width at 10pt Helvetica with 36pt margins: ~90 characters.
 */
function ledgerRow(line: StatementLine) {
  return [
    clip(line.date, 12),
    clip(line.description, 42),
    clip(amountLabel(line), 14).padStart(14),
    clip(line.balanceLabel, 16).padStart(16),
  ].join('   ')
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
    clip('Date', 12),
    clip('Description', 42),
    clip('Amount', 14).padStart(14),
    clip('Balance', 16).padStart(16),
  ].join('   ')

  const body: PdfLine[] = []
  for (const month of input.monthSections) {
    body.push({ text: '' })
    body.push({ text: month.label.toUpperCase(), bold: true })
    body.push({
      text: `Beginning balance                                    ${month.beginningLabel}`,
    })
    body.push({ text: colHead })
    if (month.transactions.length === 0) {
      body.push({ text: 'No posted items this month.' })
    } else {
      for (const t of month.transactions) body.push({ text: ledgerRow(t) })
    }
    body.push({
      text: `Total deposits                                       ${month.creditsLabel}`,
    })
    body.push({
      text: `Total withdrawals                                    ${month.debitsLabel}`,
    })
    body.push({
      text: `Posted items                                         ${month.count}`,
    })
    body.push({
      text: `Ending balance                                       ${month.closingLabel}`,
    })
  }

  const account = input.accounts[0]
  // Bank address sits directly under the logo, then statement title/body
  const header: PdfLine[] = [
    { text: input.bankAddress },
    { text: '' },
    { text: 'BUSINESS CHECKING STATEMENT', bold: true },
    { text: `${months}-month period  ${input.periodLabel}` },
    { text: `Generated ${input.generatedAt} CT` },
    { text: '' },
    { text: `Account holder    ${input.memberName}`, bold: true },
    {
      text: `Mailing address   ${input.mailingAddress || 'Not on file'}`,
      bold: true,
    },
    { text: `Routing number    ${input.routingNumber}` },
    account
      ? { text: `Account           ${account.name}  ****${account.lastFour}` }
      : { text: 'Account           Business Checking' },
    account ? { text: `Current balance   ${account.balanceLabel}` } : { text: '' },
    { text: '' },
    { text: `Posted items      ${input.totalInPeriod}` },
    { text: `Beginning balance ${input.periodOpeningLabel}` },
    { text: `Ending balance    ${input.periodClosingLabel}` },
    { text: 'Each running balance = prior balance + that item.' },
  ].filter((line) => line.text !== undefined)

  const footer: PdfLine[] = [
    { text: '' },
    { text: `End of statement. ${input.totalInPeriod} posted items.` },
    {
      text: `Final ending balance ${input.lastMonthClosingLabel} equals current balance ${input.periodClosingLabel}.`,
    },
    { text: 'Dates use Central Time. Member FDIC.' },
  ]

  const all = [...header, ...body, ...footer]
  const PER = 42
  const pages: PdfLine[][] = []
  for (let i = 0; i < all.length; i += PER) {
    const chunk = all.slice(i, i + PER)
    if (pages.length > 0) chunk.push({ text: `Page ${pages.length + 1}` })
    pages.push(chunk)
  }
  if (!pages.length) pages.push([{ text: 'Nicolet National Bank statement' }])

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

  // Fonts: F1 Helvetica, F2 Helvetica-Bold
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
