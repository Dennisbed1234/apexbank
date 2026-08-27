'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ensureUserProfileColumns } from '@/lib/db/ensure-columns'
import { chatMessage, chatThread, user } from '@/lib/db/schema'
import { ADMIN_EMAIL } from '@/lib/bank-constants'
import { and, desc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

function isAdmin(email?: string | null) {
  return String(email || '').trim().toLowerCase() === ADMIN_EMAIL
}

export type ChatMessageView = {
  id: number
  sender: string
  body: string
  createdAt: string
}

export type ChatThreadView = {
  id: number
  userId: string
  status: string
  subject: string
  memberName: string
  memberEmail: string
  updatedAt: string
  lastMessage?: string
}

async function getOrCreateUserThread(userId: string) {
  await ensureUserProfileColumns()

  const existing = await db
    .select()
    .from(chatThread)
    .where(and(eq(chatThread.userId, userId), eq(chatThread.status, 'open')))
    .orderBy(desc(chatThread.updatedAt))
    .limit(1)

  if (existing[0]) return existing[0]

  const [created] = await db
    .insert(chatThread)
    .values({
      userId,
      status: 'open',
      subject: 'Support chat',
    })
    .returning()

  return created
}

export async function getMyChat() {
  const sessionUser = await getSessionUser()
  const thread = await getOrCreateUserThread(sessionUser.id)
  const messages = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.threadId, thread.id))
    .orderBy(chatMessage.createdAt)

  return {
    threadId: thread.id,
    status: thread.status,
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })) as ChatMessageView[],
  }
}

export async function sendUserChatMessage(
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionUser = await getSessionUser()
    const text = body.trim()
    if (!text) return { ok: false, error: 'Message cannot be empty.' }
    if (text.length > 2000) return { ok: false, error: 'Message is too long.' }

    const thread = await getOrCreateUserThread(sessionUser.id)

    await db.insert(chatMessage).values({
      threadId: thread.id,
      sender: 'user',
      body: text,
    })

    await db
      .update(chatThread)
      .set({ updatedAt: new Date(), status: 'open' })
      .where(eq(chatThread.id, thread.id))

    revalidatePath('/ops')
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    if (message === 'Unauthorized') {
      return { ok: false, error: 'Sign in to send a message.' }
    }
    console.error('[chat] sendUserChatMessage', err)
    return { ok: false, error: 'Could not send message. Please try again.' }
  }
}

export async function listChatThreadsForAdmin(): Promise<ChatThreadView[]> {
  const sessionUser = await getSessionUser()
  if (!isAdmin(sessionUser.email)) throw new Error('Admin access required')
  await ensureUserProfileColumns()

  const threads = await db
    .select({
      id: chatThread.id,
      userId: chatThread.userId,
      status: chatThread.status,
      subject: chatThread.subject,
      updatedAt: chatThread.updatedAt,
      memberName: user.name,
      memberEmail: user.email,
    })
    .from(chatThread)
    .leftJoin(user, eq(chatThread.userId, user.id))
    .orderBy(desc(chatThread.updatedAt))

  const views: ChatThreadView[] = []
  for (const t of threads) {
    const last = await db
      .select({ body: chatMessage.body })
      .from(chatMessage)
      .where(eq(chatMessage.threadId, t.id))
      .orderBy(desc(chatMessage.createdAt))
      .limit(1)

    views.push({
      id: t.id,
      userId: t.userId,
      status: t.status,
      subject: t.subject,
      memberName: t.memberName || 'Member',
      memberEmail: t.memberEmail || '',
      updatedAt: t.updatedAt.toISOString(),
      lastMessage: last[0]?.body,
    })
  }
  return views
}

export async function getThreadMessagesForAdmin(threadId: number) {
  const sessionUser = await getSessionUser()
  if (!isAdmin(sessionUser.email)) throw new Error('Admin access required')
  await ensureUserProfileColumns()

  const messages = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(chatMessage.createdAt)

  return messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  })) as ChatMessageView[]
}

export async function sendAdminChatReply(
  threadId: number,
  body: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sessionUser = await getSessionUser()
    if (!isAdmin(sessionUser.email)) return { ok: false, error: 'Admin only' }

    const text = body.trim()
    if (!text) return { ok: false, error: 'Message cannot be empty.' }

    await ensureUserProfileColumns()

    const thread = await db
      .select()
      .from(chatThread)
      .where(eq(chatThread.id, threadId))
      .limit(1)

    if (!thread[0]) return { ok: false, error: 'Thread not found' }

    await db.insert(chatMessage).values({
      threadId,
      sender: 'admin',
      body: text,
    })

    await db
      .update(chatThread)
      .set({ updatedAt: new Date(), status: 'open' })
      .where(eq(chatThread.id, threadId))

    revalidatePath('/ops')
    return { ok: true }
  } catch (err) {
    console.error('[chat] sendAdminChatReply', err)
    return { ok: false, error: 'Could not send reply. Please try again.' }
  }
}
