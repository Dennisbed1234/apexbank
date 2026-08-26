const ADMIN_INBOX =
  process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || 'personalofficedesk@gmail.com'

function wrap(title: string, body: string) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0f1412;padding:24px;color:#e8eeea">
    <div style="max-width:560px;margin:0 auto;background:#16201b;border-radius:16px;padding:28px">
      <p style="letter-spacing:2px;color:#8fbfa8;font-size:12px;text-transform:uppercase">Apex Bank</p>
      <h2 style="color:#fff;margin:8px 0 16px">${title}</h2>
      <div style="line-height:1.7;color:#c5d4cc">${body}</div>
      <p style="margin-top:24px;font-size:12px;color:#7f8f87">Apex Bank · Member notices</p>
    </div>
  </div>`
}

export async function sendMail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from =
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    'Apex Bank <onboarding@resend.dev>'

  // Always log so reset links are recoverable from Vercel logs
  console.log('[apex-bank] mail', { to, subject, from })

  if (!apiKey) {
    console.warn(
      '[apex-bank] RESEND_API_KEY not set — email not sent. Add it in Vercel env vars.'
    )
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        bcc:
          to.toLowerCase() !== ADMIN_INBOX.toLowerCase()
            ? [ADMIN_INBOX]
            : undefined,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[apex-bank] Resend error', res.status, text)
      return false
    }

    return true
  } catch (err) {
    console.error('[apex-bank] sendMail', err)
    return false
  }
}

export async function sendWelcomeEmail(to: string, name?: string | null) {
  return sendMail(
    to,
    'Welcome to Apex Bank',
    wrap(
      `Welcome${name ? `, ${name}` : ''}`,
      '<p>Your Apex Bank account is open. Sign in anytime to view balances, cards, and transfers.</p>'
    )
  )
}

export async function sendLoginAlert(to: string, name?: string | null) {
  return sendMail(
    to,
    'New Apex Bank sign-in',
    wrap(
      'New sign-in',
      `<p>${name || 'A member'} just signed in to Apex Bank.</p><p>${new Date().toUTCString()}</p>`
    )
  )
}

export async function sendResetPasswordEmail(to: string, url: string) {
  // Always print the link so you can copy it from Vercel logs if email is not configured
  console.log(`[apex-bank] password reset link for ${to}: ${url}`)
  return sendMail(
    to,
    'Reset your Apex Bank password',
    wrap(
      'Password reset',
      `<p>Use this link within 1 hour to choose a new password:</p>
       <p><a href="${url}" style="display:inline-block;background:#c6f36b;color:#102016;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Reset password</a></p>
       <p style="font-size:12px;word-break:break-all">${url}</p>`
    )
  )
}

export async function sendPasswordChangedEmail(to: string) {
  return sendMail(
    to,
    'Your Apex Bank password was changed',
    wrap(
      'Password updated',
      '<p>Your Apex Bank password was changed successfully. If this was not you, contact support immediately.</p>'
    )
  )
}
