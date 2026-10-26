import { useMutation } from '@tanstack/react-query'
import { polishReply } from '@/lib/ai'

// Rewrites a reply draft with AI; nothing is saved, so no queries change.
export function usePolishReply(subject: string) {
  return useMutation({
    mutationFn: (draft: string) => polishReply({ draft, subject }),
  })
}
