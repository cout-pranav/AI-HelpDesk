import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import type { TicketDetailData } from './TicketDetail'
import { useAddReply } from './useAddReply'

const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Reply cannot be empty.')
    .max(10000, 'Reply must be at most 10,000 characters.'), // the API's limit
})

type ReplyValues = z.infer<typeof replySchema>

export function TicketReplyForm({ ticket }: { ticket: TicketDetailData }) {
  const addReply = useAddReply(ticket.id)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReplyValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: '' },
  })

  const onSubmit = handleSubmit((values) => addReply.mutate(values, { onSuccess: () => reset() }))

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Reply to customer">
      <FieldGroup>
        {addReply.isError && (
          <ErrorAlert>{errorMessage(addReply.error, 'Could not send the reply.')}</ErrorAlert>
        )}
        <Field data-invalid={errors.body ? true : undefined}>
          <FieldLabel htmlFor="reply-body">Reply</FieldLabel>
          <Textarea
            id="reply-body"
            rows={5}
            className="min-h-28"
            placeholder="Write a reply to the customer…"
            aria-invalid={errors.body ? true : undefined}
            {...register('body')}
          />
          <FieldDescription>Replies are saved to the ticket. They aren't emailed to the customer yet.</FieldDescription>
          <FieldError errors={[errors.body]} />
        </Field>
        <div>
          <Button type="submit" disabled={addReply.isPending}>
            {addReply.isPending && <Loader2 className="animate-spin" />}
            {addReply.isPending ? 'Sending…' : 'Send reply'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
