"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/contracts.js");
require("../core/chat-contracts.js");
require("../core/resource-contracts.js");
require("../core/preset-content.js");
require("../core/generation-profile-contracts.js");
require("../core/preset-compatibility.js");
const { assemblePresetInstructions, inspectPresetInstructions } = require("../core/preset-assemble.js");
const GenerationProfileStore = require("../system/generation-profile-store.js");

const source = {
  name: "Compatibility fixture",
  prompts: [
    { identifier: "initializer", name: "Initializer", role: "assistant", content: "{{setvar::voice::Measured prose.}}", injection_position: "chat", injection_depth: 4 },
    { identifier: "main", name: "Main", role: "system", content: "Style: {{getvar::voice}} {{char}} replies to {{user}}. {{getvar::missing}}" },
  ],
  prompt_order: [{ character_id: 100000, order: [{ identifier: "initializer", enabled: true }, { identifier: "main", enabled: true }] }],
};

const report = global.MercuryResourceContracts.preflightMercuryResourceImport(JSON.stringify(source));
assert.equal(report.ok, true, "external preset fixture passes import preflight");
assert.equal(report.resource.data.compatibility.runtime.activeCount, 1, "only the equivalent system prompt enters the runtime lane");
assert.equal(report.resource.data.compatibility.runtime.preservedCount, 1, "the initializer block remains outside direct prompt injection");

const values = new Map();
const storage = {
  get(key, fallback) { return values.has(key) ? values.get(key) : fallback; },
  set(key, value) { values.set(key, value); return value; },
};
const store = new GenerationProfileStore({ storage });
const profile = store.add(report.resource.data);
const templateValues = { char: "Fixture Role", user: "Fixture User" };
const instructions = assemblePresetInstructions(profile, { templateValues });
const diagnostic = inspectPresetInstructions(profile, { templateValues });

assert.equal(instructions.includes("Measured prose."), true, "safe initializer value survives import, Store normalization, and assembly");
assert.equal(instructions.includes("{{setvar::voice"), false, "initializer macros never leak into the outgoing prompt");
assert.equal(instructions.includes("{{getvar::voice}}"), false, "defined reads are resolved before runtime compilation");
assert.equal(instructions.includes("{{getvar::missing}}"), true, "unknown reads remain inspectable instead of being guessed");
assert.equal(instructions.includes("Fixture Role replies to Fixture User"), true, "the explicit Chat identity allowlist resolves standard context macros");
assert.equal(diagnostic.resolvedVariableCount, 1, "runtime diagnostic reports the adapted variable");
assert.equal(diagnostic.resolvedTemplateCount, 2, "runtime diagnostic reports standard context substitutions separately");
assert.equal(diagnostic.unresolvedMacroCount, 1, "runtime diagnostic reports only the remaining template item");

const runtime = global.MercuryChatContracts.compileRuntime({
  runtimeCore: { id: "core-fixture", rules: [] },
  runtimeModules: [],
  userPreset: { id: profile.id, instructions },
  presentation: {},
  experienceSettings: {},
  runtimeProfile: { displayName: "Fixture Role" },
  runtimeContext: null,
  warnings: [],
});
assert.equal(runtime.compiledSystemText.includes("Measured prose."), true, "adapted preset text reaches compiledSystemText through the existing userPreset lane");
assert.deepEqual(Object.keys(runtime).sort(), ["appliedModuleIds", "compiledSystemText", "experienceSettings", "precedence", "presetId", "resourceTrace", "warnings"], "compileRuntime output protocol remains unchanged");
assert.deepEqual(runtime.appliedModuleIds, [], "compatibility variables do not create a parallel runtime module lane");

const wrappedReport = global.MercuryResourceContracts.preflightMercuryResourceImport(JSON.stringify({
  exporter: "fixture",
  preset: {
    name: "Wrapped compatibility fixture",
    promptBlocks: [
      { id: "vars", role: "assistant", content: "{{setvar::tone::Low-key and precise.}}", position: "chat", depth: 2 },
      { id: "voice", role: "system", content: "Voice: {{getvar::tone}}" },
    ],
  },
}));
assert.equal(wrappedReport.ok, true, "generic wrapped preset passes the same preflight pipeline");
assert.equal(wrappedReport.format, "external-prompt-preset", "the adapter is selected by structure rather than one source filename or schema");
const wrappedProfile = store.importProfile(wrappedReport.resource.data);
const wrappedInstructions = assemblePresetInstructions(wrappedProfile);
assert.equal(wrappedInstructions.includes("Low-key and precise."), true, "safe variable adaptation also runs for normalized generic prompt collections");
assert.equal(wrappedInstructions.includes("{{getvar::tone}}"), false, "generic external formats do not create a second compatibility path");

const parameterReport = global.MercuryResourceContracts.preflightMercuryResourceImport(JSON.stringify({ temperature: 0.6, top_p: 0.85 }), { filename: "parameter-fixture.json" });
const parameterProfile = store.importProfile(parameterReport.resource.data);
const parameterDiagnostic = inspectPresetInstructions(parameterProfile);
assert.equal(parameterDiagnostic.status, "preserved", "parameter-only presets are retained without claiming runtime effect");
assert.equal(parameterDiagnostic.preservedSettingsCount, 2, "deferred generation parameters remain visible to runtime diagnostics");

console.log("external-preset-compat-runtime: assertions passed");
