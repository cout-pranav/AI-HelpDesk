import { createGoogle } from '@ai-sdk/google'
import { generateText } from 'ai'
import type { TicketDetailData } from '@/types/ticket'

// Gemini is called from the browser with a VITE_ key, so the key is public in the bundle.
// Phase 3 moves this behind the backend's IAiService; callers only use the exported functions.
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

const summarizeInstructions =
  'You summarize customer support tickets for the agent handling them. In 2 to 4 short ' +
  'sentences, say what the customer needs, what has been done or promised so far, and what is ' +
  'still open or should happen next. Only use facts from the ticket. ' +
  'Return only the summary as plain text, with no preamble, headings or Markdown.'

export async function summarizeTicket(ticket: TicketDetailData) {
  const transcript = ticket.messages
    .map((m) => {
      const from = m.direction === 'outbound' ? 'Agent' : 'Customer'
      const sender = m.senderName ? `${m.senderName} <${m.senderEmail}>` : m.senderEmail
      const attachments = m.attachmentNames.length
        ? `\nAttachments: ${m.attachmentNames.join(', ')}`
        : ''
      return `${from} ${sender} at ${m.createdAt}:\n${m.body}${attachments}`
    })
    .join('\n\n---\n\n')
  const { text } = await generateText({
    model,
    instructions: summarizeInstructions,
    prompt:
      `Ticket subject: ${ticket.subject}\nStatus: ${ticket.status}\n\n` +
      `Messages, oldest first:\n\n${transcript}`,
  })
  return text.trim()
}
