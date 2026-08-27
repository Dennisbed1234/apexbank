'use client'

import { useMemo, useState, useTransition } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, maskAccountNumber } from '@/lib/format'
import { ROUTING_NUMBER } from '@/lib/bank-constants'

export function OpsPanel({
  members,
  kycRows,
  pendingPayments = [],
}: {
  members: MemberAccountRow[]
  kycRows: KycAdminRow[]
  pendingPayments?: PendingPaymentRow[]
}) {
  const router = useRouter()
  const [selectedUserId, setSelectedUserId] = useState(members[0]?.userId ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedKycId, setSelectedKycId] = useState(kycRows[0]?.id ?? 0)

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
            Members, funding, pending transfers, and KYC. Routing {ROUTING_NUMBER}.
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

      <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Pending Zelle, wires & checks</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Member balances do not change until you approve. Reject leaves funds where they are.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Member</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Counterparty</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nothing waiting on review.
                  </td>
                </tr>
              )}
              {pendingPayments.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-3 pr-3">
                    <div className="font-medium text-foreground">{p.memberName}</div>
                    <div className="text-xs text-muted-foreground">{p.memberEmail}</div>
                  </td>
                  <td className="py-3 pr-3 capitalize">{p.method}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {p.recipientName}
                    {p.zelleHandle ? ` · ${p.zelleHandle}` : ''}
                    {p.recipientBank ? ` · ${p.recipientBank}` : ''}
                  </td>
                  <td className="py-3 pr-3 font-medium tabular-nums">
                    {formatCurrency(p.amountCents)}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending}
                        onClick={() => reviewPayment(p.id, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => reviewPayment(p.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Member accounts</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {members.length} registered member{members.length === 1 ? '' : 's'}
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Member</th>
                  <th className="py-2 pr-3 font-medium">Checking</th>
                  <th className="py-2 pr-3 font-medium">Balance</th>
                  <th className="py-2 font-medium">Savings</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No member accounts yet.
                    </td>
                  </tr>
                )}
                {members.map((m) => (
                  <tr
                    key={m.userId}
                    className={`border-b border-border/60 ${
                      selectedUserId === m.userId ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setSelectedUserId(m.userId)}
                      >
                        <div className="font-medium text-foreground">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </button>
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-muted-foreground">
                      {m.checkingNumber ? maskAccountNumber(m.checkingNumber) : '—'}
                    </td>
                    <td className="py-3 pr-3 font-medium tabular-nums">
                      {formatCurrency(m.checkingBalanceCents)}
                    </td>
                    <td className="py-3 tabular-nums text-muted-foreground">
                      {formatCurrency(m.savingsBalanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Send money to member</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Credits the member checking account immediately.
          </p>

          <form onSubmit={handleSend} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member">Member</Label>
              <select
                id="member"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {members.length === 0 && <option value="">No members</option>}
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} · {m.email}
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>
                  Checking {selected.checkingNumber ?? 'pending'} ·{' '}
                  {formatCurrency(selected.checkingBalanceCents)}
                </p>
                <p className="mt-1">Routing {ROUTING_NUMBER}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                placeholder="e.g. Welcome funding"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={isPending || members.length === 0}>
              <Send className="size-4" />
              {isPending ? 'Sending…' : 'Send to checking'}
            </Button>
          </form>
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">KYC submissions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Review SSN and ID documents submitted by members.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Member</th>
                  <th className="py-2 pr-3 font-medium">ID type</th>
                  <th className="py-2 pr-3 font-medium">SSN</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {kycRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      No KYC submissions yet.
                    </td>
                  </tr>
                )}
                {kycRows.map((k) => (
                  <tr
                    key={k.id}
                    className={`border-b border-border/60 ${
                      selectedKycId === k.id ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <button type="button" className="text-left" onClick={() => setSelectedKycId(k.id)}>
                        <div className="font-medium text-foreground">{k.memberName}</div>
                        <div className="text-xs text-muted-foreground">{k.memberEmail}</div>
                      </button>
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {k.idType === 'drivers_license' ? 'Driver license' : 'State ID'}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">***-**-{k.ssnLast4}</td>
                    <td className="py-3 capitalize">{k.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
            {!selectedKyc ? (
              <p className="text-sm text-muted-foreground">Select a submission to review.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedKyc.memberName}</p>
                  <p className="text-xs text-muted-foreground">{selectedKyc.memberEmail}</p>
                  <p className="mt-2 text-sm">
                    Full SSN:{' '}
                    <span className="font-mono tabular-nums">
                      {selectedKyc.ssnFull.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3')}
                    </span>
                  </p>
                  <p className="text-sm capitalize">Status: {selectedKyc.status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/ops/kyc-doc?id=${selectedKyc.id}&side=front`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted"
                  >
                    View ID front
                  </a>
                  <a
                    href={`/api/ops/kyc-doc?id=${selectedKyc.id}&side=back`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm hover:bg-muted"
                  >
                    View ID back
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={isPending} onClick={() => setStatus('approved')}>
                    <Check className="size-4" />
                    Approve
                  </Button>
                  <Button type="button" variant="destructive" disabled={isPending} onClick={() => setStatus('rejected')}>
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
