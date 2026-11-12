import { randomUUID } from "node:crypto";
import {
  containsSensitiveValue,
  getCapturePolicy,
  MAX_CANDIDATES,
  MAX_RECORD_BYTES,
  PILOT_PROJECT,
  PILOT_SCOPE,
  PILOT_WORKSPACE_ROOT,
  listPendingCandidates,
  promoteCandidate,
  previewPendingCandidate,
  readKnowledge,
  rejectCandidate,
  setCaptureEnabled,
  stageCandidates,
  validateCandidate,
  validateCandidateBatch,
} from "./knowledge-capture-core.mjs";
import { CONTEXT_ASSEMBLY_OUTCOMES, recordContextSelectionMetric, recordKnowledgeCaptureMetric } from "./knowledge-capture-metrics.mjs";
import { CONTEXT_WORKLOADS, selectContextSources } from "./context-source-policy.mjs";

const REVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_REVIEWS = 32;
const DISPOSITIONS = ["stage", "transient", "merge", "needs-evidence", "unsafe/out-of-scope", "abstain"];
const DISPOSITION_SET = new Set(DISPOSITIONS);
const REVIEW_ID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
const validKnowledgeId = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;
const KNOWLEDGE_CATEGORIES = ["decision", "fact", "experience", "risk", "procedure"];
// Keep aligned with the provenance contract enforced by knowledge-capture-core.mjs.
const SOURCE_KINDS = ["file", "conversation", "artifact", "user-decision"];
const CANDIDATE_STATUS = "candidate";
const RECORD_KEYS = ["id", "title", "category", "scope", "status", "source", "evidence", "recorded", "verified", "claim", "rationale"];

function textResult(text, details) {
  return { content: [{ type: "text", text }], details };
}

function literal(Type, value) {
  return Type.Literal(value);
}

function requireBoundedText(value, label, maxLength, { multiline = false } = {}) {
  const invalidControl = typeof value === "string" && /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > maxLength || invalidControl || (!multiline && /[\r\n]/u.test(value))) {
    throw new Error(`${label} must be a trimmed string of at most ${maxLength} characters`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function validateObservation(observation) {
  const requiredRecordKeys = RECORD_KEYS.filter((key) => !(key === "recorded" || key === "verified"));
  if (!isPlainObject(observation) || !hasOnlyKeys(observation, RECORD_KEYS) || requiredRecordKeys.some((key) => !(key in observation))) {
    throw new Error("candidate observation has an invalid shape");
  }
  if (typeof observation.id !== "string" || !/^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/u.test(observation.id)) {
    throw new Error("candidate observation id must be a lowercase, path-safe identifier");
  }
  requireBoundedText(observation.title, "title", 160);
  requireBoundedText(observation.category, "category", 80);
  requireBoundedText(observation.scope, "scope", 160);
  requireBoundedText(observation.status, "status", 64);
  if (observation.status !== CANDIDATE_STATUS) {
    throw new Error(`status candidate is required for triage observations; map task-local proposed handoffs to lifecycle status ${CANDIDATE_STATUS}`);
  }
  if (!isPlainObject(observation.source) || !hasOnlyKeys(observation.source, ["kind", "reference", "revision"]) || !("kind" in observation.source) || !("reference" in observation.source)) {
    throw new Error(`candidate ${observation.id} has an invalid source object`);
  }
  requireBoundedText(observation.source.kind, "source.kind", 48);
  if (!SOURCE_KINDS.includes(observation.source.kind)) {
    throw new Error(`source.kind must be one of: ${SOURCE_KINDS.join(", ")}`);
  }
  requireBoundedText(observation.source.reference, "source.reference", 300);
  if (observation.source.revision !== undefined) requireBoundedText(observation.source.revision, "source.revision", 160);
  requireBoundedText(observation.evidence, "evidence", 1200, { multiline: true });
  if (observation.recorded !== undefined) requireBoundedText(observation.recorded, "recorded", 32);
  if (observation.verified !== undefined) requireBoundedText(observation.verified, "verified", 32);
  requireBoundedText(observation.claim, "claim", 3000, { multiline: true });
  requireBoundedText(observation.rationale, "rationale", 1200, { multiline: true });

  if (!observation.recorded) observation.recorded = new Date().toISOString().split("T")[0];
  if (!observation.verified) observation.verified = observation.recorded;

  const serialized = JSON.stringify(observation);
  if (Buffer.byteLength(serialized, "utf8") > MAX_RECORD_BYTES) throw new Error(`candidate ${observation.id} exceeds ${MAX_RECORD_BYTES} bytes`);
  if (/knowledge-pending/iu.test(serialized)) throw new Error(`candidate ${observation.id} cannot link to the private pending queue`);
  if (containsSensitiveValue(serialized)) throw new Error(`candidate ${observation.id} contains a value matching a sensitive-data pattern`);
  return observation;
}

function validateDecision(decision) {
  const allowedKeys = ["id", "disposition", "rationale", "missingEvidence", "uncertainty"];
  if (!isPlainObject(decision) || !hasOnlyKeys(decision, allowedKeys) || !["id", "disposition", "rationale"].every((key) => key in decision)) {
    throw new Error("triage decision has an invalid shape");
  }
  if (typeof decision.id !== "string" || !/^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/u.test(decision.id)) {
    throw new Error("triage decision id must be a lowercase, path-safe identifier");
  }
  if (!DISPOSITION_SET.has(decision.disposition)) throw new Error(`decision ${decision.id} has an unsupported disposition`);
  requireBoundedText(decision.rationale, "decision rationale", 500);
  if (decision.missingEvidence !== undefined) requireBoundedText(decision.missingEvidence, "missingEvidence", 800);
  if (decision.uncertainty !== undefined) requireBoundedText(decision.uncertainty, "uncertainty", 500);
  return decision;
}

function validateTriageRequest(params, expectedScope = PILOT_SCOPE) {
  if (!isPlainObject(params) || !hasOnlyKeys(params, ["observations", "decisions"]) || !Array.isArray(params.observations) || !Array.isArray(params.decisions)) {
    throw new Error("triage request must contain only observations and decisions arrays");
  }
  if (params.observations.length === 0 || params.observations.length > MAX_CANDIDATES || params.decisions.length !== params.observations.length) {
    throw new Error(`triage requires 1-${MAX_CANDIDATES} observations and exactly one decision per observation`);
  }

  const observations = params.observations.map(validateObservation);
  const observationsById = new Map();
  for (const observation of observations) {
    if (observationsById.has(observation.id)) throw new Error(`duplicate candidate id: ${observation.id}`);
    observationsById.set(observation.id, observation);
  }

  const decisions = params.decisions.map(validateDecision);
  const decisionsById = new Map();
  for (const decision of decisions) {
    if (decisionsById.has(decision.id)) throw new Error(`duplicate decision id: ${decision.id}`);
    if (!observationsById.has(decision.id)) throw new Error(`decision id ${decision.id} has no matching candidate observation`);
    decisionsById.set(decision.id, decision);
  }
  for (const observation of observations) {
    const decision = decisionsById.get(observation.id);
    if (!decision) throw new Error(`candidate ${observation.id} is missing a triage decision`);
    if (decision.disposition === "stage") validateCandidate(observation, expectedScope);
  }

  const stageable = observations.filter((observation) => decisionsById.get(observation.id).disposition === "stage");
  if (stageable.length) validateCandidateBatch(stageable, expectedScope);
  return { observations, decisions };
}

function buildObservationSchema(Type, StringEnum) {
  return Type.Object({
    id: Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$" }),
    title: Type.String({ minLength: 1, maxLength: 160 }),
    category: Type.String({ minLength: 1, maxLength: 80 }),
    scope: Type.String({ minLength: 1, maxLength: 160 }),
    status: StringEnum([CANDIDATE_STATUS]),
    source: Type.Object({
      kind: StringEnum(SOURCE_KINDS),
      reference: Type.String({ minLength: 1, maxLength: 300 }),
      revision: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
    }, { additionalProperties: false }),
    evidence: Type.String({ minLength: 1, maxLength: 1200 }),
    recorded: Type.Optional(Type.String({ minLength: 1, maxLength: 32 })),
    verified: Type.Optional(Type.String({ minLength: 1, maxLength: 32 })),
    claim: Type.String({ minLength: 1, maxLength: 3000 }),
    rationale: Type.String({ minLength: 1, maxLength: 1200 }),
  }, { additionalProperties: false });
}

function buildDecisionSchema(Type, StringEnum) {
  return Type.Object({
    id: Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$" }),
    disposition: StringEnum(DISPOSITIONS),
    rationale: Type.String({ minLength: 1, maxLength: 500 }),
    missingEvidence: Type.Optional(Type.String({ minLength: 1, maxLength: 800 })),
    uncertainty: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
  }, { additionalProperties: false });
}

function notify(ctx, message, level = "info") {
  if (ctx?.hasUI && typeof ctx.ui?.notify === "function") ctx.ui.notify(message, level);
}

async function askOnce(ctx, title, message) {
  if (!ctx?.hasUI || typeof ctx.ui?.confirm !== "function") throw new Error("This operation requires an available Pi UI confirmation");
  return ctx.ui.confirm(title, message);
}

function pruneReviews(reviews, timestamp, ttlMs) {
  for (const [reviewId, review] of reviews) {
    if (timestamp - review.createdAt > ttlMs) reviews.delete(reviewId);
  }
  if (reviews.size >= MAX_REVIEWS) throw new Error("transient triage review capacity is full; retry after reviews expire");
}

export function registerKnowledgeCaptureTools(pi, Type, StringEnum, { expectedRoot = PILOT_WORKSPACE_ROOT, hooks = {}, now = () => Date.now(), reviewTtlMs = REVIEW_TTL_MS } = {}) {
  if (!Type?.Object || !Type?.String || !Type?.Literal || !Type?.Array || !Type?.Optional || typeof StringEnum !== "function") {
    throw new Error("A compatible Pi TypeBox and StringEnum API is required to register pilot knowledge tools");
  }
  if (typeof now !== "function" || !Number.isSafeInteger(reviewTtlMs) || reviewTtlMs <= 0) {
    throw new Error("transient triage review clock and expiry must be valid");
  }

  const reviews = new Map();
  const observationSchema = buildObservationSchema(Type, StringEnum);
  const decisionSchema = buildDecisionSchema(Type, StringEnum);

  pi.registerTool({
    name: "triageKnowledgeCandidates",
    label: "Triage knowledge candidates",
    description: "Validate a bounded, workspace-scoped candidate-observation set and exactly one structured advisory decision per candidate. Triage observations use lifecycle status 'candidate' (convert task-local 'proposed' handoffs to 'candidate') and source.kind must be one of: file, conversation, artifact, user-decision. Candidate scope must exactly match the configured workspace policy scope; use the approved plan checkpoint's scope when it matches, and do not guess. This tool performs no writes; it stores the validated review only in extension memory under a temporary reviewId.",
    parameters: Type.Object({
      observations: Type.Array(observationSchema, { minItems: 1, maxItems: MAX_CANDIDATES }),
      decisions: Type.Array(decisionSchema, { minItems: 1, maxItems: MAX_CANDIDATES }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const policy = await getCapturePolicy(ctx.cwd, { expectedRoot });
      const { observations, decisions } = validateTriageRequest(params, policy.scope);
      const timestamp = now();
      pruneReviews(reviews, timestamp, reviewTtlMs);
      const reviewId = randomUUID();
      const copiedObservations = observations.map((observation) => JSON.parse(JSON.stringify(observation)));
      const copiedDecisions = decisions.map((decision) => JSON.parse(JSON.stringify(decision)));
      reviews.set(reviewId, {
        createdAt: timestamp,
        inUse: false,
        observations: copiedObservations,
        decisions: copiedDecisions,
      });
      const summary = {
        reviewId,
        decisions: copiedDecisions.map((decision) => ({ ...decision })),
        expiresInMs: reviewTtlMs,
      };
      return textResult(JSON.stringify(summary), summary);
    },
  });

  pi.registerTool({
    name: "stageKnowledgeCandidates",
    label: "Stage reviewed knowledge candidates",
    description: "Stage only candidate records whose stored, validated transient triage review has disposition stage. Accepts a reviewId only; workspace opt-in is required. Candidates remain private and inactive, separate from promoted knowledge.",
    parameters: Type.Object({
      reviewId: Type.String({ minLength: 36, maxLength: 36, pattern: REVIEW_ID_PATTERN }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isPlainObject(params) || !hasOnlyKeys(params, ["reviewId"])) throw new Error("stage tool accepts only a reviewId");
      const reviewId = params.reviewId;
      if (typeof reviewId !== "string" || !new RegExp(REVIEW_ID_PATTERN, "u").test(reviewId)) throw new Error("reviewId is missing or invalid");
      const review = reviews.get(reviewId);
      if (!review) throw new Error("reviewId is missing or expired");
      if (now() - review.createdAt > reviewTtlMs) {
        reviews.delete(reviewId);
        throw new Error("reviewId is missing or expired");
      }
      if (review.inUse) throw new Error("reviewId is already being staged");

      const decisionsById = new Map(review.decisions.map((decision) => [decision.id, decision]));
      const stageRecords = review.observations.filter((observation) => decisionsById.get(observation.id)?.disposition === "stage");
      if (stageRecords.length === 0) {
        return textResult(JSON.stringify({ reviewId, staged: false, count: 0, reason: "No candidates were triaged as stage." }), {
          reviewId,
          staged: false,
          count: 0,
          reason: "No candidates were triaged as stage.",
        });
      }

      review.inUse = true;
      try {
        const policy = await getCapturePolicy(ctx.cwd, { expectedRoot });
        if (!policy.pendingStagingEnabled) throw new Error("pending staging is disabled; triage remains transient");
        const eligibleRecords = validateCandidateBatch(stageRecords, policy.scope);
        const result = await stageCandidates(ctx.cwd, eligibleRecords, { expectedRoot });
        await recordKnowledgeCaptureMetric("candidate_staged", { workspaceRoot: ctx.cwd }).catch(() => {});
        reviews.delete(reviewId);
        const details = { ...result, reviewId, stagedIds: eligibleRecords.map((record) => record.id) };
        return textResult(`Staged ${result.count} reviewed candidate record(s) in the private pending queue. They remain inactive and are not approved knowledge.`, details);
      } catch (error) {
        review.inUse = false;
        throw error;
      }
    },
  });

  pi.registerTool({
    name: "listPendingKnowledgeCandidates",
    label: "List pending knowledge candidate metadata",
    description: "List IDs and review metadata for private pending candidates in the configured workspace scope. Does not return claims, evidence, or rationale; use previewPendingKnowledgeCandidate for read-only content review before choosing a disposition.",
    parameters: Type.Object({}, { additionalProperties: false }),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const result = await listPendingCandidates(ctx.cwd, { expectedRoot });
      const summary = {
        status: result.status,
        count: result.count,
        candidates: result.candidates,
      };
      return textResult(JSON.stringify(summary, null, 2), summary);
    },
  });

  pi.registerTool({
    name: "previewPendingKnowledgeCandidate",
    label: "Preview one pending knowledge candidate",
    description: "Read-only preview of the full content and provenance for one pending candidate in the configured workspace scope. Does not write files, change queue state, require confirmation, or emit metrics. Use before deciding whether to promote or reject the candidate.",
    parameters: Type.Object({
      id: Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$" }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isPlainObject(params) || !hasOnlyKeys(params, ["id"]) || typeof params.id !== "string") {
        throw new Error("candidate preview tool accepts only a candidate id");
      }
      const result = await previewPendingCandidate(ctx.cwd, params.id, { expectedRoot });
      return textResult(JSON.stringify(result, null, 2), result);
    },
  });

  pi.registerTool({
    name: "rejectPendingKnowledgeCandidate",
    label: "Reject and discard one pending knowledge candidate",
    description: "Reject one selected pending candidate after a complete preview and explicit UI confirmation. Permanently removes only that pending candidate; it does not create or change active knowledge, and other pending candidates remain untouched.",
    parameters: Type.Object({
      id: Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$" }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isPlainObject(params) || !hasOnlyKeys(params, ["id"]) || typeof params.id !== "string") {
        throw new Error("rejection tool accepts only a candidate id");
      }
      if (!ctx?.hasUI || typeof ctx.ui?.confirm !== "function") throw new Error("Candidate rejection requires an available Pi UI confirmation");
      const result = await rejectCandidate(ctx.cwd, params.id, (preview) => ctx.ui.confirm(
        "Reject and discard this pending knowledge candidate?",
        preview,
      ), { expectedRoot, hooks });
      if (!result.discarded) return textResult("Discard cancelled. The pending candidate was left unchanged.", result);
      await recordKnowledgeCaptureMetric("candidate_rejected", { workspaceRoot: ctx.cwd }).catch(() => {});
      const warning = result.warnings.length ? ` Warnings: ${result.warnings.join(" ")}` : "";
      return textResult(`Rejected and discarded pending candidate ${result.id}; it was not promoted.${warning}`, result);
    },
  });

  pi.registerTool({
    name: "promoteKnowledgeCandidate",
    label: "Review and promote one pending knowledge candidate",
    description: "Show a concise action summary and ask for UI confirmation before promoting one selected, reviewed pending candidate. Declining leaves it pending; approval creates one new active record unless an identical active record already exists.",
    parameters: Type.Object({
      id: Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$" }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isPlainObject(params) || !hasOnlyKeys(params, ["id"]) || typeof params.id !== "string") {
        throw new Error("promotion tool accepts only a candidate id");
      }
      if (!ctx?.hasUI || typeof ctx.ui?.confirm !== "function") throw new Error("Candidate promotion requires an available Pi UI confirmation");
      const result = await promoteCandidate(ctx.cwd, params.id, (preview) => ctx.ui.confirm(
        "Confirm this knowledge action? Declining leaves the candidate pending.",
        preview,
      ), { expectedRoot, hooks });
      if (result.status === "rejected") return textResult("Promotion was rejected. The candidate remains pending and no active record was created.", result);
      if (result.status === "already_active") return textResult("An identical active record already exists; the confirmed pending duplicate was removed.", result);
      await recordKnowledgeCaptureMetric("decision_knowledge", { workspaceRoot: ctx.cwd }).catch(() => {});
      const warning = result.warnings.length ? ` Warnings: ${result.warnings.join(" ")}` : " The pending candidate was consumed.";
      return textResult(`Promotion committed: ${result.id} is active.${warning}`, result);
    },
  });

  pi.registerTool({
    name: "promoteKnowledgeCorrection",
    label: "Review and promote a knowledge correction",
    description: "Promote one normally staged candidate as a correction to one currently effective-active record. The target is supplied separately; supersedes is written only as optional metadata on the new active record. Requires one UI confirmation and adds exactly one record without changing the predecessor, INDEX.md, or topic maps.",
    parameters: Type.Object({
      id: Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$" }),
      supersedes: Type.String({ minLength: 1, maxLength: 64, pattern: "^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$" }),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isPlainObject(params) || !hasOnlyKeys(params, ["id", "supersedes"]) || typeof params.id !== "string" || typeof params.supersedes !== "string") {
        throw new Error("correction promotion requires a candidate id and target supersedes id");
      }
      if (!ctx?.hasUI || typeof ctx.ui?.confirm !== "function") throw new Error("Knowledge correction requires an available Pi UI confirmation");
      const result = await promoteCandidate(ctx.cwd, params.id, (preview) => ctx.ui.confirm(
        "Promote this knowledge correction?",
        preview,
      ), { expectedRoot, hooks, supersedes: params.supersedes });
      if (result.status === "rejected") return textResult("Correction was rejected. The predecessor and pending candidate remain unchanged; no active record was created.", result);
      await recordKnowledgeCaptureMetric("decision_knowledge", { workspaceRoot: ctx.cwd }).catch(() => {});
      const warning = result.warnings.length ? ` Warnings: ${result.warnings.join(" ")}` : " The selected pending candidate was consumed.";
      return textResult(`Correction committed: ${result.id} is active and supersedes ${params.supersedes}.${warning}`, result);
    },
  });

  pi.registerTool({
    name: "readKnowledgeRecords",
    label: "Read promoted knowledge records",
    description: "Read active, in-scope project records from AgenticLab/knowledge/. Accepts an optional exact record id or query, with optional task scope and category filters. Only eligible record bodies are returned; incomplete scans are not reported as no-match. Retrieval metrics contain only the event and timestamp.",
    parameters: Type.Object({
      id: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
      query: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
      scope: Type.Optional(Type.String({ minLength: 1, maxLength: 160 })),
      category: Type.Optional(StringEnum(KNOWLEDGE_CATEGORIES)),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (!isPlainObject(params) || !hasOnlyKeys(params, ["id", "query", "scope", "category"])) {
        throw new Error("read tool accepts only id, query, scope, and category");
      }
      const cleanId = typeof params.id === "string" && validKnowledgeId.test(params.id.trim()) ? params.id.trim() : undefined;
      if (params.id !== undefined && !cleanId && !(typeof params.query === "string" && params.query.trim())) {
        throw new Error("id must be a valid record ID unless a query is also supplied");
      }
      const result = await readKnowledge(ctx.cwd, {
        id: cleanId,
        query: params.query,
        scope: params.scope,
        category: params.category,
      }, { expectedRoot });
      if ((result.status === "ok" || result.status === "incomplete") && result.count > 0) {
        recordKnowledgeCaptureMetric("retrieval_success", { workspaceRoot: ctx.cwd }).catch(() => {});
      } else if (result.status === "no_match" || result.status === "not_found") {
        recordKnowledgeCaptureMetric("no_match", { workspaceRoot: ctx.cwd }).catch(() => {});
      }
      const summary = {
        status: result.status,
        count: result.count,
        complete: result.complete,
        searched: result.searched,
        filteredCount: result.filteredCount,
        matches: result.matches?.map((record) => ({
          id: record.id,
          title: record.title,
          category: record.category,
          scope: record.scope,
          status: record.status,
          recorded: record.recorded,
          verified: record.verified,
          ...(record.source !== undefined ? { source: record.source } : {}),
          ...(record.evidence !== undefined ? { evidence: record.evidence } : {}),
          file: record.file,
          body: record.body ?? record.content,
          ...(record.supersedes !== undefined ? { supersedes: record.supersedes } : {}),
          ...(record.requestedId !== undefined ? { requestedId: record.requestedId } : {}),
        })) ?? [],
        filtered: result.filtered,
      };
      for (const key of ["note", "issues", "totalMatches", "truncated", "resolution"]) {
        if (result[key] !== undefined) summary[key] = result[key];
      }
      return textResult(JSON.stringify(summary, null, 2), summary);
    },
  });
  // NOTE: This is an adapter-level workspace command (not a CLI subcommand).
  // Invoke via Pi runtime session: pi "knowledge-opt-in" or at the interactive prompt.
  // Do not run as `knowledge-opt-in` at the shell — it requires the Pi adapter context.
  pi.registerCommand("knowledge-opt-in", {
    description: "Explicitly enable private pending-candidate staging for the configured workspace scope",
    handler: async (_args, ctx) => {
      try {
        const policy = await getCapturePolicy(ctx.cwd, { expectedRoot });
        if (policy.pendingStagingEnabled) {
          notify(ctx, `Pending candidate staging is already enabled for ${policy.scope}.`);
          return;
        }
        const accepted = await askOnce(
          ctx,
          "Enable pending candidate staging?",
          `This enables private pending-candidate staging for ${policy.scope}. Candidates remain inactive and are not approved knowledge; promotion is a separate action. No candidate is created by opting in.`,
        );
        if (!accepted) {
          notify(ctx, "Pending candidate staging remains disabled.", "info");
          return;
        }
        await setCaptureEnabled(ctx.cwd, true, { expectedRoot });
        notify(ctx, `Pending candidate staging enabled for ${policy.scope}. No candidate was staged.`, "success");
      } catch (error) {
        notify(ctx, `Could not enable pilot candidate staging: ${error.message}`, "error");
      }
    },
  });

  // NOTE: This is an adapter-level workspace command (not a CLI subcommand).
  // Invoke via Pi runtime session: pi "knowledge-opt-out" or at the interactive prompt.
  // Do not run as `knowledge-opt-out` at the shell — it requires the Pi adapter context.
  pi.registerCommand("knowledge-opt-out", {
    description: "Revoke private pending-candidate staging for the configured workspace scope",
    handler: async (_args, ctx) => {
      try {
        const policy = await getCapturePolicy(ctx.cwd, { expectedRoot });
        if (!policy.pendingStagingEnabled) {
          notify(ctx, "Pending candidate staging is already disabled.");
          return;
        }
        const accepted = await askOnce(
          ctx,
          "Revoke pilot candidate-staging opt-in?",
          "This disables further candidate staging in this workspace. Existing pending candidates will remain untouched and inactive.",
        );
        if (!accepted) {
          notify(ctx, "Pending candidate staging remains enabled.", "info");
          return;
        }
        await setCaptureEnabled(ctx.cwd, false, { expectedRoot });
        notify(ctx, "Pending candidate staging disabled. Existing pending candidates were left untouched.", "success");
      } catch (error) {
        notify(ctx, `Could not revoke pilot candidate staging: ${error.message}`, "error");
      }
    },
  });

  pi.registerTool({
    name: "selectContextSources",
    label: "Select context sources by policy",
    description: "Apply the generic context-source inclusion policy for a task family. Always includes the user request and operating instructions; includes other layers only when their explicit relevance/workflow signals apply. Knowledge retrieval still enforces configured project/task scope, active status, and supersession independently. Emits a content-free context_source_selected event; record actual sources later with recordContextSelectionMetric.",
    parameters: Type.Object({
      workload: StringEnum(CONTEXT_WORKLOADS),
      currentSourceNeeded: Type.Optional(Type.Boolean()),
      knowledgeRelevant: Type.Optional(Type.Boolean()),
      domainPerspectiveRelevant: Type.Optional(Type.Boolean()),
      projectOrientationNeeded: Type.Optional(Type.Boolean()),
      workflowInvoked: Type.Optional(Type.Boolean()),
      approvedPlanPresent: Type.Optional(Type.Boolean()),
      meaningfulFinding: Type.Optional(Type.Boolean()),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const selection = selectContextSources(params);
      let metric = { recorded: false, reason: "metrics-unavailable" };
      try {
        metric = await recordKnowledgeCaptureMetric("context_source_selected", {
          workspaceRoot: ctx?.cwd || ".",
          sourcesUsed: selection.sources,
        });
      } catch {
        // Selection still succeeds if optional metrics storage is unavailable.
      }
      const result = {
        ...selection,
        metricsRecorded: metric.recorded,
        ...(metric.reason ? { metricReason: metric.reason } : {}),
      };
      return textResult(JSON.stringify(result), result);
    },
  });

  pi.registerTool({
    name: "recordContextSelectionMetric",
    label: "Record context-selection metric",
    description: "Record a content-free context-selection metric for the current context assembly. Accepts actual source-layer names, a required stop-rule boolean (true or false), and a required allowlisted assembly outcome. Emits context_source_used, context_stop_rule_evaluated, and context_assembly_complete events. Content-free only; never records source text or claims.",
    parameters: Type.Object({
      sourcesUsed: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 64 }), { maxItems: 10 })),
      stopRuleFired: Type.Boolean(),
      outcome: StringEnum(CONTEXT_ASSEMBLY_OUTCOMES),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const { sourcesUsed, stopRuleFired, outcome, workspaceRoot } = params || {};
      const sources = Array.isArray(sourcesUsed) ? sourcesUsed.filter((s) => typeof s === "string" && s.length > 0 && s.length <= 64) : [];
      const result = await recordContextSelectionMetric({
        sourcesUsed: sources,
        stopRuleFired,
        outcome,
        workspaceRoot: ctx?.cwd || ".",
      });
      return textResult(JSON.stringify({ recorded: result.recorded, reason: result.reason ?? null }), result);
    },
  });
}
