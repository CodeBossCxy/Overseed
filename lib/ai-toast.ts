// Lightweight event bus for AI completion toasts.
// Components fire events; the toast renderer (mounted in WorkspaceLayout) listens.

export interface AiToast {
  id: string
  type: 'chat' | 'image'
  title: string
  body: string
  href?: string
}

type Listener = (toast: AiToast) => void

const listeners = new Set<Listener>()

export function onAiToast(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function fireAiToast(toast: Omit<AiToast, 'id'>) {
  const full: AiToast = { ...toast, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }
  listeners.forEach(fn => fn(full))

  // Also try browser Notification API for background tabs
  if (typeof window !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(toast.title, { body: toast.body, icon: '/icon-blue.png', tag: 'overseed-ai' })
    } catch {}
  }
}

/** Request browser notification permission (call once on user interaction) */
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}
