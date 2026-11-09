import type { Page, Route } from "@playwright/test"
import type { ConversationPublic, UserPublic } from "../../src/client"

export const userA: UserPublic = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "a@example.test",
  is_active: true,
  is_superuser: false,
  full_name: "User A",
}

export const userB: UserPublic = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  email: "b@example.test",
  is_active: true,
  is_superuser: false,
  full_name: "User B",
}

export function makeConversation(
  ownerId: string,
  id: string,
  title: string,
  transcript = "A fictional conversation transcript.",
): ConversationPublic {
  return {
    id,
    owner_id: ownerId,
    title,
    transcript,
    created_at: "2026-11-08T12:00:00Z",
    updated_at: "2026-11-08T12:00:00Z",
    triage_summary: null,
    triage_intent: null,
    triage_sentiment: null,
    triage_next_action: null,
    triaged_at: null,
  }
}

export async function mockConversationApi(page: Page) {
  const records: ConversationPublic[] = []
  let failTriage = false
  let delayTriage = false
  let failList = false
  let delayList = false

  await page.addInitScript(() => {
    if (!sessionStorage.getItem("pbi4-auth-initialized")) {
      localStorage.setItem("access_token", "user-a-token")
      sessionStorage.setItem("pbi4-auth-initialized", "true")
    }
  })

  await page.route("**/api/v1/users/me", async (route: Route) => {
    const auth = route.request().headers().authorization
    const user = auth?.includes("user-b-token") ? userB : userA
    await route.fulfill({ json: user })
  })

  await page.route("**/api/v1/login/access-token", async (route: Route) => {
    await route.fulfill({
      json: { access_token: "user-b-token", token_type: "bearer" },
    })
  })

  await page.route("**/api/v1/conversations**", async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const auth = request.headers().authorization
    const owner = auth?.includes("user-b-token") ? userB : userA

    if (path === "/api/v1/conversations/" && method === "GET") {
      if (delayList) await new Promise((resolve) => setTimeout(resolve, 120))
      if (failList) {
        await route.fulfill({
          status: 503,
          json: { detail: "Temporarily unavailable" },
        })
        return
      }
      const data = records.filter((row) => row.owner_id === owner.id)
      await route.fulfill({ json: { data, count: data.length } })
      return
    }

    if (path === "/api/v1/conversations/" && method === "POST") {
      const body = request.postDataJSON() as {
        title: string
        transcript: string
      }
      const created = makeConversation(
        owner.id,
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        body.title,
        body.transcript,
      )
      records.push(created)
      await route.fulfill({ json: created })
      return
    }

    const match = path.match(
      /^\/api\/v1\/conversations\/([^/]+)(?:\/triage)?\/?$/,
    )
    const id = match?.[1]
    const conversation = records.find((row) => row.id === id)

    if (!conversation) {
      await route.fulfill({
        status: 404,
        json: { detail: "Conversation not found" },
      })
      return
    }
    if (conversation.owner_id !== owner.id) {
      await route.fulfill({
        status: 403,
        json: { detail: "Not enough permissions" },
      })
      return
    }

    if (path.endsWith("/triage") && method === "POST") {
      if (delayTriage) await new Promise((resolve) => setTimeout(resolve, 100))
      if (failTriage) {
        await route.fulfill({
          status: 502,
          json: { detail: "Triage failed; no result was saved." },
        })
        return
      }
      Object.assign(conversation, {
        triage_summary: "A mocked triage summary.",
        triage_intent: "request",
        triage_sentiment: "neutral",
        triage_next_action: "ask_clarifying_question",
        triaged_at: "2026-11-08T12:05:00Z",
      })
      await route.fulfill({ json: conversation })
      return
    }

    if (method === "GET") {
      await route.fulfill({ json: conversation })
      return
    }

    if (method === "PUT") {
      const body = request.postDataJSON() as Partial<ConversationPublic>
      if (
        body.transcript !== undefined &&
        body.transcript !== conversation.transcript
      ) {
        conversation.triage_summary = null
        conversation.triage_intent = null
        conversation.triage_sentiment = null
        conversation.triage_next_action = null
        conversation.triaged_at = null
      }
      Object.assign(conversation, body, { updated_at: "2026-11-08T12:10:00Z" })
      await route.fulfill({ json: conversation })
      return
    }

    if (method === "DELETE") {
      records.splice(records.indexOf(conversation), 1)
      await route.fulfill({
        json: { message: "Conversation deleted successfully" },
      })
      return
    }

    await route.fulfill({ status: 405, json: { detail: "Method not allowed" } })
  })

  return {
    records,
    setFailTriage(value: boolean) {
      failTriage = value
    },
    setDelayTriage(value: boolean) {
      delayTriage = value
    },
    setFailList(value: boolean) {
      failList = value
    },
    setDelayList(value: boolean) {
      delayList = value
    },
  }
}
