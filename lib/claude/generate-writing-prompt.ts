import { getClaudeClient } from './client'
import type { TestType } from '@/lib/types'

export async function generateWritingPrompt(testType: TestType): Promise<string> {
  const client = getClaudeClient()
  const style = testType === 'gate' ? 'narrative or imaginative' : 'persuasive or expository'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Create one ${style} writing prompt for a Western Australian Year 6 student preparing for the ${testType === 'gate' ? 'GATE/ASET' : 'scholarship'} test. The prompt should be engaging and age-appropriate. Return only the prompt text, nothing else.`,
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}
