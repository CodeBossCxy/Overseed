import PusherClient from 'pusher-js'

let pusherClient: PusherClient | null = null

export function getPusherClient(): PusherClient | null {
  if (typeof window === 'undefined') return null

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

  if (!key || !cluster) return null

  if (!pusherClient) {
    pusherClient = new PusherClient(key, {
      cluster,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
    })
    // Degrade quietly to the polling fallback instead of spamming the console
    // when the real-time service is unreachable (network/quota/config).
    pusherClient.connection.bind('error', () => {})
  }
  return pusherClient
}
