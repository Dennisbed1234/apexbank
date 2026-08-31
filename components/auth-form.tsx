'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { notifySuccessfulLogin } from '@/app/actions/notify'
import {
  startLoginChallenge,
  submitLoginOtp,
} from '@/app/actions/login-challenge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApexLogo } from '@/components/apex-logo'

function isValidUsPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

type SignInStep = 'credentials' | 'otp'

export function AuthForm({
  mode,
}: {
  mode: 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password'
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [signInStep, setSignInStep] = useState<SignInStep>('credentials')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === 'sign-up'
  const isForgot = mode === 'forgot-password'
  const isReset = mode === 'reset-password'
  const isSignIn = mode === 'sign-in'

  async function finishSignIn() {
    const { error: signErr } = await authClient.signIn.email({
      email,
      password,
    })
    if (signErr) {
      setError(signErr.message ?? 'Invalid email or password.')
      setLoading(false)
      return
    }
    await notifySuccessfulLogin().catch(() => undefined)
    router.push('/dashboard')
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (isForgot) {
        const { error } = await authClient.forgetPassword({
          email,
          redirectTo: '/reset-password',
        })
        setLoading(false)
        if (error) {
          setError(error.message ?? 'Unable to start password reset.')
          return
        }
        setSuccess(
          'If an account exists for that email, a reset link has been sent. Check inbox and spam.'
        )
        return
      }

      if (isReset) {
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
        const token =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('token')
            : null
        if (!token) {
          setLoading(false)
          setError('Missing reset token. Open the link from your email again.')
          return
        }
        const { error } = await authClient.resetPassword({
          newPassword: password,
          token,
        })
        setLoading(false)
        if (error) {
          setError(error.message ?? 'Unable to reset password.')
          return
        }
        setSuccess('Password updated. You can sign in now.')
        setTimeout(() => router.push('/sign-in'), 1200)
        return
      }

      if (isSignUp) {
        if (password !== confirmPassword) {
          setLoading(false)
          setError('Passwords do not match.')
          return
        }
        if (!isValidUsPhone(phone)) {
          setLoading(false)
          setError('Enter a valid U.S. phone number (10 digits).')
          return
        }
        if (!dateOfBirth) {
          setLoading(false)
          setError('Date of birth is required.')
          return
        }

        const { error } = await authClient.signUp.email({
          email,
          password,
          name: name.trim(),
          phone: phone.trim(),
          dateOfBirth,
        } as any)

        setLoading(false)
        if (error) {
          setError(error.message ?? 'Something went wrong. Please try again.')
          return
        }

        router.push('/dashboard')
        router.refresh()
        return
      }

      // —— Sign in ——
      if (signInStep === 'credentials') {
        const result = await startLoginChallenge({ email, password })
        if (!result.ok) {
          setLoading(false)
          setError(result.error)
          return
        }

        // Admin: no OTP
        if ('skipOtp' in result && result.skipOtp) {
          await finishSignIn()
          return
        }

        setAttemptId(result.attemptId)
        setSignInStep('otp')
        setOtp('')
        setLoading(false)
        setSuccess('A 6-digit code was sent to your email.')
        return
      }

      if (signInStep === 'otp') {
        if (!attemptId) {
          setLoading(false)
          setError('Session lost. Start again.')
          setSignInStep('credentials')
          return
        }
        const result = await submitLoginOtp({ attemptId, otp })
        if (!result.ok) {
          setLoading(false)
          setError(result.error)
          return
        }
        await finishSignIn()
      }
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const title = isSignUp
    ? 'Open your account'
    : isForgot
      ? 'Reset your password'
      : isReset
        ? 'Choose a new password'
        : signInStep === 'otp'
          ? 'Enter verification code'
          : 'Welcome back'

  const subtitle = isSignUp
    ? 'Get started with fee-free banking in minutes.'
    : isForgot
      ? 'Enter your email and we will send a reset link.'
      : isReset
        ? 'Enter and confirm your new password.'
        : signInStep === 'otp'
          ? 'We emailed a 6-digit code. Enter it to finish signing in.'
          : 'Log in to access your accounts.'

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <ApexLogo className="h-7 w-7 text-sidebar-primary" />
          <span className="text-lg font-bold tracking-tight">Apex Bank</span>
        </Link>
        <div className="max-w-sm">
          <p className="text-balance text-2xl font-semibold leading-snug">
            &ldquo;Switching to Apex was the easiest financial decision I&apos;ve
            ever made.&rdquo;
          </p>
          <p className="mt-4 text-sm text-sidebar-foreground/70">
            — A very satisfied (fictional) member
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">
          Member FDIC · Deposits insured up to $250,000
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <ApexLogo className="h-7 w-7 text-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Apex Bank
            </span>
          </Link>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {isSignUp && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Jordan Lee"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    max={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">U.S. phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </>
            )}

            {((isSignIn && signInStep === 'credentials') ||
              isSignUp ||
              isForgot) &&
              !isReset && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={isSignIn && signInStep !== 'credentials'}
                  />
                </div>
              )}

            {((isSignIn && signInStep === 'credentials') ||
              isSignUp ||
              isReset) &&
              !isForgot && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">
                    {isReset ? 'New password' : 'Password'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isSignIn ? 1 : 8}
                    autoComplete={
                      isSignUp || isReset ? 'new-password' : 'current-password'
                    }
                    placeholder={
                      isSignUp || isReset
                        ? 'At least 8 characters'
                        : '••••••••'
                    }
                    disabled={isSignIn && signInStep !== 'credentials'}
                  />
                </div>
              )}

            {(isSignUp || isReset) && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                />
              </div>
            )}

            {isSignIn && signInStep === 'otp' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.4em]"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-emerald-600" role="status">
                {success}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full text-base"
            >
              {loading
                ? 'Please wait…'
                : isSignUp
                  ? 'Create account'
                  : isForgot
                    ? 'Send reset link'
                    : isReset
                      ? 'Update password'
                      : signInStep === 'otp'
                        ? 'Verify and sign in'
                        : 'Log in'}
            </Button>

            {isSignIn && signInStep === 'otp' && (
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setSignInStep('credentials')
                  setAttemptId(null)
                  setOtp('')
                  setError(null)
                  setSuccess(null)
                }}
              >
                ← Back
              </button>
            )}
          </form>

          {mode === 'sign-in' && signInStep === 'credentials' && (
            <p className="mt-4 text-center text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </p>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <Link
                  href="/sign-in"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Log in
                </Link>
              </>
            ) : isForgot || isReset ? (
              <>
                Remembered it?{' '}
                <Link
                  href="/sign-in"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Log in
                </Link>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <Link
                  href="/sign-up"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Open one
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  )
}
