export const conversationQueryKeys = {
  all: ["conversations"] as const,
  list: (userId: string) => ["conversations", userId, "list"] as const,
  detail: (userId: string, conversationId: string) =>
    ["conversations", userId, "detail", conversationId] as const,
}
