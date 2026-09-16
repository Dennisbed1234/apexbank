import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { ensureSeeded, getAccounts, getTransactions } from '@/app/actions/banking'
import {
  listOutboundPayments,
  processDueWires,
} from '@/app/actions/outbound'
import { getProfileSettings } from '@/app/actions/settings'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { AccountCard } from '@/components/dashboard/account-card'
import { TransferDialog } from '@/components/dashboard/transfer-dialog'
import { SendExternal } from '@/components/dashboard/send-external'
import { MobileDeposit } from '@/components/dashboard/mobile-deposit'
import { ScheduledPayments } from '@/components/dashboard/scheduled-payments'
import { TransactionsList } from '@/components/dashboard/transactions-list'
import { DebitCard } from '@/components/dashboard/debit-card'
import { ApplicationPending } from '@/components/dashboard/application-pending'
import { AddProducts } from '@/components/dashboard/add-products'
import {
  ADMIN_EMAIL,
  DEMO_MEMBER_EMAIL,
  SHARED_CHECKING_NUMBER,
} from '@/lib/bank-constants'
import { ensureRetirementAccount } from '@/lib/ensure-retirement'
import { issueVisaCard } from '@/lib/visa-card'
import { isAnaMontoya, seedAnaMontoyaIfPresent } from '@/lib/seed-ana'
import {
  applyJimmyChecking,
  isDennisBedendender,
  isJimmyMember,
  seedLargeHistoryForUser,
} from '@/lib/seed-10k'
import { relabelJimmyMerchants } from '@/lib/jimmy-relabel'
import { ensureCheckingProductName } from '@/lib/account-products'
import { isHiddenLedgerRow } from '@/lib/ledger-privacy'
import { db } from '@/lib/db'
import { bankAccount } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import {
  ensureProductAccounts,
  loadMemberProductContext,
  visibleAccounts,
} from '@/lib/member-accounts'
import { productsMemberCanAdd } from '@/lib/member-products'
import { isPendingCreditApplication } from '@/lib/application-status'
import { getProduct } from '@/lib/products'
import { provisionApprovedProduct } from '@/lib/product-applications'
import { generateDailyActivityForUser } from '@/lib/daily-activity'
import { activateApprovedMember } from '@/lib/approved-member'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

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

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const email = String(session.user.email || '').trim().toLowerCase()
  const privileged =
    email === ADMIN_EMAIL ||
    email === DEMO_MEMBER_EMAIL ||
    isJimmyMember(session.user.name, session.user.email) ||
    isDennisBedendender(session.user.name, session.user.email) ||
    isAnaMontoya(session.user.name, session.user.email)

  const ctx = await loadMemberProductContext(session.user.id)
  const activated = await activateApprovedMember({
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    selectedProduct: ctx.selectedProduct,
    applicationStatus: ctx.applicationStatus,
  }).catch(() => ({ open: false, approvedIds: [] as string[], hasAccounts: false }))

  const approvedIds = activated.approvedIds || []
  for (const productId of approvedIds) {
    await provisionApprovedProduct(session.user.id, productId).catch(() => undefined)
  }
  const selected = getProduct(ctx.selectedProduct)

  if (
    !activated.open &&
    isPendingCreditApplication({
      ...ctx,
      approvedProductIds: approvedIds,
    }) &&
    !privileged
  ) {
    return (
      <ApplicationPending
        name={session.user.name}
        email={session.user.email}
        productName={selected?.name || 'credit card'}
      />
    )
  }

  if (privileged) {
    await ensureSeeded()
  } else {
    await ensureProductAccounts({
      ...ctx,
      extraProducts: [...(ctx.extraProducts || []), ...approvedIds],
      applicationStatus: 'approved',
      userId: session.user.id,
    }).catch(() => undefined)
  }

  if (isAnaMontoya(session.user.name, session.user.email)) {
    await seedAnaMontoyaIfPresent().catch(() => undefined)
  }
  if (isJimmyMember(session.user.name, session.user.email)) {
    await seedLargeHistoryForUser(
      session.user.id,
      session.user.name,
      session.user.email
    ).catch(() => undefined)
    await relabelJimmyMerchants(session.user.id).catch(() => undefined)
    const ownedJimmy = await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, session.user.id))
    const checking = ownedJimmy.find((a) => a.type === 'checking')
    if (checking) {
      await applyJimmyChecking(session.user.id, checking.id).catch(() => undefined)
    }
  }

  const owned = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, session.user.id))
  const checkingOwned = owned.find((a) => a.type === 'checking')
  if (checkingOwned) {
    await ensureCheckingProductName({
      userId: session.user.id,
      checkingId: checkingOwned.id,
      memberName: session.user.name,
      memberEmail: session.user.email,
    }).catch(() => undefined)
  }

  if (privileged) {
    await ensureRetirementAccount({
      userId: session.user.id,
      isAdmin: email === ADMIN_EMAIL,
      isDemo: email === DEMO_MEMBER_EMAIL,
    })
  }
  await processDueWires().catch(() => undefined)
  await generateDailyActivityForUser({
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
  }).catch(() => undefined)

  const refreshedCtx = {
    ...ctx,
    extraProducts: [...(ctx.extraProducts || []), ...approvedIds],
    applicationStatus: 'approved',
  }

  const [rawAccounts, transactions, outbound, profile] = await Promise.all([
    getAccounts(),
    getTransactions(250),
    listOutboundPayments().catch(() => []),
    getProfileSettings().catch(() => ({
      name: session.user.name || 'Member',
      email: session.user.email || '',
      phone: '',
      kyc: null as null,
    })),
  ])

  const accounts = visibleAccounts(rawAccounts, refreshedCtx)
  const visibleIds = new Set(accounts.map((a) => a.id))

  const firstName = session.user.name?.split(' ')[0] || 'there'
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]))
  const checking =
    accounts.find((a) => a.type === 'checking') ?? accounts[0]
  const accountNumber = checking?.accountNumber || SHARED_CHECKING_NUMBER
  const visa = issueVisaCard(session.user.id)
  const addOptions = productsMemberCanAdd(refreshedCtx)

  const seen = new Set<string>()
  const rows = transactions
    .filter((t) => visibleIds.has(t.accountId))
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
      accountName: accountNameById.get(t.accountId) ?? 'Account',
    }))
    .filter((t) => {
      const key = activityKey(t.description, t.amountCents, t.createdAt)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader name={session.user.name} email={session.user.email} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Here's what's happening with your money.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {accounts.length >= 2 && <TransferDialog accounts={accounts} />}
            {accounts.length >= 1 && <SendExternal accounts={accounts} />}
            {accounts.length >= 1 && <MobileDeposit accounts={accounts} />}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>

        <div className="mt-8">
          <AddProducts options={addOptions.map((o) => ({ id: o.id, name: o.name }))} />
        </div>

        {accounts.some((a) => a.type === 'checking' || a.type === 'credit') && (
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
        )}

        <div className="mt-8">
          <ScheduledPayments payments={outbound} />
        </div>

        <div className="mt-8">
          <TransactionsList transactions={rows} />
        </div>
      </main>
    </div>
  )
}
