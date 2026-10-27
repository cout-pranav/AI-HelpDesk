import { createGoogle } from '@ai-sdk/google'
import { generateText } from 'ai'

// Gemini is called from the browser with a VITE_ key, so the key is public in the bundle.
// Phase 3 moves this behind the backend's IAiService; callers only use polishReply.
const google = createGoogle({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })

const model = google('gemini-3.5-flash')

const polishInstructions =
  'You edit customer support replies written by an agent. Fix spelling and grammar, and make ' +
  'the reply clear, polite and professional. Keep the meaning, facts, promises and language of ' +
  'the original, and do not add information the agent did not write. Replace any greeting in ' +
  'the draft with "Hello <customer\'s first name>," on its own line, or "Hello," when the ' +
  'customer\'s name is unknown. Replace any sign-off in the draft with "Best regards," on its ' +
  'own line followed by the agent\'s name on the next line, and end the reply there. Add a few ' +
  'emojis where they suit a friendly tone (e.g. 😊 🙏 ✅), but none when the customer is upset ' +
  'or the news is bad. ' +
  'Return only the improved reply as plain text, with no preamble, quotes or Markdown.'

export async function polishReply({
  draft,
  subject,
  customerName,
  agentName,
}: {
  draft: string
  subject: string
  customerName: string | null
  agentName: string
}) {
  const { text } = await generateText({
    model,
    instructions: polishInstructions,
    prompt:
      `Ticket subject: ${subject}\nCustomer's name: ${customerName ?? 'unknown'}\n` +
      `Agent's name: ${agentName}\n\nAgent's draft reply:\n${draft}`,
  })
  return text.trim()
}
