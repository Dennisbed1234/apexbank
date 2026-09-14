import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ChatSupport } from '@/components/chat-support'
import { BANK_NAME } from '@/lib/bank-constants'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://apex-bank-theta.vercel.app'),
  title: {
    default: `${BANK_NAME} — Banking that works for you`,
    template: `%s — ${BANK_NAME}`,
  },
  description:
    `${BANK_NAME} is the modern way to bank: fee-free checking, high-yield savings, instant transfers, and real-time insights into your money.`,
  generator: 'v0.app',
  openGraph: {
    title: `${BANK_NAME} — Banking that works for you`,
    description:
      'Fee-free checking, high-yield savings, and instant transfers — all in one simple app.',
    url: 'https://apex-bank-theta.vercel.app',
    siteName: BANK_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BANK_NAME} — Banking that works for you`,
    description:
      'Fee-free checking, high-yield savings, and instant transfers — all in one simple app.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  colorScheme: 'light',
  themeColor: '#1f5138',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${manrope.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <ChatSupport />
        <Toaster position="top-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
