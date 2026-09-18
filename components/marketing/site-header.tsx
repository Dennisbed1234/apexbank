'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApexLogo } from '@/components/apex-logo'

export function SiteHeader() {
  const [legalOpen, setLegalOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const legalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (legalRef.current && !legalRef.current.contains(e.target as Node)) {
        setLegalOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <ApexLogo className="h-10 w-auto rounded-sm" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="/#accounts"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Accounts
          </a>
          <a
            href="/#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="/#security"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Security
          </a>
          <Link
            href="/about"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            About
          </Link>

          <div className="relative" ref={legalRef}>
            <button
              type="button"
              onClick={() => setLegalOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              aria-expanded={legalOpen}
            >
              Legal
              <ChevronDown className={`size-3.5 transition ${legalOpen ? 'rotate-180' : ''}`} />
            </button>
            {legalOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-lg border border-border bg-background p-1.5 shadow-lg">
                <Link
                  href="/legal#privacy"
                  className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => setLegalOpen(false)}
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/legal#terms"
                  className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => setLegalOpen(false)}
                >
                  Terms of Use
                </Link>
                <Link
                  href="/legal#contact"
                  className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => setLegalOpen(false)}
                >
                  Contact &amp; rights
                </Link>
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            Log in
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/sign-up" />}>
            Open account
          </Button>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            <a href="/#accounts" className="rounded-md px-2 py-2 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
              Accounts
            </a>
            <a href="/#features" className="rounded-md px-2 py-2 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
              Features
            </a>
            <Link href="/about" className="rounded-md px-2 py-2 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
              About
            </Link>
            <Link href="/legal#privacy" className="rounded-md px-2 py-2 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
              Privacy Policy
            </Link>
            <Link href="/legal#terms" className="rounded-md px-2 py-2 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
              Terms of Use
            </Link>
            <Link href="/sign-in" className="rounded-md px-2 py-2 text-sm hover:bg-muted" onClick={() => setMobileOpen(false)}>
              Log in
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
