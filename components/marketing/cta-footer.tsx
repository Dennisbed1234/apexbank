import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ApexLogo } from '@/components/apex-logo'
import { BANK_NAME, BANK_SHORT_NAME } from '@/lib/bank-constants'

export function CtaFooter() {
  return (
    <>
      <section
        id="security"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24"
      >
        <div className="flex flex-col items-center gap-6 rounded-3xl bg-sidebar px-6 py-14 text-center text-sidebar-foreground sm:px-12">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Open your {BANK_SHORT_NAME} account today.
          </h2>
          <p className="max-w-lg text-pretty text-lg text-sidebar-foreground/80">
            It takes about three minutes. No paperwork, no branch visit, and no
            monthly fees ever.
          </p>
          <Button
            size="lg"
            className="h-12 bg-sidebar-primary px-8 text-base text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
            nativeButton={false}
            render={<Link href="/sign-up" />}
          >
            Get started
          </Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <ApexLogo className="h-6 w-6 text-primary" />
            <span className="font-bold text-foreground">{BANK_NAME}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {BANK_NAME}. Member FDIC. Equal Housing Lender.
          </p>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {BANK_NAME}
          </p>
        </div>
      </footer>
    </>
  )
}
