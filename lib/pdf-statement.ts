/** Simple valid multi-page PDF (ASCII-only, no external deps). */

function toAscii(value: string) {
  return String(value || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapePdf(value: string) {
  return toAscii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
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

export function buildStatementPdf(input: {
  memberName: string
  memberEmail: string
  routingNumber: string
  bankAddress: string
  periodLabel: string
  accounts: Array<{ name: string; type: string; accountNumber: string; balanceLabel: string }>
  transactions: Array<{ date: string; description: string; amountLabel: string }>
  generatedAt: string
  totalInPeriod: number
}): Uint8Array {
  const shown = input.transactions.map((t) => {
    const desc =
      t.description.length > 48 ? t.description.slice(0, 45) + '...' : t.description
    return `${t.date.padEnd(13)}${t.amountLabel.padStart(14)}  ${desc}`
  })

  const header = [
    'Apex Bank - 12-Month Account Statement',
    `Bank address: ${input.bankAddress}`,
    `Generated: ${input.generatedAt}`,
    `Statement period: ${input.periodLabel}`,
    `Member: ${input.memberName}`,
    `Email: ${input.memberEmail}`,
    `Routing number: ${input.routingNumber}`,
    '',
    'Accounts (current balances)',
    ...input.accounts.map(
      (a) =>
        `- ${a.name} (${a.type}) Acct ${a.accountNumber} Balance ${a.balanceLabel}`
    ),
    '',
    `Posted transactions this period: ${input.totalInPeriod}`,
    'Complete ledger follows. Every posted item in the period is listed.',
    'Date          Amount          Description',
  ]

  const footer = [
    '',
    `End of statement - ${input.totalInPeriod} transactions`,
    input.bankAddress,
  ]

  const all = [...header, ...shown, ...footer]
  const PER = 68
  const pages: string[][] = []
  for (let i = 0; i < all.length; i += PER) {
    const chunk = all.slice(i, i + PER)
    if (pages.length > 0) {
      chunk.push(`Page ${pages.length + 1}`)
    }
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
