import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getAccounts } from '@/app/actions/banking'
import { getProfileSettings } from '@/app/actions/settings'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { MemberCreditCard } from '@/components/dashboard/member-credit-card'
import { issueCreditCard } from '@/lib/credit-card'
import { getProduct } from '@/lib/products'
import { loadMemberProductContext } from '@/lib/member-accounts'

export const dynamic = 'force-dynamic'

function resolveCreditProduct(
  cardName: string,
  selectedProduct?: string | null,
  extraProducts?: string[] | null
) {
  const selected = getProduct(selectedProduct)
  if (selected?.category === 'credit-card' && selected.name === cardName) return selected
  for (const id of extraProducts || []) {
    const p = getProduct(id)
    if (p?.category === 'credit-card' && p.name === cardName) return p
  }
  if (selected?.category === 'credit-card') return selected
  return getProduct('cash-rewards-visa')
}

export default async function CreditCardPage({
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
  const ctx = await loadMemberProductContext(session.user.id)
  const product = resolveCreditProduct(card.name, ctx.selectedProduct, ctx.extraProducts)
  const issued = issueCreditCard(session.user.id, {
    productId: product?.id,
    productName: product?.name || card.name,
  })

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
        showDebitCardLink={hasDeposit}
        showCreditCardLink
        showPayCreditLink
      />
      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        {creditAccounts.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {creditAccounts.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/credit-card?accountId=${c.id}`}
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
          <MemberCreditCard
            memberName={session.user.name || 'Member'}
            cardNumber={issued.formatted}
            cardExp={issued.exp}
            cardCvv={issued.cvv}
            network={issued.network}
            productName={product?.name || card.name}
            kycStatus={kycStatus}
            accountId={card.id}
            showActivityLink
          />
        </div>
      </main>
    </div>
  )
}
