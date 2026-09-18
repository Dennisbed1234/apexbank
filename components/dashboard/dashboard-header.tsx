'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CreditCard, FileText, LogOut, Mail, Settings, Shield, User, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { emailMyStatement } from '@/app/actions/email-statement'
import { ApexLogo } from '@/components/apex-logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ADMIN_EMAIL, BANK_NAME } from '@/lib/bank-constants'

function buildMonthOptions(count = 12) {
  const out: Array<{ key: string; label: string }> = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
    }).format(d)
    out.push({ key, label })
  }
  return out
}

export function DashboardHeader({
  name,
  email,
  showDebitCardLink = false,
  showPayCreditLink = false,
}: {
  name: string
  email: string
  showDebitCardLink?: boolean
  /** Show Pay credit balance in the account dropdown */
  showPayCreditLink?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const monthOptions = useMemo(() => buildMonthOptions(12), [])
  const [monthKey, setMonthKey] = useState(monthOptions[0]?.key || '')
  const menuRef = useRef<HTMLDivElement>(null)
  const safeName = name?.trim() || 'Account'
  const safeEmail = email?.trim() || ''
  const isAdmin = safeEmail.toLowerCase() === ADMIN_EMAIL
  const selectedLabel =
    monthOptions.find((m) => m.key === monthKey)?.label || 'this month'
  const monthNameOnly = selectedLabel.replace(/\s+\d{4}$/, '')

  const initials = safeName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fillHistory() {
      for (let i = 0; i < 8 && !cancelled; i++) {
        const res = await fetch('/api/seed-history', {
          method: 'POST',
          credentials: 'include',
        })
        const data = res.ok ? await res.json() : null
        if (cancelled) return
        if (!data || data.skipped) return
        const row = Array.isArray(data.results) ? data.results[0] : null
        if (!row || row.done) {
          router.refresh()
          return
        }
        router.refresh()
      }
    }

    fillHistory().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSignOut() {
    await authClient.signOut()
    router.push('/')
    router.refresh()
  }

  async function downloadStatement() {
    setOpen(false)
    setDownloading(true)
    try {
      const res = await fetch(
        `/api/statement?month=${encodeURIComponent(monthKey)}`,
        { credentials: 'include' }
      )
      if (!res.ok) {
        toast.error('Could not download statement')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${BANK_NAME} ${monthNameOnly} Statement.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${monthNameOnly} statement downloaded`)
    } catch {
      toast.error('Download failed. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  async function emailStatement() {
    setOpen(false)
    setEmailing(true)
    try {
      const result = await emailMyStatement(monthKey)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${result.title || monthNameOnly + ' statement'} emailed to ${safeEmail || 'your inbox'}`
      )
    } catch {
      toast.error('Could not email statement.')
    } finally {
      setEmailing(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <ApexLogo className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            {BANK_NAME}
          </span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[140px] truncate sm:inline">
              {safeName}
            </span>
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-background p-1.5 shadow-lg">
              <div className="border-b border-border px-2 py-2">
                <p className="truncate text-sm font-medium">{safeName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {safeEmail}
                </p>
              </div>
              <Link
                href="/dashboard/profile"
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <User className="size-4" />
                Profile
              </Link>
              <Link
                href="/dashboard/settings"
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <Settings className="size-4" />
                Settings
              </Link>
              {showDebitCardLink && (
                <Link
                  href="/dashboard/cards"
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  <CreditCard className="size-4" />
                  Debit card
                </Link>
              )}
              {showPayCreditLink && (
                <Link
                  href="/dashboard/pay-credit"
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  <Wallet className="size-4" />
                  Pay credit balance
                </Link>
              )}
              <label className="flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-sm">
                <span className="text-muted-foreground">Statement month</span>
                <select
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                  className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
                >
                  {monthOptions.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={downloading}
                onClick={downloadStatement}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                <FileText className="size-4" />
                {downloading
                  ? 'Preparing PDF…'
                  : `Download ${monthNameOnly} statement`}
              </button>
              <button
                type="button"
                disabled={emailing || !safeEmail}
                onClick={emailStatement}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                <Mail className="size-4" />
                {emailing
                  ? 'Emailing PDF…'
                  : `Email ${monthNameOnly} statement`}
              </button>
              {isAdmin && (
                <Link
                  href="/ops"
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  <Shield className="size-4" />
                  Operations desk
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
