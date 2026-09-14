import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
            Fee-free checking, high-yield savings, and instant transfers, all
            in one beautifully simple app. Open an account in minutes.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-12 px-6 text-base"
              nativeButton={false}
              render={<Link href="/sign-up" />}
            >
              Open your account
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base"
              nativeButton={false}
              render={<a href="#features" />}
            >
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
          <Image
            src="/hero-card.png"
            alt="Nicolet National Bank premium debit card"
            width={640}
            height={640}
            priority
            className="relative mx-auto w-full max-w-md drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  )
}
