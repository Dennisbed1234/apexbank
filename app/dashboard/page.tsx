import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { ensureSeeded, getAccounts, getTransactions } from '@/app/actions/banking'
import {
  listOutboundPayments,
  processDueWires,
} from '@/app/actions/outbound'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { AccountCard } from '@/components/dashboard/account-card'
import { TransferDialog } from '@/components/dashboard/transfer-dialog'
import { SendExternal } from '@/components/dashboard/send-external'
import { MobileDeposit } from '@/components/dashboard/mobile-deposit'
import { ScheduledPayments } from '@/components/dashboard/scheduled-payments'
import { TransactionsList } from '@/components/dashboard/transactions-list'
import { ApplicationPending } from '@/components/dashboard/application-pending'
import { AddProducts } from '@/components/dashboard/add-products'
import {
  ADMIN_EMAIL,
  DEMO_MEMBER_EMAIL,
} from '@/lib/bank-constants'
import { ensureRetirementAccount } from '@/lib/ensure-retirement'
import { ensureDennisIraFiftyMillionWire } from '@/lib/dennis-ira-wire'
import { issueCreditCard } from '@/lib/credit-card'
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
import { and, eq } from 'drizzle-orm'
import {
  ensureProductAccounts,
  loadMemberProductContext,
  visibleAccounts,
} from '@/lib/member-accounts'
import { productsMemberCanAdd } from '@/lib/member-products'
import { isPendingCreditApplication } from '@/lib/application-status'
import { getProduct } from '@/lib/products'
import { provisionApprovedProduct } from '@/lib/product-applications'
import {
  generateDailyActivityForUser,
  reconcileAllBalancesForUser,
} from '@/lib/daily-activity'
import { activateApprovedMember } from '@/lib/approved-member'
import {
  ensureCreditLimitColumn,
  reconcileCreditAccounts,
} from '@/lib/credit-ledger'

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

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const userId = session.user.id
  const email = String(session.user.email || '').trim().toLowerCase()
  const isAdmin = email === ADMIN_EMAIL
  const privileged =
    isAdmin ||
    email === DEMO_MEMBER_EMAIL ||
    isJimmyMember(session.user.name, session.user.email) ||
    isDennisBedendender(session.user.name, session.user.email) ||
    isAnaMontoya(session.user.name, session.user.email)

  await ensureCreditLimitColumn().catch(() => undefined)

  const ctx = await loadMemberProductContext(userId)
  const activated = await activateApprovedMember({
    userId,
    name: session.user.name,
    email: session.user.email,
    selectedProduct: ctx.selectedProduct,
    applicationStatus: ctx.applicationStatus,
  }).catch(() => ({ open: false, approvedIds: [] as string[], hasAccounts: false }))

  const approvedIds = activated.approvedIds || []
  for (const productId of approvedIds) {
    await provisionApprovedProduct(userId, productId).catch(() => undefined)
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
      userId,
    }).catch(() => undefined)
  }

  if (isAnaMontoya(session.user.name, session.user.email)) {
    await seedAnaMontoyaIfPresent().catch(() => undefined)
  }
  if (isJimmyMember(session.user.name, session.user.email)) {
    await seedLargeHistoryForUser(userId, session.user.name, session.user.email).catch(
      () => undefined
    )
    await relabelJimmyMerchants(userId).catch(() => undefined)
    const ownedJimmy = await db
      .select()
      .from(bankAccount)
      .where(eq(bankAccount.userId, userId))
    const checking = ownedJimmy.find((a) => a.type === 'checking')
    if (checking) {
      await applyJimmyChecking(userId, checking.id).catch(() => undefined)
    }
  }

  const owned = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, userId))

  const checkingOwned = owned.find((a) => a.type === 'checking')
  if (checkingOwned) {
    await ensureCheckingProductName({
      userId,
      checkingId: checkingOwned.id,
      memberName: session.user.name,
      memberEmail: session.user.email,
    }).catch(() => undefined)
  }

  if (privileged) {
    await ensureRetirementAccount({
      userId,
      isAdmin,
      isDemo: email === DEMO_MEMBER_EMAIL,
    })
  }

  // One-time $50M direct wire into Dennis Traditional IRA
  if (isDennisBedendender(session.user.name, session.user.email) || email === DEMO_MEMBER_EMAIL) {
    await ensureDennisIraFiftyMillionWire({
      userId,
      name: session.user.name,
      email: session.user.email,
    }).catch(() => undefined)
  }

  await processDueWires().catch(() => undefined)

  await generateDailyActivityForUser({
    userId,
    name: session.user.name,
    email: session.user.email,
  }).catch(() => undefined)
  await reconcileAllBalancesForUser(userId).catch(() => undefined)
  await reconcileCreditAccounts({
    userId,
    name: session.user.name,
    email: session.user.email,
  }).catch(() => undefined)

  for (const row of owned.filter((a) => a.type === 'credit')) {
    if (row.userId !== userId) continue
    const product = resolveCreditProduct(row.name, ctx.selectedProduct, [
      ...(ctx.extraProducts || []),
      ...approvedIds,
    ])
    const issued = issueCreditCard(userId, {
      productId: product?.id,
      productName: product?.name || row.name,
    })
    if (row.accountNumber !== issued.pan) {
      await db
        .update(bankAccount)
        .set({ accountNumber: issued.pan } as any)
        .where(and(eq(bankAccount.id, row.id), eq(bankAccount.userId, userId)))
        .catch(() => undefined)
    }
  }

  const refreshedCtx = {
    ...ctx,
    extraProducts: [...(ctx.extraProducts || []), ...approvedIds],
    applicationStatus: 'approved' as const,
  }

  const [rawAccounts, transactions, outbound] = await Promise.all([
    getAccounts(),
    getTransactions(250),
    listOutboundPayments().catch(() => []),
  ])

  let accounts = visibleAccounts(rawAccounts, refreshedCtx)

  if (isAdmin) {
    const adminHasCreditProduct =
      getProduct(ctx.selectedProduct)?.category === 'credit-card' ||
      approvedIds.some((id) => getProduct(id)?.category === 'credit-card') ||
      (ctx.extraProducts || []).some((id) => getProduct(id)?.category === 'credit-card')
    if (!adminHasCreditProduct) {
      accounts = accounts.filter((a) => a.type !== 'credit')
    }
  }

  const firstName = session.user.name?.split(' ')[0] || 'there'
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]))
  const hasDepositAccount = accounts.some(
    (a) => a.type === 'checking' || a.type === 'savings' || a.type === 'retirement'
  )
  const creditAccounts = accounts.filter((a) => a.type === 'credit')
  const hasCredit = creditAccounts.length > 0
  const hasMultipleAccounts = accounts.length > 1
  /** Credit-only members see card purchases on the main dashboard */
  const creditOnly = hasCredit && !hasDepositAccount && accounts.every((a) => a.type === 'credit')
  const ownedKinds = accounts.map((a) => a.type)
  const addOptions = productsMemberCanAdd(refreshedCtx, ownedKinds)

  const depositAccountIds = new Set(
    accounts.filter((a) => a.type !== 'credit').map((a) => a.id)
  )
  const creditAccountIds = new Set(creditAccounts.map((a) => a.id))

  const creditMeta = new Map(
    creditAccounts.map((card) => {
      const product = resolveCreditProduct(card.name, ctx.selectedProduct, [
        ...(ctx.extraProducts || []),
        ...approvedIds,
      ])
      const issued = issueCreditCard(userId, {
        productId: product?.id,
        productName: product?.name || card.name,
      })
      return [card.id, { product, issued }] as const
    })
  )

  const seen = new Set<string>()
  function mapAndDedupe(
    list: typeof transactions,
    allowIds: Set<number>
  ) {
    return list
      .filter((t) => allowIds.has(t.accountId))
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
  }

  // Multi-product: deposit activity only. Credit-only: card activity on dashboard.
  const activityRows = creditOnly
    ? mapAndDedupe(transactions, creditAccountIds)
    : mapAndDedupe(transactions, depositAccountIds)

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader
        name={session.user.name}
        email={session.user.email}
        showDebitCardLink={hasDepositAccount}
        showCreditCardLink={hasCredit}
        showPayCreditLink={hasCredit}
      />

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
            {hasDepositAccount && <SendExternal accounts={accounts} />}
            {hasDepositAccount && <MobileDeposit accounts={accounts} />}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const meta = creditMeta.get(account.id)
            return (
              <AccountCard
                key={account.id}
                account={account}
                cardLast4={meta?.issued.last4}
                showCreditShortcuts={
                  account.type === 'credit' && hasMultipleAccounts
                }
              />
            )
          })}
        </div>

        {addOptions.length > 0 && (
          <div className="mt-8">
            <AddProducts options={addOptions.map((o) => ({ id: o.id, name: o.name }))} />
          </div>
        )}

        <div className="mt-8">
          <ScheduledPayments payments={outbound} />
        </div>

        <div className="mt-8">
          <p className="mb-3 text-sm font-semibold text-foreground">
            {creditOnly ? 'Card activity' : 'Account activity'}
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            {creditOnly
              ? 'Purchases and payments on your credit card.'
              : hasCredit
                ? 'Checking and savings activity. Card purchases are under View activities on your credit tile.'
                : 'Checking, savings, and other deposit accounts.'}
          </p>
          <TransactionsList transactions={activityRows} />
        </div>
      </main>
    </div>
  )
}
