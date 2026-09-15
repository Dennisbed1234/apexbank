import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { SiteHeader } from '@/components/marketing/site-header'
import { Hero } from '@/components/marketing/hero'
import { Products } from '@/components/marketing/products'
import { Features } from '@/components/marketing/features'
import { CtaFooter } from '@/components/marketing/cta-footer'

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/dashboard')

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <Products />
        <Features />
        <CtaFooter />
      </main>
    </div>
  )
}
