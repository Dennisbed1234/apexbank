import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { ensureSeeded, getAccounts, getTransactions } from '@/app/actions/banking'
import { getProfileSettings } from '@/app/actions/settings'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { AccountCard } from '@/components/dashboard/account-card'
import { TransferDialog } from '@/components/dashboard/transfer-dialog'
import { TransactionsList } from '@/components/dashboard/transactions-list'
import { DebitCard } from '@/components/dashboard/debit-card'
import { SHARED_CHECKING_NUMBER } from '@/lib/bank-constants'
import { issueVisaCard } from '@/lib/visa-card'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  await ensureSeeded()
  const [accounts, transactions, profile] = await Promise.all([
    getAccounts(),
    getTransactions(250),
    getProfileSettings().catch(() => ({
      name: session.user.name || 'Member',
      email: session.user.email || '',
      phone: '',
      kyc: null as null,
    })),
  ])

  const firstName = session.user.name?.split(' ')[0] || 'there'
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]))
  const checking =
    accounts.find((a) => a.type === 'checking') ?? accounts[0]
  const accountNumber = checking?.accountNumber || SHARED_CHECKING_NUMBER
  const visa = issueVisaCard(session.user.id)

  const rows = transactions.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    amountCents: t.amountCents,
    type: t.type,
    description: t.description,
    category: t.category,
    counterparty: t.counterparty,
    createdAt:
      t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt),
    accountName: accountNameById.get(t.accountId) ?? 'Account',
  }))

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader name={session.user.name} email={session.user.email} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Here's what's happening with your money.
            </p>
          </div>
          {accounts.length >= 2 && <TransferDialog accounts={accounts} />}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>

        <div className="mt-8">
          <DebitCard
            memberName={session.user.name || 'Member'}
            accountNumber={accountNumber}
            cardNumber={visa.formatted}
            cardExp={visa.exp}
            cardCvv={visa.cvv}
            kycStatus={profile.kyc?.status ?? null}
          />
        </div>

        <div className="mt-8">
          <TransactionsList transactions={rows} />
        </div>
      </main>
    </div>
  )
}
