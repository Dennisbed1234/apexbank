import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getProfileSettings } from '@/app/actions/settings'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { ProfileForm } from '@/components/dashboard/profile-form'

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
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
            <p className="text-sm text-muted-foreground">
              Update your name, phone, and mailing address. Address appears on bank statements.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
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
