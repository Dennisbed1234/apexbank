import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getAccounts } from '@/app/actions/banking'
import { getProfileSettings } from '@/app/actions/settings'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DebitCard } from '@/components/dashboard/debit-card'
import { SHARED_CHECKING_NUMBER } from '@/lib/bank-constants'
import { issueVisaCard } from '@/lib/visa-card'

export const dynamic = 'force-dynamic'

export default async function CardsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const accounts = await getAccounts()
  const hasDeposit = accounts.some((a) => a.type === 'checking' || a.type === 'savings')
  if (!hasDeposit) redirect('/dashboard')

  const hasCredit = accounts.some((a) => a.type === 'credit')
  const checking = accounts.find((a) => a.type === 'checking') ?? accounts[0]
  const accountNumber = checking?.accountNumber || SHARED_CHECKING_NUMBER
  const debitVisa = issueVisaCard(session.user.id)
  const profile = await getProfileSettings().catch(() => ({
    name: session.user.name || 'Member',
    email: session.user.email || '',
    phone: '',
    kyc: null as null,
  }))
  const kycStatus = profile.kyc?.status ?? null

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader
        name={session.user.name}
        email={session.user.email}
        showDebitCardLink
        showCreditCardLink={hasCredit}
        showPayCreditLink={hasCredit}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Debit card</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Linked to your checking account. Order a physical card after identity verification.
          </p>
        </div>
        <div className="mt-8">
          <DebitCard
            memberName={session.user.name || 'Member'}
            accountNumber={accountNumber}
            cardNumber={debitVisa.formatted}
            cardExp={debitVisa.exp}
            cardCvv={debitVisa.cvv}
            kycStatus={kycStatus}
          />
        </div>
      </main>
    </div>
  )
}
