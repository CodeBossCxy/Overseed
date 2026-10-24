import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import OpenAI from 'openai'
import { checkRateLimit } from '@/lib/rate-limit'

const client = new OpenAI({ apiKey: process.env.CHAT_API })

// Translation is free (0 credits, pricing v4) but rate-limited: 60/hour/user.
const TRANSLATE_LIMIT = 60
const TRANSLATE_WINDOW_MS = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const rate = checkRateLimit(
      `translate:${(session.user as any).id}`,
      TRANSLATE_LIMIT,
      TRANSLATE_WINDOW_MS
    )
    if (!rate.ok) {
      return NextResponse.json(
        { message: 'Too many translation requests. Try again later.', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      )
    }

    const { text, targetLanguage } = await req.json()

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { message: 'text and targetLanguage are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const langName = targetLanguage === 'zh' ? 'Chinese (Simplified)' : 'English'

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a translator. Translate the following text to ${langName}. Rules:
- Return ONLY the translated text, no explanations.
- Preserve ALL markdown syntax exactly: headings (## ), bold (**), italic (*), bullet lists (- ), numbered lists, links, code blocks.
- Keep heading levels unchanged (e.g. "## About" → "## 关于").
- Keep list markers as "- " (dash + space), never replace them with "·" or other symbols.
- Do not add or remove any markdown formatting.
- If the text is already in ${langName}, return it unchanged.`,
        },
        { role: 'user', content: text },
      ],
      max_tokens: 1024,
    })

    let translated = completion.choices[0]?.message?.content || text

    // Fix common markdown corruption from translation:
    // "# #Title" → "## Title" (Google splits ## into # #)
    translated = translated.replace(/^(#\s)+#(?=\s|\S)/gm, (m: string) => '#'.repeat((m.match(/#/g) || []).length))
    translated = translated.replace(/^(#{1,6})([^ #\n])/gm, '$1 $2')
    // "* *bold* *" → "**bold**" (Google splits ** into * *)
    translated = translated.replace(/\*\s\*/g, '**')
    // "· item" or "• item" → "- item"
    translated = translated.replace(/^[\s]*[·•]\s*/gm, '- ')
    // Clean spaces inside bold, then restore list marker spacing
    translated = translated.replace(/(\*\*)\s+/g, '$1').replace(/\s+(\*\*)/g, '$1')
    translated = translated.replace(/^(\s*-)\*\*/gm, '$1 **')

    return NextResponse.json({ translated })
  } catch (error) {
    console.error('Translation error:', error)
    return NextResponse.json(
      { message: 'Translation failed', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
