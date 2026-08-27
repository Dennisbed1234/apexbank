'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { transferFunds } from '@/app/actions/banking'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { formatCurrency, maskAccountNumber } from '@/lib/format'
import type { BankAccount } from '@/lib/db/schema'

function accountLabel(a: BankAccount) {
  return `${a.name} ${maskAccountNumber(a.accountNumber)}`
}

export function TransferDialog({ accounts }: { accounts: BankAccount[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fromId, setFromId] = useState<string>(String(accounts[0]?.id ?? ''))
  const [toId, setToId] = useState<string>(String(accounts[1]?.id ?? ''))
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setAmount('')
    setNote('')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const amountDollars = Number.parseFloat(amount)

    startTransition(async () => {
      const result = await transferFunds({
        fromAccountId: Number(fromId),
        toAccountId: Number(toId),
        amountDollars,
        note,
      })

      if (!result.ok) {
        setError(result.error)
        return
      }

      toast.success('Transfer complete', {
        description: `${formatCurrency(Math.round(amountDollars * 100))} moved successfully.`,
      })
      resetForm()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <ArrowRightLeft data-icon="inline-start" />
            Transfer money
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
          <DialogDescription>
            Move money instantly between your Apex Bank accounts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="from-account">From</FieldLabel>
              <select
                id="from-account"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {accountLabel(a)}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="to-account">To</FieldLabel>
              <select
                id="to-account"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {accountLabel(a)}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="note">Note (optional)</FieldLabel>
              <Input
                id="note"
                placeholder="e.g. Move to savings"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </FieldGroup>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Transferring…' : 'Confirm transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
