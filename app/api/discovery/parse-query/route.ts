import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { AI_MODELS, providerConfig } from '@/lib/ai-models'
import { sanitizeParsedQuery, PARSE_SYSTEM_PROMPT } from '@/lib/discovery-ai'

// POST /api/discovery/parse-query — turn a free-form creator request into
// structured discovery filters. Brand-only. Uses a cheap fast model; not
// charged to the user (UX helper, the actual search bills as usual).

// Cheapest configured OpenAI-compatible provider first
const PARSE_MODEL_IDS = ['deepseek-v4-flash', 'kimi-k2.6', 'gpt-5.6-luna']

function pickModel() {
  for (const id of PARSE_MODEL_IDS) {
    const def = AI_MODELS.find((m) => m.id === id)
    if (!def) continue
    const cfg = providerConfig(def.provider)
    if (cfg.apiKey) return { def, cfg }
  }
  return null
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const brand = await prisma.brandProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!brand) {
    return NextResponse.json({ message: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 600) : ''
  if (text.length < 5) {
    return NextResponse.json({ message: 'Query too short', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const picked = pickModel()
  if (!picked) {
    return NextResponse.json({ message: 'AI parsing unavailable', code: 'AI_UNAVAILABLE' }, { status: 503 })
  }

  try {
    const client = new OpenAI({
      apiKey: picked.cfg.apiKey,
      baseURL: picked.cfg.baseURL,
      timeout: 12000,
    })
    const completion = await client.chat.completions.create({
      model: picked.def.model,
      // gpt-5.x rejects max_tokens/custom temperature; deepseek/kimi use the
      // classic parameters.
      ...(picked.def.provider === 'openai'
        ? { max_completion_tokens: 400 }
        : { max_tokens: 400, temperature: 0 }),
      messages: [
        { role: 'system', content: PARSE_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    })
    const reply = completion.choices?.[0]?.message?.content || ''
    // Models occasionally wrap JSON in code fences — take the outermost object
    const match = reply.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in model reply')
    const parsed = sanitizeParsedQuery(JSON.parse(match[0]))
    return NextResponse.json({ parsed })
  } catch (err: any) {
    console.warn('Discovery query parse failed:', err?.message)
    return NextResponse.json(
      { message: 'Could not parse the request', code: 'AI_PARSE_FAILED' },
      { status: 502 }
    )
  }
}
