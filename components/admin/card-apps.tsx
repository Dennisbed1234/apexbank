'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  reviewCardApplication,
  type CardApplicationRow,
} from '@/app/actions/card-applications'

export function CardApps({ rows }: { rows: CardApplicationRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function decide(userId: string, decision: 'approved' | 'rejected') {
    start(async () => {
      const result = await reviewCardApplication(userId, decision)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(decision === 'approved' ? 'Card approved and emailed' : 'Application declined')
      router.refresh()
    })
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Credit card applications</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Approve before the member can open a card dashboard. An email is sent on each decision.
      </p>
      <div className="mt-4 space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No card applications.</p>
        )}
        {rows.map((row) => (
          <div
            key={row.userId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.email} · {row.productName} · {row.status}
              </p>
            </div>
            {row.status !== 'approved' && (
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={pending} onClick={() => decide(row.userId, 'approved')}>
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => decide(row.userId, 'rejected')}
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
