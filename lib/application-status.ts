import { getProduct } from '@/lib/products'

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export function statusForNewProduct(productId?: string | null): ApplicationStatus {
  return getProduct(productId) ? 'pending' : 'approved'
}

export function isCreditCardProduct(productId?: string | null) {
  return getProduct(productId)?.category === 'credit-card'
}

export function isPendingCreditApplication(input: {
  selectedProduct?: string | null
  applicationStatus?: string | null
  approvedProductIds?: string[]
}) {
  if ((input.approvedProductIds || []).length > 0) return false
  if (String(input.applicationStatus || '') === 'approved') return false
  return String(input.applicationStatus || 'pending') !== 'approved'
}
