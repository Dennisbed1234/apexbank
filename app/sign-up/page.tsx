import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ProductPicker } from '@/components/product-picker'
import { SignupForm } from '@/components/signup-form'
import { getProduct } from '@/lib/products'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/dashboard')

  const params = await searchParams
  const product = getProduct(params.product)
  if (!product) return <ProductPicker />

  return <SignupForm product={product} />
}
