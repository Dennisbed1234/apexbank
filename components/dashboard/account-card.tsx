'use client'

import { useState } from 'react'
import { Check, Copy, Eye, EyeOff, Landmark, PiggyBank, Trees } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, maskAccountNumber } from '@/lib/format'
import { ROUTING_NUMBER } from '@/lib/bank-constants'
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

export function AccountCard({ account }: { account: BankAccount }) {
  const [revealed, setRevealed] = useState(false)
  const isSavings = account.type === 'savings'
  const isRetirement = account.type === 'retirement'

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={
              isRetirement
                ? 'flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : isSavings
                  ? 'flex size-10 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground'
                  : 'flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary'
            }
          >
            {isRetirement ? (
              <Trees className="size-5" />
            ) : isSavings ? (
              <PiggyBank className="size-5" />
            ) : (
              <Landmark className="size-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {account.name}
            </p>
            <p className="text-xs text-muted-foreground">
              Acct {maskAccountNumber(account.accountNumber)}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="capitalize">
          {account.type}
        </Badge>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
