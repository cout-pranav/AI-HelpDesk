import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TicketDetail } from '@/tickets/TicketDetail'

export function TicketDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  // Only digits are a valid id; anything else would just 404 on the API.
  const ticketId = id && /^\d+$/.test(id) ? Number(id) : null

  return (
    <>
      <Link
        to="/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to tickets
      </Link>
      {ticketId === null ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>Ticket not found.</AlertDescription>
        </Alert>
      ) : (
        <TicketDetail ticketId={ticketId} canAssign={user?.role === 'Admin'} />
      )}
    </>
  )
}
