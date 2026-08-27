import { db } from '@/lib/db'
import { bankAccount } from '@/lib/db/schema'
import { SHARED_CHECKING_NUMBER } from '@/lib/bank-constants'
import { eq } from 'drizzle-orm'

function randomAccountNumber() {
  let n = ''
  do {
    n = String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999))
  } while (n === SHARED_CHECKING_NUMBER)
  return n
}

export async function ensureRetirementAccount(input: {
  userId: string
  isAdmin?: boolean
  isDemo?: boolean
}) {
  const accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, input.userId))

  const existing = accounts.find((a) => a.type === 'retirement')
  if (existing) return existing

  const [created] = await db
    .insert(bankAccount)
    .values({
      userId: input.userId,
      name: input.isAdmin ? 'Retirement Reserve' : 'Traditional IRA',
      type: 'retirement',
      accountNumber: randomAccountNumber(),
      balanceCents: input.isAdmin ? 2_250_000 : input.isDemo ? 428_500 : 0,
    })
    .returning()

  return created
}
