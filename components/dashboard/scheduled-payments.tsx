'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cancelScheduledWire } from '@/app/actions/outbound'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import type { OutboundPayment } from '@/lib/db/schema'

function methodLabel(method: string) {
  if (method === 'zelle') return 'Zelle'
  if (method === 'check') return 'Check deposit'
  return 'Wire'
}

export function ScheduledPayments({
  payments,
}: {
  payments: OutboundPayment[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (payments.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfers & deposits</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {methodLabel(p.method)}{' '}
                  {p.method === 'check' ? 'to your account' : `to ${p.recipientName}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.status === 'pending' ? 'Pending admin review' : p.status} ·{' '}
                  {formatDate(p.scheduledFor)}
                  {p.zelleHandle ? ` · ${p.zelleHandle}` : ''}
                  {p.recipientBank ? ` · ${p.recipientBank}` : ''}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(
                  p.method === 'check'
                    ? Math.abs(Number(p.amountCents))
                    : -Math.abs(Number(p.amountCents))
                )}
              </p>
              {(p.status === 'scheduled' || p.status === 'pending') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await cancelScheduledWire(p.id)
                      if (!result.ok) {
                        toast.error(result.error)
                        return
                      }
                      toast.success('Request cancelled')
                      router.refresh()
                    })
                  }}
                >
                  Cancel
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
