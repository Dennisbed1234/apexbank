import { connect } from 'node:tls'
import {
  BANK_ADDRESS,
  BANK_NAME,
  BANK_PHONE,
  BANK_PHONE_TOLL_FREE,
} from '@/lib/bank-constants'
import { NICOLET_LOGO_JPEG_B64 } from '@/lib/nicolet-logo-jpeg'

const ADMIN_INBOX =
  process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || 'personalofficedesk@gmail.com'

const LOGO_CID = 'nicolet-logo'
const LOGO_B64_FOLDED = NICOLET_LOGO_JPEG_B64.replace(/(.{76})/g, '$1\r\n')

function wrap(title: string, body: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} · ${BANK_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#0f1412;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1412;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#16201b;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:#0c1210;padding:28px 32px 20px;text-align:center;border-bottom:1px solid #1e2c26;">
              <img src="cid:${LOGO_CID}" alt="${BANK_NAME}" width="140" height="48" style="display:block;margin:0 auto 12px;max-width:140px;height:auto;border:0;" />
              <p style="margin:0;letter-spacing:2.5px;color:#8fbfa8;font-size:11px;text-transform:uppercase;font-weight:600;">
                ${BANK_NAME}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0 0 20px;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">
                ${title}
              </h1>
              <div style="line-height:1.7;color:#c5d4cc;font-size:15px;">
                ${body}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1e2c26;padding-top:20px;">
                <tr>
                  <td style="font-size:12px;line-height:1.6;color:#7f8f87;">
                    <strong style="color:#8fbfa8;">${BANK_NAME}</strong><br />
                    ${BANK_ADDRESS}<br />
                    Phone: ${BANK_PHONE}<br />
                    Toll-free: ${BANK_PHONE_TOLL_FREE}<br />
                    <span style="color:#5a6b63;">Member FDIC · Equal Housing Lender</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px;font-size:11px;color:#5a6b63;">
                    This is an automated member notice. Please do not reply directly to this email.
                    If you did not request this message, contact support immediately.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function brandedHtml(subject: string, html: string, title?: string) {
  if (html.includes('<html')) return html
  return wrap(title || subject, html)
}

function logoRelatedPart(htmlBoundary: string) {
  return [
    `--${htmlBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    '{{HTML}}',
    `--${htmlBoundary}`,
    'Content-Type: image/jpeg; name="nicolet-logo.jpg"',
    'Content-Transfer-Encoding: base64',
    `Content-ID: <${LOGO_CID}>`,
    'Content-Disposition: inline; filename="nicolet-logo.jpg"',
    '',
    LOGO_B64_FOLDED,
    `--${htmlBoundary}--`,
  ].join('\r\n')
}

function fromAddress() {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER
  return (
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    (gmailUser ? `Nicolet National Bank <${gmailUser}>` : 'Nicolet National Bank <onboarding@resend.dev>')
  )
}

function readSmtpReply(socket: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = ''
    const onData = (chunk: string | Buffer) => {
      buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      const lines = buf.split(/\r?\n/).filter((line) => line.length > 0)
      const last = lines[lines.length - 1]
      if (last && /^\d{3}[ -]/.test(last) && !lines.some((line) => /^\d{3}-/.test(line) && line === last)) {
        if (/^\d{3} /.test(last)) {
          socket.off('data', onData)
          socket.off('error', onError)
          resolve(buf)
        }
      }
    }
    const onError = (err: Error) => {
      socket.off('data', onData)
      reject(err)
    }
    socket.on('data', onData)
    socket.once('error', onError)
  })
}

async function expectOk(socket: NodeJS.ReadWriteStream, command?: string) {
  if (command) socket.write(command + '\r\n')
  const reply = await readSmtpReply(socket)
  if (!/^[23]/.test(reply.trim())) {
    throw new Error(`SMTP rejected: ${reply.trim()}`)
  }
  return reply
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64')
}

async function sendViaGmail(
  to: string,
  subject: string,
  html: string,
  attachment?: { filename: string; contentType: string; content: Uint8Array }
) {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').replace(/\s/g, '')
  if (!user || !pass) {
    console.warn('[nicolet] Gmail env missing GMAIL_USER / GMAIL_APP_PASSWORD')
    return false
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 465)
  const from = fromAddress()
  const bcc =
    to.toLowerCase() !== ADMIN_INBOX.toLowerCase() ? ADMIN_INBOX : null
  const mix = `mix_${Date.now().toString(16)}`
  const rel = `rel_${Date.now().toString(16)}`
  const related = logoRelatedPart(rel).replace('{{HTML}}', html)

  let body: string
  if (attachment) {
    const b64 = toBase64(attachment.content).replace(/(.{76})/g, '$1\r\n')
    body = [
      `From: ${from}`,
      `To: ${to}`,
      bcc ? `Bcc: ${bcc}` : null,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${mix}"`,
      '',
      `--${mix}`,
      `Content-Type: multipart/related; boundary="${rel}"`,
      '',
      related,
      `--${mix}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      b64,
      `--${mix}--`,
      '.',
    ]
      .filter(Boolean)
      .join('\r\n')
  } else {
    body = [
      `From: ${from}`,
      `To: ${to}`,
      bcc ? `Bcc: ${bcc}` : null,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${rel}"`,
      '',
      related,
      '.',
    ]
      .filter(Boolean)
      .join('\r\n')
  }

  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port, servername: host }, async () => {
      try {
        await expectOk(socket)
        await expectOk(socket, `EHLO nicoletnational`)
        await expectOk(socket, 'AUTH LOGIN')
        await expectOk(socket, Buffer.from(user).toString('base64'))
        await expectOk(socket, Buffer.from(pass).toString('base64'))
        await expectOk(socket, `MAIL FROM:<${user}>`)
        await expectOk(socket, `RCPT TO:<${to}>`)
        if (bcc) await expectOk(socket, `RCPT TO:<${bcc}>`)
        await expectOk(socket, 'DATA')
        await expectOk(socket, body)
        socket.write('QUIT\r\n')
        socket.end()
        resolve()
      } catch (err) {
        socket.destroy()
        reject(err)
      }
    })
    socket.setEncoding('utf8')
    socket.setTimeout(20000, () => {
      socket.destroy()
      reject(new Error('Gmail SMTP timed out'))
    })
    socket.on('error', reject)
  })

  return true
}

function logoAttachment() {
  return {
    filename: 'nicolet-logo.jpg',
    content: NICOLET_LOGO_JPEG_B64,
    content_id: LOGO_CID,
    contentId: LOGO_CID,
  }
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  attachment?: { filename: string; contentType: string; content: Uint8Array }
) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const attachments = [logoAttachment()]
  if (attachment) {
    attachments.push({
      filename: attachment.filename,
      content: toBase64(attachment.content),
      content_id: '',
      contentId: '',
    } as any)
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      bcc:
        to.toLowerCase() !== ADMIN_INBOX.toLowerCase()
          ? [ADMIN_INBOX]
          : undefined,
      subject,
      html,
      attachments,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[nicolet] Resend error', res.status, text)
    return false
  }
  return true
}

export async function sendMail(to: string, subject: string, html: string, title?: string) {
  const payload = brandedHtml(subject, html, title)
  console.log('[nicolet] mail', { to, subject, from: fromAddress() })

  try {
    if (await sendViaGmail(to, subject, payload)) return true
    if (await sendViaResend(to, subject, payload)) return true
    console.warn(
      '[nicolet] No mail transport. Set GMAIL_USER + GMAIL_APP_PASSWORD or RESEND_API_KEY.'
    )
    return false
  } catch (err) {
    console.error('[nicolet] sendMail', err)
    return false
  }
}

export async function sendMailWithAttachment(
  to: string,
  subject: string,
  html: string,
  attachment: { filename: string; contentType: string; content: Uint8Array }
) {
  const wrapped = brandedHtml(subject, html)
  console.log('[nicolet] mail+pdf', { to, subject, file: attachment.filename })
  try {
    if (await sendViaGmail(to, subject, wrapped, attachment)) return true
    if (await sendViaResend(to, subject, wrapped, attachment)) return true
    console.warn('[nicolet] No mail transport for PDF attachment.')
    return false
  } catch (err) {
    console.error('[nicolet] sendMailWithAttachment', err)
    return false
  }
}

export async function sendWelcomeEmail(to: string, name?: string | null) {
  return sendMail(
    to,
    'Welcome to Nicolet National Bank',
    '<p>Your Nicolet National Bank account is open. Sign in anytime to view balances, cards, and transfers.</p>',
    `Welcome${name ? `, ${name}` : ''}`
  )
}

export async function sendLoginAlert(to: string, name?: string | null) {
  const when = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return sendMail(
    to,
    'New Nicolet National Bank sign-in',
    `<p>${name || 'A member'} just signed in to Nicolet National Bank.</p><p>${when}</p>`,
    'New sign-in'
  )
}

export async function sendResetPasswordEmail(to: string, url: string) {
  console.log(`[nicolet] password reset link for ${to}: ${url}`)
  return sendMail(
    to,
    'Reset your Nicolet National Bank password',
    `<p>Use this link within 1 hour to choose a new password:</p>
       <p><a href="${url}" style="display:inline-block;background:#c6f36b;color:#102016;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Reset password</a></p>
       <p style="font-size:12px;word-break:break-all">${url}</p>`,
    'Password reset'
  )
}

export async function sendPasswordChangedEmail(to: string) {
  return sendMail(
    to,
    'Your Nicolet National Bank password was changed',
    '<p>Your Nicolet National Bank password was changed successfully. If this was not you, contact support immediately.</p>',
    'Password updated'
  )
}

export async function sendTransferReceipt(to: string, detail: string) {
  return sendMail(
    to,
    'Nicolet National Bank transfer confirmation',
    `<p>${detail}</p>`,
    'Transfer complete'
  )
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  name?: string | null,
  purpose: 'sign-in' | 'sign-up' = 'sign-in'
) {
  const isSignup = purpose === 'sign-up'
  return sendMail(
    to,
    isSignup
      ? 'Verify your email to open a Nicolet National Bank account'
      : 'Your Nicolet National Bank verification code',
    `<p>Hi${name ? ` ${name}` : ''},</p>
       <p>${
         isSignup
           ? 'Use this code to finish opening your Nicolet National Bank account:'
           : 'Your one-time sign-in code is:'
       }</p>
       <p style="font-size:28px;letter-spacing:6px;font-weight:700;color:#ffffff;margin:20px 0;">${otp}</p>
       <p>This code expires in 10 minutes.</p>
       <p>${
         isSignup
           ? 'If you did not try to open an account, ignore this email.'
           : 'If you did not try to sign in, ignore this email and contact support.'
       }</p>`,
    isSignup ? 'Confirm your email' : 'Verification code'
  )
}
