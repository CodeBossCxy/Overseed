'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import CreatorWorkspaceLayout from '@/components/workspace/CreatorWorkspaceLayout'
import BrandWorkspaceLayout from '@/components/workspace/BrandWorkspaceLayout'
import { useViewMode } from '@/lib/hooks/useViewMode'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'
import { getPusherClient } from '@/lib/pusher-client'

interface ConversationItem {
  id: string
  applicationId: string
  campaignTitle: string
  campaignId: string
  influencerId?: string
  brandProfileId?: string
  favorited?: boolean
  otherUser: {
    id: string
    name: string | null
    image: string | null
    userType: string
  } | null
  lastMessage: {
    id: string
    content: string
    senderId: string
    isSystemMessage: boolean
    createdAt: string
  } | null
  unreadCount: number
  updatedAt: string
}

interface MessageItem {
  id: string
  conversationId: string
  senderId: string
  content: string
  messageType: string
  isSystemMessage: boolean
  createdAt: string
  attachmentUrl?: string | null
  attachmentName?: string | null
  attachmentMime?: string | null
}

export default function MessagesPage() {
  const { data: session } = useSession()
  const { t, locale } = useLanguage()
  const { isBrand } = useViewMode()
  const searchParams = useSearchParams()
  const userId = (session?.user as any)?.id
  const Shell = isBrand ? BrandWorkspaceLayout : CreatorWorkspaceLayout

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [convDetails, setConvDetails] = useState<any>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showMobileThread, setShowMobileThread] = useState(false)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set())
  const [autoTranslate, setAutoTranslate] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('overseed-auto-translate') === 'true'
    }
    return false
  })
  const [showSettings, setShowSettings] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<{ file: File; preview?: string } | null>(null)
  const attachmentRef = useRef<HTMLInputElement>(null)
  const [savedCreatorIds, setSavedCreatorIds] = useState<Set<string>>(new Set())
  const [listQuery, setListQuery] = useState('')
  const [listFilter, setListFilter] = useState<'all' | 'unread' | 'favorites'>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Brands see a bookmark next to creators they saved
  useEffect(() => {
    if (!isBrand) return
    fetch('/api/saved-creators?idsOnly=1')
      .then((res) => (res.ok ? res.json() : { ids: [] }))
      .then((data) => setSavedCreatorIds(new Set(data.ids || [])))
      .catch(() => {})
  }, [isBrand])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/messages/conversations/${convId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
        setConvDetails(data.conversation)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetchConversations()
    }
  }, [session, fetchConversations])

  // Auto-select conversation from URL param
  useEffect(() => {
    const convId = searchParams.get('conv')
    if (convId && conversations.length > 0) {
      const found = conversations.find((c) => c.id === convId)
      if (found) {
        setSelectedConvId(convId)
        setShowMobileThread(true)
      }
    }
  }, [searchParams, conversations])

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId)
    }
  }, [selectedConvId, fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Real-time updates via Pusher (falls back to polling if unavailable)
  useEffect(() => {
    const pusher = getPusherClient()

    if (pusher && selectedConvId) {
      const convChannel = pusher.subscribe(`conversation-${selectedConvId}`)
      convChannel.bind('new-message', () => {
        fetchMessages(selectedConvId)
        fetchConversations()
      })
      return () => {
        convChannel.unbind_all()
        pusher.unsubscribe(`conversation-${selectedConvId}`)
      }
    } else if (selectedConvId) {
      // Fallback polling
      const interval = setInterval(() => {
        fetchMessages(selectedConvId)
        fetchConversations()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [selectedConvId, fetchMessages, fetchConversations])

  // Subscribe to user channel for inbox-level updates
  useEffect(() => {
    const pusher = getPusherClient()
    if (pusher && userId) {
      const userChannel = pusher.subscribe(`user-${userId}`)
      userChannel.bind('conversation-updated', () => {
        fetchConversations()
      })
      return () => {
        userChannel.unbind_all()
        pusher.unsubscribe(`user-${userId}`)
      }
    }
  }, [userId, fetchConversations])

  // Detect if text is likely in a different language than the user's locale
  const isLikelyForeignLanguage = (text: string): boolean => {
    const hasChinese = /[\u4e00-\u9fff]/.test(text)
    const hasMainlyLatin = /^[a-zA-Z0-9\s.,!?'"()\-:;@#$%&*/\\[\]{}|~`+=<>^_]+$/.test(text.trim())
    if (locale === 'zh') return hasMainlyLatin && text.trim().length > 3
    return hasChinese
  }

  const translateMessage = async (msgId: string, text: string) => {
    if (translations[msgId]) {
      // Toggle off
      setTranslations((prev) => {
        const next = { ...prev }
        delete next[msgId]
        return next
      })
      return
    }

    setTranslatingIds((prev) => new Set(prev).add(msgId))
    try {
      const res = await fetch('/api/messages/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: locale }),
      })
      if (res.ok) {
        const data = await res.json()
        setTranslations((prev) => ({ ...prev, [msgId]: data.translated }))
      }
    } catch (error) {
      console.error('Translation error:', error)
    } finally {
      setTranslatingIds((prev) => {
        const next = new Set(prev)
        next.delete(msgId)
        return next
      })
    }
  }

  // Auto-translate incoming messages from the other user
  useEffect(() => {
    if (!autoTranslate || messages.length === 0) return
    const otherMessages = messages.filter(
      (m) => m.senderId !== userId && !m.isSystemMessage && !translations[m.id] && isLikelyForeignLanguage(m.content)
    )
    otherMessages.forEach((m) => {
      translateMessage(m.id, m.content)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, autoTranslate])

  const toggleAutoTranslate = () => {
    const newVal = !autoTranslate
    setAutoTranslate(newVal)
    localStorage.setItem('overseed-auto-translate', String(newVal))
    if (!newVal) {
      setTranslations({})
    }
  }

  const handleSelectConversation = (convId: string) => {
    setTranslations({})

    setSelectedConvId(convId)
    setShowMobileThread(true)
    // Clear unread for this conversation in local state
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    )
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && !attachment) || !selectedConvId || sendingMessage) return

    setSendingMessage(true)
    const content = input.trim()
    const selectedAttachment = attachment
    setInput('')
    setAttachment(null)

    // Optimistic update
    const optimisticMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      conversationId: selectedConvId,
      senderId: userId,
      content,
      messageType: 'text',
      isSystemMessage: false,
      createdAt: new Date().toISOString(),
      attachmentName: selectedAttachment?.file.name,
      attachmentMime: selectedAttachment?.file.type,
      attachmentUrl: selectedAttachment?.preview,
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      let uploaded: { url: string; name: string; mime: string } | null = null
      if (selectedAttachment) {
        const form = new FormData(); form.set('file', selectedAttachment.file)
        const uploadRes = await fetch('/api/messages/upload', { method: 'POST', body: form })
        const uploadData = await uploadRes.json().catch(() => ({}))
        if (!uploadRes.ok) throw new Error(uploadData.message || 'Attachment upload failed')
        uploaded = uploadData
      }
      const res = await fetch(
        `/api/messages/conversations/${selectedConvId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, attachmentUrl: uploaded?.url, attachmentName: uploaded?.name, attachmentMime: uploaded?.mime }),
        }
      )

      if (res.ok) {
        setSendError(null)
        // Refresh messages to get the real message
        await fetchMessages(selectedConvId)
        await fetchConversations()
      } else {
        const data = await res.json().catch(() => ({}))
        // Remove the optimistic message; restore the input so nothing is lost
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
        setInput(content)
        if (selectedAttachment) setAttachment(selectedAttachment)
        setSendError(
          data.code === 'BANNED_CONTENT'
            ? (t.messages as any)?.bannedWarning ||
                'This message can’t be sent: sharing off-platform contact info (WhatsApp, WeChat, phone numbers, emails) is not allowed.'
            : data.message || 'Failed to send message'
        )
      }
    } catch (error: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      setInput(content)
      if (selectedAttachment) setAttachment(selectedAttachment)
      setSendError(error?.message || 'Failed to send message')
      console.error('Error sending message:', error)
    } finally {
      setSendingMessage(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US'

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === 0) {
      return date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return t.messages?.yesterday || 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString(localeTag, { weekday: 'short' })
    }
    return date.toLocaleDateString(localeTag, { month: 'short', day: 'numeric' })
  }

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })
  }

  const isFavorited = (conv: ConversationItem) =>
    !!conv.favorited || (isBrand && !!conv.influencerId && savedCreatorIds.has(conv.influencerId))

  const visibleConversations = conversations.filter((conv) => {
    if (listFilter === 'unread' && conv.unreadCount === 0) return false
    if (listFilter === 'favorites' && !isFavorited(conv)) return false
    const q = listQuery.trim().toLowerCase()
    if (!q) return true
    return (
      (conv.otherUser?.name || '').toLowerCase().includes(q) ||
      (conv.campaignTitle || '').toLowerCase().includes(q)
    )
  })

  const selectedConv = conversations.find((cv) => cv.id === selectedConvId)

  if (!session) {
    return (
      <Shell>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">{t.common.loading}</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 flex flex-col"
        style={{ height: 'calc(100vh - 64px)' }}
      >
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {t.messages?.title || 'Messages'}
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {t.messages?.subtitle || 'Communicate with your collaborators'}
          </p>
        </div>

        {/* Main container */}
        <div className="flex-1 workspace-glass-card rounded-2xl flex overflow-hidden">
          {/* Conversation List (left panel) */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-gray-100 flex flex-col ${
              showMobileThread ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="relative">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder={(t.messages as any)?.searchMessages || 'Search messages...'}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-full text-sm border border-transparent focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div className="flex gap-1.5">
                {([['all', (t.messages as any)?.tabAll || 'All'], ['unread', (t.messages as any)?.tabUnread || 'Unread'], ['favorites', (t.messages as any)?.tabFavorites || 'Favorites']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setListFilter(key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs transition ${
                      listFilter === key ? 'selected-option-glass text-gray-900 font-bold' : 'bg-gray-100/70 text-gray-600 font-semibold hover:bg-white/55'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  {t.common.loading}
                </div>
              ) : visibleConversations.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {t.messages?.noConversations || 'No conversations yet'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {t.messages?.noConversationsDesc ||
                      'Conversations will appear here when you start messaging with brands or creators.'}
                  </p>
                </div>
              ) : (
                visibleConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition text-left border-b border-gray-50 ${
                      selectedConvId === conv.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {conv.otherUser?.image ? (
                        <img
                          src={conv.otherUser.image}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-primary-600 font-medium text-sm">
                          {conv.otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 truncate flex items-center gap-1.5">
                          {conv.otherUser?.name || t.messages.unknownUser}
                          {isFavorited(conv) && (
                            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l2.9 6.26 6.86.62-5.18 4.55 1.52 6.72L12 16.67l-6.1 3.48 1.52-6.72L2.24 8.88l6.86-.62L12 2z" />
                            </svg>
                          )}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {conv.lastMessage
                            ? formatTime(conv.lastMessage.createdAt)
                            : ''}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {conv.campaignTitle}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-gray-600 truncate">
                          {conv.lastMessage?.isSystemMessage
                            ? `${t.messages.systemPrefix} ${conv.lastMessage.content}`
                            : conv.lastMessage?.content || ''}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0 ml-2">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Message Thread (right panel) */}
          <div
            className={`flex-1 flex flex-col ${
              !showMobileThread ? 'hidden md:flex' : 'flex'
            }`}
          >
            {selectedConvId && convDetails ? (
              <>
                {/* Thread header */}
                <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                  <button
                    onClick={() => setShowMobileThread(false)}
                    className="md:hidden p-1 hover:bg-gray-100 rounded"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
                      {convDetails.otherUser?.name || t.messages.unknownUser}
                      {selectedConv && isFavorited(selectedConv) && (
                        <>
                          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l2.9 6.26 6.86.62-5.18 4.55 1.52 6.72L12 16.67l-6.1 3.48 1.52-6.72L2.24 8.88l6.86-.62L12 2z" />
                          </svg>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-semibold">
                            {(t.messages as any)?.favorited || 'Favorited'}
                          </span>
                        </>
                      )}
                    </h3>
                    <Link
                      href={`/campaign/${convDetails.campaignId}`}
                      className="text-xs text-primary-600 hover:underline truncate block"
                    >
                      {(t.messages as any)?.messageContext || 'Message context:'} {convDetails.campaignTitle}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isBrand && selectedConv?.brandProfileId && (
                      <Link
                        href={`/brand/${selectedConv.brandProfileId}`}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:text-primary-700 transition whitespace-nowrap"
                      >
                        {(t.messages as any)?.viewBrandProfile || 'View Brand Profile'}
                      </Link>
                    )}
                    {isBrand && selectedConv?.influencerId ? (
                      <Link
                        href={`/influencer/${selectedConv.influencerId}`}
                        className="text-xs text-gray-500 hover:text-primary-600"
                      >
                        {(t.messages as any)?.viewCreatorProfile || 'View Creator Profile'}
                      </Link>
                    ) : (
                      <Link
                        href={`/campaign/${convDetails.campaignId}`}
                        className="text-xs text-gray-500 hover:text-primary-600"
                      >
                        {t.messages?.viewCampaign || 'View Campaign'}
                      </Link>
                    )}
                    {/* Settings button */}
                    <div className="relative">
                      <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition"
                        title={t.nav.settings}
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      {showSettings && (
                        <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-20">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={autoTranslate}
                              onChange={toggleAutoTranslate}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700">
                              {t.messages?.autoTranslate || 'Auto-translate all messages'}
                            </span>
                          </label>
                          <p className="text-xs text-gray-400 mt-1.5 ml-6">
                            {t.messages?.autoTranslateDesc || 'Automatically translate messages in other languages'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg) =>
                    msg.isSystemMessage ? (
                      <div key={msg.id} className="text-center">
                        <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
                          {msg.content}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.senderId === userId
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                      >
                        <div className="max-w-[75%]">
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              msg.senderId === userId
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">
                              {msg.content}
                            </p>
                            {msg.attachmentUrl && (msg.attachmentMime?.startsWith('image/') ? (
                              <a href={msg.attachmentUrl} target="_blank" rel="noreferrer"><img src={msg.attachmentUrl} alt={msg.attachmentName || 'Attachment'} className="mt-2 max-h-56 rounded-xl object-cover" /></a>
                            ) : (
                              <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-sm underline">📎 {msg.attachmentName || 'Attachment'}</a>
                            ))}
                            {/* Translated text */}
                            {translations[msg.id] && (
                              <div
                                className={`mt-2 pt-2 border-t text-sm whitespace-pre-wrap ${
                                  msg.senderId === userId
                                    ? 'border-primary-400/30 text-primary-100'
                                    : 'border-gray-200 text-gray-600'
                                }`}
                              >
                                {translations[msg.id]}
                              </div>
                            )}
                            <p
                              className={`text-xs mt-1 ${
                                msg.senderId === userId
                                  ? 'text-primary-200'
                                  : 'text-gray-400'
                              }`}
                            >
                              {formatMessageTime(msg.createdAt)}
                            </p>
                          </div>
                          {/* Translate button */}
                          {(
                            <button
                              onClick={() => translateMessage(msg.id, msg.content)}
                              disabled={translatingIds.has(msg.id)}
                              className={`mt-1 text-xs flex items-center gap-1 hover:underline disabled:opacity-50 ${
                                msg.senderId === userId
                                  ? 'ml-auto text-gray-400'
                                  : 'text-gray-400'
                              }`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                              </svg>
                              {translatingIds.has(msg.id)
                                ? (t.messages?.translating || 'Translating...')
                                : translations[msg.id]
                                  ? (t.messages?.showOriginal || 'Show original')
                                  : (t.messages?.translate || 'Translate')}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-gray-100 p-4">
                  {sendError && (
                    <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-sm text-red-700">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="flex-1">{sendError}</span>
                      <button type="button" onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600" aria-label="Dismiss">✕</button>
                    </div>
                  )}
                  <form onSubmit={handleSend} className="flex items-end gap-3">
                    <input ref={attachmentRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) setAttachment({file:f, preview:f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined}); e.currentTarget.value='' }} />
                    <button type="button" onClick={() => attachmentRef.current?.click()} className="p-3 rounded-xl workspace-glass-control text-gray-500" title="Attach image or PDF">📎</button>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        t.messages?.typeMessage || 'Type a message...'
                      }
                      rows={1}
                      className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
                      style={{ maxHeight: '120px' }}
                    />
                    <button
                      type="submit"
                      disabled={(!input.trim() && !attachment) || sendingMessage}
                      className="px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </button>
                  </form>
                  {attachment && <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/50 px-3 py-1.5 text-xs"><span>📎 {attachment.file.name}</span><button onClick={() => setAttachment(null)} aria-label="Remove attachment">×</button></div>}
                  {/* Safety note */}
                  <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      {(t.messages as any)?.safetyNote || 'Please communicate safely and do not make any payments outside the platform.'}
                    </span>
                    <Link href="/contact" className="text-primary-500 hover:underline whitespace-nowrap">
                      {(t.messages as any)?.reportUser || 'Report user'}
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">
                    {t.messages?.selectConversation ||
                      'Select a conversation to start messaging'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}
