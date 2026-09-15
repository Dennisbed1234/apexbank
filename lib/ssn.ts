export function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '')
}

export function isValidSsn(value: string) {
  const digits = digitsOnly(value)
  if (digits.length !== 9) return false
  if (digits === '000000000' || digits.startsWith('000') || digits.slice(3, 5) === '00' || digits.slice(5) === '0000') {
    return false
  }
  if (digits.startsWith('9')) return false
  return true
}

export function formatSsnInput(value: string) {
  const digits = digitsOnly(value).slice(0, 9)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export function ssnLast4(value: string) {
  const digits = digitsOnly(value)
  return digits.length >= 4 ? digits.slice(-4) : ''
}
