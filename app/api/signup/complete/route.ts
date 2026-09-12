import { NextResponse } from 'next/server'
import { completeSignup } from '@/app/actions/signup-challenge'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const result = await completeSignup({
      email: String(body.email || ''),
      password: String(body.password || ''),
      name: String(body.name || ''),
      phone: String(body.phone || ''),
      dateOfBirth: String(body.dateOfBirth || ''),
      otp: String(body.otp || ''),
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (err) {
    console.error('[signup] complete route', err)
    return NextResponse.json(
      { ok: false, error: 'Could not create the account. Try again.' },
      { status: 500 }
    )
  }
}
