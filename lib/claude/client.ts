import OpenAI from 'openai'

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not set')
  if (!client) client = new OpenAI({ apiKey, maxRetries: 1 })
  return client
}

export const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o-mini'

export async function getChatCompletionText(params: {
  system?: string
  prompt: string
  maxTokens?: number
  json?: boolean
}): Promise<string> {
  const client = getOpenAIClient()

  const response = await client.chat.completions.create({
    model: OPENAI_TEXT_MODEL,
    temperature: 0.7,
    max_completion_tokens: params.maxTokens,
    response_format: params.json ? { type: 'json_object' } : undefined,
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      { role: 'user' as const, content: params.prompt },
    ],
  })

  return response.choices[0]?.message?.content?.trim() ?? ''
}
