import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getAccounts } from '@/app/actions/banking'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { PayCreditBalance } from '@/components/dashboard/pay-credit-balance'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PayCreditPage({
  searchParams,
}: {
  searchParams?: Promise<{ accountId?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const params = (await searchParams) || {}
  const accounts = await getAccounts()
  const creditAccounts = accounts.filter((a) => a.type === 'credit')
  if (!creditAccounts.length) redirect('/dashboard')

  const requestedId = params.accountId ? Number(params.accountId) : null
  const card =
    (requestedId && creditAccounts.find((a) => a.id === requestedId)) ||
    creditAccounts[0]

  const hasDeposit = accounts.some((a) => a.type === 'checking' || a.type === 'savings')

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader
        name={session.user.name}
        email={session.user.email}
        showDebitCardLink={hasDeposit}
        showPayCreditLink
      />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: 'default', size: 'default' }),
            'gap-1.5 px-4 shadow-sm'
          )}
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Pay credit balance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{card.name}</p>
        </div>

        {creditAccounts.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {creditAccounts.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/pay-credit?accountId=${c.id}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  c.id === card.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6">
          <PayCreditBalance
            creditAccountId={card.id}
            currentBalanceCents={Math.max(0, Number(card.balanceCents || 0))}
          />
        </div>
      </main>
    </div>
  )
}
