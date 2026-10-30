import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'

// A mint circle with the person's initials. Decorative: the name is always shown next to it, so
// the initials are drawn with CSS `content` and stay out of the text of the row around it.
export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-initials={initials(name)}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-heading text-xs font-semibold text-primary before:content-[attr(data-initials)]',
        className,
      )}
    />
  )
}
