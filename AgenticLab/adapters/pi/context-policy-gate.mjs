const PLAN_INPUT = /^\/plan(?:\s|$)/iu;
const WORKFLOW_SWITCH = /^\/(?:implement|premortem)\b/iu;
const PLAN_APPROVAL = /Do you approve this plan and authorize writing its transient[\s\S]*plan-checkpoint\.json/iu;
const SHELL_BLOCK_MESSAGE = "Shell commands are blocked while /plan is active. Use Pi read and registered knowledge/metrics tools, or run /plan-cancel to leave planning.";

function assistantText(message) {
  if (!message || message.role !== "assistant") return "";
  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";
  return message.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

/** Keeps a shell restriction active for an explicit /plan and its clarification turns. */
export function createPlanShellGuardState() {
  let active = false;
  let awaitingPlanDecision = false;
  let approvalResponseInProgress = false;
  let clarificationPending = false;

  return {
    onInput(text, source) {
      if (source === "extension" || typeof text !== "string") return;
      const input = text.trimStart();
      if (PLAN_INPUT.test(input)) {
        active = true;
        awaitingPlanDecision = false;
        approvalResponseInProgress = false;
        clarificationPending = false;
        return;
      }
      if (WORKFLOW_SWITCH.test(input)) {
        active = false;
        awaitingPlanDecision = false;
        approvalResponseInProgress = false;
        clarificationPending = false;
        return;
      }
      if (active && awaitingPlanDecision) {
        awaitingPlanDecision = false;
        approvalResponseInProgress = true;
        clarificationPending = false;
      }
    },

    onMessage(message) {
      if (!active) return;
      const text = assistantText(message).trim();
      if (!text) return;
      if (PLAN_APPROVAL.test(text)) {
        awaitingPlanDecision = true;
        clarificationPending = false;
        return;
      }
      clarificationPending = /\?\s*$/u.test(text);
    },

    onAgentSettled() {
      if (!approvalResponseInProgress) return;
      approvalResponseInProgress = false;
      if (!awaitingPlanDecision && !clarificationPending) active = false;
    },

    isActive() {
      return active;
    },

    cancel() {
      active = false;
      awaitingPlanDecision = false;
      approvalResponseInProgress = false;
      clarificationPending = false;
    },
  };
}

/**
 * Block shell execution only while the user-invoked /plan workflow is active.
 * Reads and registered knowledge/context tools remain available. /implement,
 * /premortem, and ordinary work are not restricted by this guard.
 */
export function registerPlanShellGuard(pi) {
  const state = createPlanShellGuardState();

  pi.on("input", (event) => {
    state.onInput(event?.text, event?.source);
  });

  pi.on("message_end", (event) => {
    state.onMessage(event?.message);
  });

  pi.on("agent_settled", () => {
    state.onAgentSettled();
  });

  pi.on("tool_call", (event) => {
    if (state.isActive() && event?.toolName === "bash") {
      return { block: true, reason: SHELL_BLOCK_MESSAGE };
    }
    return undefined;
  });

  pi.on("user_bash", () => {
    if (!state.isActive()) return undefined;
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
    description: "Leave an active /plan shell guard when abandoning the planning flow",
    handler: async (_args, ctx) => {
      state.cancel();
      if (ctx?.hasUI && typeof ctx.ui?.notify === "function") {
        ctx.ui.notify("Planning shell guard cleared.", "info");
      }
    },
  });

  return state;
}
