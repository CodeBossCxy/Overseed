'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import RoleShell from '@/components/workspace/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { localizeApiError } from '@/lib/i18n/api-error'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTheme } from '@/components/ThemeProvider'
import ImageGenerationPanel from '@/components/ai/ImageGenerationPanel'


// Keep in sync with lib/ai-models.ts (client components can't import it
// directly without leaking env handling).
const AI_MODEL_OPTIONS = [
  { id: 'gpt-5.6-luna', label: 'ChatGPT · Advanced' },
  { id: 'gpt-5.6-sol', label: 'ChatGPT · Advanced Plus' },
  { id: 'claude-sonnet-5', label: 'Claude · Advanced Reasoning' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek · Standard Fast' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek · Standard Pro' },
  { id: 'kimi-k2.6', label: 'Kimi · Standard' },
  { id: 'kimi-k3', label: 'Kimi · Standard Creative' },
]

const AI_MODES = [
  { id: 'auto', icon: '✦', label: 'Auto', labelZh: '自动', desc: 'Automatically selects the best model', descZh: '自动选择最佳模型', model: 'claude-sonnet-5', recommended: true },
  { id: 'quick', icon: '⚡', label: 'Quick', labelZh: '快速', desc: 'Fast answers for everyday questions', descZh: '日常问题快速回答', model: 'deepseek-v4-flash' },
  { id: 'creative', icon: '✧', label: 'Creative', labelZh: '创意', desc: 'Marketing, branding & content creation', descZh: '营销、品牌和内容创作', model: 'kimi-k3' },
  { id: 'reasoning', icon: '◈', label: 'Reasoning', labelZh: '推理', desc: 'Complex analysis & strategic thinking', descZh: '复杂分析和战略思考', model: 'claude-sonnet-5' },
  { id: 'documents', icon: '▤', label: 'Documents', labelZh: '文档', desc: 'Read, summarize & analyze documents', descZh: '阅读、总结和分析文档', model: 'kimi-k2.6' },
  { id: 'general', icon: '◎', label: 'All-Purpose', labelZh: '通用', desc: 'General business assistance', descZh: '通用商业助手', model: 'gpt-5.6-luna' },
] as const

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
  const { t, locale } = useLanguage()
  const zh = locale === 'zh'
  const isLoggedIn = !!session
  const userType = (session?.user as any)?.userType
  const isCreator = userType === 'INFLUENCER'
  // Pricing v3: every tier gets monthly AI credits, so any signed-in
  // brand-side user can use the assistant (credits are the server-side gate).
  const isProUser = isLoggedIn && !isCreator
  const { themeMode } = useTheme()
  const themeIcon = themeMode === 'brand' ? '/icon-blue.png' : '/icon-pink.png'

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [provider, setProvider] = useState<string>('claude-sonnet-5')
  const [chatId, setChatId] = useState<string | null>(null)
  const [chatList, setChatList] = useState<ChatSummary[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [usagePercent, setUsagePercent] = useState<number | null>(null)
  const [creditsUsage, setCreditsUsage] = useState<{ used: number; limit: number; purchased: number } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toolBusy, setToolBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'image'>('chat')
  const [aiMode, setAiMode] = useState<string>('auto')
  const [modePickerOpen, setModePickerOpen] = useState(false)
  const [showAdvancedModels, setShowAdvancedModels] = useState(false)
  const modePickerRef = useRef<HTMLDivElement>(null)
  const [folders, setFolders] = useState<{ id: string; name: string; chatIds: string[] }[]>([])
  const [activeFolder, setActiveFolder] = useState<string | null>(null) // null = "All"
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const aiAttachmentRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSidebarOpen(window.matchMedia('(min-width: 768px)').matches)
  }, [])

  const [modePickerPos, setModePickerPos] = useState<{ left: number; bottom: number } | null>(null)
  const modeButtonRef = useRef<HTMLButtonElement>(null)

  // Close mode picker on click outside
  useEffect(() => {
    if (!modePickerOpen) return
    const handler = (e: MouseEvent) => {
      if (modePickerRef.current && !modePickerRef.current.contains(e.target as Node) &&
          modeButtonRef.current && !modeButtonRef.current.contains(e.target as Node)) {
        setModePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modePickerOpen])

  const toggleModePicker = () => {
    if (!modePickerOpen && modeButtonRef.current) {
      const rect = modeButtonRef.current.getBoundingClientRect()
      setModePickerPos({ left: rect.left, bottom: window.innerHeight - rect.top + 8 })
    }
    setModePickerOpen(!modePickerOpen)
  }

  const selectMode = (modeId: string, modelId?: string) => {
    setAiMode(modeId)
    if (modelId) setProvider(modelId)
    else {
      const mode = AI_MODES.find(m => m.id === modeId)
      if (mode) setProvider(mode.model)
    }
    setModePickerOpen(false)
    setShowAdvancedModels(false)
  }

  const currentMode = AI_MODES.find(m => m.id === aiMode)

  const attachToPrompt = async (file: File) => {
    setToolBusy(true)
    try {
      const form = new FormData(); form.set('file', file)
      const res = await fetch('/api/messages/upload', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Upload failed')
      setInput(prev => `${prev}${prev ? '\n\n' : ''}Attached file: [${data.name}](${data.url})`)
      inputRef.current?.focus()
    } catch (error: any) { alert(error.message || 'Upload failed') }
    finally { setToolBusy(false) }
  }

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
        setCreditsUsage({ used: data.used, limit: data.limit, purchased: data.purchased || 0 })
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
        if (window.matchMedia('(max-width: 767px)').matches) setSidebarOpen(false)
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
    if (window.matchMedia('(max-width: 767px)').matches) setSidebarOpen(false)
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
        const content =
          data.code === 'INSUFFICIENT_CREDITS'
            ? `${t.aiAssistant.insufficientCredits} [${t.aiAssistant.buyCreditsCta}](/pricing/brand)`
            : localizeApiError(t, data, t.aiAssistant.errorGeneric)
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content, timestamp: new Date() },
        ])
        if (data.code === 'INSUFFICIENT_CREDITS') loadUsage()
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
            <img src="/logo-horizontal.png" alt="Overseed" className="h-14 w-auto mx-auto mb-4 overseed-logo-ink" />
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
          <img src="/logo-horizontal.png" alt="Overseed" className="h-14 w-auto mx-auto mb-4 overseed-logo-ink" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{ai.creatorTitle}</h1>
          <p className="text-gray-600">{ai.creatorDesc}</p>
        </div>
      </RoleShell>
    )
  }

  // Derive the user's first name for the welcome greeting
  const userName = (session?.user as any)?.name?.split(' ')[0] || (session?.user as any)?.email?.split('@')[0] || (zh ? '用户' : 'there')

  // Group chat list into time buckets for the sidebar, filtered by active folder
  const groupChats = () => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000)
    const groups: { label: string; chats: ChatSummary[] }[] = [
      { label: zh ? '今天' : 'Today', chats: [] },
      { label: zh ? '本周' : 'This Week', chats: [] },
      { label: zh ? '近30天' : 'Last 30 Days', chats: [] },
      { label: zh ? '更早' : 'Older', chats: [] },
    ]
    const folder = activeFolder ? folders.find(f => f.id === activeFolder) : null
    const filtered = folder ? chatList.filter(c => folder.chatIds.includes(c.id)) : chatList
    for (const chat of filtered) {
      const d = new Date(chat.updatedAt)
      if (d >= todayStart) groups[0].chats.push(chat)
      else if (d >= weekStart) groups[1].chats.push(chat)
      else if (d >= monthStart) groups[2].chats.push(chat)
      else groups[3].chats.push(chat)
    }
    return groups.filter(g => g.chats.length > 0)
  }

  const suggestionCards = [
    {
      title: zh ? '市场进入策略' : 'Market entry strategy',
      desc: zh ? '获取针对特定地区的洞察和市场推广计划' : 'Get region-specific insights and go-to-market plans',
      prompt: zh ? '帮我制定进入东南亚市场的策略' : 'Help me build a market entry strategy for Southeast Asia',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'bg-teal-100 text-teal-600',
    },
    {
      title: zh ? '创作者合作' : 'Creator collaboration',
      desc: zh ? '找到创作者、外联模板和最佳实践' : 'Find creators, outreach templates and best practices',
      prompt: zh ? '帮我找到适合我品牌的创作者合作策略' : 'Help me find the right creator collaboration strategy for my brand',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'bg-rose-100 text-rose-500',
    },
    {
      title: zh ? '跨境营销活动' : 'Cross-border campaign',
      desc: zh ? '规划和优化全球营销活动' : 'Plan and optimize global campaigns',
      prompt: zh ? '帮我规划一个跨境营销活动' : 'Help me plan a cross-border marketing campaign',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-teal-100 text-teal-600',
    },
    {
      title: zh ? '本地化与洞察' : 'Localization & insights',
      desc: zh ? '针对不同市场和文化调整您的品牌' : 'Adapt your brand for different markets and cultures',
      prompt: zh ? '帮我了解如何将品牌本地化适应不同文化' : 'Help me localize my brand for different cultural markets',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-emerald-100 text-emerald-600',
    },
  ]

  return (
    <RoleShell noFooter>
      <div className="ai-assistant-page">
        <div className="ai-workspace rounded-3xl overflow-hidden">

        {/* Image Generation tab */}
        {activeTab === 'image' && <ImageGenerationPanel isProUser={isProUser} activeTab={activeTab} onTabChange={setActiveTab} />}

        {/* Conversation sidebar */}
        {activeTab === 'chat' && isProUser && sidebarOpen && (
          <button
            type="button"
            className="absolute inset-0 z-10 bg-black/20 md:hidden"
            aria-label={zh ? '关闭对话列表' : 'Close conversations'}
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {activeTab === 'chat' && isProUser && sidebarOpen && (
          <div className="conversation-sidebar w-[300px] flex-shrink-0 workspace-glass-card rounded-3xl overflow-hidden">
            {/* Search + close arrow row */}
            <div className="px-3 pt-3 pb-1.5 flex items-center gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder={zh ? '搜索对话...' : 'Search conversations...'}
                  className="w-full pl-8 pr-3 py-2 bg-white/50 border border-white/70 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-400 focus:bg-white transition"
                  readOnly
                />
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label={zh ? '关闭对话列表' : 'Close conversations'}
                className="p-2 rounded-lg text-gray-500 hover:bg-white/70 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Folder tabs */}
            <div className="px-3 pb-1 flex items-center gap-1.5 flex-shrink-0 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveFolder(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${
                  activeFolder === null
                    ? 'bg-primary-600 text-white'
                    : 'bg-white/50 text-gray-500 hover:bg-white/80 border border-white/60'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolder('__all__') }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverFolder(null)
                  const droppedChatId = e.dataTransfer.getData('text/plain')
                  if (droppedChatId) {
                    // Remove from all folders (move back to "All" / unfiled)
                    setFolders(prev => prev.map(f => ({ ...f, chatIds: f.chatIds.filter(id => id !== droppedChatId) })))
                  }
                }}
              >
                {zh ? '全部' : 'All'}
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(activeFolder === folder.id ? null : folder.id)}
                  className={`group/folder relative px-3 py-1 rounded-full text-xs font-medium transition whitespace-nowrap ${
                    activeFolder === folder.id
                      ? 'bg-primary-600 text-white'
                      : dragOverFolder === folder.id
                      ? 'bg-primary-100 text-primary-700 border border-primary-300'
                      : 'bg-white/50 text-gray-500 hover:bg-white/80 border border-white/60'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder.id) }}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverFolder(null)
                    const droppedChatId = e.dataTransfer.getData('text/plain')
                    if (droppedChatId) {
                      setFolders(prev => prev.map(f => ({
                        ...f,
                        chatIds: f.id === folder.id
                          ? (f.chatIds.includes(droppedChatId) ? f.chatIds : [...f.chatIds, droppedChatId])
                          : f.chatIds.filter(id => id !== droppedChatId),
                      })))
                    }
                  }}
                >
                  {folder.name}
                  <span
                    className="ml-1 hidden group-hover/folder:inline-block text-[10px] opacity-60 hover:opacity-100 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFolders(prev => prev.filter(f => f.id !== folder.id))
                      if (activeFolder === folder.id) setActiveFolder(null)
                    }}
                    title={zh ? '删除文件夹' : 'Remove folder'}
                  >
                    ×
                  </span>
                </button>
              ))}
              {addingFolder ? (
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => { setAddingFolder(false); setNewFolderName('') }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFolderName.trim()) {
                      setFolders(prev => [...prev, { id: Date.now().toString(), name: newFolderName.trim(), chatIds: [] }])
                      setAddingFolder(false)
                      setNewFolderName('')
                    }
                    if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName('') }
                  }}
                  className="px-2 py-1 rounded-full text-xs bg-white border border-primary-300 focus:outline-none focus:ring-1 focus:ring-primary-500 w-20"
                  placeholder={zh ? '名称' : 'Name'}
                />
              ) : (
                <button
                  onClick={() => setAddingFolder(true)}
                  className="p-1 rounded-full text-gray-400 hover:bg-white/70 hover:text-gray-600 transition flex-shrink-0"
                  title={zh ? '添加文件夹' : 'Add folder'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            {/* Chat list grouped by time */}
            <div className="conversation-list px-3 pt-1 pb-4">
              {chatList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                  <svg className="w-8 h-8 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-xs">{t.aiAssistant.noConversations}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupChats().map((group) => (
                    <div key={group.label}>
                      <p className="text-[10px] font-medium text-gray-300 uppercase tracking-wider px-2 mb-1 mt-1">{group.label}</p>
                      <div className="space-y-0.5">
                        {group.chats.map((chat) => (
                          <div
                            key={chat.id}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData('text/plain', chat.id); e.dataTransfer.effectAllowed = 'move' }}
                            onClick={() => editingChatId !== chat.id && loadChat(chat.id)}
                            className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                              chatId === chat.id
                                ? 'selected-option-glass text-gray-900'
                                : 'hover:bg-white/45 text-gray-700'
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
                                <p className={`text-sm truncate leading-tight ${chatId === chat.id ? 'font-bold' : 'font-medium'}`}>{chat.title}</p>
                              )}
                              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{formatDate(chat.updatedAt)}</p>
                            </div>
                            <div className="flex-shrink-0 flex items-center">
                              <span className="text-[10px] text-gray-400 group-hover:hidden">{formatDate(chat.updatedAt)}</span>
                              {editingChatId !== chat.id && (
                                <div className="hidden group-hover:flex items-center gap-0.5">
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
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* New Chat button at bottom */}
            <div className="p-4 border-t border-white/50 flex-shrink-0">
              <button
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-sm font-semibold hover:from-primary-700 hover:to-primary-600 transition shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t.aiAssistant.newChat}
              </button>
            </div>
          </div>
        )}

        {/* Main chat area (kept mounted so chat state survives tab switches) */}
        <div className={`chat-panel ${activeTab === 'chat' ? 'flex' : 'hidden'} min-w-0 relative workspace-glass-card`}>
          {/* Top bar */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/55 bg-white/35 backdrop-blur flex-shrink-0">
            <div className="flex items-center gap-3">
              {isProUser && !sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  aria-label={zh ? '打开对话列表' : 'Open conversations'}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/40 border border-white/60">
              <button
                onClick={() => setActiveTab('chat')}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm transition ${
                  activeTab === 'chat'
                    ? 'bg-white shadow-sm text-gray-900 font-bold'
                    : 'text-gray-500 font-medium hover:text-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {t.aiAssistant.tabChat}
              </button>
              <button
                onClick={() => setActiveTab('image')}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm transition ${
                  activeTab === 'image'
                    ? 'bg-white shadow-sm text-gray-900 font-bold'
                    : 'text-gray-500 font-medium hover:text-gray-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
                </svg>
                {t.aiAssistant.tabImage}
              </button>
            </div>
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
          <div ref={messagesContainerRef} className="chat-messages">
            <div className={`max-w-3xl mx-auto px-4 ${messages.length > 0 ? 'py-6 space-y-6' : 'h-full flex flex-col'}`}>

              {/* Welcome state */}
              {messages.length === 0 && isProUser && (
                <div className="flex-1 flex flex-col justify-center items-center py-6 sm:py-10">
                  <h2 className="text-2xl sm:text-3xl text-center break-words max-w-full font-bold text-gray-900 mb-2">
                    {zh ? `嗨，${userName} 👋` : `Hi ${userName} 👋`}
                  </h2>
                  <p className="text-lg text-gray-500 mb-1">
                    {zh ? '今天我能帮您做什么？' : 'How can I help you today?'}
                  </p>
                  <p className="text-sm text-gray-400 text-center max-w-md mb-10">
                    {zh
                      ? '获取全球扩张、创作者营销和品牌增长的洞察、创意和实用策略。'
                      : 'Get insights, ideas, and practical strategies for global expansion, creator marketing, and brand growth.'}
                  </p>

                  {/* Suggestion cards 2x2 grid */}
                  <div className="w-full max-w-2xl grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {suggestionCards.map((card) => (
                      <button
                        key={card.title}
                        onClick={() => setInput(card.prompt)}
                        className="flex items-center gap-3 p-4 bg-white/60 hover:bg-white/90 border border-white/80 rounded-2xl text-left transition group shadow-sm hover:shadow-md"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.color}`}>
                          {card.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{card.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{card.desc}</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
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
          <div className="chat-composer border-t border-white/55 bg-white/30 backdrop-blur px-4 py-3">
            <input ref={aiAttachmentRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) attachToPrompt(f); e.currentTarget.value='' }} />
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit}>
                <div className="relative bg-white/70 border border-white/80 rounded-2xl shadow-sm overflow-hidden">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.aiAssistant.placeholder}
                    disabled={!isProUser || isLoading}
                    rows={1}
                    className="w-full px-4 pt-3 pb-12 bg-transparent focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed text-sm text-gray-800 placeholder-gray-400 transition"
                    style={{ maxHeight: '120px' }}
                  />
                  {/* Bottom row of input */}
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 border-t border-gray-100/60">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!isProUser || toolBusy}
                        onClick={() => aiAttachmentRef.current?.click()}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-600 disabled:opacity-40"
                        title={zh ? '附件' : 'Attach file'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      {isProUser && (
                        <>
                          <button
                            ref={modeButtonRef}
                            type="button"
                            onClick={toggleModePicker}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100/80 hover:bg-gray-200/80 transition text-xs font-medium text-gray-600 cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            <span>{currentMode?.icon}</span>
                            <span>{zh ? currentMode?.labelZh : currentMode?.label}</span>
                            <svg className={`w-3 h-3 text-gray-400 transition-transform ${modePickerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {modePickerOpen && modePickerPos && (
                            <div
                              ref={modePickerRef}
                              className="fixed w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[9999]"
                              style={{ left: modePickerPos.left, bottom: modePickerPos.bottom }}
                            >
                              <div className="px-4 pt-4 pb-2">
                                <p className="text-xs font-semibold text-gray-900">{zh ? '选择 AI 模式' : 'Choose AI Mode'}</p>
                              </div>
                              <div className="px-2 pb-2">
                                {AI_MODES.map((mode) => (
                                  <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => selectMode(mode.id)}
                                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                                      aiMode === mode.id
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <span className="text-base mt-0.5 w-5 text-center flex-shrink-0">{mode.icon}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${aiMode === mode.id ? 'text-primary-700' : 'text-gray-900'}`}>{zh ? mode.labelZh : mode.label}</span>
                                        {'recommended' in mode && mode.recommended && (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-primary-100 text-primary-600">{zh ? '推荐' : 'Recommended'}</span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{zh ? mode.descZh : mode.desc}</p>
                                    </div>
                                    {aiMode === mode.id && (
                                      <svg className="w-4 h-4 text-primary-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <div className="border-t border-gray-100">
                                <button
                                  type="button"
                                  onClick={() => setShowAdvancedModels(!showAdvancedModels)}
                                  className="w-full flex items-center gap-2 px-5 py-3 text-xs font-medium text-gray-500 hover:bg-gray-50 transition"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {zh ? '高级模型选择' : 'Advanced Model Selection'}
                                  <svg className={`w-3 h-3 ml-auto transition-transform ${showAdvancedModels ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {showAdvancedModels && (
                                  <div className="px-2 pb-2">
                                    {AI_MODEL_OPTIONS.map((m) => (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => selectMode('advanced', m.id)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition ${
                                          provider === m.id && aiMode === 'advanced'
                                            ? 'bg-primary-50 text-primary-700 font-semibold'
                                            : 'text-gray-600 hover:bg-gray-50'
                                        }`}
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                                        {m.label}
                                        {provider === m.id && aiMode === 'advanced' && (
                                          <svg className="w-3.5 h-3.5 text-primary-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        disabled={!isProUser}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100/80 hover:bg-gray-200/80 transition text-xs font-medium text-gray-500 disabled:opacity-40"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        {zh ? '网络搜索' : 'Web search'}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading || !isProUser}
                      className="w-8 h-8 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-700 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </form>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                {currentMode ? `${currentMode.icon} ${zh ? currentMode.labelZh : currentMode.label}` : AI_MODEL_OPTIONS.find((m) => m.id === provider)?.label || provider} — {zh ? '回答仅供参考，请核实重要信息' : 'responses may not always be accurate'}
              </p>
            </div>
          </div>
        </div>
        </div> {/* end ai-workspace */}
      </div>
    </RoleShell>
  )
}
