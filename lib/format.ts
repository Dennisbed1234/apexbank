import { ROUTING_NUMBER } from '@/lib/bank-constants'

/** Bank is in New Orleans — keep every member-facing stamp in this zone. */
export const BANK_TIMEZONE = 'America/Chicago'

export function formatCurrency(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

export function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BANK_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BANK_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

export function formatStatementStamp(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BANK_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function formatMonthYear(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BANK_TIMEZONE,
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export function chicagoMonthKey(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BANK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const year = parts.find((p) => p.type === 'year')?.value || '0000'
  const month = parts.find((p) => p.type === 'month')?.value || '00'
  return `${year}-${month}`
}

export function formatMailingAddress(addr: {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}) {
  const line1 = String(addr.addressLine1 || '').trim()
  const line2 = String(addr.addressLine2 || '').trim()
  const city = String(addr.city || '').trim()
  const state = String(addr.state || '').trim().toUpperCase()
  const zip = String(addr.postalCode || '').trim()
  const cityState = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [line1, line2, cityState].filter(Boolean).join(', ')
}

export function transactionReference(id: number) {
  return `NNB${String(id).padStart(10, '0')}`
}

export function lastFour(num: string) {
  const digits = String(num || '').replace(/\D/g, '')
  return digits.slice(-4) || '----'
}

export function maskAccountNumber(num: string) {
  return `•••• ${lastFour(num)}`
}

export function formatRoutingNumber(routing = ROUTING_NUMBER) {
  return routing
}
