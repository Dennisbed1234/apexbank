const HIDDEN = [/history locked/i, /^apex 10k/i, /^apex demo/i]

export function isHiddenLedgerRow(
  description?: string | null,
  amountCents?: number | null
) {
  const text = String(description || '')
  if (HIDDEN.some((re) => re.test(text))) return true
  if (amountCents === 0 && /^apex\b/i.test(text)) return true
  return false
}
