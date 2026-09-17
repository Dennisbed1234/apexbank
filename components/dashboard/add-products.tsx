'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <section
      className="relative overflow-hidden rounded-2xl border border-teal-400/25 p-5 shadow-[0_0_40px_-16px_rgba(13,148,136,0.45)]"
      style={{
        background:
          'radial-gradient(120% 90% at 0% 0%, rgba(45,212,191,0.22) 0%, transparent 55%), radial-gradient(90% 80% at 100% 100%, rgba(13,148,136,0.18) 0%, transparent 50%), linear-gradient(145deg, #042f2e 0%, #0f766e 42%, #0d9488 72%, #134e4a 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full opacity-40 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(94,234,212,0.65), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-14 -left-8 size-40 rounded-full opacity-30 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.5), transparent 70%)' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.07)_50%,transparent_60%)]" />

      <div className="relative z-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/70">
          Expand your banking
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-white">Products</h2>
        <p className="mt-1 text-sm text-teal-50/70">
          Add checking, savings, or retirement — an officer reviews each request.
        </p>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          {options.map((option) => {
            const busy = pending === option.id
            return (
              <button
                key={option.id}
                type="button"
                disabled={busy}
                onClick={() => apply(option.id, option.name)}
                className="group inline-flex h-11 items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/10 px-3.5 text-left text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition hover:border-teal-200/40 hover:bg-white/15 disabled:opacity-60"
              >
                <span className="truncate">{option.name}</span>
                <span className="inline-flex shrink-0 items-center rounded-lg bg-teal-300/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-teal-50 ring-1 ring-teal-200/30 group-hover:bg-teal-200/30">
                  {busy ? '…' : 'Add'}
                </span>
              </button>
            )
          })}
        </div>

        {chosen && (
          <p className="mt-4 text-sm text-teal-50/80">
            {chosen} was submitted. An officer will review it before it appears on this dashboard.
          </p>
        )}
      </div>
    </section>
  )
}
