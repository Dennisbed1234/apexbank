import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getProfileSettings } from '@/app/actions/settings'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { ProfileForm } from '@/components/dashboard/profile-form'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const profile = await getProfileSettings().catch(() => null)
  const name = String(profile?.name || session.user.name || 'Account')
  const email = String(session.user.email || '')

  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader name={name} email={email} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Update your name, phone, and mailing address. Address appears on bank statements.
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
        <ProfileForm
          initialName={name}
          initialPhone={profile?.phone || ''}
          initialAddress={
            profile?.address || {
              addressLine1: '',
              addressLine2: '',
              city: '',
              state: '',
              postalCode: '',
            }
          }
          ssnLast4={profile?.kyc?.ssnLast4}
        />
      </main>
    </div>
  )
}
