import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { MessageSquare, RefreshCw } from "lucide-react"

import { ConversationsService } from "@/client"
import ConversationFormDialog from "@/components/Conversations/ConversationFormDialog"
import { conversationQueryKeys } from "@/components/Conversations/queryKeys"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/conversations/")({
  component: ConversationsPage,
  head: () => ({
    meta: [{ title: "Conversations - FastAPI Template" }],
  }),
})

function ConversationsPage() {
  const { user, isUserLoading, isUserError } = useAuth()
  const queryClient = useQueryClient()
  const listKey = user
    ? conversationQueryKeys.list(user.id)
    : conversationQueryKeys.list("anonymous")
  const query = useQuery({
    queryKey: listKey,
    queryFn: async () =>
      (
        await ConversationsService.readConversations({
          query: { skip: 0, limit: 100 },
        })
      ).data,
    enabled: Boolean(user?.id),
    retry: false,
  })

  if (isUserError) {
    return <LoadError message="Your account could not be loaded." />
  }

  if (isUserLoading) {
    return <ConversationsLoading />
  }

  if (!user) {
    return <LoadError message="Your account could not be loaded." />
  }

  if (query.isPending) {
    return <ConversationsLoading />
  }

  if (query.isError) {
    return (
      <LoadError
        message="Conversations could not be loaded. Please try again."
        onRetry={() => query.refetch()}
      />
    )
  }

  const conversations = query.data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground">
            Create and review your private conversations.
          </p>
        </div>
        <ConversationFormDialog
          onSaved={() => queryClient.invalidateQueries({ queryKey: listKey })}
        />
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <MessageSquare className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">No conversations yet</h2>
          <p className="text-muted-foreground">
            Create a conversation to store its transcript and try triage.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {conversations.map((conversation) => (
            <Link
              key={conversation.id}
              to="/conversations/$conversationId"
              params={{ conversationId: conversation.id }}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition-colors hover:bg-accent/40">
                <CardHeader>
                  <CardTitle>{conversation.title}</CardTitle>
                  <CardDescription>
                    {conversation.triaged_at
                      ? `Triaged ${new Date(conversation.triaged_at).toLocaleString()}`
                      : "Not triaged yet"}
                    {conversation.created_at &&
                      ` · Created ${new Date(conversation.created_at).toLocaleDateString()}`}
                  </CardDescription>
                </CardHeader>
                {conversation.triage_summary && (
                  <CardContent>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {conversation.triage_summary}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function ConversationsLoading() {
  return (
    <div
      className="grid gap-4"
      role="status"
      aria-label="Loading conversations"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  )
}

function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-16 text-center"
      role="alert"
    >
      <p className="text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 size-4" />
          Retry
        </Button>
      )}
    </div>
  )
}
