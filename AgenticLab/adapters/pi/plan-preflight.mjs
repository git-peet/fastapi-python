import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const EVALUATION_CARD = "AgenticLab/evaluation/results/EXP4-C03-CONTEXT-POLICY-001.md";
const MARKER_PATTERN = /C03-EVAL-ID\s*:\s*([A-Z0-9][A-Z0-9-]{1,63})/giu;
const ALLOWED_KEYS = [
  "taskContext", "pbiEntry", "planText", "outcome", "planningSession", "decisionSummary",
  "checkpointTask", "checkpointSummary", "implementationScope", "exclusions", "sourcePaths",
  "validationCommands", "openDecisions",
];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function uniqueMarkers(...texts) {
  const markers = new Set();
  for (const text of texts) {
    if (typeof text !== "string") continue;
    for (const match of text.matchAll(MARKER_PATTERN)) markers.add(match[1]);
  }
  return [...markers];
}

function text(value, label, gaps, { optional = false, max = 30000 } = {}) {
  if (optional && value === undefined) return "";
  if (typeof value !== "string" || value.trim() !== value || value.length > max || (!optional && !value)) {
    gaps.push(`${label} must be a trimmed string${optional ? " when supplied" : ""}`);
    return "";
  }
  return value;
}

function stringArray(value, label, gaps, maxItems = 100) {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string" || !item.trim() || item.trim() !== item)) {
    gaps.push(`${label} must be an array of trimmed, non-empty strings`);
    return [];
  }
  return value;
}

function pathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function globToRegExp(pattern) {
  return new RegExp(`^${pattern.split("").map((character) => {
    if (character === "*") return ".*";
    if (character === "?") return ".";
    return character.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
  }).join("")}$`, "u");
}

async function resolveTargets(root, reference) {
  if (typeof reference !== "string" || !reference || path.isAbsolute(reference) || reference.includes("\\") || reference.split("/").includes("..")) {
    return { paths: [], error: `path is not workspace-relative: ${String(reference)}` };
  }
  const absolute = path.resolve(root, reference);
  if (!pathWithin(root, absolute)) return { paths: [], error: `path escapes the workspace: ${reference}` };
  if (!/[*?]/u.test(reference)) {
    try {
      await stat(absolute);
      return { paths: [absolute] };
    } catch {
      return { paths: [], error: `referenced path does not exist: ${reference}` };
    }
  }
  if (reference.includes("**")) return { paths: [], error: `recursive globs are not supported: ${reference}` };
  const directory = path.dirname(absolute);
  const matcher = globToRegExp(path.basename(reference));
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const paths = entries.filter((entry) => matcher.test(entry.name)).map((entry) => path.join(directory, entry.name));
    if (paths.length === 0) return { paths: [], error: `referenced path pattern has no matches: ${reference}` };
    return { paths };
  } catch {
    return { paths: [], error: `referenced path directory does not exist: ${path.dirname(reference)}` };
  }
}

function extractPaths(value) {
  return [...value.matchAll(/(?:^|\s|\()((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.*?-]+)(?=$|\s|\)|,)/gu)].map((match) => match[1]);
}

function hasBlanketImplementationBan(value) {
  return /\b(?:no|prohibit(?:ed)?)\s+(?:(?:application|source|code|file)\s+)?(?:implementation\s+)?(?:changes|edits|writes)\b|\bdo\s+not\s+(?:edit|change|write)\s+(?:any\s+)?(?:files|source|code)\b/iu.test(value);
}

function commandTokens(command) {
  if (/[;|&><`$()\n\r]/u.test(command) || /['"]|\\/u.test(command)) return null;
  return command.trim().split(/\s+/u);
}

async function verifyNodeTestCommand(command, workingDirectory, root, gaps) {
  const tokens = commandTokens(command);
  if (!tokens || tokens.length < 3 || tokens[0] !== "node" || tokens[1] !== "--test") return false;
  for (const reference of tokens.slice(2)) {
    const result = await resolveTargets(workingDirectory, reference);
    if (result.error) {
      gaps.push(`validation command target: ${result.error}`);
      continue;
    }
    for (const target of result.paths) {
      const relative = path.relative(root, target).split(path.sep).join("/");
      if (!relative.endsWith(".test.mjs")) {
        gaps.push(`node --test target is not an existing .test.mjs file: ${relative}`);
        continue;
      }
      try {
        const source = await readFile(target, "utf8");
        if (!/(?:from\s*["']node:test["']|import\s*["']node:test["'])/u.test(source)) {
          gaps.push(`node --test target does not use the built-in node:test runner: ${relative}`);
        }
      } catch {
        gaps.push(`could not verify node --test target: ${relative}`);
      }
    }
  }
  return true;
}

async function verifyPackageScript(command, workingDirectory, gaps) {
  const tokens = commandTokens(command);
  if (!tokens || tokens.length !== 3 || !["npm", "bun"].includes(tokens[0]) || tokens[1] !== "run" || !/^[A-Za-z0-9:_-]+$/u.test(tokens[2])) return false;
  try {
    const packageJson = JSON.parse(await readFile(path.join(workingDirectory, "package.json"), "utf8"));
    if (typeof packageJson.scripts?.[tokens[2]] !== "string") {
      gaps.push(`validation command script is not declared in ${path.relative(workingDirectory, path.join(workingDirectory, "package.json")) || "package.json"}: ${tokens[2]}`);
    }
  } catch {
    gaps.push(`could not verify package script in ${path.join(workingDirectory, "package.json")}`);
  }
  return true;
}

/**
 * Validate a structured plan draft without rewriting it or executing commands.
 * All repository paths are resolved relative to workspaceRoot.
 */
export async function preflightDeliveryPlan(input, { workspaceRoot = process.cwd() } = {}) {
  const gaps = [];
  if (!isPlainObject(input) || Object.keys(input).some((key) => !ALLOWED_KEYS.includes(key))) {
    return { ok: false, marker: null, gaps: ["preflight input has an invalid shape"] };
  }

  const taskContext = text(input.taskContext, "taskContext", gaps);
  const pbiEntry = text(input.pbiEntry, "pbiEntry", gaps, { optional: true });
  const planText = text(input.planText, "planText", gaps);
  const outcome = text(input.outcome, "outcome", gaps);
  text(input.planningSession, "planningSession", gaps);
  const decisionSummary = text(input.decisionSummary, "decisionSummary", gaps);
  const checkpointTask = text(input.checkpointTask, "checkpointTask", gaps);
  const checkpointSummary = text(input.checkpointSummary, "checkpointSummary", gaps);
  const implementationScope = stringArray(input.implementationScope, "implementationScope", gaps);
  const exclusions = stringArray(input.exclusions, "exclusions", gaps);
  const sourcePaths = stringArray(input.sourcePaths, "sourcePaths", gaps);
  const commands = Array.isArray(input.validationCommands) ? input.validationCommands : [];
  const openDecisions = Array.isArray(input.openDecisions) ? input.openDecisions : [];
  if (!Array.isArray(input.validationCommands) || commands.length > 50) gaps.push("validationCommands must be an array with at most 50 entries");
  if (!Array.isArray(input.openDecisions) || openDecisions.length > 50) gaps.push("openDecisions must be an array with at most 50 entries");
  if (!outcome || !implementationScope.length) gaps.push("outcome and proposed implementation scope must both be explicit");

  if (hasBlanketImplementationBan(outcome) && implementationScope.length) {
    gaps.push("outcome forbids implementation changes that are present in proposed scope");
  }
  for (const exclusion of exclusions) {
    if (hasBlanketImplementationBan(exclusion) && implementationScope.length) {
      gaps.push(`exclusion conflicts with proposed implementation scope: ${exclusion}`);
    }
    const excludedPaths = extractPaths(exclusion).map((value) => value.replace(/\/$/u, ""));
    for (const scoped of implementationScope) {
      for (const scopedPath of extractPaths(scoped)) {
        if (excludedPaths.some((excluded) => scopedPath === excluded || scopedPath.startsWith(`${excluded}/`))) {
          gaps.push(`excluded path overlaps proposed implementation scope: ${scopedPath}`);
        }
      }
    }
  }

  const markers = uniqueMarkers(taskContext, pbiEntry);
  if (markers.length > 1) gaps.push("task context and PBI entry contain conflicting C03-EVAL-ID markers");
  const marker = markers.length === 1 ? markers[0] : null;
  if (marker) {
    if (!planText.includes(marker)) gaps.push(`C03-EVAL-ID ${marker} is missing from the human-readable plan`);
    if (!checkpointTask.includes(marker) && !checkpointSummary.includes(marker)) gaps.push(`C03-EVAL-ID ${marker} is missing from checkpoint task/summary`);
    if (!implementationScope.some((item) => item.includes(EVALUATION_CARD))) gaps.push(`marked task must include the append-only evaluation card in implementation scope: ${EVALUATION_CARD}`);
  } else if (implementationScope.some((item) => item.includes(EVALUATION_CARD))) {
    gaps.push("evaluation-card scope is present without a C03-EVAL-ID marker");
  }

  const decisionItems = [];
  for (const [index, decision] of openDecisions.entries()) {
    if (!isPlainObject(decision) || typeof decision.text !== "string" || !decision.text.trim() || decision.status !== "open") {
      gaps.push(`openDecisions[${index}] must have non-empty text and status open`);
    } else {
      decisionItems.push(decision.text);
    }
  }
  if (decisionItems.length && (/^(?:none|no open decisions?)\.?$/iu.test(decisionSummary) || !/\bopen\b/iu.test(decisionSummary))) {
    gaps.push("open decisions must be labeled open; do not report a None/no-open-decisions outcome");
  }
  if (decisionItems.length && !/\bopen\s+decisions?\b/iu.test(planText)) {
    gaps.push("human-readable plan must label unresolved design decisions as open");
  }
  if (/^(?:none|null|n\/a)$/iu.test(outcome) && decisionItems.length) {
    gaps.push("outcome cannot be None while decisions remain open");
  }

  const root = path.resolve(workspaceRoot);
  for (const reference of sourcePaths) {
    const result = await resolveTargets(root, reference);
    if (result.error) gaps.push(result.error);
  }

  for (const [index, entry] of commands.entries()) {
    if (!isPlainObject(entry) || typeof entry.command !== "string" || !entry.command.trim() || typeof entry.workingDirectory !== "string" || !entry.workingDirectory.trim()) {
      gaps.push(`validationCommands[${index}] must include command and workingDirectory`);
      continue;
    }
    const workingDirectory = path.resolve(root, entry.workingDirectory);
    if (!pathWithin(root, workingDirectory)) {
      gaps.push(`validation command working directory escapes the workspace: ${entry.workingDirectory}`);
      continue;
    }
    let verified = await verifyNodeTestCommand(entry.command, workingDirectory, root, gaps);
    if (!verified) verified = await verifyPackageScript(entry.command, workingDirectory, gaps);
    if (!verified) gaps.push(`unsupported or unverified validation command: ${entry.command}`);
  }

  return { ok: gaps.length === 0, marker, gaps };
}
