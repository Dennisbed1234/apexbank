'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  markCreditPayoffReviewed,
  type CreditPayoffAdminRow,
} from '@/app/actions/credit-payoff'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'

export function CreditPayoffs({ rows }: { rows: CreditPayoffAdminRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function decide(id: number, status: 'approved' | 'rejected') {
    start(async () => {
      const result = await markCreditPayoffReviewed(id, status)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(status === 'approved' ? 'Marked approved' : 'Marked rejected')
      router.refresh()
    })
  }

  return (
    <section className="mt-8 rounded-xl border border-amber-500/40 bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Credit card payoffs</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        External card and checking details submitted by members (plain text for ops review).
      </p>
      <div className="mt-4 space-y-4">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No payoff submissions.</p>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-border bg-muted/20 p-4 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">
                  {row.memberName} · {formatCurrency(row.amountCents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.memberEmail} · {row.method.replace(/_/g, ' ')} · {row.status}
                </p>
              </div>
              {row.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => decide(row.id, 'approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => decide(row.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md bg-background p-3 font-mono text-xs text-foreground">
              {row.payloadPlain}
            </pre>
          </div>
        ))}
      </div>
    </section>
  )
}
