'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, CheckCircle2, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { depositMobileCheck } from '@/app/actions/deposit-check'
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

function PhotoSlot({
  label,
  preview,
  inputRef,
  onChange,
}: {
  label: string
  preview: string | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onChange: (file: File | null) => void
}) {
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex aspect-[16/9] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 text-center hover:bg-muted"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="h-full w-full object-cover" />
      ) : (
        <>
          <Camera className="size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Tap to take or upload a photo</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </button>
  )
}

export function MobileDeposit({ accounts }: { accounts: BankAccount[] }) {
  const dest = accounts.filter((a) => a.type !== 'retirement')
  const destinations = dest.length ? dest : accounts
  const [open, setOpen] = useState(false)
  const [toId, setToId] = useState(String(destinations[0]?.id ?? ''))
  const [amount, setAmount] = useState('')
  const [front, setFront] = useState<string | null>(null)
  const [back, setBack] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const frontRef = useRef<HTMLInputElement>(null)
  const backRef = useRef<HTMLInputElement>(null)

  function readFile(file: File | null, setter: (v: string | null) => void) {
    if (!file) {
      setter(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setter(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  function resetForm() {
    setAmount('')
    setFront(null)
    setBack(null)
    setError(null)
    if (frontRef.current) frontRef.current.value = ''
    if (backRef.current) backRef.current.value = ''
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const amountDollars = Number.parseFloat(amount)
    startTransition(async () => {
      const result = await depositMobileCheck({
        toAccountId: Number(toId),
        amountDollars,
        hasFront: Boolean(front),
        hasBack: Boolean(back),
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Check submitted', {
        description: `${formatCurrency(Math.round(amountDollars * 100))} posted to your account.`,
      })
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
          <Button variant="outline">
            <Landmark data-icon="inline-start" />
            Deposit check
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mobile check deposit</DialogTitle>
          <DialogDescription>
            Photograph the front and back, then submit. Limit $5,000 per check.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <p className="font-semibold text-foreground">Endorse the back first</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
            <li>Sign your name in the endorsement box.</li>
            <li>
              Under the signature write{' '}
              <span className="font-medium text-foreground">
                For Mobile Deposit at Apex Bank only
              </span>
              .
            </li>
            <li>Use a dark surface and good light. All four corners must be visible.</li>
            <li>Hold the check 7 days after you see it post, then shred it.</li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Deposit to</FieldLabel>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {destinations.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name} · {maskAccountNumber(a.accountNumber)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="chk-amt">Amount on check</FieldLabel>
              <Input
                id="chk-amt"
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
          </FieldGroup>

          <div className="grid gap-3 sm:grid-cols-2">
            <PhotoSlot
              label="Front of check"
              preview={front}
              inputRef={frontRef}
              onChange={(file) => readFile(file, setFront)}
            />
            <PhotoSlot
              label="Back of check"
              preview={back}
              inputRef={backRef}
              onChange={(file) => readFile(file, setBack)}
            />
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            The back photo must show your signature and the Apex endorsement line.
          </p>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Submitting…' : 'Submit deposit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
