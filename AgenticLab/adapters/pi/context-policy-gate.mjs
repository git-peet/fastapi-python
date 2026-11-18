import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { preflightDeliveryPlan } from "./plan-preflight.mjs";

const PLAN_INPUT = /^\/plan(?:\s|$)/iu;
const IMPLEMENT_INPUT = /^\/implement(?:\s|$)/iu;
const PREMORTEM_INPUT = /^\/premortem(?:\s|$)/iu;
const PLAN_APPROVAL = /Do you approve this plan and authorize writing its transient[\s\S]*plan-checkpoint\.json/iu;
const IMPLEMENT_CHECKPOINT_GATE = /(?:Are you planning to run\s+\/premortem\?|Not planning to run\s+\/premortem\?)/iu;
const IMPLEMENT_LOG_GATE = /Do you approve writing the implementation-log\?/iu;
const SHELL_BLOCK_MESSAGE = "Shell commands are blocked while /plan is active. Read-only directory listing with `ls` or `find` is allowed; other shell commands are blocked. Use Pi read and registered knowledge/metrics tools, or run /plan-cancel to leave the workflow.";
const READ_ONLY_LISTING = /^(?:ls|find)(?:\s|$)/u;
const DANGEROUS_SHELL = /[;|&><`]|\$\(|(?:^|\s)-(?:exec|execdir|delete|ok|okdir)(?:\s|$)/u;

function isReadOnlyListingCommand(command) {
  if (typeof command !== "string") return false;
  const trimmed = command.trim();
  return READ_ONLY_LISTING.test(trimmed) && !DANGEROUS_SHELL.test(trimmed);
}
const KNOWLEDGE_READ_BLOCK_MESSAGE = "Direct reads of knowledge records and the pending queue are blocked in /plan and /implement. Use readKnowledgeRecords for active records and the registered pending-candidate tools for pending data.";

function assistantText(message) {
  if (!message || message.role !== "assistant") return "";
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

function resolveReadPath(value, cwd) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  let target = value.trim().replace(/^@/u, "");
  if (target === "~") target = homedir();
  else if (target.startsWith("~/")) target = path.join(homedir(), target.slice(2));
  return path.resolve(cwd || process.cwd(), target);
}

function isWithinWorkspace(workspaceRoot, candidate) {
  const relative = path.relative(workspaceRoot, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
  const parts = relative.split(path.sep).filter(Boolean);
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index] !== "AgenticLab") continue;
    if (parts[index + 1] === "knowledge-pending") return true;
    if (parts[index + 1] === "knowledge" && ["records", "_candidates"].includes(parts[index + 2])) return true;
  }
  return false;
}

async function isProtectedKnowledgeRead(value, cwd) {
  const absolute = resolveReadPath(value, cwd);
  if (!absolute) return false;
  let root = path.resolve(cwd || process.cwd());
  try {
    root = await realpath(root);
  } catch {
    return isWithinWorkspace(root, absolute);
  }

  if (isWithinWorkspace(root, absolute)) return true;
  try {
    return isWithinWorkspace(root, await realpath(absolute));
  } catch {
    return false;
  }
}

/** Tracks explicit delivery workflows so context-source access rules are scoped. */
export function createDeliveryContextGuardState() {
  let mode = null;
  let awaitingUserDecision = false;
  let responseInProgress = false;
  let clarificationPending = false;

  return {
    onInput(text, source) {
      if (source === "extension" || typeof text !== "string") return;
      const input = text.trimStart();
      if (PLAN_INPUT.test(input)) {
        mode = "plan";
        awaitingUserDecision = false;
        responseInProgress = false;
        clarificationPending = false;
        return;
      }
      if (IMPLEMENT_INPUT.test(input)) {
        mode = "implement";
        awaitingUserDecision = false;
        responseInProgress = false;
        clarificationPending = false;
        return;
      }
      if (PREMORTEM_INPUT.test(input)) {
        mode = null;
        awaitingUserDecision = false;
        responseInProgress = false;
        clarificationPending = false;
        return;
      }
      if (mode && awaitingUserDecision) {
        awaitingUserDecision = false;
        responseInProgress = true;
        clarificationPending = false;
      }
    },

    onMessage(message) {
      if (!mode) return;
      const text = assistantText(message).trim();
      if (!text) return;
      const isGate = mode === "plan"
        ? PLAN_APPROVAL.test(text)
        : IMPLEMENT_CHECKPOINT_GATE.test(text) || IMPLEMENT_LOG_GATE.test(text);
      if (isGate) {
        awaitingUserDecision = true;
        clarificationPending = false;
        return;
      }
      clarificationPending = /\?\s*$/u.test(text);
    },

    onAgentSettled() {
      if (!responseInProgress) return;
      responseInProgress = false;
      if (!awaitingUserDecision && !clarificationPending) mode = null;
    },

    workflowMode() {
      return mode;
    },

    isPlanActive() {
      return mode === "plan";
    },

    guardsKnowledgeReads() {
      return mode === "plan" || mode === "implement";
    },

    cancel() {
      mode = null;
      awaitingUserDecision = false;
      responseInProgress = false;
      clarificationPending = false;
    },
  };
}

/**
 * Restrict shell calls during /plan and direct knowledge-record/pending-queue
 * reads during explicitly invoked /plan and /implement workflows. The dedicated
 * retrieval and pending-candidate tools remain available.
 */
export function registerPlanPreflight(pi, Type) {
  if (typeof pi?.registerTool !== "function" || !Type?.Object || !Type?.String || !Type?.Array || !Type?.Optional) {
    throw new Error("A compatible Pi tool and TypeBox API is required to register the delivery-plan preflight");
  }

  const decisionSchema = Type.Object({
    text: Type.String({ minLength: 1, maxLength: 2000 }),
    status: Type.String({ minLength: 1, maxLength: 16 }),
  }, { additionalProperties: false });
  const commandSchema = Type.Object({
    command: Type.String({ minLength: 1, maxLength: 1000 }),
    workingDirectory: Type.String({ minLength: 1, maxLength: 500 }),
  }, { additionalProperties: false });

  pi.registerTool({
    name: "preflightDeliveryPlan",
    label: "Preflight delivery plan",
    description: "Run the deterministic final /plan check before presenting a plan. Pass the supplied task/PBI context, drafted plan and checkpoint fields, proposed implementation scope/exclusions, source paths, validation commands, and unresolved decisions. Does not rewrite the plan or execute commands; on failure, present only the returned gaps.",
    parameters: Type.Object({
      taskContext: Type.String({ minLength: 1, maxLength: 30000 }),
      pbiEntry: Type.Optional(Type.String({ minLength: 1, maxLength: 30000 })),
      planText: Type.String({ minLength: 1, maxLength: 30000 }),
      outcome: Type.String({ minLength: 1, maxLength: 3000 }),
      planningSession: Type.String({ minLength: 1, maxLength: 3000 }),
      decisionSummary: Type.String({ minLength: 1, maxLength: 3000 }),
      checkpointTask: Type.String({ minLength: 1, maxLength: 3000 }),
      checkpointSummary: Type.String({ minLength: 1, maxLength: 3000 }),
      implementationScope: Type.Array(Type.String({ minLength: 1, maxLength: 2000 }), { minItems: 1, maxItems: 100 }),
      exclusions: Type.Array(Type.String({ minLength: 1, maxLength: 2000 }), { maxItems: 100 }),
      sourcePaths: Type.Array(Type.String({ minLength: 1, maxLength: 1000 }), { maxItems: 100 }),
      validationCommands: Type.Array(commandSchema, { maxItems: 50 }),
      openDecisions: Type.Array(decisionSchema, { maxItems: 50 }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await preflightDeliveryPlan(params, { workspaceRoot: ctx?.cwd || process.cwd() });
      const message = result.ok ? "Plan preflight passed." : `Plan preflight failed. Present only these gaps: ${result.gaps.join("; ")}`;
      return { content: [{ type: "text", text: message }], details: result };
    },
  });
}

export function registerPlanShellGuard(pi) {
  const state = createDeliveryContextGuardState();

  pi.on("input", (event) => {
    state.onInput(event?.text, event?.source);
  });

  pi.on("message_end", (event) => {
    state.onMessage(event?.message);
  });

  pi.on("agent_settled", () => {
    state.onAgentSettled();
  });

  pi.on("tool_call", async (event, ctx) => {
    if (state.isPlanActive() && event?.toolName === "bash") {
      if (isReadOnlyListingCommand(event?.input?.command)) return undefined;
      return { block: true, reason: SHELL_BLOCK_MESSAGE };
    }
    if (state.guardsKnowledgeReads() && event?.toolName === "read"
      && await isProtectedKnowledgeRead(event?.input?.path, ctx?.cwd)) {
      return { block: true, reason: KNOWLEDGE_READ_BLOCK_MESSAGE };
    }
    return undefined;
  });

  pi.on("user_bash", (event) => {
    if (!state.isPlanActive()) return undefined;
    if (isReadOnlyListingCommand(event?.command)) return undefined;
    return {
      result: {
        output: SHELL_BLOCK_MESSAGE,
        exitCode: 126,
        cancelled: false,
        truncated: false,
      },
    };
  });

  pi.registerCommand("plan-cancel", {
    description: "Clear active /plan or /implement context guards when abandoning the workflow",
    handler: async (_args, ctx) => {
      state.cancel();
      if (ctx?.hasUI && typeof ctx.ui?.notify === "function") {
        ctx.ui.notify("Delivery context guard cleared.", "info");
      }
    },
  });

  return state;
}
