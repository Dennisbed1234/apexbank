/** Pure helpers for credit-card display math. Safe to import from client components. */

export const DEFAULT_CARD_LIMIT_CENTS = 1_000_000

export function cardFigures(account: {
  type: string
  balanceCents: number
  creditLimitCents?: number | null
}) {
  const stored = Number(account.creditLimitCents || 0)
  const limit =
    account.type === 'credit'
      ? stored > 0
        ? stored
        : DEFAULT_CARD_LIMIT_CENTS
      : 0
  const current =
    account.type === 'credit' ? Math.max(0, account.balanceCents) : account.balanceCents
  const available =
    account.type === 'credit' ? Math.max(0, limit - current) : account.balanceCents
  return { limitCents: limit, currentCents: current, availableCents: available }
}
