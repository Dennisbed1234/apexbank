'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, LogOut, Mail, Settings, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { emailMyStatement } from '@/app/actions/email-statement'
import { ApexLogo } from '@/components/apex-logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ADMIN_EMAIL } from '@/lib/bank-constants'

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export function DashboardHeader({
  name,
  email,
}: {
  name: string
  email: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [months, setMonths] = useState(12)
  const menuRef = useRef<HTMLDivElement>(null)
  const safeName = name?.trim() || 'Account'
  const safeEmail = email?.trim() || ''
  const isAdmin = safeEmail.toLowerCase() === ADMIN_EMAIL

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
    fetch('/api/seed-history', { method: 'POST', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.results) return
        const incomplete = data.results.some((row: { done?: boolean }) => !row.done)
        if (!incomplete) return
        router.refresh()
      })
      .catch(() => undefined)
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
      const res = await fetch(`/api/statement?months=${months}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        toast.error('Could not download statement')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `apex-${months}mo-statement-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${months}-month statement downloaded`)
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
      const result = await emailMyStatement(months)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`${months}-month statement emailed to ${safeEmail || 'your inbox'}`)
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
            Apex Bank
          </span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 items-center gap-2 rounded-md px-2 hover:bg-accent"
          >
            <Avatar className="size-7">
              <AvatarFallback className="text-xs font-semibold">
                {initials || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium text-foreground sm:inline">
              {safeName}
            </span>
          </button>

          {open && (
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
              <div className="px-2 py-1.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{safeName}</span>
                  <span className="truncate text-xs text-muted-foreground">{safeEmail}</span>
                </div>
              </div>
              <div className="my-1 h-px bg-border" />
              <Link
                href="/dashboard/settings"
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                <Settings className="size-4" />
                Settings
              </Link>
              <label className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm">
                <span>Statement period</span>
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs"
                >
                  {PERIODS.map((n) => (
                    <option key={n} value={n}>
                      {n} month{n === 1 ? '' : 's'}
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
                {downloading ? 'Preparing PDF…' : `Download ${months}-month PDF`}
              </button>
              <button
                type="button"
                disabled={emailing || !safeEmail}
                onClick={emailStatement}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              >
                <Mail className="size-4" />
                {emailing ? 'Emailing PDF…' : `Email ${months}-month PDF`}
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
