import { Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { TicketMessage } from './TicketDetail'
import { formatDate } from './ticketDisplay'

// The ticket's messages oldest first: the customer's emails and the agents' replies.
export function TicketThread({ messages }: { messages: TicketMessage[] }) {
  return (
    <section aria-labelledby="ticket-messages">
      <h2 id="ticket-messages" className="mb-3">
        Messages
      </h2>
      {messages.length === 0 ? (
        <p className="text-muted-foreground">No messages.</p>
      ) : (
        <ol className="grid gap-4">
          {messages.map((message) => {
            const isReply = message.direction === 'outbound'
            const sender = message.senderName ?? message.senderEmail
            return (
              <li
                key={message.id}
                aria-label={`${isReply ? 'Reply' : 'Message'} from ${sender}`}
                // Replies are inset and tinted so the customer's messages stand out.
                className={isReply ? 'sm:ml-8' : undefined}
              >
                <Card className={isReply ? 'bg-muted' : undefined}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                      {sender}
                      {isReply && <Badge variant="secondary">Reply</Badge>}
                    </CardTitle>
                    <CardDescription>
                      {message.senderName && <>{message.senderEmail} · </>}
                      <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Bodies are plain text, so keep the email's line breaks. */}
                    <p className="text-sm break-words whitespace-pre-wrap">{message.body}</p>
                    {message.attachmentNames.length > 0 && (
                      <ul aria-label="Attachments" className="mt-4 flex flex-wrap gap-2">
                        {message.attachmentNames.map((name, i) => (
                          <li key={`${name}-${i}`}>
                            <Badge variant="outline">
                              <Paperclip />
                              {name}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
