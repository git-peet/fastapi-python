import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, RefreshCw } from "lucide-react"

import { ConversationsService } from "@/client"
import ConversationFormDialog from "@/components/Conversations/ConversationFormDialog"
import DeleteConversationDialog from "@/components/Conversations/DeleteConversationDialog"
import { conversationQueryKeys } from "@/components/Conversations/queryKeys"
import TriageConversationButton from "@/components/Conversations/TriageConversationButton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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

export const Route = createFileRoute("/_layout/conversations/$conversationId")({
  component: ConversationDetailPage,
  head: () => ({
    meta: [{ title: "Conversation - FastAPI Template" }],
  }),
})

function ConversationDetailPage() {
  const { conversationId } = Route.useParams()
  const { user, isUserLoading, isUserError } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const detailKey = user
    ? conversationQueryKeys.detail(user.id, conversationId)
    : conversationQueryKeys.detail("anonymous", conversationId)
  const query = useQuery({
    queryKey: detailKey,
    queryFn: async () =>
      (
        await ConversationsService.readConversation({
          path: { id: conversationId },
        })
      ).data,
    enabled: Boolean(user?.id),
    retry: false,
  })

  if (isUserError) {
    return <ConversationError message="Your account could not be loaded." />
  }

  if (isUserLoading) {
    return (
      <Skeleton className="h-96 w-full" aria-label="Loading conversation" />
    )
  }

  if (!user) {
    return <ConversationError message="Your account could not be loaded." />
  }

  if (query.isPending) {
    return (
      <Skeleton className="h-96 w-full" aria-label="Loading conversation" />
    )
  }

  if (query.isError || !query.data) {
    const status = (query.error as { response?: { status?: number } } | null)
      ?.response?.status
    const message =
      status === 403
        ? "You don't have access to this conversation."
        : status === 404
          ? "Conversation not found."
          : "This conversation could not be loaded."
    return (
      <ConversationError message={message} onRetry={() => query.refetch()} />
    )
  }

  const conversation = query.data
  const hasTriage = Boolean(conversation.triaged_at)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/conversations">
            <ArrowLeft className="mr-2 size-4" />
            Conversations
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <ConversationFormDialog
            conversation={conversation}
            onSaved={(saved) => {
              queryClient.setQueryData(detailKey, saved)
              if (user.id) {
                queryClient.invalidateQueries({
                  queryKey: conversationQueryKeys.list(user.id),
                })
              }
            }}
          />
          <DeleteConversationDialog
            conversationId={conversation.id}
            onDeleted={() => {
              queryClient.removeQueries({ queryKey: detailKey })
              void navigate({ to: "/conversations" })
            }}
          />
        </div>
      </div>

      <section aria-labelledby="conversation-title" className="grid gap-4">
        <div>
          <h1
            id="conversation-title"
            className="text-2xl font-bold tracking-tight"
          >
            {conversation.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Created{" "}
            {conversation.created_at
              ? new Date(conversation.created_at).toLocaleString()
              : "date unavailable"}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>Private to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {conversation.transcript}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Triage</CardTitle>
            <CardDescription>
              {conversation.triaged_at
                ? `Last run ${new Date(conversation.triaged_at).toLocaleString()}`
                : "No current triage result"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {hasTriage ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                <TriageField
                  label="Summary"
                  value={conversation.triage_summary}
                />
                <TriageField
                  label="Intent"
                  value={conversation.triage_intent}
                />
                <TriageField
                  label="Sentiment"
                  value={conversation.triage_sentiment}
                />
                <TriageField
                  label="Suggested next action"
                  value={conversation.triage_next_action}
                />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Run triage to see a structured summary and suggested next
                action.
              </p>
            )}
            <div className="flex flex-col items-start gap-2">
              <TriageConversationButton
                conversationId={conversation.id}
                hasTriage={hasTriage}
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function TriageField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm">{value || "—"}</dd>
    </div>
  )
}

function ConversationError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Could not open conversation</AlertTitle>
      <AlertDescription className="mt-2 flex flex-col items-start gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-2 size-4" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
