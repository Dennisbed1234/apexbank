import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureKycTable } from '@/lib/db/ensure-columns'
import { kycSubmission } from '@/lib/db/schema'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = String(session.user.email || '').trim().toLowerCase()
  if (email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = Number(req.nextUrl.searchParams.get('id'))
  const side = req.nextUrl.searchParams.get('side') === 'back' ? 'back' : 'front'

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    await ensureKycTable()
  } catch (err) {
    console.error('[ops/kyc-doc] ensure table failed', err)
    return NextResponse.json({ error: 'Database not ready' }, { status: 503 })
  }

  const rows = await db
    .select()
    .from(kycSubmission)
    .where(eq(kycSubmission.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const mime = side === 'back' ? row.idBackMime : row.idFrontMime
  const name = side === 'back' ? row.idBackName : row.idFrontName
  const data = side === 'back' ? row.idBackData : row.idFrontData
  const buffer = Buffer.from(data, 'base64')

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': mime || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${name || `kyc-${side}`}"`,
      'Cache-Control': 'no-store',
    },
  })
}
