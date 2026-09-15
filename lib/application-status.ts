import { getProduct } from '@/lib/products'

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export function statusForNewProduct(productId?: string | null): ApplicationStatus {
  const product = getProduct(productId)
  if (product?.category === 'credit-card') return 'pending'
  return 'approved'
}

export function isCreditCardProduct(productId?: string | null) {
  return getProduct(productId)?.category === 'credit-card'
}

export function isPendingCreditApplication(input: {
  selectedProduct?: string | null
  applicationStatus?: string | null
}) {
  return (
    isCreditCardProduct(input.selectedProduct) &&
    String(input.applicationStatus || 'pending') !== 'approved'
  )
}
