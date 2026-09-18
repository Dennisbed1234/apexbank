'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Receipt,
  ShieldCheck,
  Wallet,
  Wifi,
} from 'lucide-react'
import { toast } from 'sonner'
import { BANK_NAME, BANK_SHORT_NAME } from '@/lib/bank-constants'

const DESIGNS = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    text: 'text-white',
    muted: 'text-white/55',
    bg: 'radial-gradient(90% 70% at 100% 0%, rgba(90,120,255,0.22) 0%, transparent 50%), linear-gradient(160deg, #0a0a0c 0%, #1a1d24 55%, #0d1117 100%)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    text: 'text-white',
    muted: 'text-white/55',
    bg: 'radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.14) 0%, transparent 45%), linear-gradient(135deg, #0b3d2e 0%, #145c43 42%, #1f7a56 72%, #0f2f24 100%)',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    text: 'text-white',
    muted: 'text-white/55',
    bg: 'radial-gradient(80% 60% at 0% 100%, rgba(180,180,200,0.15) 0%, transparent 50%), linear-gradient(145deg, #2a2d35 0%, #3a3f4a 50%, #1c1f26 100%)',
  },
] as const

function maskFormatted(pan: string) {
  const digits = pan.replace(/\D/g, '')
  const last4 = digits.slice(-4)
  return `••••  ••••  ••••  ${last4}`
}

function NetworkMark({ network }: { network: 'visa' | 'mastercard' }) {
  if (network === 'mastercard') {
    return (
      <div className="flex items-center" aria-label="Mastercard">
        <span className="relative flex h-7 w-11 items-center justify-center">
          <span className="absolute left-0 size-6 rounded-full bg-[#eb001b]/90" />
          <span className="absolute right-0 size-6 rounded-full bg-[#f79e1b]/90" />
          <span className="absolute left-1/2 size-6 -translate-x-1/2 rounded-full bg-[#ff5f00]/75 mix-blend-multiply" />
        </span>
      </div>
    )
  }
  return (
    <p className="text-[13px] font-bold italic tracking-wide" aria-label="Visa">
      VISA
    </p>
  )
}

function CardFace({
  design,
  memberName,
  cardNumber,
  cardExp,
  network,
}: {
  design: (typeof DESIGNS)[number]
  memberName: string
  cardNumber: string
  cardExp: string
  network: 'visa' | 'mastercard'
}) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl p-5 shadow-2xl ${design.text}`}
      style={{ aspectRatio: '1.586 / 1', background: design.bg }}
    >
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em]">{BANK_SHORT_NAME.toUpperCase()}</p>
          <p className={`mt-0.5 text-[10px] ${design.muted}`}>{BANK_NAME}</p>
        </div>
        <Wifi className={`size-5 rotate-90 ${design.muted}`} aria-hidden />
      </div>

      <div className="relative mt-5 flex items-center gap-3">
        <div
          className="h-9 w-12 rounded-md"
          style={{
            background:
              'linear-gradient(145deg, #e8d5a3 0%, #c9a84c 40%, #f0e0b0 60%, #b8923a 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
          }}
        >
          <div className="grid h-full grid-cols-3 gap-px p-1 opacity-50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-[1px] bg-black/20" />
            ))}
          </div>
        </div>
      </div>

      <p className="relative mt-5 font-mono text-[17px] tracking-[0.14em] sm:text-xl">{cardNumber}</p>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[9px] uppercase tracking-wider ${design.muted}`}>Cardholder</p>
          <p className="truncate text-sm font-semibold tracking-wide">{memberName}</p>
        </div>
        <div className="text-right">
          <p className={`text-[9px] uppercase tracking-wider ${design.muted}`}>Valid thru</p>
          <p className="font-mono text-sm font-semibold">{cardExp}</p>
        </div>
        <NetworkMark network={network} />
      </div>
    </div>
  )
}

export function MemberCreditCard({
  memberName,
  cardNumber,
  cardExp,
  cardCvv,
  network,
  productName,
  kycStatus,
  accountId,
  showActivityLink = false,
}: {
  memberName: string
  cardNumber: string
  cardExp: string
  cardCvv: string
  network: 'visa' | 'mastercard'
  productName?: string
  kycStatus?: string | null
  accountId?: number
  currentBalanceCents?: number
  showActivityLink?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<(typeof DESIGNS)[number]['id']>('obsidian')
  const [revealed, setRevealed] = useState(false)
  const design = DESIGNS.find((d) => d.id === selected) ?? DESIGNS[0]
  const displayName = (memberName || 'MEMBER').toUpperCase()
  const approved = kycStatus === 'approved'
  const pending = kycStatus === 'pending'
  const activityHref = accountId
    ? `/dashboard/credit-activity?accountId=${accountId}`
    : '/dashboard/credit-activity'
  const payHref = accountId
    ? `/dashboard/pay-credit?accountId=${accountId}`
    : '/dashboard/pay-credit'

  function orderPhysical(label: string) {
    if (approved) {
      toast.success(`${label} requested`, {
        description: `${design.name} card will ship after production.`,
      })
      return
    }
    if (pending) {
      toast.message('Verification under review', {
        description: 'Finish identity verification before a physical card can ship.',
      })
    } else {
      toast.error('Verification required', {
        description: 'Complete KYC in Settings to order a physical card.',
      })
    }
    router.push('/dashboard/settings')
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Your card</p>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {productName || (network === 'mastercard' ? 'Mastercard' : 'Visa')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{BANK_NAME}</p>
        </div>
        {approved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" />
            Verified
          </span>
        ) : pending ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700">
            <Lock className="size-3.5" />
            Verification pending
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" />
            KYC required for physical card
          </span>
        )}
      </div>

      <div className="mt-5 flex justify-center">
        <div className="w-full max-w-[380px]">
          <CardFace
            design={design}
            memberName={displayName}
            cardNumber={revealed ? cardNumber : maskFormatted(cardNumber)}
            cardExp={cardExp}
            network={network}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="mx-auto mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        {revealed ? 'Hide number & CVV' : 'Show full number & CVV'}
      </button>

      {revealed && (
        <div className="mx-auto mt-3 grid max-w-[380px] grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">Card number</p>
            <p className="font-mono font-medium tabular-nums">{cardNumber}</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">CVV · Exp</p>
            <p className="font-mono font-medium tabular-nums">
              {cardCvv} · {cardExp}
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        {DESIGNS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSelected(option.id)}
            className={`rounded-xl border p-2 text-left transition ${
              selected === option.id
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-border hover:border-foreground/20'
            }`}
          >
            <div className="h-12 w-full rounded-lg" style={{ background: option.bg }} />
            <p className="mt-2 text-sm font-semibold text-foreground">{option.name}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => orderPhysical('Physical card')}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <CreditCard className="size-4" />
          Order physical card
        </button>
        <button
          type="button"
          onClick={() => orderPhysical(design.name)}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Order {design.name}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {accountId != null && (
          <Link
            href={payHref}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Wallet className="size-3.5" />
            Pay balance
          </Link>
        )}
        {showActivityLink && (
          <Link
            href={activityHref}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Receipt className="size-3.5" />
            View card activity
          </Link>
        )}
      </div>
    </section>
  )
}
