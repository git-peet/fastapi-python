import { StringEnum, Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerKnowledgeCaptureTools } from "./knowledge-capture-tools.mjs";
import { registerPlanPreflight, registerPlanShellGuard } from "./context-policy-gate.mjs";
import { registerKnowledgeWriteGate } from "./knowledge-write-gate.mjs";

export default function (pi: ExtensionAPI) {
  registerKnowledgeWriteGate(pi);
  registerKnowledgeCaptureTools(pi, Type, StringEnum);
  registerPlanShellGuard(pi);
  registerPlanPreflight(pi, Type);
}
