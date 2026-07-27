// AI assistant model registry — the single source of truth for which models
// the assistant offers. Each provider's actual model id can be overridden via
// env (AI_MODEL_<KEY>) without a code change, in case a vendor renames it.

export type AiProvider = 'openai' | 'anthropic' | 'deepseek' | 'kimi'

export interface AiModelDef {
  /** wire id sent by the client */
  id: string
  /** display label in the picker */
  label: string
  provider: AiProvider
  /** provider-side model id */
  model: string
}

export const AI_MODELS: AiModelDef[] = [
  { id: 'gpt-5.6-luna', label: 'OpenAI GPT-5.6 Luna', provider: 'openai', model: process.env.AI_MODEL_GPT_LUNA || 'gpt-5.6-luna' },
  { id: 'gpt-5.6-sol', label: 'OpenAI GPT-5.6 Sol', provider: 'openai', model: process.env.AI_MODEL_GPT_SOL || 'gpt-5.6-sol' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'anthropic', model: process.env.AI_MODEL_CLAUDE || 'claude-sonnet-5' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', provider: 'deepseek', model: process.env.AI_MODEL_DEEPSEEK_FLASH || 'deepseek-v4-flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'deepseek', model: process.env.AI_MODEL_DEEPSEEK_PRO || 'deepseek-v4-pro' },
  { id: 'kimi-k2.6', label: 'Kimi K2.6', provider: 'kimi', model: process.env.AI_MODEL_KIMI_K26 || 'kimi-k2.6' },
  { id: 'kimi-k3', label: 'Kimi K3', provider: 'kimi', model: process.env.AI_MODEL_KIMI_K3 || 'kimi-k3' },
]

export const DEFAULT_MODEL_ID = 'claude-sonnet-5'

export function resolveModel(id: string | undefined | null): AiModelDef {
  // Back-compat with the old two-provider picker values
  if (id === 'claude') return AI_MODELS.find((m) => m.provider === 'anthropic')!
  if (id === 'openai') return AI_MODELS.find((m) => m.provider === 'openai')!
  return AI_MODELS.find((m) => m.id === id) || AI_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)!
}

/** Provider connection details (OpenAI-compatible providers share the shape). */
export function providerConfig(provider: AiProvider): { apiKey: string | undefined; baseURL?: string } {
  switch (provider) {
    case 'openai':
      return { apiKey: process.env.CHAT_API }
    case 'anthropic':
      return { apiKey: process.env.CLAUDE_API }
    case 'deepseek':
      return { apiKey: process.env.DEEPSEEK_API_KEY, baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1' }
    case 'kimi':
      return { apiKey: process.env.KIMI_API_KEY, baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1' }
  }
}
