import { Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { TicketDetailData } from '@/types/ticket'
import { ReplyDeliveryStatus } from './ReplyDeliveryStatus'
import { formatDate } from './ticketDisplay'

// The ticket's messages oldest first, as a conversation: the customer's emails on the left in
// mint bubbles, the agents' replies on the right in pine, each reply with whether it was emailed.
export function TicketThread({ ticket }: { ticket: TicketDetailData }) {
  const { messages } = ticket
  return (
    <section aria-labelledby="ticket-messages">
      <h2 id="ticket-messages" className="sr-only">
        Messages
      </h2>
      {messages.length === 0 ? (
        <p className="text-muted-foreground">No messages.</p>
      ) : (
        <ol className="grid gap-6">
          {messages.map((message) => {
            const isReply = message.direction === 'outbound'
            const sender = message.senderName ?? message.senderEmail
            return (
              <li
                key={message.id}
                aria-label={`${isReply ? 'Reply' : 'Message'} from ${sender}`}
                className={cn(
                  'flex max-w-full flex-col gap-1.5 sm:max-w-[80%]',
                  isReply ? 'items-end justify-self-end' : 'items-start justify-self-start',
                )}
              >
                <div
                  className={cn(
                    'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1 text-xs text-muted-foreground',
                    isReply && 'justify-end text-right',
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{sender}</span>
                  {isReply && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[0.625rem]">
                      Reply
                    </Badge>
                  )}
                  {message.senderName && <span>{message.senderEmail}</span>}
                  <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                </div>
                <div
                  className={cn(
                    'max-w-full rounded-2xl px-4 py-3',
                    // The tight corner points at the side the message came from.
                    isReply
                      ? 'rounded-tr-md bg-primary text-primary-foreground'
                      : 'rounded-tl-md bg-muted text-foreground',
                  )}
                >
                  {/* Bodies are plain text, so keep the email's line breaks. */}
                  <p className="break-words whitespace-pre-wrap">{message.body}</p>
                  {message.attachmentNames.length > 0 && (
                    <ul aria-label="Attachments" className="mt-3 flex flex-wrap gap-2">
                      {message.attachmentNames.map((name, i) => (
                        <li key={`${name}-${i}`}>
                          <Badge variant="outline" className="border-current/25 bg-background/15 text-current">
                            <Paperclip />
                            {name}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {isReply && <ReplyDeliveryStatus ticketId={ticket.id} message={message} />}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
