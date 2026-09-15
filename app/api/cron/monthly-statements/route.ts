import { NextResponse } from 'next/server'
import { sendMonthlyStatements } from '@/lib/monthly-statements'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET || ''
  const header = req.headers.get('authorization') || ''
  if (secret && header === `Bearer ${secret}`) return true
  if (process.env.VERCEL === '1' && req.headers.get('x-vercel-cron') === '1') return true
  return false
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await sendMonthlyStatements()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron] monthly statements', err)
    return NextResponse.json({ ok: false, error: 'Failed' }, { status: 500 })
  }
}
