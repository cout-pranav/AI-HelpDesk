import { Loader2, MailCheck, MailX, RotateCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import type { TicketMessage } from '@/types/ticket'
import { useResendReply } from './useResendReply'

// Whether a reply was emailed to the customer, with a Resend button when the email failed.
export function ReplyDeliveryStatus({ ticketId, message }: { ticketId: number; message: TicketMessage }) {
  const resend = useResendReply(ticketId)

  switch (message.deliveryStatus) {
    case 'pending':
      return (
        <Badge variant="outline">
          <Loader2 className="animate-spin" />
          Sending email…
        </Badge>
      )
    case 'sent':
      return (
        <Badge variant="outline">
          <MailCheck />
          Emailed
        </Badge>
      )
    case 'failed':
      return (
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive">
            <MailX />
            Email failed
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resend.isPending}
            onClick={() => resend.mutate(message.id)}
          >
            {resend.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
            Resend
          </Button>
          {resend.isError && (
            <span role="alert" className="text-sm font-normal text-destructive">
              {errorMessage(resend.error, 'Could not resend the email.')}
            </span>
          )}
        </span>
      )
    default:
      // Saved while email sending wasn't configured, or before replies were emailed.
      return <Badge variant="outline">Not emailed</Badge>
  }
}
