'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { sendLoginAlert } from '@/lib/mail'

export async function notifySuccessfulLogin() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.email) return { ok: false }
    const sent = await sendLoginAlert(session.user.email, session.user.name)
    return { ok: sent }
  } catch (err) {
    console.error('[apex-bank] notifySuccessfulLogin', err)
    return { ok: false }
  }
}
