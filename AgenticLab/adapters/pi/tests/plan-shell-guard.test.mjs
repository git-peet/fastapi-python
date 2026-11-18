import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDeliveryContextGuardState, registerPlanPreflight, registerPlanShellGuard } from "../context-policy-gate.mjs";
import { preflightDeliveryPlan } from "../plan-preflight.mjs";

const planApproval = {
  role: "assistant",
  content: [{
    type: "text",
    text: "### Approval\nDo you approve this plan and authorize writing its transient plan-checkpoint.json handoff?",
  }],
};
const implementCheckpointGate = {
  role: "assistant",
  content: [{
    type: "text",
    text: "A) Are you planning to run /premortem? If so, plan-checkpoint.json will be kept. B) Not planning to run /premortem? I explicitly authorize deleting plan-checkpoint.json.",
  }],
};
const implementationLogGate = {
  role: "assistant",
  content: [{ type: "text", text: "Do you approve writing the implementation-log?" }],
};

test("delivery guard activates for explicit /plan and persists through clarification", () => {
  const state = createDeliveryContextGuardState();
  assert.equal(state.workflowMode(), null);

  state.onInput("/plan Plan a bounded change", "interactive");
  assert.equal(state.workflowMode(), "plan");
  assert.equal(state.isPlanActive(), true);
  assert.equal(state.guardsKnowledgeReads(), true);

  state.onMessage({ role: "assistant", content: [{ type: "text", text: "What replacement copy should I use?" }] });
  state.onInput("Use My Conversations", "interactive");
  assert.equal(state.workflowMode(), "plan");
  assert.equal(state.isPlanActive(), true);
});

test("delivery guard remains active through checkpoint and implementation-log decisions", () => {
  const state = createDeliveryContextGuardState();
  state.onInput("/implement", "interactive");
  assert.equal(state.workflowMode(), "implement");
  assert.equal(state.isPlanActive(), false);
  assert.equal(state.guardsKnowledgeReads(), true);

  state.onMessage(implementCheckpointGate);
  state.onInput("B", "interactive");
  assert.equal(state.workflowMode(), "implement");
  state.onMessage(implementationLogGate);
  state.onInput("No implementation log", "interactive");
  state.onAgentSettled();
  assert.equal(state.workflowMode(), null);
});

test("explicit workflow switches and cancel release the delivery guard", () => {
  const state = createDeliveryContextGuardState();
  state.onInput("/plan Inspect a small surface", "interactive");
  state.onInput("/implement", "interactive");
  assert.equal(state.workflowMode(), "implement");
  state.onInput("/premortem", "interactive");
  assert.equal(state.workflowMode(), null);

  state.onInput("/plan Another task", "interactive");
  state.cancel();
  assert.equal(state.workflowMode(), null);
});

test("extension-injected messages do not activate a delivery guard", () => {
  const state = createDeliveryContextGuardState();
  state.onInput("/plan injected", "extension");
  state.onInput("/implement injected", "extension");
  assert.equal(state.workflowMode(), null);
});

test("Pi guard allows read-only ls/find in /plan and blocks other shell", async () => {
  const handlers = new Map();
  const pi = {
    on(name, handler) { handlers.set(name, handler); },
    registerCommand() {},
  };
  registerPlanShellGuard(pi);
  const ctx = { cwd: process.cwd() };
  const call = (toolName, input) => handlers.get("tool_call")({ toolName, input }, ctx);

  handlers.get("input")({ text: "/plan Inspect scoped context", source: "interactive" });
  assert.equal(await call("bash", { command: "ls" }), undefined);
  assert.equal(await call("bash", { command: "find . -name '*.md'" }), undefined);
  assert.equal(await call("bash", { command: "ls -la" }), undefined);
  assert.equal((await call("bash", { command: "echo blocked" })).block, true);
  assert.equal((await call("bash", { command: "find . -exec rm -rf {} +" })).block, true);
  assert.equal((await call("bash", { command: "ls; echo blocked" })).block, true);
  assert.equal((await call("bash", { command: "grep -r foo ." })).block, true);

  const userBashAllowed = handlers.get("user_bash")({ command: "ls" });
  assert.equal(userBashAllowed, undefined);
  const userBashBlocked = handlers.get("user_bash")({ command: "echo blocked" });
  assert.equal(userBashBlocked.result.exitCode, 126);
  assert.equal(userBashBlocked.result.cancelled, false);
});

test("Pi guard blocks shell in /plan and raw knowledge reads in /plan and /implement", async () => {
  const handlers = new Map();
  const commands = new Map();
  const pi = {
    on(name, handler) { handlers.set(name, handler); },
    registerCommand(name, definition) { commands.set(name, definition); },
  };
  const state = registerPlanShellGuard(pi);
  const ctx = { cwd: process.cwd() };
  const call = (toolName, input) => handlers.get("tool_call")({ toolName, input }, ctx);

  handlers.get("input")({ text: "/plan Inspect scoped context", source: "interactive" });
  assert.equal(state.workflowMode(), "plan");
  assert.equal((await call("bash", { command: "find . -exec rm -rf {} +" })).block, true);
  assert.equal((await call("read", { path: "AgenticLab/knowledge/records/backend-rule.md" })).block, true);
  assert.equal((await call("read", { path: "AgenticLab/knowledge-pending/batch/bundle.json" })).block, true);
  assert.equal(await call("read", { path: "AgenticLab/knowledge/INDEX.md" }), undefined);
  assert.equal(await call("read", { path: "AgenticLab/knowledge/maps/backend.md" }), undefined);
  assert.equal(await call("read", { path: "backend/app/api/routes/conversations.py" }), undefined);
  assert.equal(await call("readKnowledgeRecords", { query: "owner scope" }), undefined);

  const userBashBlocked = handlers.get("user_bash")({ command: "echo blocked" });
  assert.equal(userBashBlocked.result.exitCode, 126);
  assert.equal(userBashBlocked.result.cancelled, false);

  handlers.get("message_end")({ message: planApproval });
  handlers.get("input")({ text: "A", source: "interactive" });
  handlers.get("agent_settled")({ aborted: false });
  assert.equal(state.workflowMode(), null);
  assert.equal(await call("bash", { command: "ls" }), undefined);
  assert.equal(await call("bash", { command: "echo allowed outside /plan" }), undefined);
  assert.equal(await call("read", { path: "AgenticLab/knowledge/records/backend-rule.md" }), undefined);

  handlers.get("input")({ text: "/implement", source: "interactive" });
  assert.equal(state.workflowMode(), "implement");
  assert.equal(await call("bash", { command: "backend/scripts/test-isolated.sh" }), undefined);
  assert.equal((await call("read", { path: "AgenticLab/knowledge/records/backend-rule.md" })).block, true);
  assert.equal((await call("read", { path: "AgenticLab/knowledge/checkpoints/plan-checkpoint.json" })), undefined);
  assert.equal(await call("readKnowledgeRecords", { query: "owner scope" }), undefined);

  const cancel = commands.get("plan-cancel");
  assert.ok(cancel, "/plan-cancel must be registered as a recovery path");
  await cancel.handler("", {});
  assert.equal(state.workflowMode(), null);
});

async function preflightFixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plan-preflight-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const testDirectory = path.join(root, "AgenticLab", "adapters", "pi", "tests");
  const sourceDirectory = path.join(root, "AgenticLab", "adapters", "pi");
  await mkdir(testDirectory, { recursive: true });
  await writeFile(path.join(sourceDirectory, "context-policy-gate.mjs"), "export {};\n");
  await writeFile(path.join(testDirectory, "sample.test.mjs"), 'import test from "node:test";\ntest("sample", () => {});\n');
  await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));

  const input = {
    taskContext: "PBI 10 — Add plan preflight. C03-EVAL-ID: EXP4-C03-PBI10-001",
    pbiEntry: "PBI 10 — Add plan preflight. C03-EVAL-ID: EXP4-C03-PBI10-001",
    planText: "## Outcome\nAdd the preflight. C03-EVAL-ID: EXP4-C03-PBI10-001\n## Risks and open decisions\nOpen decision: confirm the tool invocation path.",
    outcome: "Add a deterministic preflight before final plan presentation.",
    planningSession: "No files changed, commands or tests run during planning.",
    decisionSummary: "Open decisions: one integration detail remains.",
    checkpointTask: "PBI 10 — C03-EVAL-ID: EXP4-C03-PBI10-001",
    checkpointSummary: "Preserve C03-EVAL-ID: EXP4-C03-PBI10-001.",
    implementationScope: [
      "Create AgenticLab/adapters/pi/plan-preflight.mjs",
      "Append one sanitized card to AgenticLab/evaluation/results/EXP4-C03-CONTEXT-POLICY-001.md during /implement",
    ],
    exclusions: ["Permanent telemetry", "Broad workflow re-architecture"],
    sourcePaths: ["AgenticLab/adapters/pi/context-policy-gate.mjs"],
    validationCommands: [{ command: "node --test AgenticLab/adapters/pi/tests/*.test.mjs", workingDirectory: "." }],
    openDecisions: [{ text: "Confirm the tool invocation path", status: "open" }],
  };
  return { root, input: { ...input, ...overrides } };
}

test("plan preflight accepts a marked plan and keeps planning-session restrictions separate", async (t) => {
  const { root, input } = await preflightFixture(t);
  const result = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.deepEqual(result, { ok: true, marker: "EXP4-C03-PBI10-001", gaps: [] });
});

test("plan preflight resolves a marker from the PBI entry and requires it in plan, checkpoint, and implementation scope", async (t) => {
  const { root, input } = await preflightFixture(t, {
    taskContext: "Implement PBI 10.",
    pbiEntry: "PBI 10 — C03-EVAL-ID: EXP4-C03-PBI10-001",
  });
  const result = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.equal(result.ok, true);
  assert.equal(result.marker, "EXP4-C03-PBI10-001");

  input.planText = "## Outcome\nNo marker included.\n## Risks and open decisions";
  input.checkpointTask = "PBI 10";
  input.checkpointSummary = "No marker";
  input.implementationScope = ["Create AgenticLab/adapters/pi/plan-preflight.mjs"];
  const failed = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.equal(failed.ok, false);
  assert.ok(failed.gaps.some((gap) => gap.includes("human-readable plan")));
  assert.ok(failed.gaps.some((gap) => gap.includes("checkpoint task/summary")));
  assert.ok(failed.gaps.some((gap) => gap.includes("evaluation card")));
});

test("plan preflight rejects outcome/scope and exclusion/scope conflicts", async (t) => {
  const { root, input } = await preflightFixture(t, {
    exclusions: ["No code changes are permitted", "AgenticLab/adapters/pi"],
  });
  input.outcome = "No implementation changes";
  const result = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((gap) => gap.includes("outcome forbids implementation changes")));
  assert.ok(result.gaps.some((gap) => gap.includes("exclusion conflicts")));
  assert.ok(result.gaps.some((gap) => gap.includes("excluded path overlaps")));

  input.outcome = "None";
  input.decisionSummary = "None";
  const openDecisionResult = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.ok(openDecisionResult.gaps.some((gap) => gap.includes("cannot be None")));
  assert.ok(openDecisionResult.gaps.some((gap) => gap.includes("labeled open")));
});

test("plan preflight rejects conflicting evaluation markers and closed decision labels", async (t) => {
  const { root, input } = await preflightFixture(t, {
    pbiEntry: "PBI 10 — C03-EVAL-ID: EXP4-C03-PBI11-002",
    planText: "## Outcome\nAdd the validator.\n## Risks\nOne unresolved choice remains.",
  });
  const result = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.ok(result.gaps.some((gap) => gap.includes("conflicting C03-EVAL-ID")));
  assert.ok(result.gaps.some((gap) => gap.includes("human-readable plan must label")));

  input.openDecisions = [{ text: "Confirm the tool invocation path", status: "closed" }];
  const closed = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.ok(closed.gaps.some((gap) => gap.includes("status open")));
});

test("plan preflight verifies source paths and validation command targets without executing them", async (t) => {
  const { root, input } = await preflightFixture(t, {
    sourcePaths: ["AgenticLab/adapters/pi/missing.mjs"],
    validationCommands: [{ command: "node --test AgenticLab/adapters/pi/tests/missing*.test.mjs", workingDirectory: "." }],
  });
  const result = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((gap) => gap.includes("referenced path does not exist")));
  assert.ok(result.gaps.some((gap) => gap.includes("no matches")));

  input.sourcePaths = ["AgenticLab/adapters/pi/context-policy-gate.mjs"];
  input.validationCommands = [{ command: "pytest tests", workingDirectory: "." }];
  const unsupported = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.ok(unsupported.gaps.some((gap) => gap.includes("unsupported or unverified validation command")));
});

test("plan preflight verifies package script references from package.json", async (t) => {
  const { root, input } = await preflightFixture(t, {
    validationCommands: [{ command: "bun run test", workingDirectory: "." }],
  });
  const result = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.equal(result.ok, true);
});

test("plan preflight rejects an evaluation-card scope when no marker is present", async (t) => {
  const { root, input } = await preflightFixture(t, {
    taskContext: "Unmarked task.",
    pbiEntry: "Unmarked PBI.",
    checkpointTask: "Unmarked task",
    checkpointSummary: "Unmarked summary",
  });
  const result = await preflightDeliveryPlan(input, { workspaceRoot: root });
  assert.equal(result.ok, false);
  assert.ok(result.gaps.some((gap) => gap.includes("without a C03-EVAL-ID")));
});

test("delivery extension registers the deterministic preflight tool", async (t) => {
  const { root, input } = await preflightFixture(t);
  const tools = new Map();
  const Type = {
    Object: (properties, options) => ({ properties, options }),
    String: (options) => ({ type: "string", options }),
    Array: (items, options) => ({ items, options }),
    Optional: (schema) => ({ ...schema, optional: true }),
  };
  registerPlanPreflight({ registerTool(tool) { tools.set(tool.name, tool); } }, Type);
  const tool = tools.get("preflightDeliveryPlan");
  assert.ok(tool);
  const result = await tool.execute("test-call", input, undefined, undefined, { cwd: root });
  assert.equal(result.details.ok, true);
  assert.match(result.content[0].text, /preflight passed/u);
});
