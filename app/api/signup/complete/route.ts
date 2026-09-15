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
      addressLine1: String(body.addressLine1 || ''),
      addressLine2: String(body.addressLine2 || ''),
      city: String(body.city || ''),
      state: String(body.state || ''),
      postalCode: String(body.postalCode || ''),
      productId: String(body.productId || ''),
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
