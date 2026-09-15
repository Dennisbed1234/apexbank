import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { eq } from 'drizzle-orm'
import { db, pool } from '@/lib/db'
import { user as userTable } from '@/lib/db/schema'
import { sendResetPasswordEmail } from '@/lib/mail'

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
      try {
        const ok = await sendResetPasswordEmail(user.email, url)
        if (!ok) {
          console.info('[apex-bank] password reset link for', user.email, url)
        }
      } catch (err) {
        console.error('[apex-bank] sendResetPassword failed', err)
        console.info('[apex-bank] password reset link for', user.email, url)
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await db
              .update(userTable)
              .set({ emailVerified: true, updatedAt: new Date() })
              .where(eq(userTable.id, user.id))
          } catch (err) {
            console.error('[apex-bank] mark email verified', err)
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      phone: { type: 'string', required: false, input: true },
      dateOfBirth: { type: 'string', required: false, input: true },
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
          'https://nk-theta.vercel.app',
          'https://apex-bank-theta.vercel.app',
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [nextCookies()],
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
