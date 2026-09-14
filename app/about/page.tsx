import type { Metadata } from 'next'
import { Shield, Globe2, LineChart, Headphones } from 'lucide-react'
import { SiteHeader } from '@/components/marketing/site-header'
import { CtaFooter } from '@/components/marketing/cta-footer'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { BANK_ADDRESS, BANK_NAME } from '@/lib/bank-constants'

export const metadata: Metadata = {
  title: `About Us | ${BANK_NAME}`,
  description:
    'Nicolet National Bank bridges institutional security and modern digital banking for individuals, entrepreneurs, and enterprises.',
}

const reasons = [
  {
    icon: Shield,
    title: 'Uncompromised Security',
    body: 'Built with bank-grade encryption and multi-factor authorization protocols to keep your funds and data fully protected around the clock.',
  },
  {
    icon: Globe2,
    title: 'Global Access, Zero Friction',
    body: 'Manage transfers, monitor international transactions, and oversee account operations seamlessly from anywhere in the world.',
  },
  {
    icon: LineChart,
    title: 'Real-Time Financial Intelligence',
    body: 'Track payments, inspect accounts, and deploy funds with real-time balance updates and transparent analytics.',
  },
  {
    icon: Headphones,
    title: 'Client-First Support',
    body: 'Dedicated financial assistance tailored to meet the dynamic needs of individuals, entrepreneurs, and corporations alike.',
  },
]

const team = [
  {
    name: 'Maria Chen',
    role: 'Founder & CEO',
    bio: 'Maria spent a decade in fintech before founding Nicolet to make fee-free banking the default, not the exception.',
    initials: 'MC',
  },
  {
    name: 'David Okafor',
    role: 'Chief Technology Officer',
    bio: 'David leads engineering, focused on building banking infrastructure that is fast, secure, and simple.',
    initials: 'DO',
  },
  {
    name: 'Sofia Reyes',
    role: 'Chief Operating Officer',
    bio: 'Sofia oversees operations and compliance, ensuring every Nicolet member is protected and well served.',
    initials: 'SR',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            About us
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Welcome to {BANK_NAME}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            At Nicolet, we believe that modern financial management should be
            effortless, secure, and built around your speed. Headquartered in the
            United States, {BANK_NAME} was created to bridge the gap
            between world-class institutional security and modern digital banking.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Whether you are managing personal wealth, scaling an enterprise, or
            navigating global markets, our platform delivers an intuitive digital
            experience engineered to give you total control over your financial
            ecosystem.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Headquarters · {BANK_ADDRESS}
          </p>
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Why Choose Nicolet?
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {reasons.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Our Commitment
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            We are more than just a financial platform. We are your strategic
            financial partner. {BANK_NAME} combines American
            regulatory standards with modern web technology to make banking fast,
            transparent, and completely borderless.
          </p>
          <p className="mt-4 text-base font-medium text-foreground">
            Empower your financial future with Nicolet today.
          </p>
        </section>

        <section className="mt-16">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground">
            Leadership
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
            The team guiding {BANK_NAME}.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {team.map((person) => (
              <div
                key={person.name}
                className="flex flex-col items-center rounded-xl border border-border/60 bg-card p-6 text-center"
              >
                <Avatar className="size-20">
                  <AvatarFallback className="text-lg font-semibold">
                    {person.initials}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {person.name}
                </h3>
                <p className="text-sm font-medium text-primary">{person.role}</p>
                <p className="mt-2 text-sm text-muted-foreground">{person.bio}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <CtaFooter />
    </div>
  )
}
