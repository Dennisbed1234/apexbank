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
  const [chosen, setChosen] = useState<string | null>(null)
  if (!options.length) return null

  async function apply(productId: string, name: string) {
    setPending(productId)
    try {
      const result = await applyForProduct(productId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setChosen(name)
      toast.success(`${name} selected`)
      router.refresh()
    } catch {
      toast.error('Could not submit that application.')
    } finally {
      setPending(null)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5">
      <h2 className="text-lg font-bold tracking-tight">Products</h2>
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
      {chosen && (
        <p className="mt-4 text-sm text-muted-foreground">
          {chosen} was submitted. An officer will review it before the product is added to this dashboard.
        </p>
      )}
    </section>
  )
}
