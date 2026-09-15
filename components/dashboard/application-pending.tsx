import { DashboardHeader } from '@/components/dashboard/dashboard-header'

export function ApplicationPending({
  name,
  email,
  productName,
}: {
  name?: string | null
  email?: string | null
  productName: string
}) {
  return (
    <div className="min-h-svh bg-background">
      <DashboardHeader name={name} email={email} />
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Application in review
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Your {productName} application is being reviewed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Credit card accounts are not opened until a Nicolet officer approves the
          application. You will receive an email as soon as a decision is made.
          Other deposit accounts are not added unless you apply for them separately.
        </p>
      </main>
    </div>
  )
}
