import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { resolveModel, providerConfig } from '@/lib/ai-models'
import { getEffectiveTier, isUserVerified } from '@/lib/subscription'

// Allow streaming responses to run longer on Vercel
export const maxDuration = 60

const MONTHLY_TOKEN_LIMIT = 150_000

const SYSTEM_PROMPT = `You are a helpful AI assistant for Overseed, a platform connecting brands with global creators and influencers. Help users with global expansion strategies, market insights, creator collaboration advice, and platform-related questions. Be concise, friendly, and professional.

FORMATTING RULES:
- Always use proper markdown formatting for readability
- Use bullet lists (- item) or numbered lists (1. item) — each item on its own line
- Use headings (## / ###) to organize longer answers
- Use **bold** for key terms and emphasis
- Use tables (| col1 | col2 |) for comparisons or structured data
- Never put multiple list items or numbered points on the same line
- Add blank lines between paragraphs and before/after lists

DOCUMENT GENERATION RULES:
When the user's request is a deliverable (not just a question), you should generate a document. Signals for document generation:
- The content is long-form (whitepaper, report, contract, guide, plan, etc.)
- User says "做一份", "帮我写一个文档", "生成一份报告", "write a document", "create a report", "generate a guide", "make a whitepaper", "draft a contract"
- The content has specific format requirements (Word/Excel/PPT)
- The content is a deliverable meant to be saved, shared, or printed — not just read in chat

When you detect a document request, you MUST start your VERY FIRST LINE with exactly this format (no text before it):
[DOC:FORMAT:TITLE_HERE]
where FORMAT is one of: docx, xlsx, pdf — and TITLE_HERE is a short descriptive title.

Choose the format based on the content:
- **docx** (Word): reports, whitepapers, guides, contracts, articles, plans — any long-form text document
- **xlsx** (Excel): data tables, comparisons, pricing lists, product catalogs, financial data, any content that is primarily structured/tabular
- **pdf** (PDF): when user explicitly asks for PDF, or for polished read-only documents

If the user explicitly requests a format (e.g. "Excel表格", "Word文档", "PDF"), use that format.

Then write the full document content in markdown starting from the next line. Do NOT add any text before [DOC:...]. Do NOT explain that you are generating a document.

For Excel documents specifically: structure your content using markdown tables. Each major table should have a heading (## or ###) above it that becomes the sheet name.

When the request is conversational, exploratory ("你觉得...", "解释一下...", "帮我分析一下", "tell me about", "what do you think"), or the user just wants to read the answer — respond normally WITHOUT the [DOC:] marker.

Simple rule: content is an answer → respond directly | content is a product/deliverable → start with [DOC:format:title] marker.

IMPORTANT: When generating a document, after the full document content, add a line with exactly [/DOC] to mark the end of the document. Then on the next lines, write a brief friendly summary in proper markdown format:
- Start with a 1-2 sentence overview of what the document covers
- Use a bullet list (with - or *) for key sections or highlights
- Add any helpful next-step tips as separate bullet points
- Use proper markdown line breaks between paragraphs
This summary is what the user sees in chat — the full document content is only in the downloadable file.`

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = (session.user as any).id

  // The assistant requires a verified account
  if (!(await isUserVerified(userId))) {
    return NextResponse.json(
      { error: 'Verification required to use the AI assistant', code: 'VERIFICATION_REQUIRED' },
      { status: 403 }
    )
  }

  // Effective tier (handles expired verified-user trials)
  const subscriptionTier = await getEffectiveTier(userId)
  if (subscriptionTier !== 'PRO') {
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthlyUsage = await prisma.aiTokenUsage.aggregate({
    where: { userId, createdAt: { gte: startOfMonth } },
    _sum: { totalTokens: true },
  })

  const usedTokens = monthlyUsage._sum.totalTokens || 0
  if (usedTokens >= MONTHLY_TOKEN_LIMIT) {
    return NextResponse.json(
      { error: 'Monthly AI usage limit reached. Your allowance resets next month.' },
      { status: 429 }
    )
  }

  const { messages, provider, chatId } = await req.json()
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
  }

  // `provider` carries the model id from the picker (old values still work)
  const modelDef = resolveModel(provider)
  const conn = providerConfig(modelDef.provider)
  if (!conn.apiKey) {
    return NextResponse.json(
      { error: `${modelDef.label} is not configured yet. Please pick another model.` },
      { status: 503 }
    )
  }
  const useProvider = modelDef.id

  try {
    // Get or create chat for history
    let activeChatId = chatId
    if (!activeChatId) {
      const chat = await prisma.aiChat.create({
        data: { userId, provider: useProvider },
      })
      activeChatId = chat.id
    }

    // Save user message
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage?.role === 'user') {
      await prisma.aiChatMessage.create({
        data: { chatId: activeChatId, role: 'user', content: lastUserMessage.content },
      })
      if (messages.filter((m: any) => m.role === 'user').length === 1) {
        // Quick fallback title immediately
        const fallbackTitle = lastUserMessage.content.slice(0, 50) + (lastUserMessage.content.length > 50 ? '...' : '')
        await prisma.aiChat.update({ where: { id: activeChatId }, data: { title: fallbackTitle } })

        // Generate smart title in background (non-blocking)
        const chatIdForTitle = activeChatId
        const msgForTitle = lastUserMessage.content
        setTimeout(async () => {
          try {
            const client = new Anthropic({ apiKey: process.env.CLAUDE_API })
            const resp = await client.messages.create({
              model: process.env.AI_MODEL_CLAUDE || 'claude-sonnet-5',
              max_tokens: 30,
              messages: [{ role: 'user', content: `Generate a short title (max 6 words, no quotes) summarizing this chat topic. Reply with ONLY the title, nothing else. If the message is in Chinese, reply in Chinese.\n\nMessage: ${msgForTitle.slice(0, 200)}` }],
            })
            const smartTitle = resp.content[0]?.type === 'text' ? resp.content[0].text.trim().slice(0, 60) : null
            if (smartTitle) {
              await prisma.aiChat.update({ where: { id: chatIdForTitle }, data: { title: smartTitle } })
            }
          } catch {}
        }, 100)
      }
    }

    // Stream response
    const encoder = new TextEncoder()
    let fullContent = ''
    let totalTokens = 0
    let promptTokens = 0
    let completionTokens = 0
    const model = modelDef.model

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send chatId as first event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'meta', chatId: activeChatId })}\n\n`))

          if (modelDef.provider === 'anthropic') {
            const client = new Anthropic({ apiKey: conn.apiKey })
            const response = await client.messages.create({
              model: modelDef.model,
              max_tokens: 16384,
              system: SYSTEM_PROMPT,
              stream: true,
              messages: messages.map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
            })

            for await (const event of response) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                const text = event.delta.text
                fullContent += text
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`))
              }
              if (event.type === 'message_delta' && event.usage) {
                completionTokens = event.usage.output_tokens
              }
              if (event.type === 'message_start' && event.message.usage) {
                promptTokens = event.message.usage.input_tokens
              }
            }
            totalTokens = promptTokens + completionTokens
          } else if (modelDef.provider === 'deepseek' || modelDef.provider === 'kimi') {
            // OpenAI-compatible chat.completions streaming
            const client = new OpenAI({ apiKey: conn.apiKey, baseURL: conn.baseURL })
            const response = await client.chat.completions.create({
              model: modelDef.model,
              stream: true,
              stream_options: { include_usage: true },
              messages: [
                { role: 'system' as const, content: SYSTEM_PROMPT },
                ...messages.map((m: any) => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content as string,
                })),
              ],
            })

            for await (const chunk of response) {
              const text = chunk.choices?.[0]?.delta?.content
              if (text) {
                fullContent += text
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`))
              }
              if (chunk.usage) {
                promptTokens = chunk.usage.prompt_tokens || 0
                completionTokens = chunk.usage.completion_tokens || 0
                totalTokens = chunk.usage.total_tokens || promptTokens + completionTokens
              }
            }
          } else {
            // OpenAI models use the Responses API with streaming
            const res = await fetch('https://api.openai.com/v1/responses', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${conn.apiKey}`,
              },
              body: JSON.stringify({
                model: modelDef.model,
                instructions: SYSTEM_PROMPT,
                input: messages.map((m: any) => ({
                  role: m.role as 'user' | 'assistant',
                  content: m.content,
                })),
                stream: true,
              }),
            })

            if (!res.ok) {
              const errText = await res.text()
              throw new Error(`OpenAI API error: ${res.status} ${errText}`)
            }

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            if (reader) {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
                  try {
                    const event = JSON.parse(line.slice(6))
                    if (event.type === 'response.output_text.delta' && event.delta) {
                      fullContent += event.delta
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta })}\n\n`))
                    }
                    if (event.type === 'response.completed' && event.response?.usage) {
                      promptTokens = event.response.usage.input_tokens || 0
                      completionTokens = event.response.usage.output_tokens || 0
                      totalTokens = promptTokens + completionTokens
                    }
                  } catch {}
                }
              }
            }
          }

          // Save assistant reply and update chat
          const savedMessage = await prisma.aiChatMessage.create({
            data: { chatId: activeChatId, role: 'assistant', content: fullContent },
          })
          await prisma.aiChat.update({
            where: { id: activeChatId },
            data: { updatedAt: new Date() },
          })

          if (totalTokens > 0) {
            await prisma.aiTokenUsage.create({
              data: { userId, promptTokens, completionTokens, totalTokens, model },
            })
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', messageId: savedMessage.id })}\n\n`))
          controller.close()
        } catch (error: any) {
          console.error('AI stream error:', error?.message || error)
          const isAuthError = error?.message?.includes('authentication') || error?.message?.includes('apiKey') || error?.message?.includes('API key')
          const userMessage = isAuthError
            ? 'AI service is temporarily unavailable. Please try a different model or try again later.'
            : 'Something went wrong. Please try again.'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: userMessage })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('AI Chat error:', error?.message || error)
    return NextResponse.json({ error: error?.message || 'Failed to generate response' }, { status: 500 })
  }
}
