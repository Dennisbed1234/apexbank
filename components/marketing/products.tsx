import Link from 'next/link'
import { BANK_PRODUCTS } from '@/lib/products'
import { Button } from '@/components/ui/button'

const CATEGORY_LABEL: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  'credit-card': 'Credit cards',
}

export function Products() {
  return (
    <section id="accounts" className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Choose the product that fits.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Two checking options, one high-yield savings account, and two Visa cards with different rewards. Pick one before you open an account.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BANK_PRODUCTS.map((product) => (
            <article
              key={product.id}
              className="flex flex-col rounded-2xl border border-border bg-card p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {CATEGORY_LABEL[product.category]}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-foreground">{product.name}</h3>
              <p className="mt-1 text-sm font-medium text-foreground">{product.headline}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{product.summary}</p>
              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-sm text-muted-foreground">
                {product.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                nativeButton={false}
                render={<Link href={`/sign-up?product=${product.id}`} />}
              >
                Open {product.name}
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
