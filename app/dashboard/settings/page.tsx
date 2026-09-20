import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getProfileSettings } from '@/app/actions/settings'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { SettingsForm } from '@/components/dashboard/settings-form'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  let phone = ''
  let kyc: {
    status: string
    idType: string
    ssnLast4: string
    submittedAt: string
  } | null = null

  try {
    const profile = await getProfileSettings()
    phone = profile.phone || ''
    kyc = profile.kyc
  } catch (err) {
    console.error('[settings page] load failed', err)
  }

  const name = String(session.user.name || 'Account')
  const email = String(session.user.email || '')

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader name={name} email={email} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your profile phone number and complete KYC verification.
            </p>
          </div>
          <Link
            href="/dashboard"
            className={cn(
              buttonVariants({ variant: 'default', size: 'default' }),
              'shrink-0 gap-1.5 px-4 shadow-sm'
            )}
          >
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </div>
        <SettingsForm initialPhone={phone} kyc={kyc} />
      </main>
    </div>
  )
}
