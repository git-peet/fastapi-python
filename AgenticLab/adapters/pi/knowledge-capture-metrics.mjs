import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import { CONTEXT_SOURCES } from "./context-source-policy.mjs";

const ALLOWED_EVENTS = new Set([
  "candidate_staged",
  "candidate_rejected",
  "decision_knowledge",
  "retrieval_success",
  "no_match",
  "context_source_selected",
  "context_source_used",
  "context_stop_rule_triggered",
  "context_assembly_complete"
]);

/**
 * Allowed context-source identifiers for context-selection metrics.
 * Content-free: only source-layer names, never source text.
 */
const ALLOWED_CONTEXT_SOURCES = new Set(CONTEXT_SOURCES);

const ALLOWED_CONTEXT_OUTCOMES = new Set([
  "selected",
  "complete",
  "not_needed",
  "no_match",
  "filtered",
  "incomplete",
  "unavailable",
  "blocked"
]);

/**
 * Allowed context-selection events (content-free, event-based)
 * - context_source_selected: source layers selected by policy
 * - context_source_used: source layers actually used in context assembly
 * - context_stop_rule_triggered: stop rule triggered during assembly
 * - context_assembly_complete: final context assembly state
 */
const ALLOWED_CONTEXT_EVENTS = new Set([
  "context_source_selected",
  "context_source_used",
  "context_stop_rule_triggered",
  "context_assembly_complete"
]);

export function metricPaths(workspaceRoot = ".") {
  const root = path.resolve(workspaceRoot);
  const metricsDir = path.join(root, ".pi", "metrics");
  return { workspaceRoot: root, metricsDir, logPath: path.join(metricsDir, "agenticlab.jsonl") };
}

/**
 * Register the workspace metrics location for the Pi adapter. Inventory and
 * pricing events deliberately share this narrow writer without payload data.
 */
export function registerKnowledgeCaptureMetrics(_pi, opts = {}) {
  return metricPaths(opts.workspaceRoot || ".");
}

/**
 * Append one allowlisted, content-free event. Callers cannot attach arbitrary
 * metadata, so rule names, conditions, actions, customer, and cart data never
 * enter this log.
 */
export async function recordKnowledgeCaptureMetric(event, opts = {}) {
  if (!ALLOWED_EVENTS.has(event)) {
    throw new Error("unsupported knowledge-capture metric event");
  }
  const contextFields = {
    context_source_selected: ["sourcesUsed"],
    context_source_used: ["sourcesUsed"],
    context_stop_rule_triggered: ["stopRuleFired"],
    context_assembly_complete: ["outcome"],
  };
  const allowedFields = new Set(["workspaceRoot", ...(ALLOWED_CONTEXT_EVENTS.has(event) ? contextFields[event] : [])]);
  if (Object.keys(opts).some((key) => !allowedFields.has(key))) {
    throw new Error("unsupported knowledge-capture metric field");
  }
  if (event === "context_source_selected" || event === "context_source_used") {
    if (!Array.isArray(opts.sourcesUsed) || opts.sourcesUsed.length < 1 || opts.sourcesUsed.length > 10
      || opts.sourcesUsed.some((source) => !ALLOWED_CONTEXT_SOURCES.has(source))) {
      throw new Error("context sources must be non-empty allowlisted source-layer names");
    }
  } else if (event === "context_stop_rule_triggered") {
    if (typeof opts.stopRuleFired !== "boolean") throw new Error("stopRuleFired must be a boolean");
  } else if (event === "context_assembly_complete") {
    if (opts.outcome !== undefined && opts.outcome !== null && !ALLOWED_CONTEXT_OUTCOMES.has(opts.outcome)) {
      throw new Error("context outcome is not allowlisted");
    }
  }
  const { workspaceRoot, metricsDir, logPath } = metricPaths(opts.workspaceRoot || ".");
  const policyPath = path.join(workspaceRoot, "AgenticLab", "config", "knowledge-capture-policy.json");
  const policyText = await fs.readFile(policyPath, "utf8");
  const policy = JSON.parse(policyText);
  if (policy.metricsEnabled !== true) return { recorded: false, reason: "metrics-disabled" };

  await fs.mkdir(metricsDir, { recursive: true, mode: 0o700 });
  const payload = { event, occurredAt: new Date().toISOString() };
  if (event === "context_source_selected" || event === "context_source_used") {
    payload.sourcesUsed = [...new Set(opts.sourcesUsed)];
  }
  if (event === "context_stop_rule_triggered") payload.stopRuleFired = opts.stopRuleFired;
  if (event === "context_assembly_complete" && opts.outcome !== null && opts.outcome !== undefined) {
    payload.outcome = opts.outcome;
  }
  const line = `${JSON.stringify(payload)}\n`;
  const handle = await fs.open(logPath, fsConstants.O_WRONLY | fsConstants.O_APPEND | fsConstants.O_CREAT, 0o600);
  try {
    await handle.writeFile(line, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { recorded: true };
}

/**
 * Record a context-selection metric. Content-free: only source-layer names,
 * boolean stop-rule flag, and optional outcome string. Delegates to the core
 * metric writer (policy gate, allowlist, JSONL append).
 */
export async function recordContextSelectionMetric(opts = {}) {
  if (opts === null || typeof opts !== "object" || Array.isArray(opts)) {
    throw new Error("context-selection metric input must be an object");
  }
  const allowedKeys = new Set(["sourcesUsed", "stopRuleFired", "outcome", "workspaceRoot"]);
  if (Object.keys(opts).some((key) => !allowedKeys.has(key))) {
    throw new Error("context-selection metric input contains an unsupported field");
  }
  const { sourcesUsed = [], stopRuleFired = null, outcome = null, workspaceRoot = "." } = opts;
  if (!Array.isArray(sourcesUsed) || sourcesUsed.length > 10 || sourcesUsed.some((source) => !ALLOWED_CONTEXT_SOURCES.has(source))) {
    throw new Error("sourcesUsed must contain only allowlisted context source names");
  }
  if (stopRuleFired !== null && typeof stopRuleFired !== "boolean") {
    throw new Error("stopRuleFired must be a boolean or null");
  }
  if (outcome !== null && outcome !== undefined && !ALLOWED_CONTEXT_OUTCOMES.has(outcome)) {
    throw new Error("context outcome is not allowlisted");
  }
  let result;

  // Record sources used in context assembly (content-free)
  if (sourcesUsed.length) {
    result = await recordKnowledgeCaptureMetric("context_source_used", { workspaceRoot, sourcesUsed });
  }

  // Record if stop rule was triggered
  if (stopRuleFired !== null) {
    result = await recordKnowledgeCaptureMetric("context_stop_rule_triggered", { workspaceRoot, stopRuleFired });
  }

  // Final assembly complete
  result = await recordKnowledgeCaptureMetric("context_assembly_complete", { workspaceRoot, outcome });
  return result;
}
