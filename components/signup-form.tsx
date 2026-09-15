'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApexLogo } from '@/components/apex-logo'
import { PasswordInput } from '@/components/password-input'
import {
  US_STATES,
  getProduct,
  isValidUsState,
  isValidUsZip,
  type BankProduct,
} from '@/lib/products'

function isValidUsPhone(value: string) {
  const digits = value.replace(/\\D/g, '')
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

function adultDobCutoff() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().slice(0, 10)
}

async function postJson<T extends { ok: boolean; error?: string }>(
  url: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as T | null
  if (!data) return { ok: false, error: 'Request failed. Try again.' } as T
  return data
}

export function SignupForm({ product }: { product: BankProduct }) {
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const normalizedEmail = email.trim().toLowerCase()
  const selected = getProduct(product.id) || product

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      if (step === 'details') {
        if (password !== confirmPassword) {
          setLoading(false)
          setError('Passwords do not match.')
          return
        }
        if (password.length < 8) {
          setLoading(false)
          setError('Password must be at least 8 characters.')
          return
        }
        if (!isValidUsPhone(phone)) {
          setLoading(false)
          setError('Enter a valid U.S. phone number (10 digits).')
          return
        }
        if (!dateOfBirth) {
          setLoading(false)
          setError('Choose your date of birth.')
          return
        }
        if (dateOfBirth > adultDobCutoff()) {
          setLoading(false)
          setError('You must be at least 18 years old to open an account.')
          return
        }
        if (!addressLine1.trim() || !city.trim()) {
          setLoading(false)
          setError('Enter your street address and city.')
          return
        }
        if (!isValidUsState(state)) {
          setLoading(false)
          setError('Select a U.S. state.')
          return
        }
        if (!isValidUsZip(postalCode)) {
          setLoading(false)
          setError('Enter a valid ZIP code (12345 or 12345-6789).')
          return
        }
        const result = await postJson<{ ok: boolean; error?: string }>('/api/signup/start', {
          email: normalizedEmail,
          name: name.trim(),
        })
        if (!result.ok) {
          setLoading(false)
          setError(result.error || 'Unable to send verification code.')
          return
        }
        setStep('otp')
        setOtp('')
        setLoading(false)
        setSuccess('A 6-digit code was sent to your email.')
        return
      }
      const created = await postJson<{ ok: boolean; error?: string }>('/api/signup/complete', {
        email: normalizedEmail,
        password,
        name: name.trim(),
        phone: phone.trim(),
        dateOfBirth,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        postalCode: postalCode.trim(),
        productId: selected.id,
        otp,
      })
      if (!created.ok) {
        setLoading(false)
        setError(created.error || 'Could not create the account.')
        return
      }
      window.location.assign('/dashboard')
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <ApexLogo className="h-10 w-auto rounded-sm" />
        </Link>
        <div className="max-w-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-sidebar-foreground/70">Selected product</p>
          <p className="mt-2 text-2xl font-semibold">{selected.name}</p>
          <p className="mt-2 text-sm text-sidebar-foreground/80">{selected.headline}</p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Member FDIC. Deposits insured up to $250,000.</p>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {step === 'otp' ? 'Verify your email' : `Open ${selected.name}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 'otp'
                ? `We emailed a 6-digit code to ${normalizedEmail}.`
                : 'U.S. mailing address and date of birth are required.'}
            </p>
            {step === 'details' && (
              <Link href="/sign-up" className="mt-2 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline">
                Change product
              </Link>
            )}
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {step === 'details' && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Full legal name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Jordan Lee" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required max={adultDobCutoff()} min="1900-01-01" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">U.S. phone number</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" placeholder="(555) 123-4567" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="line1">Street address</Label>
                  <Input id="line1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required autoComplete="address-line1" placeholder="1201 Piper Blvd" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="line2">Apt, suite (optional)</Label>
                  <Input id="line2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} autoComplete="address-line2" placeholder="Suite 200" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required autoComplete="address-level2" placeholder="Naples" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="state">State</Label>
                    <select id="state" value={state} onChange={(e) => setState(e.target.value)} required className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Select</option>
                      {US_STATES.map(([abbr, label]) => (
                        <option key={abbr} value={abbr}>{abbr} - {label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="zip">ZIP code</Label>
                  <Input id="zip" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} required autoComplete="postal-code" inputMode="numeric" placeholder="34110" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput id="password" value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <PasswordInput id="confirm" value={confirmPassword} onChange={setConfirmPassword} required minLength={8} autoComplete="new-password" placeholder="Re-enter password" />
                </div>
              </>
            )}
            {step === 'otp' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input id="otp" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\\D/g, '').slice(0, 6))} required autoComplete="one-time-code" placeholder="000000" className="text-center text-2xl tracking-[0.4em]" />
              </div>
            )}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {success && <p className="text-sm text-emerald-600" role="status">{success}</p>}
            <Button type="submit" disabled={loading} className="h-11 w-full text-base">
              {loading ? 'Please wait…' : step === 'otp' ? 'Verify and create account' : 'Send verification code'}
            </Button>
            {step === 'otp' && (
              <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setStep('details'); setOtp(''); setError(null); setSuccess(null) }}>
                Back
              </button>
            )}
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
