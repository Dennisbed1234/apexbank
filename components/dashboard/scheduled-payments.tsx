'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelScheduledWire } from '@/app/actions/outbound'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import type { OutboundPayment } from '@/lib/db/schema'

export function ScheduledPayments({
  payments,
}: {
  payments: OutboundPayment[]
}) {
  const [isPending, startTransition] = useTransition()

  if (payments.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zelle & wires</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {p.method === 'zelle' ? 'Zelle' : 'Wire'} to {p.recipientName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.status} · {formatDate(p.scheduledFor)}
                  {p.zelleHandle ? ` · ${p.zelleHandle}` : ''}
                  {p.recipientBank ? ` · ${p.recipientBank}` : ''}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(-Math.abs(Number(p.amountCents)))}
              </p>
              {p.status === 'scheduled' && (
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
                      toast.success('Scheduled wire cancelled')
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
