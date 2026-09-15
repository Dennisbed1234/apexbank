import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BANK_NAME } from '@/lib/bank-constants'

function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div
        className="relative overflow-hidden rounded-[1.4rem] p-6 text-white shadow-2xl"
        style={{
          aspectRatio: '1.586 / 1',
          background:
            'radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.16) 0%, transparent 46%), linear-gradient(145deg, #0b3d2e 0%, #145c43 40%, #1f7a56 70%, #0f2f24 100%)',
          boxShadow:
            '0 30px 60px rgba(15, 47, 36, 0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.22em] text-white/90">NICOLET</p>
            <p className="mt-1 text-sm font-semibold tracking-wide">{BANK_NAME}</p>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">Visa Debit</p>
        </div>
        <div className="mt-8 flex items-center gap-3">
          <div className="h-10 w-12 rounded-md" style={{ background: 'linear-gradient(145deg, #e8d5a3 0%, #c9a84c 40%, #f0e0b0 60%, #b8923a 100%)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18)' }} />
          <div className="h-4 w-5 rounded-sm border border-white/35" />
        </div>
        <p className="mt-8 font-mono text-lg tracking-[0.18em] text-white/95 sm:text-xl">••••  ••••  ••••  5822</p>
        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/55">Cardholder</p>
            <p className="text-sm font-semibold tracking-wide">MEMBER</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold italic tracking-wide">VISA</p>
            <p className="text-[10px] text-white/60">Debit</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            FDIC insured up to $250,000
          </span>
          <h1 className="text-pretty text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Banking that works as hard as you do.
          </h1>
          <p className="max-w-md text-pretty text-lg leading-relaxed text-muted-foreground">
            Fee-free checking, high-yield savings, and instant transfers, all in one beautifully simple app. Open an account in minutes.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-6 text-base" nativeButton={false} render={<Link href="/sign-up" />}>
              Open your account
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6 text-base" nativeButton={false} render={<a href="#features" />}>
              See how it works
            </Button>
          </div>
          <dl className="mt-4 flex gap-8">
            <div>
              <dt className="text-sm text-muted-foreground">APY on savings</dt>
              <dd className="text-2xl font-bold text-foreground">4.30%</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Monthly fees</dt>
              <dd className="text-2xl font-bold text-foreground">$0</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Members</dt>
              <dd className="text-2xl font-bold text-foreground">2.4M</dd>
            </div>
          </dl>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-primary/5" />
          <div className="relative">
            <HeroCard />
          </div>
        </div>
      </div>
    </section>
  )
}
