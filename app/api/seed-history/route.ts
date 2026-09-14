import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import {
  seedLargeHistoryForUser,
  shouldSeedLargeHistory,
  TARGET_TX_COUNT,
} from '@/lib/seed-10k'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const email = String(session.user.email || '').trim().toLowerCase()
    const allowed =
      email === ADMIN_EMAIL ||
      shouldSeedLargeHistory(session.user.name, session.user.email)
    if (!allowed) {
      return NextResponse.json({ ok: true, skipped: true, target: TARGET_TX_COUNT })
    }

    const result = await seedLargeHistoryForUser(
      session.user.id,
      session.user.name,
      session.user.email
    )
    return NextResponse.json({
      ok: true,
      target: TARGET_TX_COUNT,
      results: result ? [result] : [],
    })
  } catch (err) {
    console.error('[seed-history]', err)
    return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
  }
}
