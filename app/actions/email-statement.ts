'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  buildMemberStatementPdf,
  clampStatementMonths,
  parseMonthKey,
} from '@/lib/member-statement'
import { sendMailWithAttachment } from '@/lib/mail'

export async function emailMyStatement(
  monthsOrKey?: number | string
): Promise<{ ok: true; title?: string } | { ok: false; error: string }> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.email) {
      return { ok: false, error: 'Sign in to email your statement.' }
    }

    const monthKey =
      typeof monthsOrKey === 'string' && parseMonthKey(monthsOrKey)
        ? monthsOrKey
        : undefined
    const months =
      typeof monthsOrKey === 'number'
        ? clampStatementMonths(monthsOrKey)
        : monthKey
          ? 1
          : 12

    const { pdf, filename, totalInPeriod, statementTitle, periodLabel } =
      await buildMemberStatementPdf({
        userId: session.user.id,
        memberName: session.user.name || 'Member',
        memberEmail: session.user.email,
        months,
        monthKey,
      })

    const title = statementTitle || 'Nicolet National Bank Statement'

    const sent = await sendMailWithAttachment(
      session.user.email,
      title,
      `<p>Hi ${session.user.name || 'there'},</p>
       <p>Your statement is attached: <strong>${title}</strong>.</p>
       <p>Period: ${periodLabel}</p>
       <p>This PDF includes ${totalInPeriod} posted transaction${totalInPeriod === 1 ? '' : 's'}.</p>`,
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
    return { ok: true, title }
  } catch (err) {
    console.error('[statement] email failed', err)
    return { ok: false, error: 'Could not email statement.' }
  }
}
