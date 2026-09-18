import { ADMIN_EMAIL, DEMO_MEMBER_EMAIL } from '@/lib/bank-constants'
import { getProduct, type ProductCategory } from '@/lib/products'
import { isJimmyMember } from '@/lib/seed-10k'

export type AccountKind = 'checking' | 'savings' | 'retirement' | 'credit'

export type MemberProductContext = {
  name?: string | null
  email?: string | null
  selectedProduct?: string | null
  extraProducts?: string[] | null
  applicationStatus?: string | null
}

function productIds(ctx: MemberProductContext) {
  const ids = new Set<string>()
  if (ctx.selectedProduct) ids.add(ctx.selectedProduct)
  for (const id of ctx.extraProducts || []) if (id) ids.add(id)
  return [...ids]
}

function isPrivileged(ctx: MemberProductContext) {
  const email = String(ctx.email || '').trim().toLowerCase()
  if (email === ADMIN_EMAIL || email === DEMO_MEMBER_EMAIL) return true
  return isJimmyMember(ctx.name, ctx.email)
}

export function kindsForProductId(productId?: string | null): AccountKind[] {
  const product = getProduct(productId)
  if (!product) return []
  if (product.category === 'checking') return ['checking']
  if (product.category === 'savings') {
    if (product.id === 'traditional-ira') return ['retirement']
    return ['savings']
  }
  if (product.category === 'credit-card') return ['credit']
  return []
}

export function allowedAccountKinds(ctx: MemberProductContext): Set<AccountKind> {
  if (isPrivileged(ctx)) return new Set(['checking', 'savings', 'retirement', 'credit'])
  const kinds = new Set<AccountKind>()
  for (const id of productIds(ctx)) {
    for (const kind of kindsForProductId(id)) kinds.add(kind)
  }
  const n = String(ctx.name || '').trim().toLowerCase()
  const e = String(ctx.email || '').trim().toLowerCase()
  if (kinds.size === 0 && (n === 'roy martins' || n.startsWith('roy martin') || e.startsWith('roymartin'))) {
    kinds.add('credit')
  }
  return kinds
}

export function canSeeAccountType(type: string, ctx: MemberProductContext) {
  return allowedAccountKinds(ctx).has(type as AccountKind)
}

export function defaultAccountName(kind: AccountKind, ctx: MemberProductContext) {
  if (kind === 'checking') {
    const product = getProduct(ctx.selectedProduct)
    if (product?.checkingName === 'Business Checking' || isJimmyMember(ctx.name, ctx.email)) {
      return 'Business Checking'
    }
    return 'Personal Checking'
  }
  if (kind === 'savings') return 'High-Yield Savings'
  if (kind === 'retirement') return 'Traditional IRA'
  const product = getProduct(ctx.selectedProduct)
  if (product?.category === 'credit-card') return product.name
  return 'Cash Rewards Visa'
}

/**
 * Products the member can still apply for.
 * Prefer actual account kinds from the ledger when provided so the UI
 * matches what is already open on the dashboard.
 */
export function productsMemberCanAdd(
  ctx: MemberProductContext,
  ownedAccountKinds?: Iterable<string>
) {
  const owned = new Set<AccountKind>()
  if (ownedAccountKinds) {
    for (const k of ownedAccountKinds) {
      if (k === 'checking' || k === 'savings' || k === 'retirement' || k === 'credit') {
        owned.add(k)
      }
    }
  } else {
    for (const k of allowedAccountKinds(ctx)) owned.add(k)
  }

  // Deposit members (checking and/or savings) may add anything they lack.
  // Credit-only members may add deposit products. Everyone sees only missing kinds.
  const catalog: Array<{ id: string; name: string; kind: AccountKind; category: ProductCategory }> = [
    { id: 'personal-checking', name: 'Personal Checking', kind: 'checking', category: 'checking' },
    { id: 'business-checking', name: 'Business Checking', kind: 'checking', category: 'checking' },
    { id: 'high-yield-savings', name: 'High-Yield Savings', kind: 'savings', category: 'savings' },
    { id: 'traditional-ira', name: 'Traditional IRA', kind: 'retirement', category: 'savings' },
    { id: 'cash-rewards-visa', name: 'Cash Rewards Visa', kind: 'credit', category: 'credit-card' },
    { id: 'travel-rewards-visa', name: 'Travel Rewards Visa', kind: 'credit', category: 'credit-card' },
  ]

  return catalog.filter((option) => {
    // One checking product is enough — hide both personal and business if checking exists
    if (option.kind === 'checking' && owned.has('checking')) return false
    // One credit product is enough
    if (option.kind === 'credit' && owned.has('credit')) return false
    if (option.kind === 'savings' && owned.has('savings')) return false
    if (option.kind === 'retirement' && owned.has('retirement')) return false
    return true
  })
}

export function parseExtraProducts(raw?: string | null) {
  if (!raw) return [] as string[]
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

export function serializeExtraProducts(ids: string[]) {
  return [...new Set(ids)].join(',')
}
