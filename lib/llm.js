import Anthropic from '@anthropic-ai/sdk'

// Provider config — all providers speak the Anthropic Messages API.
// MiniMax uses a compatible endpoint so code is identical; only baseURL/apiKey/model differ.
const PROVIDERS = {
  claude: {
    apiKey: () => process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  },
  minimax: {
    baseURL: () => process.env.MINIMAX_BASE_URL ?? 'https://api.minimax.io/anthropic',
    apiKey: () => process.env.MINIMAX_API_KEY,
    model: () => process.env.MINIMAX_MODEL ?? 'MiniMax-M3',
  },
}

/**
 * Returns { client, model } for the given provider name.
 * client is an Anthropic SDK instance configured for that provider.
 */
export function getClient(provider = 'claude') {
  const cfg = PROVIDERS[provider]
  if (!cfg) throw new Error(`Unknown LLM provider: ${provider}`)

  const opts = { apiKey: cfg.apiKey() }
  if (cfg.baseURL) {
    const url = cfg.baseURL()
    if (url) opts.baseURL = url
  }

  const model = typeof cfg.model === 'function' ? cfg.model() : cfg.model
  return { client: new Anthropic(opts), model }
}
