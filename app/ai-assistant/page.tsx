'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import RoleShell from '@/components/workspace/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTheme } from '@/components/ThemeProvider'


// Keep in sync with lib/ai-models.ts (client components can't import it
// directly without leaking env handling).
const AI_MODEL_OPTIONS = [
  { id: 'gpt-5.6-luna', label: 'OpenAI GPT-5.6 Luna' },
  { id: 'gpt-5.6-sol', label: 'OpenAI GPT-5.6 Sol' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6' },
  { id: 'kimi-k3', label: 'Kimi K3' },
]

interface Message {
  id: string
  dbId?: string // database ID for persisted messages
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  feedback?: 'like' | 'dislike' | null
}

interface ChatSummary {
  id: string
  title: string
  provider: string
  updatedAt: string
}

export default function AIAssistantPage() {
  const { data: session } = useSession()
  const { t } = useLanguage()
  const subscriptionTier = (session?.user as any)?.subscriptionTier || 'FREE'
  const isProUser = subscriptionTier === 'PRO'
  const isLoggedIn = !!session
  const userType = (session?.user as any)?.userType
  const isCreator = userType === 'INFLUENCER'
  const { themeMode } = useTheme()
  const themeIcon = themeMode === 'brand' ? '/icon-blue.png' : '/icon-pink.png'

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [provider, setProvider] = useState<string>('claude-sonnet-5')
  const [chatId, setChatId] = useState<string | null>(null)
  const [chatList, setChatList] = useState<ChatSummary[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [usagePercent, setUsagePercent] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const startProgress = () => {
    setProgress(0)
    const start = Date.now()
    if (progressRef.current) clearInterval(progressRef.current)
    progressRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      // Fast start, then slow asymptotic approach to 90%
      const p = Math.min(90, 90 * (1 - Math.exp(-elapsed / 15)))
      setProgress(Math.round(p))
    }, 200)
  }

  const stopProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current)
    progressRef.current = null
    setProgress(100)
    setTimeout(() => setProgress(0), 800)
  }

  const scrollToBottom = () => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadChatList = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-chat/history')
      if (res.ok) setChatList(await res.json())
    } catch {}
  }, [])

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-chat/usage')
      if (res.ok) {
        const data = await res.json()
        setUsagePercent(data.percentage)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (isProUser) {
      loadChatList()
      loadUsage()
    }
  }, [isProUser, loadChatList, loadUsage])

  const loadChat = async (id: string) => {
    try {
      const res = await fetch(`/api/ai-chat/history/${id}`)
      if (res.ok) {
        const data = await res.json()
        setChatId(data.id)
        setProvider(data.provider && AI_MODEL_OPTIONS.some((m) => m.id === data.provider) ? data.provider : 'claude-sonnet-5')
        setMessages(
          data.messages.map((m: any) => ({
            id: m.id,
            dbId: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.createdAt),
            feedback: m.feedback || null,
          }))
        )
      }
    } catch {}
  }

  const startNewChat = () => {
    setChatId(null)
    setMessages([])
  }

  const deleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch('/api/ai-chat/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: id }),
      })
      setChatList((prev) => prev.filter((c) => c.id !== id))
      if (chatId === id) startNewChat()
    } catch {}
  }

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingChatId(id)
    setEditingTitle(currentTitle)
  }

  const submitRename = async () => {
    if (!editingChatId || !editingTitle.trim()) {
      setEditingChatId(null)
      return
    }
    try {
      await fetch('/api/ai-chat/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: editingChatId, title: editingTitle.trim() }),
      })
      setChatList((prev) =>
        prev.map((c) => (c.id === editingChatId ? { ...c, title: editingTitle.trim() } : c))
      )
    } catch {}
    setEditingChatId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !isProUser) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    startProgress()

    const assistantId = (Date.now() + 1).toString()

    try {
      const chatHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, provider, chatId }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: data.error || t.aiAssistant.errorGeneric, timestamp: new Date() },
        ])
        setIsLoading(false)
        stopProgress()
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: t.aiAssistant.errorReadResponse, timestamp: new Date() },
        ])
        setIsLoading(false)
        stopProgress()
        return
      }

      let sseBuffer = ''
      let contentSoFar = ''
      let pendingUpdate = false
      let decided = false // have we decided doc vs direct?
      let isDocMode = false
      let messageAdded = false

      const flushContent = () => {
        pendingUpdate = false
        const snapshot = contentSoFar
        if (!messageAdded) {
          // First flush — add the message
          messageAdded = true
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: snapshot, timestamp: new Date() },
          ])
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: snapshot } : m
            )
          )
        }
      }

      const processEvents = (line: string) => {
        if (!line.startsWith('data: ')) return
        try {
          const event = JSON.parse(line.slice(6))
          if (event.type === 'meta' && event.chatId && !chatId) {
            setChatId(event.chatId)
          } else if (event.type === 'text') {
            contentSoFar += event.text

            // Buffer initial tokens to detect [DOC:] marker
            if (!decided) {
              // Check if we have enough to decide
              if (/^\s*\[DOC:/.test(contentSoFar)) {
                decided = true
                isDocMode = true
                // For doc mode: add message immediately with whatever we have
                // but DON'T stream content visually — the card UI handles it
                if (!pendingUpdate) {
                  pendingUpdate = true
                  requestAnimationFrame(flushContent)
                }
              } else if (contentSoFar.length > 10 || !contentSoFar.trimStart().startsWith('[')) {
                // Not a doc — it's a direct answer. Flush buffered content and stream normally.
                decided = true
                isDocMode = false
                if (!pendingUpdate) {
                  pendingUpdate = true
                  requestAnimationFrame(flushContent)
                }
              }
              // Still undecided — keep buffering (don't render yet)
              return
            }

            if (!isDocMode) {
              // Direct answer — stream to UI
              if (!pendingUpdate) {
                pendingUpdate = true
                requestAnimationFrame(flushContent)
              }
            } else {
              // Doc mode — update content silently for the card (less frequent updates)
              if (!pendingUpdate) {
                pendingUpdate = true
                requestAnimationFrame(flushContent)
              }
            }
          } else if (event.type === 'done' && event.messageId) {
            // Attach the DB message ID so feedback can be persisted
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, dbId: event.messageId } : m))
            )
          } else if (event.type === 'error') {
            contentSoFar = contentSoFar || event.error || t.aiAssistant.errorGeneric
            decided = true
            flushContent()
          }
        } catch {}
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop() || ''

        for (const line of lines) {
          processEvents(line)
        }
      }

      // Final flush
      if (!decided) {
        decided = true
      }
      flushContent()

      loadChatList()
    } catch {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === assistantId)
        if (exists) {
          return prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || t.aiAssistant.errorRetry }
              : m
          )
        }
        return [
          ...prev,
          { id: assistantId, role: 'assistant', content: t.aiAssistant.errorRetry, timestamp: new Date() },
        ]
      })
    } finally {
      setIsLoading(false)
      stopProgress()
      loadUsage()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleEditResend = (messageIndex: number) => {
    const message = messages[messageIndex]
    if (message.role !== 'user') return
    setInput(message.content)
    // Remove this message and everything after it
    setMessages((prev) => prev.slice(0, messageIndex))
    inputRef.current?.focus()
  }

  const handleFeedback = async (messageId: string, dbId: string | undefined, value: 'like' | 'dislike') => {
    // Toggle: if same feedback clicked again, remove it
    const currentMsg = messages.find((m) => m.id === messageId)
    const newValue = currentMsg?.feedback === value ? null : value

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback: newValue } : m))
    )

    if (dbId) {
      try {
        await fetch('/api/ai-chat/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: dbId, feedback: newValue }),
        })
      } catch {}
    }
  }

  const parseDocMarker = (content: string) => {
    // Match [DOC:format:title] or [DOC:title] at the start
    const match = content.match(/^\s*\[DOC:(?:(docx|xlsx|pdf):)?(.+?)\]\s*\n?/)
    // Also match <!--doc:title-->
    const match2 = !match ? content.match(/^\s*<!--\s*doc:(.+?)-->\s*\n?/) : null

    if (match) {
      const format = (match[1] || 'docx') as 'docx' | 'xlsx' | 'pdf'
      const title = match[2].trim()
      const afterMarker = content.slice(match[0].length)
      const endMatch = afterMarker.split(/\[\/DOC\]\s*\n?/)
      const docContent = endMatch[0]
      const summary = endMatch.length > 1 ? endMatch.slice(1).join('').trim() : ''
      return { isDoc: true, format, title, docContent, summary }
    }
    if (match2) {
      const afterMarker = content.slice(match2[0].length)
      const endMatch = afterMarker.split(/\[\/DOC\]\s*\n?/)
      return { isDoc: true, format: 'docx' as const, title: match2[1].trim(), docContent: endMatch[0], summary: endMatch.length > 1 ? endMatch.slice(1).join('').trim() : '' }
    }
    return { isDoc: false, format: 'docx' as const, title: '', docContent: content, summary: '' }
  }

  const handleDownloadDoc = async (content: string, title: string, format: 'docx' | 'xlsx' | 'pdf' = 'docx') => {
    try {
      const res = await fetch('/api/ai-chat/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title, format, theme: themeMode }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert(t.aiAssistant.errorGenerateDoc)
    }
  }

  const formatLabels: Record<string, { label: string; ext: string; icon: string }> = {
    docx: { label: t.aiAssistant.formatWord, ext: '.docx', icon: 'W' },
    xlsx: { label: t.aiAssistant.formatExcel, ext: '.xlsx', icon: 'X' },
    pdf: { label: t.aiAssistant.formatPdf, ext: '.pdf', icon: 'P' },
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return t.common.today
    if (days === 1) return t.common.yesterday
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const ai = t.aiAssistant.intro
  const introHelps = [ai.help1, ai.help2, ai.help3, ai.help4, ai.help5]
  const examplePrompts = [ai.prompt1, ai.prompt2, ai.prompt3, ai.prompt4]
  const comingSoon = [
    { title: ai.soon1Title, desc: ai.soon1Desc },
    { title: ai.soon2Title, desc: ai.soon2Desc },
    { title: ai.soon3Title, desc: ai.soon3Desc },
    { title: ai.soon4Title, desc: ai.soon4Desc },
    { title: ai.soon5Title, desc: ai.soon5Desc },
  ]

  // Public AI intro — logged-out visitors get the feature intro, example
  // prompts and Coming Soon cards instead of the chat or an upgrade wall.
  if (!isLoggedIn) {
    return (
      <RoleShell>
        <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
          {/* Hero */}
          <div className="text-center mb-10">
            <img src={themeIcon} alt="Overseed" className="w-14 h-14 rounded-2xl mx-auto mb-4" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{ai.title}</h1>
            <p className="mt-3 text-gray-600 max-w-xl mx-auto">{ai.subtitle}</p>
          </div>

          {/* What it helps with + CTA */}
          <div className="bg-white rounded-2xl shadow-md p-6 mb-6 max-w-2xl mx-auto">
            <p className="text-sm font-medium text-gray-700 mb-3">{ai.helpsWithLabel}</p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {introHelps.map((h) => (
                <li key={h} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-medium shadow-sm"
              >
                {ai.startCta}
              </Link>
              <Link href="/auth/signin" className="text-sm text-primary-600 hover:text-primary-700 transition">
                {t.nav.login}
              </Link>
            </div>
            <p className="mt-3 text-xs text-gray-400">{ai.brandOnlyNote}</p>
          </div>

          {/* Example prompts */}
          <div className="max-w-2xl mx-auto mb-12">
            <p className="text-sm font-medium text-gray-700 mb-3">{ai.examplePromptsLabel}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {examplePrompts.map((p) => (
                <div key={p} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700">
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Coming soon */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">{ai.comingSoonLabel}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingSoon.map((c) => (
                <div key={c.title} className="relative bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <span className="absolute top-3 right-3 text-[10px] font-semibold tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {ai.comingSoonTag}
                  </span>
                  <h3 className="font-semibold text-gray-900 mb-1.5 pr-20">{c.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RoleShell>
    )
  }

  // Creators don't have AI access yet.
  if (isCreator) {
    return (
      <RoleShell>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <img src={themeIcon} alt="Overseed" className="w-14 h-14 rounded-2xl mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{ai.creatorTitle}</h1>
          <p className="text-gray-600">{ai.creatorDesc}</p>
        </div>
      </RoleShell>
    )
  }

  return (
    <RoleShell noFooter>
      <div className="h-full flex overflow-hidden">
        {/* Sidebar */}
        {isProUser && sidebarOpen && (
          <div className="w-72 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
            {/* Sidebar header */}
            <div className="p-4 flex items-center justify-between">
              <button
                onClick={startNewChat}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t.aiAssistant.newChat}
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="ml-2 p-2 rounded-lg hover:bg-gray-200 transition text-gray-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {chatList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-xs">{t.aiAssistant.noConversations}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {chatList.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => editingChatId !== chat.id && loadChat(chat.id)}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        chatId === chat.id
                          ? 'bg-primary-100/60 text-primary-900'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <img src={themeIcon} alt="Overseed" className="w-7 h-7 rounded-lg flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        {editingChatId === chat.id ? (
                          <input
                            autoFocus
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={submitRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') submitRename()
                              if (e.key === 'Escape') setEditingChatId(null)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-sm font-medium bg-white border border-primary-300 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        ) : (
                          <p className="text-sm font-medium truncate leading-tight">{chat.title}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(chat.updatedAt)}</p>
                      </div>
                      {editingChatId !== chat.id && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                          <button
                            onClick={(e) => startRename(chat.id, chat.title, e)}
                            className="p-1 rounded-md hover:bg-gray-200 transition text-gray-300 hover:text-gray-600"
                            title={t.aiAssistant.rename}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => deleteChat(chat.id, e)}
                            className="p-1 rounded-md hover:bg-red-50 transition text-gray-300 hover:text-red-500"
                            title={t.common.delete}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Usage tracker */}
            {usagePercent !== null && (
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-500">{t.aiAssistant.usage}</span>
                  <span className="text-xs font-semibold text-gray-700">{usagePercent}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      usagePercent >= 100
                        ? 'bg-red-500'
                        : usagePercent >= 80
                        ? 'bg-amber-500'
                        : usagePercent >= 50
                        ? 'bg-yellow-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {usagePercent >= 100
                    ? t.aiAssistant.usageExhausted
                    : usagePercent >= 80
                    ? t.aiAssistant.usageHigh
                    : usagePercent >= 50
                    ? t.aiAssistant.usageMedium
                    : t.aiAssistant.usageLow}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              {isProUser && !sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <div>
                <h1 className="text-sm font-semibold text-gray-900">
                  {chatId ? (chatList.find(c => c.id === chatId)?.title || 'Chat') : t.aiAssistant.title}
                </h1>
                {!chatId && (
                  <p className="text-[11px] text-gray-400 leading-tight">{t.aiAssistant.subtitle}</p>
                )}
              </div>
            </div>

            {isProUser && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium text-gray-800 border-0 focus:outline-none focus:ring-2 focus:ring-primary-100 cursor-pointer"
                  title="AI model"
                >
                  {AI_MODEL_OPTIONS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {progress > 0 && (
            <div className="flex-shrink-0 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
              <div className="max-w-3xl mx-auto flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 font-medium tabular-nums w-8 text-right">
                  {progress}%
                </span>
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {/* Welcome */}
              {messages.length === 0 && isProUser && (
                <div className="flex justify-center items-center min-h-[60vh]">
                  <div className="text-center max-w-md">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
                      <svg className="w-7 h-7 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                      </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-2">{t.aiAssistant.welcome}</h2>
                    <div className="grid grid-cols-2 gap-2 mt-6">
                      {[t.aiAssistant.tip1, t.aiAssistant.tip2, t.aiAssistant.tip3, t.aiAssistant.tip4].map((tip, i) => (
                        <button
                          key={i}
                          onClick={() => setInput(tip)}
                          className="text-left p-3 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/30 transition text-sm text-gray-600 leading-snug"
                        >
                          {tip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((message, msgIndex) => {
                const isStillStreaming = isLoading && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id
                return (
                <div key={message.id} className={`group/msg flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                  {message.role === 'assistant' && (
                    <img src={themeIcon} alt="Overseed" className="w-7 h-7 rounded-lg flex-shrink-0 mt-0.5" />
                  )}
                  <div className={`min-w-0 ${message.role === 'user' ? 'max-w-[75%]' : 'max-w-[85%]'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-50 text-gray-800 border border-gray-100'
                      }`}
                    >
                      {message.role === 'assistant' ? (() => {
                        const { isDoc, format: docFormat, title: docTitle, docContent, summary } = parseDocMarker(message.content)
                        const fl = formatLabels[docFormat] || formatLabels.docx
                        const formatColors: Record<string, string> = {
                          docx: 'bg-blue-100 text-blue-600',
                          xlsx: 'bg-emerald-100 text-emerald-600',
                          pdf: 'bg-red-100 text-red-600',
                        }
                        if (isDoc && docContent.length > 50) {
                          return (
                            <>
                              <div className="p-4 bg-gradient-to-br from-primary-50 to-white border border-primary-200 rounded-xl">
                                <div className="flex items-center gap-3 mb-3">
                                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isStillStreaming ? 'bg-primary-100' : formatColors[docFormat] || 'bg-primary-100'}`}>
                                    {isStillStreaming ? (
                                      <svg className="w-5 h-5 text-primary-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                      </svg>
                                    ) : (
                                      <span className="text-sm font-bold">{fl.icon}</span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{docTitle}</p>
                                    <p className="text-xs text-gray-500">
                                      {isStillStreaming ? t.aiAssistant.generatingDocument.replace('{progress}', String(progress)) : `${fl.label} (${fl.ext})`}
                                    </p>
                                  </div>
                                </div>
                                {isStillStreaming ? (
                                  <div className="w-full py-2.5 bg-gray-200 text-gray-500 text-sm font-medium rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
                                    <div className="flex gap-1">
                                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    {t.aiAssistant.generating}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleDownloadDoc(docContent, docTitle, docFormat)}
                                    className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition flex items-center justify-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    {t.aiAssistant.download.replace('{label}', fl.label)}
                                  </button>
                                )}
                              </div>
                              {!isStillStreaming && summary && (
                                <div className="ai-markdown mt-4 pt-3 border-t border-gray-100">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                                </div>
                              )}
                            </>
                          )
                        }
                        return (
                          <div className="ai-markdown">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{docContent}</ReactMarkdown>
                          </div>
                        )
                      })() : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    {!isStillStreaming && (
                      <div className={`flex items-center gap-1 mt-1 ${message.role === 'user' ? 'justify-end' : ''} opacity-0 group-hover/msg:opacity-100 transition-opacity`}>
                        {/* Copy */}
                        <button
                          onClick={() => handleCopy(message.id, message.content)}
                          className="p-1 rounded-md hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
                          title={t.aiAssistant.copy}
                        >
                          {copiedId === message.id ? (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>

                        {/* Edit & Resend (user messages only) */}
                        {message.role === 'user' && !isLoading && (
                          <button
                            onClick={() => handleEditResend(msgIndex)}
                            className="p-1 rounded-md hover:bg-gray-100 transition text-gray-400 hover:text-gray-600"
                            title={t.aiAssistant.editResend}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}

                        {/* Feedback (assistant messages only) */}
                        {message.role === 'assistant' && (
                          <>
                            <button
                              onClick={() => handleFeedback(message.id, message.dbId, 'like')}
                              className={`p-1 rounded-md transition ${
                                message.feedback === 'like'
                                  ? 'text-emerald-500 bg-emerald-50'
                                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                              title={t.aiAssistant.goodResponse}
                            >
                              <svg className="w-3.5 h-3.5" fill={message.feedback === 'like' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zm-10 11H7V10H4a2 2 0 00-2 2v7a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleFeedback(message.id, message.dbId, 'dislike')}
                              className={`p-1 rounded-md transition ${
                                message.feedback === 'dislike'
                                  ? 'text-red-500 bg-red-50'
                                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                              title={t.aiAssistant.badResponse}
                            >
                              <svg className="w-3.5 h-3.5" fill={message.feedback === 'dislike' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zm10-11h-3v11h1a2 2 0 002-2V6a2 2 0 00-2-2z" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )})}


              {/* Loading */}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-3">
                  <img src={themeIcon} alt="Overseed" className="w-7 h-7 rounded-lg flex-shrink-0" />
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pro gate */}
          {!isProUser && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center px-6">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-2">{t.aiAssistant.proOnly}</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">{t.aiAssistant.proOnlyDesc}</p>
                <Link
                  href="/dashboard/upgrade"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition font-medium shadow-md"
                >
                  {t.upgrade.upgradeToPro}
                </Link>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.aiAssistant.placeholder}
                  disabled={!isProUser || isLoading}
                  rows={1}
                  className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white resize-none disabled:opacity-50 disabled:cursor-not-allowed text-sm transition"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading || !isProUser}
                  className="absolute right-2 bottom-2 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7l7 7-7 7" />
                  </svg>
                </button>
              </form>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                {AI_MODEL_OPTIONS.find((m) => m.id === provider)?.label || provider} — responses may not always be accurate
              </p>
            </div>
          </div>
        </div>
      </div>
    </RoleShell>
  )
}
