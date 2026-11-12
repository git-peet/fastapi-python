export const CONTEXT_SOURCES = Object.freeze([
  "user_request",
  "operating_instructions",
  "current_source",
  "project_knowledge",
  "domain_perspective",
  "workflow_prompt",
  "approved_plan",
  "task_local_handoff",
  "project_orientation",
]);

export const CONTEXT_WORKLOADS = Object.freeze([
  "direct",
  "research",
  "bug_diagnosis",
  "planning",
  "implementation",
  "review",
  "bootstrap",
]);

const BOOLEAN_SIGNALS = Object.freeze([
  "currentSourceNeeded",
  "knowledgeRelevant",
  "domainPerspectiveRelevant",
  "projectOrientationNeeded",
  "workflowInvoked",
  "approvedPlanPresent",
  "meaningfulFinding",
]);

/**
 * Apply the generic context-source inclusion policy to explicit task signals.
 * This selects source layers only; readKnowledgeRecords remains responsible for
 * enforcing project/task scope, active lifecycle status, and supersession.
 */
export function selectContextSources(input = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("context-selection input must be an object");
  }
  const allowedKeys = new Set(["workload", ...BOOLEAN_SIGNALS]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new Error("context-selection input contains an unsupported field");
  }
  if (!CONTEXT_WORKLOADS.includes(input.workload)) {
    throw new Error(`workload must be one of: ${CONTEXT_WORKLOADS.join(", ")}`);
  }
  for (const key of BOOLEAN_SIGNALS) {
    if (input[key] !== undefined && typeof input[key] !== "boolean") {
      throw new Error(`${key} must be a boolean when provided`);
    }
  }

  const sources = ["user_request", "operating_instructions"];
  const include = (signal, source) => {
    if (input[signal] === true) sources.push(source);
  };

  include("currentSourceNeeded", "current_source");
  include("knowledgeRelevant", "project_knowledge");
  include("domainPerspectiveRelevant", "domain_perspective");
  include("projectOrientationNeeded", "project_orientation");

  if (input.workflowInvoked === true) sources.push("workflow_prompt");
  if (input.approvedPlanPresent === true && ["implementation", "review"].includes(input.workload)) {
    sources.push("approved_plan");
  }
  if (input.meaningfulFinding === true) sources.push("task_local_handoff");
  if (input.workload === "bootstrap" && !sources.includes("project_orientation")) {
    sources.push("project_orientation");
  }

  return { sources, outcome: "selected" };
}
