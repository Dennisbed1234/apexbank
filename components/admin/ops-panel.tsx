'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { adminSendToUser } from '@/app/actions/send-to-member'
import {
  updateKycStatus,
  type KycAdminRow,
  type MemberAccountRow,
} from '@/app/actions/admin-ops'
import {
  reviewOutboundPayment,
  type PendingPaymentRow,
} from '@/app/actions/outbound'
import {
  decideLoginAttempt,
  type LoginAttemptRow,
} from '@/app/actions/login-challenge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, maskAccountNumber } from '@/lib/format'
import { ROUTING_NUMBER } from '@/lib/bank-constants'

export function OpsPanel({
  members,
  kycRows,
  pendingPayments = [],
  loginAttempts = [],
}: {
  members: MemberAccountRow[]
  kycRows: KycAdminRow[]
  pendingPayments?: PendingPaymentRow[]
  loginAttempts?: LoginAttemptRow[]
}) {
  const router = useRouter()
  const [selectedUserId, setSelectedUserId] = useState(members[0]?.userId ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedKycId, setSelectedKycId] = useState(kycRows[0]?.id ?? 0)

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(id)
  }, [router])

  const selected = useMemo(
    () => members.find((m) => m.userId === selectedUserId) ?? null,
    [members, selectedUserId]
  )

  const selectedKyc = useMemo(
    () => kycRows.find((k) => k.id === selectedKycId) ?? null,
    [kycRows, selectedKycId]
  )

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedUserId) {
      setError('Select a member account.')
      return
    }
    const amountDollars = Number.parseFloat(amount)
    startTransition(async () => {
      const result = await adminSendToUser({
        targetUserId: selectedUserId,
        amountDollars,
        note,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Money sent', {
        description: `${formatCurrency(Math.round(amountDollars * 100))} posted on both ledgers.`,
      })
      setAmount('')
      setNote('')
      router.refresh()
    })
  }

  function setStatus(status: 'approved' | 'rejected' | 'pending') {
    if (!selectedKyc) return
    startTransition(async () => {
      const result = await updateKycStatus(selectedKyc.id, status)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`KYC marked ${status}`)
      router.refresh()
    })
  }

  function reviewPayment(id: number, decision: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await reviewOutboundPayment(id, decision)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(decision === 'approved' ? 'Posted to the account' : 'Request declined')
      router.refresh()
    })
  }

  function reviewLogin(id: string, decision: 'approved' | 'rejected') {
    startTransition(async () => {
      const result = await decideLoginAttempt(id, decision)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(decision === 'approved' ? 'Login approved' : 'Login rejected')
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Restricted · DaddyG Enterprise
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Operations desk
          </h1>
          <p className="text-sm text-muted-foreground">
            Live sign-ins, members, funding, transfers, and KYC. Routing{' '}
            {ROUTING_NUMBER}. Auto-refreshes every 3s.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Open my user dashboard
        </Link>
      </div>

      <section className="mt-8 rounded-xl border border-amber-500/40 bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">
          Live sign-in attempts
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign-in status only. Passwords, OTPs, and cookies are never stored or
          displayed.
        </p>
        <div className="mt-4 space-y-4">
          {loginAttempts.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active sign-in attempts.
            </p>
          )}
          {loginAttempts.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{a.memberName}</p>
                  <p className="text-xs text-muted-foreground">
                    Step:{' '}
                    <span className="capitalize">{a.step.replace(/_/g, ' ')}</span>
                    {' · '}
                    <span className="capitalize">
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.lastEvent}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      isPending ||
                      a.status !== 'awaiting_approval' ||
                      !a.otp1Verified ||
                      !a.otp2Verified
                    }
                    onClick={() => reviewLogin(a.id, 'approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => reviewLogin(a.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid gap-1 rounded-md bg-background/80 p-3 font-mono text-xs">
                <p>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  {a.email}
                </p>
                {a.ipAddress && (
                  <p>
                    <span className="text-muted-foreground">IP:</span>{' '}
                    {a.ipAddress}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
