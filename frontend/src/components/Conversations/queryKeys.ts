export const conversationQueryKeys = {
  all: ["conversations"] as const,
  list: (userId: string, skip = 0, limit = 20) =>
    ["conversations", userId, "list", skip, limit] as const,
  search: (userId: string, term: string, skip = 0, limit = 20) =>
    ["conversations", userId, "search", term, skip, limit] as const,
  detail: (userId: string, conversationId: string) =>
    ["conversations", userId, "detail", conversationId] as const,
}
