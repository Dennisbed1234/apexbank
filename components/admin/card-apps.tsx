'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  reviewCardApplication,
  type CardApplicationRow,
} from '@/app/actions/card-applications'

export function CardApps({ rows }: { rows: CardApplicationRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [limits, setLimits] = useState<Record<string, string>>({})

  function rowKey(row: CardApplicationRow) {
    return `${row.userId}-${row.productId}-${row.id}`
  }

  function decide(row: CardApplicationRow, decision: 'approved' | 'rejected') {
    const key = row.id ? String(row.id) : row.userId
    const limitRaw = limits[rowKey(row)]
    const creditLimitDollars =
      row.isCredit && decision === 'approved'
        ? Number.parseFloat(limitRaw || '10000')
        : undefined

    if (
      row.isCredit &&
      decision === 'approved' &&
      (!Number.isFinite(creditLimitDollars) || (creditLimitDollars as number) < 500)
    ) {
      toast.error('Enter a credit limit of at least $500.')
      return
    }

    start(async () => {
      const result = await reviewCardApplication(key, decision, {
        creditLimitDollars,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        decision === 'approved'
          ? row.isCredit
            ? `Approved at $${Number(creditLimitDollars).toLocaleString('en-US')} limit`
            : 'Approved and emailed'
          : 'Application declined'
      )
      router.refresh()
    })
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Product applications</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Approve or decline checking, savings, IRA, and credit card requests. For credit cards, set the limit before approving.
      </p>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No applications.</p>
        )}
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className="flex flex-col gap-3 rounded-md border border-border px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.email} · {row.productName} · {row.status}
              </p>
            </div>
            {row.status !== 'approved' && (
              <div className="flex flex-wrap items-center gap-2">
                {row.isCredit && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Limit $</span>
                    <Input
                      className="h-8 w-28"
                      inputMode="decimal"
                      placeholder="10000"
                      value={limits[rowKey(row)] ?? '10000'}
                      onChange={(e) =>
                        setLimits((prev) => ({ ...prev, [rowKey(row)]: e.target.value }))
                      }
                    />
                  </div>
                )}
                <Button type="button" size="sm" disabled={pending} onClick={() => decide(row, 'approved')}>
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => decide(row, 'rejected')}
                >
                  Decline
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
