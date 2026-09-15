import { sendMail } from '@/lib/mail'
import { BANK_NAME } from '@/lib/bank-constants'

export async function sendCardDecisionEmail(input: {
  to: string
  name?: string | null
  productName: string
  approved: boolean
}) {
  const greeting = input.name ? `Hi ${input.name.split(' ')[0]},` : 'Hi,'
  if (input.approved) {
    return sendMail(
      input.to,
      `${input.productName} approved · ${BANK_NAME}`,
      `<p>${greeting}</p><p>Your ${input.productName} application has been approved. Sign in to your dashboard to view the card.</p>`
    )
  }
  return sendMail(
    input.to,
    `${input.productName} decision · ${BANK_NAME}`,
    `<p>${greeting}</p><p>We were unable to approve your ${input.productName} application at this time.</p>`
  )
}
