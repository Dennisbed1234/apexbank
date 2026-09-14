import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ApexLogo } from '@/components/apex-logo'
import { BANK_NAME } from '@/lib/bank-constants'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <ApexLogo className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            {BANK_NAME}
          </span>
        </Link>
        <Link
          href="/about"
          className="text-sm font-medium text-muted-foreground md:hidden"
        >
          About
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#accounts"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Accounts
          </a>
          <a
            href="#security"
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
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            Log in
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/sign-up" />}>
            Open account
          </Button>
        </div>
      </div>
    </header>
  )
}
