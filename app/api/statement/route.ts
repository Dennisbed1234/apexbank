import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  buildMemberStatementPdf,
  clampStatementMonths,
  parseMonthKey,
} from '@/lib/member-statement'

export const maxDuration = 60

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const monthParam = url.searchParams.get('month') || ''
    const monthKey = parseMonthKey(monthParam) ? monthParam : undefined
    const months = monthKey
      ? 1
      : clampStatementMonths(url.searchParams.get('months'))

    const { pdf, filename } = await buildMemberStatementPdf({
      userId: session.user.id,
      memberName: session.user.name || 'Member',
      memberEmail: session.user.email || '',
      months,
      monthKey,
    })

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[statement] failed', err)
    return NextResponse.json(
      { error: 'Could not generate statement. Please try again.' },
      { status: 500 }
    )
  }
}
