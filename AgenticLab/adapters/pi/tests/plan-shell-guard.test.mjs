import assert from "node:assert/strict";
import test from "node:test";
import { createPlanShellGuardState, registerPlanShellGuard } from "../context-policy-gate.mjs";

const checkpointApproval = {
  role: "assistant",
  content: [{
    type: "text",
    text: "### Approval\nDo you approve this plan and authorize writing its transient plan-checkpoint.json handoff?",
  }],
};

test("plan shell guard activates only for explicit /plan and persists through clarification", () => {
  const state = createPlanShellGuardState();
  assert.equal(state.isActive(), false);

  state.onInput("/plan Plan a bounded change", "interactive");
  assert.equal(state.isActive(), true);

  state.onMessage({ role: "assistant", content: [{ type: "text", text: "What replacement copy should I use?" }] });
  state.onInput("Use My Conversations", "interactive");
  assert.equal(state.isActive(), true);
});

test("plan shell guard clears after the approval response or explicit workflow switch", () => {
  const state = createPlanShellGuardState();
  state.onInput("/plan Plan a bounded change", "interactive");
  state.onMessage(checkpointApproval);
  assert.equal(state.isActive(), true);
  state.onInput("No checkpoint write", "interactive");
  assert.equal(state.isActive(), true, "the guard remains active during the approval-response run");
  state.onAgentSettled();
  assert.equal(state.isActive(), false);

  state.onInput("/plan Another bounded change", "interactive");
  state.onInput("/implement", "interactive");
  assert.equal(state.isActive(), false);
});

test("plan shell guard remains active when an approval response triggers another clarification", () => {
  const state = createPlanShellGuardState();
  state.onInput("/plan Plan a bounded change", "interactive");
  state.onMessage(checkpointApproval);
  state.onInput("Revise the title to My Conversations", "interactive");
  state.onMessage({ role: "assistant", content: [{ type: "text", text: "Should the browser title change too?" }] });
  state.onAgentSettled();
  assert.equal(state.isActive(), true);
});

test("extension-injected messages do not activate a plan shell guard", () => {
  const state = createPlanShellGuardState();
  state.onInput("/plan injected", "extension");
  assert.equal(state.isActive(), false);
});

test("Pi guard blocks bash and user shell only while planning; reads remain allowed", async () => {
  const handlers = new Map();
  const commands = new Map();
  const pi = {
    on(name, handler) { handlers.set(name, handler); },
    registerCommand(name, definition) { commands.set(name, definition); },
  };
  const state = registerPlanShellGuard(pi);
  handlers.get("input")({ text: "/plan Inspect a small surface", source: "interactive" });
  assert.equal(state.isActive(), true);

  const blocked = handlers.get("tool_call")({ toolName: "bash", input: { command: "find ." } });
  assert.deepEqual(blocked, {
    block: true,
    reason: "Shell commands are blocked while /plan is active. Use Pi read and registered knowledge/metrics tools, or run /plan-cancel to leave planning.",
  });
  assert.equal(handlers.get("tool_call")({ toolName: "read", input: { path: "file.md" } }), undefined);

  const userBash = handlers.get("user_bash")({ command: "ls" });
  assert.equal(userBash.result.exitCode, 126);
  assert.equal(userBash.result.cancelled, false);

  handlers.get("message_end")({ message: checkpointApproval });
  handlers.get("input")({ text: "No checkpoint write", source: "interactive" });
  assert.notEqual(handlers.get("tool_call")({ toolName: "bash", input: { command: "find ." } }), undefined);
  handlers.get("agent_settled")({ aborted: false });
  assert.equal(state.isActive(), false);
  assert.equal(handlers.get("tool_call")({ toolName: "bash", input: { command: "echo allowed" } }), undefined);

  handlers.get("input")({ text: "/plan Another task", source: "interactive" });
  const cancel = commands.get("plan-cancel");
  assert.ok(cancel, "/plan-cancel must be registered as a recovery path");
  await cancel.handler("", {});
  assert.equal(state.isActive(), false);
  assert.equal(handlers.get("tool_call")({ toolName: "bash", input: { command: "echo allowed" } }), undefined);
});
