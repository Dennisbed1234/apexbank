import { NextResponse } from 'next/server'
import { resendSignupOtp } from '@/app/actions/signup-challenge'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const result = await resendSignupOtp({
      email: String(body.email || ''),
      name: String(body.name || ''),
    })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (err) {
    console.error('[signup] resend route', err)
    return NextResponse.json(
      { ok: false, error: 'Unable to resend code. Try again.' },
      { status: 500 }
    )
  }
}
