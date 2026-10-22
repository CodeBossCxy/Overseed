export async function webSearch(query: string): Promise<string | null> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ q: query, num: 5 }),
    })

    if (!res.ok) return null

    const data = await res.json()
    const organic: Array<{ title?: string; snippet?: string; link?: string }> = data.organic || []

    if (!organic.length) return null

    const lines = organic.slice(0, 5).map((r, i) => {
      const title = r.title || 'Untitled'
      const snippet = r.snippet || ''
      const link = r.link || ''
      return `${i + 1}. **${title}**\n   ${snippet}\n   Source: ${link}`
    })

    return lines.join('\n\n')
  } catch {
    return null
  }
}
