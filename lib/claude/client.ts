import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) throw new Error('CLAUDE_API_KEY environment variable is not set')
  if (!client) client = new Anthropic({ apiKey, maxRetries: 1 })
  return client
}
