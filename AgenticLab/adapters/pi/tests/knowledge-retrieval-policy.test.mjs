import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readKnowledge } from "../knowledge-capture-core.mjs";

const WORKSPACE_SCOPE = "project:context-policy-test";

async function fixture(t, records = []) {
  const root = await mkdtemp(path.join(os.tmpdir(), "knowledge-retrieval-policy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "AgenticLab", "config"), { recursive: true });
  await mkdir(path.join(root, "AgenticLab", "knowledge", "records"), { recursive: true });
  await writeFile(path.join(root, "AgenticLab", "config", "knowledge-capture-policy.json"), JSON.stringify({
    schemaVersion: 1,
    project: "context-policy-test",
    workspaceRoot: root,
    pendingStagingEnabled: false,
    metricsEnabled: false,
    scope: WORKSPACE_SCOPE,
  }));
  for (const record of records) await writeRecord(root, record);
  return root;
}

async function writeRecord(root, {
  id,
  scope = `${WORKSPACE_SCOPE}/backend`,
  status = "active",
  claim = "policy-test-claim",
  supersedes,
}) {
  const supersedesLine = supersedes ? `supersedes: ${JSON.stringify(supersedes)}\n` : "";
  const content = [
    "---",
    `id: ${JSON.stringify(id)}`,
    `title: ${JSON.stringify(`Record ${id}`)}`,
    'category: "fact"',
    `scope: ${JSON.stringify(scope)}`,
    `status: ${JSON.stringify(status)}`,
    'recorded: "2026-11-11"',
    'verified: "2026-11-11"',
    supersedesLine.trimEnd(),
    "---",
    "",
    `# Record ${id}`,
    "",
    claim,
    "",
  ].filter((line) => line !== "").join("\n");
  await writeFile(path.join(root, "AgenticLab", "knowledge", "records", `${id}.md`), content);
}

test("retrieval selects only requested in-project scope and active lifecycle status", async (t) => {
  const root = await fixture(t, [
    { id: "backend-match", scope: `${WORKSPACE_SCOPE}/backend`, claim: "backend-only-token" },
    { id: "frontend-match", scope: `${WORKSPACE_SCOPE}/frontend`, claim: "backend-only-token" },
    { id: "stale-match", scope: `${WORKSPACE_SCOPE}/backend`, status: "stale", claim: "backend-only-token" },
    { id: "other-project", scope: "project:another-project/backend", claim: "backend-only-token" },
  ]);

  const result = await readKnowledge(root, {
    query: "backend-only-token",
    scope: `${WORKSPACE_SCOPE}/backend`,
  }, { expectedRoot: root });
  assert.equal(result.status, "ok");
  assert.deepEqual(result.matches.map((record) => record.id), ["backend-match"]);
  assert.ok(result.filtered.some((record) => record.id === "frontend-match"));
  assert.ok(result.filtered.some((record) => record.id === "stale-match"));
  assert.ok(result.filtered.some((record) => record.id === "other-project"));
});

test("filtered-only retrieval is distinct from a complete no-match", async (t) => {
  const root = await fixture(t, [
    { id: "frontend-only", scope: `${WORKSPACE_SCOPE}/frontend`, claim: "only-frontend-token" },
  ]);
  const filtered = await readKnowledge(root, {
    query: "only-frontend-token",
    scope: `${WORKSPACE_SCOPE}/backend`,
  }, { expectedRoot: root });
  assert.equal(filtered.status, "filtered");
  assert.equal(filtered.count, 0);

  const emptyRoot = await fixture(t, []);
  const noMatch = await readKnowledge(emptyRoot, {
    query: "absent-token",
    scope: `${WORKSPACE_SCOPE}/backend`,
  }, { expectedRoot: emptyRoot });
  assert.equal(noMatch.status, "no_match");
  assert.equal(noMatch.complete, true);
});

test("stale or malformed active-corpus metadata fails closed as incomplete", async (t) => {
  const root = await fixture(t, []);
  await writeFile(path.join(root, "AgenticLab", "knowledge", "records", "broken.md"), "not a valid record header\n");
  const result = await readKnowledge(root, { query: "anything" }, { expectedRoot: root });
  assert.equal(result.status, "incomplete");
  assert.equal(result.complete, false);
  assert.equal(result.count, 0);
});

test("an ID request for a superseded record resolves to its effective replacement", async (t) => {
  const root = await fixture(t, [
    { id: "old-rule", claim: "old claim" },
    { id: "new-rule", claim: "replacement claim", supersedes: "old-rule" },
  ]);
  const result = await readKnowledge(root, { id: "old-rule" }, { expectedRoot: root });
  assert.equal(result.status, "ok");
  assert.equal(result.matches[0].id, "new-rule");
  assert.equal(result.resolution.effectiveStatus, "superseded");
  assert.equal(result.resolution.replacementId, "new-rule");
});
