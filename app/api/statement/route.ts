import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { buildMemberStatementPdf } from '@/lib/member-statement'

export const maxDuration = 60

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { pdf, filename } = await buildMemberStatementPdf({
      userId: session.user.id,
      memberName: session.user.name || 'Member',
      memberEmail: session.user.email || '',
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
