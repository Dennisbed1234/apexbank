'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, CreditCard, Eye, EyeOff, Landmark, PiggyBank, Trees, Wifi } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, lastFour, maskAccountNumber } from '@/lib/format'
import { ROUTING_NUMBER } from '@/lib/bank-constants'
import { cardFigures } from '@/lib/card-figures'
import type { BankAccount } from '@/lib/db/schema'

function CopyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-background/70 px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate font-medium tabular-nums text-foreground">{value}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}

export function AccountCard({
  account,
  cardLast4,
  showCardPageLinks = false,
  showDebitPageLink = false,
}: {
  account: BankAccount & { creditLimitCents?: number }
  /** When set (credit cards), must match the plastic card last 4 */
  cardLast4?: string
  /** Small buttons under credit tile → /dashboard/credit-card */
  showCardPageLinks?: boolean
  /** Also show Debit card shortcut when member has checking/savings */
  showDebitPageLink?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const isSavings = account.type === 'savings'
  const isRetirement = account.type === 'retirement'
  const isCredit = account.type === 'credit'
  const figures = cardFigures(account)
  const ending = isCredit
    ? lastFour(cardLast4 || account.accountNumber)
    : lastFour(account.accountNumber)

  return (
    <Card
      className={
        isCredit
          ? 'relative overflow-hidden border border-emerald-400/30 text-white shadow-[0_0_40px_-12px_rgba(16,185,129,0.55)]'
          : 'relative overflow-hidden'
      }
      style={
        isCredit
          ? {
              background:
                'radial-gradient(120% 90% at 0% 0%, rgba(52,211,153,0.35) 0%, transparent 55%), radial-gradient(90% 80% at 100% 100%, rgba(16,185,129,0.25) 0%, transparent 50%), linear-gradient(145deg, #042f1a 0%, #065f46 38%, #047857 68%, #022c22 100%)',
            }
          : undefined
      }
    >
      {isCredit && (
        <>
          <div
            className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full opacity-40 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(110,231,183,0.7), transparent 70%)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-6 size-36 rounded-full opacity-30 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.6), transparent 70%)' }}
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%)]" />
        </>
      )}

      <CardHeader className="relative z-10 flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={
              isCredit
                ? 'flex size-10 items-center justify-center rounded-xl bg-white/15 text-emerald-50 ring-1 ring-white/20 backdrop-blur-sm'
                : isRetirement
                  ? 'flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : isSavings
                    ? 'flex size-10 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground'
                    : 'flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary'
            }
          >
            {isCredit ? (
              <CreditCard className="size-5" />
            ) : isRetirement ? (
              <Trees className="size-5" />
            ) : isSavings ? (
              <PiggyBank className="size-5" />
            ) : (
              <Landmark className="size-5" />
            )}
          </div>
          <div>
            <p className={`text-sm font-semibold ${isCredit ? 'text-white' : 'text-foreground'}`}>
              {account.name}
            </p>
            <p className={`text-xs ${isCredit ? 'text-emerald-100/75' : 'text-muted-foreground'}`}>
              {isCredit ? `Card ending •••• ${ending}` : `Acct ${maskAccountNumber(account.accountNumber)}`}
            </p>
          </div>
        </div>
        {isCredit ? (
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-emerald-50 ring-1 ring-white/15 backdrop-blur-sm">
            <Wifi className="size-3 rotate-90 opacity-80" />
            Card
          </div>
        ) : (
          <Badge variant="secondary" className="capitalize">
            {account.type}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="relative z-10">
        {isCredit ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs tracking-wide text-emerald-100/70">Available</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-white tabular-nums">
                {formatCurrency(figures.availableCents, account.currency)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/10 backdrop-blur-sm">
                <p className="text-[11px] text-emerald-100/65">Current balance</p>
                <p className="font-semibold tabular-nums text-white">
                  {formatCurrency(figures.currentCents, account.currency)}
                </p>
              </div>
              <div className="rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/10 backdrop-blur-sm">
                <p className="text-[11px] text-emerald-100/65">Limit</p>
                <p className="font-semibold tabular-nums text-white">
                  {formatCurrency(figures.limitCents, account.currency)}
                </p>
              </div>
            </div>

            {showCardPageLinks && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/dashboard/credit-card?accountId=${account.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/25"
                >
                  <CreditCard className="size-3.5" />
                  Credit card
                </Link>
                {showDebitPageLink && (
                  <Link
                    href="/dashboard/cards"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-black/20 px-3 text-xs font-semibold text-emerald-50 ring-1 ring-white/15 backdrop-blur-sm hover:bg-black/30"
                  >
                    <CreditCard className="size-3.5" />
                    Debit card
                  </Link>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {isRetirement ? 'Retirement balance' : 'Available balance'}
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              {formatCurrency(account.balanceCents, account.currency)}
            </p>

            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
            >
              {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {revealed ? 'Hide account details' : 'Tap to view account & routing'}
            </button>

            {revealed && (
              <div className="mt-3 space-y-2 rounded-lg bg-muted/50 p-2">
                <CopyField label="Routing number" value={ROUTING_NUMBER} />
                <CopyField label="Account number" value={account.accountNumber} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
