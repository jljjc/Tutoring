import { getChatCompletionText, OPENAI_QUESTION_MODEL } from './client'
import type { TestType } from '@/lib/types'

export async function generateWritingPrompt(testType: TestType): Promise<string> {
  const style = testType === 'gate' ? 'narrative or imaginative' : 'persuasive or expository'

  return getChatCompletionText({
    model: OPENAI_QUESTION_MODEL,
    prompt: `Create one ${style} writing prompt for a high-performing Western Australian Year 6 student preparing for the ${testType === 'gate' ? 'GATE/ASET' : 'scholarship'} test for Year 7 entry. The prompt should feel exam-appropriate, intellectually engaging, and clearly above routine classroom work. Return only the prompt text, nothing else.`,
    maxTokens: 256,
  })
}
