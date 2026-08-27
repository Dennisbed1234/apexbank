'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  getMyChat,
  sendUserChatMessage,
  type ChatMessageView,
} from '@/app/actions/chat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Near-real-time chat via short polling (2s).
 * True push (WebSocket / SSE / Ably) can replace this later without UI changes.
 */
export function ChatSupport() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [text, setText] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastCount = useRef(0)

  async function refresh() {
    try {
      const data = await getMyChat()
      setMessages(data.messages)
      setLoaded(true)
      lastCount.current = data.messages.length
    } catch {
      setLoaded(true)
    }
  }

  useEffect(() => {
    if (!open) return
    void refresh()
    // Fast poll for near-instant admin replies without extra infra
    const id = setInterval(() => {
      void refresh()
    }, 2000)
    return () => clearInterval(id)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    startTransition(async () => {
      try {
        const result = await sendUserChatMessage(body)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setText('')
        await refresh()
      } catch {
        toast.error('Could not send message. Please try again.')
      }
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[420px] w-[min(100vw-2rem,360px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-sm font-semibold">Chat support</p>
              <p className="text-xs opacity-90">Live help · replies in seconds</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 hover:bg-primary-foreground/10"
              aria-label="Close chat"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {!loaded && (
              <p className="text-center text-xs text-muted-foreground">Loading…</p>
            )}
            {loaded && messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Say hello — an agent will reply from Operations.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <p>{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              disabled={isPending}
            />
            <Button type="submit" size="icon" disabled={isPending || !text.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        <MessageCircle className="size-5" />
        Chat support
      </button>
    </div>
  )
}
