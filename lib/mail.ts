import { connect } from 'node:tls'

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

function fromAddress() {
  const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER
  return (
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    (gmailUser ? `Apex Bank <${gmailUser}>` : 'Apex Bank <onboarding@resend.dev>')
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

async function sendViaGmail(to: string, subject: string, html: string) {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').replace(/\s/g, '')
  if (!user || !pass) {
    console.warn('[apex-bank] Gmail env missing GMAIL_USER / GMAIL_APP_PASSWORD')
    return false
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 465)
  const from = fromAddress()
  const bcc =
    to.toLowerCase() !== ADMIN_INBOX.toLowerCase() ? ADMIN_INBOX : null

  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port, servername: host }, async () => {
      try {
        await expectOk(socket)
        await expectOk(socket, `EHLO apexbank`)
        await expectOk(socket, 'AUTH LOGIN')
        await expectOk(socket, Buffer.from(user).toString('base64'))
        await expectOk(socket, Buffer.from(pass).toString('base64'))
        await expectOk(socket, `MAIL FROM:<${user}>`)
        await expectOk(socket, `RCPT TO:<${to}>`)
        if (bcc) await expectOk(socket, `RCPT TO:<${bcc}>`)
        await expectOk(socket, 'DATA')
        const headers = [
          `From: ${from}`,
          `To: ${to}`,
          bcc ? `Bcc: ${bcc}` : null,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          '',
          html,
          '.',
        ]
          .filter(Boolean)
          .join('\r\n')
        await expectOk(socket, headers)
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

async function sendViaResend(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

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
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[apex-bank] Resend error', res.status, text)
    return false
  }
  return true
}

export async function sendMail(to: string, subject: string, html: string) {
  console.log('[apex-bank] mail', { to, subject, from: fromAddress() })

  try {
    if (await sendViaGmail(to, subject, html)) return true
    if (await sendViaResend(to, subject, html)) return true
    console.warn(
      '[apex-bank] No mail transport. Set GMAIL_USER + GMAIL_APP_PASSWORD or RESEND_API_KEY.'
    )
    return false
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
  const when = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return sendMail(
    to,
    'New Apex Bank sign-in',
    wrap(
      'New sign-in',
      `<p>${name || 'A member'} just signed in to Apex Bank.</p><p>${when}</p>`
    )
  )
}

export async function sendResetPasswordEmail(to: string, url: string) {
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

export async function sendTransferReceipt(to: string, detail: string) {
  return sendMail(
    to,
    'Apex Bank transfer confirmation',
    wrap('Transfer complete', `<p>${detail}</p>`)
  )
}
