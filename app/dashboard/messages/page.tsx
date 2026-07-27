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
  const [savedCreatorIds, setSavedCreatorIds] = useState<Set<string>>(new Set())
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
    if (!input.trim() || !selectedConvId || sendingMessage) return

    setSendingMessage(true)
    const content = input.trim()
    setInput('')

    // Optimistic update
    const optimisticMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      conversationId: selectedConvId,
      senderId: userId,
      content,
      messageType: 'text',
      isSystemMessage: false,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch(
        `/api/messages/conversations/${selectedConvId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
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
        setSendError(
          data.code === 'BANNED_CONTENT'
            ? (t.messages as any)?.bannedWarning ||
                'This message can’t be sent: sharing off-platform contact info (WhatsApp, WeChat, phone numbers, emails) is not allowed.'
            : data.message || 'Failed to send message'
        )
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      setInput(content)
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
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col"
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
        <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-100 flex overflow-hidden">
          {/* Conversation List (left panel) */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-gray-100 flex flex-col ${
              showMobileThread ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                {t.messages?.conversations || 'Conversations'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  {t.common.loading}
                </div>
              ) : conversations.length === 0 ? (
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
                conversations.map((conv) => (
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
                          {isBrand && conv.influencerId && savedCreatorIds.has(conv.influencerId) && (
                            <svg className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
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
                    <h3 className="font-semibold text-gray-900 truncate">
                      {convDetails.otherUser?.name || t.messages.unknownUser}
                    </h3>
                    <Link
                      href={`/campaign/${convDetails.campaignId}`}
                      className="text-xs text-primary-600 hover:underline truncate block"
                    >
                      {convDetails.campaignTitle}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/campaign/${convDetails.campaignId}`}
                      className="text-xs text-gray-500 hover:text-primary-600"
                    >
                      {t.messages?.viewCampaign || 'View Campaign'}
                    </Link>
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
                      disabled={!input.trim() || sendingMessage}
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
