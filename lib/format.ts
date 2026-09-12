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

export function transactionReference(id: number) {
  return `APX${String(id).padStart(10, '0')}`
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
