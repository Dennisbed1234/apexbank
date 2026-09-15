'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateProfile, type MemberAddress } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { US_STATES } from '@/lib/products'

export function ProfileForm({
  initialName,
  initialPhone,
  initialAddress,
  ssnLast4,
}: {
  initialName: string
  initialPhone: string
  initialAddress: MemberAddress
  ssnLast4?: string
}) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [addressLine1, setAddressLine1] = useState(initialAddress.addressLine1)
  const [addressLine2, setAddressLine2] = useState(initialAddress.addressLine2)
  const [city, setCity] = useState(initialAddress.city)
  const [state, setState] = useState(initialAddress.state)
  const [postalCode, setPostalCode] = useState(initialAddress.postalCode)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateProfile({
        name,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success('Profile saved. New statements will use this address.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Contact</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Name and phone stay on your profile. Address prints on every statement.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Legal name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          {ssnLast4 ? (
            <p className="text-sm text-muted-foreground">SSN on file ending in {ssnLast4}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Mailing address</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is the address shown on downloaded and emailed statements.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="line1">Street address</Label>
            <Input
              id="line1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="123 Gulf Shore Blvd"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="line2">Apt, suite, unit (optional)</Label>
            <Input
              id="line2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Unit 4"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Naples"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="state">State</Label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select</option>
                {US_STATES.map(([abbr, label]) => (
                  <option key={abbr} value={abbr}>
                    {abbr} - {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zip">ZIP</Label>
              <Input
                id="zip"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="34102"
                required
              />
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  )
}
