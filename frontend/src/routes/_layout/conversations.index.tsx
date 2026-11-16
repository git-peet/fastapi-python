import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { MessageSquare, RefreshCw, Search } from "lucide-react"
import { useState } from "react"

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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import useAuth from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout/conversations/")({
  component: ConversationsPage,
  head: () => ({
    meta: [{ title: "Conversations - FastAPI Template" }],
  }),
})

const UI_PAGE_SIZE = 20

function ConversationsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [term, setTerm] = useState("")
  const [submittedTerm, setSubmittedTerm] = useState<string | undefined>(
    undefined,
  )
  const [skip, setSkip] = useState(0)

  const userId = user?.id ?? "anonymous"
  const isSearching = submittedTerm !== undefined

  const listQuery = useQuery({
    queryKey: conversationQueryKeys.list(userId, skip, UI_PAGE_SIZE),
    queryFn: async () =>
      (
        await ConversationsService.readConversations({
          query: { skip, limit: UI_PAGE_SIZE },
        })
      ).data,
    enabled: Boolean(user?.id && !isSearching),
    retry: false,
  })

  const searchQuery = useQuery({
    queryKey: conversationQueryKeys.search(
      userId,
      submittedTerm ?? "",
      skip,
      UI_PAGE_SIZE,
    ),
    queryFn: async () =>
      (
        await ConversationsService.searchConversations({
          query: { skip, limit: UI_PAGE_SIZE },
          body: { query: submittedTerm ?? "" },
        })
      ).data,
    enabled: Boolean(user?.id && isSearching),
    retry: false,
  })

  const active = isSearching ? searchQuery : listQuery
  const conversations = active.data?.data ?? []
  const count = active.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / UI_PAGE_SIZE))
  const page = Math.floor(skip / UI_PAGE_SIZE) + 1

  if (!user) {
    return <ConversationsLoading />
  }

  if (active.isPending) {
    return <ConversationsLoading />
  }

  if (active.isError) {
    return (
      <LoadError
        message="Conversations could not be loaded. Please try again."
        onRetry={() => active.refetch()}
      />
    )
  }

  const handleSearch = (value: string) => {
    const normalized = value.trim()
    setSubmittedTerm(normalized || undefined)
    setSkip(0)
  }

  const clearSearch = () => {
    setSubmittedTerm(undefined)
    setTerm("")
    setSkip(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground">
            Create and review your private conversations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleSearch(term)
            }}
            className="flex items-center gap-2"
          >
            <Input
              type="search"
              placeholder="Search titles..."
              aria-label="Search conversation titles"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="w-56"
            />
            <Button type="submit">
              <Search className="mr-2 size-4" />
              Search
            </Button>
          </form>
          <ConversationFormDialog
            onSaved={() => {
              clearSearch()
              queryClient.invalidateQueries({
                queryKey: conversationQueryKeys.all,
              })
            }}
          />
        </div>
      </div>

      {isSearching && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Results for “{submittedTerm}” ({count})
          </p>
          <Button variant="outline" onClick={clearSearch}>
            Clear search
          </Button>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <MessageSquare className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">
            {isSearching ? "No matching conversations" : "No conversations yet"}
          </h2>
          <p className="text-muted-foreground">
            {isSearching
              ? "Try a different title search."
              : "Create a conversation to store its transcript and try triage."}
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
                      ? `Triaged ${new Date(
                          conversation.triaged_at,
                        ).toLocaleString()}`
                      : "Not triaged yet"}
                    {conversation.created_at &&
                      ` · Created ${new Date(
                        conversation.created_at,
                      ).toLocaleDateString()}`}
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

      {count > 0 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => setSkip(skip - UI_PAGE_SIZE)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setSkip(skip + UI_PAGE_SIZE)}
          >
            Next
          </Button>
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
