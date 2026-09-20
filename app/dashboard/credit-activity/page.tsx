import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getAccounts, getTransactions } from '@/app/actions/banking'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { TransactionsList } from '@/components/dashboard/transactions-list'
import { isHiddenLedgerRow } from '@/lib/ledger-privacy'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function activityKey(description: string, amountCents: number, createdAt: string) {
  const day = createdAt.slice(0, 10)
  const base = description
    .replace(/\s+[\u2014\-]\s+.*$/, '')
    .replace(/\s+\(pending review\)$/i, '')
    .replace(/\s+\(processing\)$/i, '')
    .trim()
    .toLowerCase()
  return `${base}|${amountCents}|${day}`
}

export default async function CreditActivityPage({
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
  const transactions = await getTransactions(250)
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]))

  const seen = new Set<string>()
  const rows = transactions
    .filter((t) => t.accountId === card.id)
    .filter((t) => !isHiddenLedgerRow(t.description, t.amountCents))
    .map((t) => ({
      id: t.id,
      accountId: t.accountId,
      amountCents: t.amountCents,
      type: t.type,
      description: t.description,
      category: t.category,
      counterparty: t.counterparty,
      createdAt:
        t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
      accountName: accountNameById.get(t.accountId) ?? card.name,
    }))
    .filter((t) => {
      const key = activityKey(t.description, t.amountCents, t.createdAt)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader
        name={session.user.name}
        email={session.user.email}
        showDebitCardLink={hasDeposit}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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
            Card activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {card.name} — purchases and payments on this card only.
          </p>
        </div>

        {creditAccounts.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {creditAccounts.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/credit-activity?accountId=${c.id}`}
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

        <div className="mt-8">
          <TransactionsList transactions={rows} />
        </div>
      </main>
    </div>
  )
}
