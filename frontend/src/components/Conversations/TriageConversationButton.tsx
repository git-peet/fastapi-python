import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Sparkles } from "lucide-react"

import { type ConversationPublic, ConversationsService } from "@/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { LoadingButton } from "@/components/ui/loading-button"
import useAuth from "@/hooks/useAuth"

interface TriageConversationButtonProps {
  conversationId: string
  hasTriage: boolean
}

function TriageConversationButton({
  conversationId,
  hasTriage,
}: TriageConversationButtonProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const detailKey = user
    ? ["conversations", user.id, "detail", conversationId]
    : ["conversations", "anonymous", "detail", conversationId]

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await ConversationsService.triageConversation({
        path: { id: conversationId },
      })
      return response.data
    },
    onSuccess: (conversation: ConversationPublic) => {
      queryClient.setQueryData(detailKey, conversation)
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ["conversations", user.id, "list"],
        })
      }
    },
  })

  return (
    <div className="grid gap-2">
      <LoadingButton
        type="button"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <Sparkles className="size-4" />
        {hasTriage ? "Run triage again" : "Run triage"}
      </LoadingButton>
      {mutation.isError && (
        <Alert variant="destructive">
          <AlertTitle>Triage failed</AlertTitle>
          <AlertDescription>
            The conversation could not be triaged. Your saved conversation
            remains unchanged; please try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default TriageConversationButton
