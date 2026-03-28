import { getChatCompletionText } from './client'
import type { TestType } from '@/lib/types'

export async function generateWritingPrompt(testType: TestType): Promise<string> {
  const style = testType === 'gate' ? 'narrative or imaginative' : 'persuasive or expository'

  return getChatCompletionText({
    prompt: `Create one ${style} writing prompt for a Western Australian Year 6 student preparing for the ${testType === 'gate' ? 'GATE/ASET' : 'scholarship'} test. The prompt should be engaging and age-appropriate. Return only the prompt text, nothing else.`,
    maxTokens: 256,
  })
}
