import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";

const ALLOWED_EVENTS = new Set([
  "candidate_staged",
  "candidate_rejected",
  "decision_knowledge",
  "retrieval_success",
  "no_match",
  "context_source_used",
  "context_stop_rule_triggered",
  "context_assembly_complete"
]);

/**
 * Allowed context-source identifiers for context-selection metrics.
 * Content-free: only source-layer names, never source text.
 */
const ALLOWED_CONTEXT_SOURCES = new Set([
  "user_request",
  "project_knowledge",
  "current_source"
]);

/**
 * Allowed context-selection events (content-free, event-based)
 * - context_source_used: sources used in context assembly
 * - context_stop_rule_triggered: stop rule triggered during assembly
 * - context_assembly_complete: final context assembly state
 */
const ALLOWED_CONTEXT_EVENTS = new Set([
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
  const { workspaceRoot, metricsDir, logPath } = metricPaths(opts.workspaceRoot || ".");
  const policyPath = path.join(workspaceRoot, "AgenticLab", "config", "knowledge-capture-policy.json");
  const policyText = await fs.readFile(policyPath, "utf8");
  const policy = JSON.parse(policyText);
  if (policy.metricsEnabled !== true) return { recorded: false, reason: "metrics-disabled" };

  await fs.mkdir(metricsDir, { recursive: true, mode: 0o700 });
  const payload = { event, occurredAt: new Date().toISOString() };
  if (opts.sourcesUsed && opts.sourcesUsed.length) payload.sourcesUsed = opts.sourcesUsed;
  if (opts.stopRuleFired !== null) payload.stopRuleFired = opts.stopRuleFired;
  if (opts.outcome !== null && opts.outcome !== undefined) payload.outcome = opts.outcome;
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
  const { sourcesUsed = [], stopRuleFired = null, outcome = null, workspaceRoot = "." } = opts;
  const events = [];

  // Record sources used in context assembly (content-free)
  if (sourcesUsed?.length) {
    await recordKnowledgeCaptureMetric("context_source_used", { workspaceRoot, sourcesUsed });
  }

  // Record if stop rule was triggered
  if (stopRuleFired !== null) {
    await recordKnowledgeCaptureMetric("context_stop_rule_triggered", { workspaceRoot, stopRuleFired });
  }

  // Final assembly complete
  await recordKnowledgeCaptureMetric("context_assembly_complete", { workspaceRoot, outcome });
}