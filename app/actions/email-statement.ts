'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  buildMemberStatementPdf,
  clampStatementMonths,
} from '@/lib/member-statement'
import { sendMailWithAttachment } from '@/lib/mail'

export async function emailMyStatement(
  monthsInput?: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.email) {
      return { ok: false, error: 'Sign in to email your statement.' }
    }

    const months = clampStatementMonths(monthsInput)
    const { pdf, filename, totalInPeriod } = await buildMemberStatementPdf({
      userId: session.user.id,
      memberName: session.user.name || 'Member',
      memberEmail: session.user.email,
      months,
    })

    const sent = await sendMailWithAttachment(
      session.user.email,
      `Your Apex Bank ${months}-month statement (PDF)`,
      `<p>Hi ${session.user.name || 'there'},</p>
       <p>Your ${months}-month account statement is attached.</p>
       <p>This PDF lists all ${totalInPeriod} posted transactions in the statement period.</p>`,
      {
        filename,
        contentType: 'application/pdf',
        content: pdf,
      }
    )

    if (!sent) {
      return {
        ok: false,
        error: 'Could not send email. Check mail settings and try again.',
      }
    }
    return { ok: true }
  } catch (err) {
    console.error('[statement] email failed', err)
    return { ok: false, error: 'Could not email statement.' }
  }
}
