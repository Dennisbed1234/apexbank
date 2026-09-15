import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { buildMemberStatementPdf } from '@/lib/member-statement'
import { sendMailWithAttachment } from '@/lib/mail'

function previousMonthKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function sendMonthlyStatements(now = new Date()) {
  const monthKey = previousMonthKey(now)
  const members = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const member of members) {
    if (!member.email) {
      skipped += 1
      continue
    }
    try {
      const { pdf, filename, totalInPeriod, statementTitle, periodLabel } =
        await buildMemberStatementPdf({
          userId: member.id,
          memberName: member.name || 'Member',
          memberEmail: member.email,
          months: 1,
          monthKey,
        })
      if (!totalInPeriod) {
        skipped += 1
        continue
      }
      const title = statementTitle || 'Nicolet National Bank Statement'
      const ok = await sendMailWithAttachment(
        member.email,
        title,
        `<p>Hi ${member.name || 'there'},</p>
         <p>Your monthly statement is attached: <strong>${title}</strong>.</p>
         <p>Period: ${periodLabel}</p>
         <p>This PDF includes ${totalInPeriod} posted transaction${totalInPeriod === 1 ? '' : 's'}.</p>`,
        {
          filename,
          contentType: 'application/pdf',
          content: pdf,
        }
      )
      if (ok) sent += 1
      else failed += 1
    } catch (err) {
      console.error('[cron] statement', member.email, err)
      failed += 1
    }
  }

  return { monthKey, sent, skipped, failed }
}
