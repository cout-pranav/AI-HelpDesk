import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Sparkles } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import type { TicketDetailData } from '@/types/ticket'
import { useAddReply } from './useAddReply'
import { usePolishReply } from './usePolishReply'

const replySchema = z.object({
  body: z
    .string()
    .trim()
    .max(10000, 'Reply must be at most 10,000 characters.'), // the API's limit
})

type ReplyValues = z.infer<typeof replySchema>

// agentName signs replies polished with AI.
export function TicketReplyForm({ ticket, agentName }: { ticket: TicketDetailData; agentName: string }) {
  const addReply = useAddReply(ticket.id)
  const polish = usePolishReply(ticket, agentName)
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    control,
    formState: { errors },
  } = useForm<ReplyValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: '' },
  })

  const onSubmit = handleSubmit((values) => addReply.mutate(values, { onSuccess: () => reset() }))

  const hasDraft = useWatch({ control, name: 'body' }).trim() !== ''
  const onPolish = () =>
    polish.mutate(getValues('body').trim(), {
      onSuccess: (text) => setValue('body', text, { shouldValidate: true }),
    })

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
          <FieldDescription>Replies are saved to the ticket and emailed to {ticket.submitterEmail}.</FieldDescription>
          <FieldError errors={[errors.body]} />
        </Field>
        {polish.isError && (
          <ErrorAlert>{errorMessage(polish.error, 'Could not polish the reply.')}</ErrorAlert>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!hasDraft || polish.isPending || addReply.isPending}
            onClick={onPolish}
          >
            {polish.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {polish.isPending ? 'Polishing…' : 'Polish'}
          </Button>
          <Button type="submit" disabled={!hasDraft || addReply.isPending || polish.isPending}>
            {addReply.isPending && <Loader2 className="animate-spin" />}
            {addReply.isPending ? 'Sending…' : 'Send reply'}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
