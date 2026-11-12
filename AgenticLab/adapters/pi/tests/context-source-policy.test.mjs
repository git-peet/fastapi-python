import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { selectContextSources } from "../context-source-policy.mjs";
import { recordContextSelectionMetric, recordKnowledgeCaptureMetric } from "../knowledge-capture-metrics.mjs";
import { registerKnowledgeCaptureTools } from "../knowledge-capture-tools.mjs";

const includes = (selection, ...sources) => {
  for (const source of sources) assert.ok(selection.sources.includes(source), `expected ${source}`);
};
const excludes = (selection, ...sources) => {
  for (const source of sources) assert.ok(!selection.sources.includes(source), `did not expect ${source}`);
};

test("baseline context is always present; optional layers are not presumed", () => {
  const selection = selectContextSources({ workload: "direct" });
  assert.deepEqual(selection.sources, ["user_request", "operating_instructions"]);
  assert.equal(selection.outcome, "selected");
});

test("source layers are included only when relevant and authorized workflow state applies", () => {
  const selection = selectContextSources({
    workload: "implementation",
    currentSourceNeeded: true,
    knowledgeRelevant: true,
    domainPerspectiveRelevant: true,
    workflowInvoked: true,
    approvedPlanPresent: true,
    meaningfulFinding: true,
  });
  includes(selection,
    "user_request", "operating_instructions", "current_source", "project_knowledge",
    "domain_perspective", "workflow_prompt", "approved_plan", "task_local_handoff");
  excludes(selection, "project_orientation");
});

test("project orientation is selected on explicit need and automatically during bootstrap", () => {
  const planning = selectContextSources({ workload: "planning", projectOrientationNeeded: true });
  includes(planning, "project_orientation");

  const ordinary = selectContextSources({ workload: "planning", projectOrientationNeeded: false });
  excludes(ordinary, "project_orientation");

  const bootstrap = selectContextSources({ workload: "bootstrap", projectOrientationNeeded: false });
  includes(bootstrap, "project_orientation");
});

test("an approved plan is not included for unrelated workloads", () => {
  const selection = selectContextSources({ workload: "direct", approvedPlanPresent: true });
  excludes(selection, "approved_plan");
});

test("invalid workload and non-boolean policy signals fail closed", () => {
  assert.throws(() => selectContextSources({ workload: "unknown" }), /workload must be one of/u);
  assert.throws(() => selectContextSources({ workload: "planning", knowledgeRelevant: "yes" }), /must be a boolean/u);
  assert.throws(() => selectContextSources({ workload: "planning", promptText: "sensitive" }), /unsupported field/u);
});

test("Pi selector records the selected layers without conflating them with used layers", async (t) => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "context-policy-selector-"));
  t.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  await mkdir(path.join(workspaceRoot, "AgenticLab", "config"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "AgenticLab", "config", "knowledge-capture-policy.json"), JSON.stringify({ metricsEnabled: true }));

  const tools = new Map();
  const pi = {
    registerTool(tool) { tools.set(tool.name, tool); },
    registerCommand() {},
  };
  const Type = {
    Object: () => ({}),
    String: () => ({}),
    Literal: () => ({}),
    Array: () => ({}),
    Optional: () => ({}),
    Boolean: () => ({}),
  };
  const StringEnum = () => ({});
  registerKnowledgeCaptureTools(pi, Type, StringEnum, { expectedRoot: workspaceRoot });

  const tool = tools.get("selectContextSources");
  assert.ok(tool, "selectContextSources must be registered as a Pi tool");
  const result = await tool.execute("test-call", {
    workload: "planning",
    workflowInvoked: true,
    knowledgeRelevant: false,
    projectOrientationNeeded: true,
  }, undefined, undefined, { cwd: workspaceRoot });
  assert.deepEqual(result.details.sources, [
    "user_request", "operating_instructions", "project_orientation", "workflow_prompt",
  ]);
  assert.equal(result.details.metricsRecorded, true);
  const rows = (await readFile(path.join(workspaceRoot, ".pi", "metrics", "agenticlab.jsonl"), "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event, "context_source_selected");
  assert.deepEqual(rows[0].sourcesUsed, [
    "user_request", "operating_instructions", "project_orientation", "workflow_prompt",
  ]);
});

test("Pi metric tool preserves an explicit false stop-rule result", async (t) => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "context-policy-metric-tool-"));
  t.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  await mkdir(path.join(workspaceRoot, "AgenticLab", "config"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "AgenticLab", "config", "knowledge-capture-policy.json"), JSON.stringify({ metricsEnabled: true }));

  const tools = new Map();
  const pi = { registerTool(tool) { tools.set(tool.name, tool); }, registerCommand() {} };
  const Type = {
    Object: () => ({}), String: () => ({}), Literal: () => ({}), Array: () => ({}),
    Optional: () => ({}), Boolean: () => ({}),
  };
  registerKnowledgeCaptureTools(pi, Type, () => ({}), { expectedRoot: workspaceRoot });

  const result = await tools.get("recordContextSelectionMetric").execute("test-call", {
    sourcesUsed: ["user_request"],
    stopRuleFired: false,
    outcome: "complete",
  }, undefined, undefined, { cwd: workspaceRoot });
  assert.equal(result.details.recorded, true);
  const rows = (await readFile(path.join(workspaceRoot, ".pi", "metrics", "agenticlab.jsonl"), "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(rows.map(({ event }) => event), [
    "context_source_used", "context_stop_rule_evaluated", "context_assembly_complete",
  ]);
  assert.equal(rows[1].stopRuleFired, false);
  assert.equal(rows[2].outcome, "complete");
});

test("context selection still returns a policy result when metric storage is unavailable", async (t) => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "context-policy-selector-storage-"));
  t.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  await mkdir(path.join(workspaceRoot, "AgenticLab", "config"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "AgenticLab", "config", "knowledge-capture-policy.json"), JSON.stringify({ metricsEnabled: true }));
  await mkdir(path.join(workspaceRoot, ".pi"), { recursive: true });
  await writeFile(path.join(workspaceRoot, ".pi", "metrics"), "not a directory");

  const tools = new Map();
  const pi = { registerTool(tool) { tools.set(tool.name, tool); }, registerCommand() {} };
  const Type = {
    Object: () => ({}), String: () => ({}), Literal: () => ({}), Array: () => ({}),
    Optional: () => ({}), Boolean: () => ({}),
  };
  registerKnowledgeCaptureTools(pi, Type, () => ({}), { expectedRoot: workspaceRoot });
  const result = await tools.get("selectContextSources").execute("test-call", {
    workload: "planning", workflowInvoked: true,
  }, undefined, undefined, { cwd: workspaceRoot });
  assert.deepEqual(result.details.sources, ["user_request", "operating_instructions", "workflow_prompt"]);
  assert.equal(result.details.metricsRecorded, false);
  assert.equal(result.details.metricReason, "metrics-unavailable");
});

test("context-selection metrics serialize only allowlisted source and outcome values", async (t) => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "context-policy-metrics-"));
  t.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  await mkdir(path.join(workspaceRoot, "AgenticLab", "config"), { recursive: true });
  await writeFile(path.join(workspaceRoot, "AgenticLab", "config", "knowledge-capture-policy.json"), JSON.stringify({ metricsEnabled: true }));

  const result = await recordContextSelectionMetric({
    workspaceRoot,
    sourcesUsed: ["user_request", "project_knowledge", "user_request"],
    stopRuleFired: true,
    outcome: "complete",
  });
  assert.deepEqual(result, { recorded: true });
  const rows = (await readFile(path.join(workspaceRoot, ".pi", "metrics", "agenticlab.jsonl"), "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(rows.map(({ event }) => event), [
    "context_source_used", "context_stop_rule_evaluated", "context_assembly_complete",
  ]);
  assert.deepEqual(rows[0].sourcesUsed, ["user_request", "project_knowledge"]);
  assert.equal(rows[1].stopRuleFired, true);
  assert.equal(rows[2].outcome, "complete");
  assert.ok(rows.every((row) => Object.keys(row).every((key) => [
    "event", "occurredAt", "sourcesUsed", "stopRuleFired", "outcome",
  ].includes(key))));

  await recordContextSelectionMetric({
    workspaceRoot,
    sourcesUsed: ["user_request", "operating_instructions"],
    stopRuleFired: true,
    outcome: "blocked",
  });
  const blockedRows = (await readFile(path.join(workspaceRoot, ".pi", "metrics", "agenticlab.jsonl"), "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(blockedRows.slice(-3).map(({ event }) => event), [
    "context_source_used", "context_stop_rule_evaluated", "context_assembly_complete",
  ]);
  assert.equal(blockedRows.at(-1).outcome, "blocked");
  assert.equal(blockedRows.at(-2).stopRuleFired, true);

  await recordContextSelectionMetric({
    workspaceRoot,
    sourcesUsed: ["user_request", "operating_instructions"],
    stopRuleFired: false,
    outcome: "complete",
  });
  const notTriggeredRows = (await readFile(path.join(workspaceRoot, ".pi", "metrics", "agenticlab.jsonl"), "utf8"))
    .trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(notTriggeredRows.at(-2).event, "context_stop_rule_evaluated");
  assert.equal(notTriggeredRows.at(-2).stopRuleFired, false);

  await assert.rejects(recordContextSelectionMetric({
    workspaceRoot, sourcesUsed: ["user_request"], stopRuleFired: true, outcome: "selected",
  }), /outcome is not allowlisted/u);
  await assert.rejects(recordContextSelectionMetric({
    workspaceRoot, sourcesUsed: ["user_request"], outcome: "complete",
  }), /stopRuleFired must be a boolean/u);

  await assert.rejects(recordContextSelectionMetric({
    workspaceRoot,
    sourcesUsed: ["raw user request content"],
    stopRuleFired: true,
    outcome: "complete",
  }), /allowlisted context source names/u);
  await assert.rejects(recordContextSelectionMetric({
    workspaceRoot,
    sourcesUsed: ["user_request"],
    stopRuleFired: true,
    outcome: "the user asked for a password reset",
  }), /outcome is not allowlisted/u);
  await assert.rejects(recordKnowledgeCaptureMetric("context_source_used", {
    workspaceRoot, sourcesUsed: ["sensitive arbitrary text"],
  }), /allowlisted source-layer names/u);
  await assert.rejects(recordKnowledgeCaptureMetric("context_source_selected", {
    workspaceRoot, sourcesUsed: ["raw source text"],
  }), /allowlisted source-layer names/u);

  const disabledRoot = await mkdtemp(path.join(os.tmpdir(), "context-policy-disabled-"));
  t.after(() => rm(disabledRoot, { recursive: true, force: true }));
  await mkdir(path.join(disabledRoot, "AgenticLab", "config"), { recursive: true });
  await writeFile(path.join(disabledRoot, "AgenticLab", "config", "knowledge-capture-policy.json"), JSON.stringify({ metricsEnabled: false }));
  assert.deepEqual(await recordContextSelectionMetric({
    workspaceRoot: disabledRoot,
    sourcesUsed: ["user_request"],
    stopRuleFired: false,
    outcome: "complete",
  }), { recorded: false, reason: "metrics-disabled" });

  const failingRoot = await mkdtemp(path.join(os.tmpdir(), "context-policy-storage-failure-"));
  t.after(() => rm(failingRoot, { recursive: true, force: true }));
  await mkdir(path.join(failingRoot, "AgenticLab", "config"), { recursive: true });
  await writeFile(path.join(failingRoot, "AgenticLab", "config", "knowledge-capture-policy.json"), JSON.stringify({ metricsEnabled: true }));
  await mkdir(path.join(failingRoot, ".pi"), { recursive: true });
  await writeFile(path.join(failingRoot, ".pi", "metrics"), "not a directory");
  await assert.rejects(recordContextSelectionMetric({
    workspaceRoot: failingRoot,
    sourcesUsed: ["user_request"],
    stopRuleFired: false,
    outcome: "complete",
  }));
});
