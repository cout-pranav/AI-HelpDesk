import { createGoogle } from '@ai-sdk/google'
import { generateText } from 'ai'

// Gemini is called from the browser with a VITE_ key, so the key is public in the bundle.
// Phase 3 moves this behind the backend's IAiService; callers only use polishReply.
const google = createGoogle({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })

const model = google('gemini-3.5-flash')

const polishInstructions =
  'You edit customer support replies written by an agent. Fix spelling and grammar, and make ' +
  'the reply clear, polite and professional. Keep the meaning, facts, promises and language of ' +
  'the original, and do not add information, greetings or sign-offs the agent did not write. ' +
  'Return only the improved reply as plain text, with no preamble, quotes or Markdown.'

export async function polishReply({ draft, subject }: { draft: string; subject: string }) {
  const { text } = await generateText({
    model,
    instructions: polishInstructions,
    prompt: `Ticket subject: ${subject}\n\nAgent's draft reply:\n${draft}`,
  })
  return text.trim()
}
