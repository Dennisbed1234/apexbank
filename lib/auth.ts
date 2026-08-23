import { betterAuth } from 'better-auth'
import { pool } from '@/lib/db'
import {
  sendLoginAlert,
  sendPasswordChangedEmail,
  sendResetPasswordEmail,
  sendWelcomeEmail,
} from '@/lib/mail'

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      const ok = await sendResetPasswordEmail(user.email, url)
      if (!ok) {
        console.info('[apex-bank] password reset link for', user.email, url)
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          void sendWelcomeEmail(user.email, user.name)
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          try {
            const { rows } = await pool.query('select email, name from "user" where id = $1 limit 1', [
              session.userId,
            ])
            const row = rows[0] as { email?: string; name?: string } | undefined
            if (row?.email) void sendLoginAlert(row.email, row.name)
          } catch (err) {
            console.error('[apex-bank] login mail', err)
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      phone: {
        type: 'string',
        required: false,
        input: true,
      },
      dateOfBirth: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          'https://*.vusercontent.net',
          'https://*.vercel.run',
          'https://*.v0.build',
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
          ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
          ...(process.env.AUTH_URL ? [process.env.AUTH_URL] : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
