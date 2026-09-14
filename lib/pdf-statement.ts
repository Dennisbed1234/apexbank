/** US-style multi-page bank statement PDF (ASCII, Helvetica, fixed columns). */

function toAscii(value: string) {
  return String(value || '')
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

function pageStream(lines: string[]) {
  const cmds = ['BT', '/F1 8 Tf', '36 760 Td', '10 TL']
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
  amountLabel: string
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

function ledgerRow(line: StatementLine) {
  return [
    clip(line.date, 10),
    clip(line.reference, 8),
    clip(line.description, 28),
    clip(line.amountLabel, 14).padStart(14),
    clip(line.balanceLabel, 14).padStart(14),
  ].join(' ')
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
    clip('Ref No.', 8),
    clip('Description', 28),
    '        Amount',
    '       Balance',
  ].join(' ')

  const body: string[] = []
  for (const month of input.monthSections) {
    body.push('')
    body.push(`${month.label.toUpperCase()}`)
    body.push(`Beginning balance${''.padEnd(20)}${month.beginningLabel}`)
    body.push(colHead)
    body.push('-'.repeat(78))
    if (month.transactions.length === 0) {
      body.push('No posted items this month.')
    } else {
      for (const t of month.transactions) body.push(ledgerRow(t))
    }
    body.push('-'.repeat(78))
    body.push(`Total deposits / credits${''.padEnd(12)}${month.creditsLabel}`)
    body.push(`Total withdrawals / debits${''.padEnd(10)}${month.debitsLabel}`)
    body.push(`Items this month: ${month.count}`)
    body.push(`Ending balance${''.padEnd(23)}${month.closingLabel}`)
    body.push('Ending = beginning + deposits + withdrawals')
  }

  const header = [
    `APEX BANK  ACCOUNT STATEMENT`,
    `${months}-MONTH PERIOD  ${input.periodLabel}`,
    `Bank: ${input.bankAddress}`,
    `Generated: ${input.generatedAt} CT`,
    `Account holder: ${input.memberName}`,
    `Mailing address: ${input.mailingAddress || 'Not on file'}`,
    `Routing number: ${input.routingNumber}`,
    '',
    'ACCOUNT SUMMARY',
    ...input.accounts.map(
      (a) =>
        `${clip(a.name, 22)}  ${clip(a.type, 10)}  ****${a.lastFour}  ${a.balanceLabel}`
    ),
    '',
    `Posted items this period: ${input.totalInPeriod}`,
    `Beginning balance: ${input.periodOpeningLabel}`,
    `Ending balance:    ${input.periodClosingLabel}`,
    'Each line balance = prior balance + that item amount.',
  ]

  const footer = [
    '',
    `End of statement. ${input.totalInPeriod} posted items.`,
    `Final ending balance ${input.lastMonthClosingLabel} equals current balance ${input.periodClosingLabel}.`,
    'Dates use Central Time. Member FDIC.',
    input.bankAddress,
  ]

  const all = [...header, ...body, ...footer]
  const PER = 68
  const pages: string[][] = []
  for (let i = 0; i < all.length; i += PER) {
    const chunk = all.slice(i, i + PER)
    if (pages.length > 0) chunk.push(`Page ${pages.length + 1}`)
    pages.push(chunk)
  }
  if (!pages.length) pages.push(['Apex Bank statement'])

  const n = pages.length
  const streams = pages.map(pageStream)
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = [0]
  let size = 0

  function push(str: string) {
    const bytes = encoder.encode(str)
    chunks.push(bytes)
    size += bytes.length
  }

  push('%PDF-1.4\n')
  offsets.push(size)
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  const kids = Array.from({ length: n }, (_, i) => `${3 + i} 0 R`).join(' ')
  offsets.push(size)
  push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`)

  for (let i = 0; i < n; i++) {
    const contentId = 3 + n + i
    const fontId = 3 + 2 * n
    offsets.push(size)
    push(
      `${3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`
    )
  }

  for (let i = 0; i < n; i++) {
    const stream = streams[i]
    const len = encoder.encode(stream).length
    offsets.push(size)
    push(`${3 + n + i} 0 obj\n<< /Length ${len} >>\nstream\n${stream}\nendstream\nendobj\n`)
  }

  const fontId = 3 + 2 * n
  offsets.push(size)
  push(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)

  const xrefStart = size
  const objCount = fontId
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
