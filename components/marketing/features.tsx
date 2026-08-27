import {
  Zap,
  PiggyBank,
  ShieldCheck,
  LineChart,
  CreditCard,
  Trees,
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: 'Instant transfers',
    body: 'Move money between checking, savings, and retirement in real time — no waiting days for it to clear.',
  },
  {
    icon: PiggyBank,
    title: 'High-yield savings',
    body: 'Earn 4.30% APY automatically. No minimums, no lock-ups, no surprises.',
  },
  {
    icon: Trees,
    title: 'Retirement accounts',
    body: 'Open a Traditional IRA next to your everyday accounts. Contribute from checking or savings anytime.',
  },
  {
    icon: LineChart,
    title: 'Real-time insights',
    body: 'See where your money goes with automatic categorization and clear spending breakdowns.',
  },
  {
    icon: CreditCard,
    title: 'Fee-free checking',
    body: 'No monthly fees, no overdraft fees, and access to 55,000+ ATMs nationwide.',
  },
  {
    icon: ShieldCheck,
    title: 'Bank-grade security',
    body: 'Your deposits are FDIC insured and protected with encryption and fraud monitoring.',
  },
]

export function Features() {
  return (
    <section id="features" className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need, nothing you don't.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Apex Bank brings your entire financial life into one place, with the
            tools to help your money grow.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-background p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {f.title}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
