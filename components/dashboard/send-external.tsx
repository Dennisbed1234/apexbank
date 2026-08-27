'use client'

import { useState, useTransition } from 'react'
import { Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { scheduleWire, sendZelle } from '@/app/actions/outbound'
import { ZelleMark } from '@/components/zelle-mark'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { formatCurrency, maskAccountNumber } from '@/lib/format'
import type { BankAccount } from '@/lib/db/schema'

type Mode = 'zelle' | 'wire'

export function SendExternal({ accounts }: { accounts: BankAccount[] }) {
  const spendable = accounts.filter((a) => a.type !== 'retirement')
  const sourceAccounts = spendable.length ? spendable : accounts
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('zelle')
  const [fromId, setFromId] = useState(String(sourceAccounts[0]?.id ?? ''))
  const [amount, setAmount] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [zelleHandle, setZelleHandle] = useState('')
  const [recipientBank, setRecipientBank] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [sendOn, setSendOn] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resetForm() {
    setAmount('')
    setRecipientName('')
    setZelleHandle('')
    setRecipientBank('')
    setRoutingNumber('')
    setAccountNumber('')
    setSendOn('')
    setMemo('')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountDollars = Number.parseFloat(amount)

    startTransition(async () => {
      const result =
        mode === 'zelle'
          ? await sendZelle({
              fromAccountId: Number(fromId),
              amountDollars,
              recipientName,
              zelleHandle,
              memo,
            })
          : await scheduleWire({
              fromAccountId: Number(fromId),
              amountDollars,
              recipientName,
              recipientBank,
              routingNumber,
              accountNumber,
              sendOn: sendOn || undefined,
              memo,
            })

      if (!result.ok) {
        setError(result.error)
        return
      }

      if (result.status === 'scheduled') {
        toast.success('Wire scheduled', {
          description: `${formatCurrency(Math.round(amountDollars * 100))} will leave on the date you chose.`,
        })
      } else {
        toast.success(mode === 'zelle' ? 'Zelle sent' : 'Wire sent', {
          description: `${formatCurrency(Math.round(amountDollars * 100))} is on the way to ${recipientName}.`,
        })
      }
      resetForm()
      setOpen(false)
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
          <Button variant="outline" className="gap-2">
            <ZelleMark showWord={false} />
            Zelle / Wire
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send outside Apex</DialogTitle>
          <DialogDescription>
            Zelle posts immediately. Wires can send today or on a future date.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('zelle')}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
              mode === 'zelle'
                ? 'border-[#6C1CD3] bg-[#6C1CD3]/10 text-foreground'
                : 'border-border text-muted-foreground'
            }`}
          >
            <ZelleMark />
          </button>
          <button
            type="button"
            onClick={() => setMode('wire')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              mode === 'wire'
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground'
            }`}
          >
            <Banknote className="mr-1 inline size-4" />
            Wire
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel>From</FieldLabel>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sourceAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name} · {maskAccountNumber(a.accountNumber)} ·{' '}
                        {formatCurrency(a.balanceCents)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="ext-amount">Amount</FieldLabel>
              <Input
                id="ext-amount"
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
              <FieldLabel htmlFor="ext-name">Recipient name</FieldLabel>
              <Input
                id="ext-name"
                required
                placeholder="Jordan Lee"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </Field>

            {mode === 'zelle' ? (
              <Field>
                <FieldLabel htmlFor="ext-zelle">Zelle email or mobile</FieldLabel>
                <Input
                  id="ext-zelle"
                  required
                  placeholder="name@email.com or (504) 555-0199"
                  value={zelleHandle}
                  onChange={(e) => setZelleHandle(e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="ext-bank">Receiving bank</FieldLabel>
                  <Input
                    id="ext-bank"
                    required
                    placeholder="Chase, Bank of America, ..."
                    value={recipientBank}
                    onChange={(e) => setRecipientBank(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ext-routing">Routing number</FieldLabel>
                  <Input
                    id="ext-routing"
                    required
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="9 digits"
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ext-acct">Account number</FieldLabel>
                  <Input
                    id="ext-acct"
                    required
                    inputMode="numeric"
                    placeholder="Destination account"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="ext-date">Send on (optional)</FieldLabel>
                  <Input
                    id="ext-date"
                    type="date"
                    value={sendOn}
                    onChange={(e) => setSendOn(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to send today. Future dates stay scheduled until that morning.
                  </p>
                </Field>
              </>
            )}

            <Field>
              <FieldLabel htmlFor="ext-memo">Memo (optional)</FieldLabel>
              <Input
                id="ext-memo"
                placeholder="Rent, invoice 1042, ..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </Field>
          </FieldGroup>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={isPending}
              className={`w-full ${
                mode === 'zelle' ? 'bg-[#6C1CD3] text-white hover:bg-[#5a16b3]' : ''
              }`}
            >
              {isPending
                ? 'Sending…'
                : mode === 'zelle'
                  ? 'Send with Zelle®'
                  : sendOn
                    ? 'Schedule wire'
                    : 'Send wire today'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
