import { expect, test } from "@playwright/test"

import {
  makeConversation,
  mockConversationApi,
  userA,
  userB,
} from "./utils/conversations"

test.use({ storageState: { cookies: [], origins: [] } })

test.describe("Conversations", () => {
  test("shows loading and empty states, validates limits, and creates a conversation", async ({
    page,
  }) => {
    const api = await mockConversationApi(page)
    api.setDelayList(true)

    await page.goto("/conversations")
    await expect(page.getByLabel("Loading conversations")).toBeVisible()
    await expect(page.getByText("No conversations yet")).toBeVisible()

    await page.getByRole("button", { name: "New Conversation" }).click()
    await expect(page.getByLabel("Title")).toHaveAttribute("maxlength", "255")
    await expect(page.getByLabel("Transcript")).toHaveAttribute(
      "maxlength",
      "10000",
    )
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("Title is required")).toBeVisible()
    await expect(page.getByText("Transcript is required")).toBeVisible()

    await page.getByLabel("Title").fill("A conversation for the UI test")
    await page.getByLabel("Transcript").fill("A short, fictional transcript.")
    await page.getByRole("button", { name: "Save" }).click()

    await expect(
      page.getByText("Conversation created successfully"),
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: /A conversation for the UI test/ }),
    ).toBeVisible()
    expect(api.records).toHaveLength(1)
  })

  test("shows a list error and lets the user retry", async ({ page }) => {
    const api = await mockConversationApi(page)
    api.setFailList(true)

    await page.goto("/conversations")
    await expect(
      page.getByText("Conversations could not be loaded."),
    ).toBeVisible()

    api.setFailList(false)
    await page.getByRole("button", { name: "Retry" }).click()
    await expect(page.getByText("No conversations yet")).toBeVisible()
  })

  test("loads detail, triages, edits, and invalidates triage when transcript changes", async ({
    page,
  }) => {
    const api = await mockConversationApi(page)
    const conversation = makeConversation(
      userA.id,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "Design discussion",
      "We discussed the first design.",
    )
    api.records.push(conversation)

    await page.goto(`/conversations/${conversation.id}`)
    await expect(
      page.getByRole("heading", { name: "Design discussion" }),
    ).toBeVisible()
    await expect(page.getByText("We discussed the first design.")).toBeVisible()

    await page.getByRole("button", { name: "Run triage" }).click()
    await expect(page.getByText("A mocked triage summary.")).toBeVisible()
    await expect(page.getByText("ask_clarifying_question")).toBeVisible()

    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Transcript").fill("The design changed after review.")
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.locator("p.whitespace-pre-wrap")).toHaveText(
      "The design changed after review.",
    )
    await expect(page.getByText("No current triage result")).toBeVisible()
    await expect(page.getByText("A mocked triage summary.")).not.toBeVisible()

    await page.getByRole("button", { name: "Run triage" }).click()
    await expect(page.getByText("A mocked triage summary.")).toBeVisible()
    await page.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Title").fill("Title-only change")
    await page.getByRole("button", { name: "Save" }).click()
    await expect(page.getByText("A mocked triage summary.")).toBeVisible()
  })

  test("shows triage pending and failure states", async ({ page }) => {
    const api = await mockConversationApi(page)
    const conversation = makeConversation(
      userA.id,
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "Triage failure example",
    )
    api.records.push(conversation)
    api.setDelayTriage(true)
    api.setFailTriage(true)

    await page.goto(`/conversations/${conversation.id}`)
    const triageButton = page.getByRole("button", { name: "Run triage" })
    await triageButton.click()
    await expect(triageButton).toBeDisabled()
    await expect(page.getByText("Triage failed")).toBeVisible()
    await expect(
      page.getByText("The conversation could not be triaged."),
    ).toBeVisible()
  })

  test("deletes a conversation and returns to the list", async ({ page }) => {
    const api = await mockConversationApi(page)
    const conversation = makeConversation(
      userA.id,
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "Conversation to delete",
    )
    api.records.push(conversation)

    await page.goto(`/conversations/${conversation.id}`)
    await page.getByRole("button", { name: "Delete" }).click()
    await expect(
      page.getByRole("heading", { name: "Delete conversation?" }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Delete conversation" }).click()

    await expect(page).toHaveURL(/\/conversations$/)
    await expect(page.getByText("No conversations yet")).toBeVisible()
    expect(api.records).toHaveLength(0)
  })

  test("does not show another user's conversation on a forbidden detail route", async ({
    page,
  }) => {
    const api = await mockConversationApi(page)
    const otherConversation = makeConversation(
      userB.id,
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "Private other-user title",
      "Private other-user transcript",
    )
    api.records.push(otherConversation)

    await page.goto(`/conversations/${otherConversation.id}`)

    await expect(
      page.getByText("You don't have access to this conversation."),
    ).toBeVisible()
    await expect(
      page.getByText("Private other-user transcript"),
    ).not.toBeVisible()
    await expect(page).toHaveURL(new RegExp(otherConversation.id))
  })

  test("clears cached conversations when switching accounts", async ({
    page,
  }) => {
    const api = await mockConversationApi(page)
    api.records.push(
      makeConversation(
        userA.id,
        "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
        "User A private conversation",
      ),
      makeConversation(
        userB.id,
        "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
        "User B private conversation",
      ),
    )

    await page.goto("/conversations")
    await expect(page.getByText("User A private conversation")).toBeVisible()
    await expect(
      page.getByText("User B private conversation"),
    ).not.toBeVisible()

    await page.getByTestId("user-menu").click()
    await page.getByRole("menuitem", { name: "Log Out" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByTestId("email-input").fill(userB.email)
    await page.getByTestId("password-input").fill("test-password-123")
    await page.getByRole("button", { name: "Log In" }).click()
    await expect(page).toHaveURL("/")
    await page.getByRole("link", { name: "Conversations" }).click()

    await expect(page.getByText("User B private conversation")).toBeVisible()
    await expect(
      page.getByText("User A private conversation"),
    ).not.toBeVisible()
  })
})
