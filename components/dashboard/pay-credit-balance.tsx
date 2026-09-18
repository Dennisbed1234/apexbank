'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { submitCreditPayoff } from '@/app/actions/credit-payoff'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/format'

export function PayCreditBalance({
  creditAccountId,
  currentBalanceCents,
}: {
  creditAccountId: number
  currentBalanceCents: number
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [method, setMethod] = useState<'external_card' | 'checking'>('external_card')
  const [amount, setAmount] = useState(
    currentBalanceCents > 0 ? (currentBalanceCents / 100).toFixed(2) : ''
  )

  // External card fields
  const [cardNumber, setCardNumber] = useState('')
  const [cardExp, setCardExp] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [mailingAddress, setMailingAddress] = useState('')

  // Checking fields
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountDollars = Number.parseFloat(amount)
    start(async () => {
      const result = await submitCreditPayoff({
        creditAccountId,
        method,
        amountDollars,
        cardNumber,
        cardExp,
        cardCvv,
        mailingAddress,
        routingNumber,
        accountNumber,
        bankName,
        accountHolderName,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Payment submitted',
        {
          description: 'An officer will review and post your credit card payment.',
        }
      )
      setCardNumber('')
      setCardExp('')
      setCardCvv('')
      setMailingAddress('')
      setRoutingNumber('')
      setAccountNumber('')
      setBankName('')
      setAccountHolderName('')
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-base font-semibold text-foreground">Pay credit balance</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Link an external card or checking account to pay toward your balance
        {currentBalanceCents > 0 ? ` (${formatCurrency(currentBalanceCents)} owed)` : ''}.
        Submissions are reviewed by the bank before posting.
      </p>

      {/* Toggle */}
      <div className="mt-4 flex rounded-xl border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setMethod('external_card')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            method === 'external_card'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          External card
        </button>
        <button
          type="button"
          onClick={() => setMethod('checking')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            method === 'checking'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Checking account
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay-amount">Payment amount (USD)</Label>
          <Input
            id="pay-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        {method === 'external_card' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-number">Card number</Label>
              <Input
                id="card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="16-digit number"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="card-exp">Expiration</Label>
                <Input
                  id="card-exp"
                  autoComplete="cc-exp"
                  value={cardExp}
                  onChange={(e) => setCardExp(e.target.value)}
                  placeholder="MM/YY"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="card-cvv">CVV</Label>
                <Input
                  id="card-cvv"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                  placeholder="123"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mail-addr">Mailing address</Label>
              <textarea
                id="mail-addr"
                className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={mailingAddress}
                onChange={(e) => setMailingAddress(e.target.value)}
                placeholder="Street, city, state, ZIP"
                required
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="holder">Name on account</Label>
              <Input
                id="holder"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Full legal name"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bank">Bank name</Label>
              <Input
                id="bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Chase, Bank of America"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="routing">Routing number</Label>
              <Input
                id="routing"
                inputMode="numeric"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
                placeholder="9 digits"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acct">Account number</Label>
              <Input
                id="acct"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Checking account number"
                required
              />
            </div>
          </>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit payment'}
        </Button>
      </form>
    </section>
  )
}
