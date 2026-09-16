'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { applyForProduct } from '@/app/actions/products'

export function AddProducts({
  options,
}: {
  options: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  if (!options.length) return null

  async function apply(productId: string, name: string) {
    setPending(productId)
    try {
      const result = await applyForProduct(productId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`${name} submitted for review`)
      router.refresh()
    } catch {
      toast.error('Could not submit that application.')
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="rounded-2xl border border-dashed border-border bg-card/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Add a product</p>
      <h2 className="mt-1 text-lg font-bold tracking-tight">Apply for another Nicolet product</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose checking, savings, IRA, or a card. An officer must approve the request before it appears on your dashboard.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={pending === option.id}
            onClick={() => apply(option.id, option.name)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <Plus className="size-3.5" />
            {pending === option.id ? 'Submitting…' : option.name}
          </button>
        ))}
      </div>
    </section>
  )
}
