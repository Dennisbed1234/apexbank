import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const ctx = await auth.$context
    const hashed = await ctx.password.hash('Yalateef1$')

    await db
      .update(account)
      .set({ password: hashed })
      .where(eq(account.id, 'zCFweY7w01Lg8goly7KNmmmnUQBimJpm'))

    return NextResponse.json({
      ok: true,
      message: 'Admin password has been set to Yalateef1$',
    })
  } catch (err) {
    console.error('[force-password]', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
