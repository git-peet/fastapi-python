import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/conversations")({
  component: ConversationsLayout,
})

function ConversationsLayout() {
  return <Outlet />
}
