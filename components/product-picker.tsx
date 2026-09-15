import Link from 'next/link'
import { ApexLogo } from '@/components/apex-logo'
import { BANK_NAME } from '@/lib/bank-constants'
import { BANK_PRODUCTS } from '@/lib/products'

const CATEGORY_LABEL: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  'credit-card': 'Credit cards',
}

export function ProductPicker() {
  return (
    <main className="min-h-svh bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <ApexLogo className="h-10 w-auto rounded-sm" />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Choose a product</h1>
        <p className="mt-2 text-muted-foreground">
          Select one {BANK_NAME} product first. Then we will collect your U.S. address and date of birth.
        </p>

        <div className="mt-8 grid gap-4">
          {BANK_PRODUCTS.map((product) => (
            <Link
              key={product.id}
              href={`/sign-up?product=${product.id}`}
              className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {CATEGORY_LABEL[product.category]}
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">{product.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{product.headline}</p>
              <p className="mt-2 text-sm text-muted-foreground">{product.summary}</p>
            </Link>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
