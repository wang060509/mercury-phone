"use strict";

const assert = require("node:assert/strict");
const adapter = require("../core/preset-compatibility.js");

const profile = {
  compatibility: {
    format: "external-chat-preset",
    blocks: [
      { id: "init", enabled: true, injection: { order: 0 }, content: "{{setvar::tone::克制}}{{setglobalvar::voice::轻声}}{{setvar::combined::{{getvar::tone}} / {{getglobalvar::voice}}}}" },
      { id: "disabled", enabled: false, injection: { order: 1 }, content: "{{setvar::tone::失控}}" },
      { id: "late", enabled: true, injection: { order: 2 }, content: "{{setvar::empty::}}{{setvar::line::第一行{{newline}}第二行}}" },
    ],
  },
};
const before = JSON.stringify(profile);
const result = adapter.resolveCompatibilityText(profile, "{{getvar::combined}}\n{{getvar::empty}}\n{{getvar::line}}\n{{getvar::missing}}\n{{incvar::score}}");

assert.equal(result.compatible, true, "external preset compatibility mode is explicit");
assert.equal(result.definedVariableCount, 5, "enabled assignment macros create a bounded variable context");
assert.equal(result.text.includes("克制 / 轻声"), true, "local and global reads resolve through nested values");
assert.equal(result.text.includes("失控"), false, "disabled initializer blocks never affect runtime text");
assert.equal(result.text.includes("第一行\n第二行"), true, "the safe newline formatting macro is normalized");
assert.equal(result.text.includes("{{getvar::missing}}"), true, "undefined variables remain visible for truthful diagnostics");
assert.equal(result.text.includes("{{incvar::score}}"), true, "stateful or unsupported macros are never executed");
assert.equal(result.resolvedVariableNames.includes("local:combined"), true, "resolved variables are reported without exposing values");
assert.equal(result.unresolvedVariableNames.includes("local:missing"), true, "unresolved variables are reported by scoped name");
assert.equal(JSON.stringify(profile), before, "compatibility resolution does not mutate the imported profile");

const cyclic = {
  compatibility: {
    format: "external-chat-preset",
    blocks: [{ id: "cycle", enabled: true, injection: { order: 0 }, content: "{{setvar::a::{{getvar::b}}}}{{setvar::b::{{getvar::a}}}}" }],
  },
};
const cyclicResult = adapter.resolveCompatibilityText(cyclic, "{{getvar::a}}");
assert.equal(cyclicResult.text.includes("{{getvar::"), true, "variable cycles stay unresolved instead of looping");
assert.equal(cyclicResult.warnings.some((item) => item.code === "compat_variable_cycle"), true, "variable cycles emit a stable warning");

const ordinary = adapter.resolveCompatibilityText({ id: "ordinary" }, "Keep {{getvar::literal}} unchanged.");
assert.equal(ordinary.compatible, false, "ordinary Mercury profiles do not enter external compatibility mode");
assert.equal(ordinary.text, "Keep {{getvar::literal}} unchanged.", "ordinary profile text is untouched");

const contextual = adapter.resolveCompatibilityText(profile, "{{char}} responds to {{user}}.", { templateValues: { char: "Aster", user: "Lin" } });
assert.equal(contextual.text, "Aster responds to Lin.", "only the explicit user and character template allowlist reads Chat context");
assert.equal(contextual.resolvedTemplateCount, 2, "context template substitutions are reported separately from imported variables");

const inlineAssignment = adapter.resolveCompatibilityText(profile, "{{setvar::tone::克制}}{{getvar::tone}}");
assert.equal(inlineAssignment.text, "克制", "supported assignment macros return no prompt text while their selected value remains readable");

console.log("preset-compatibility: assertions passed");
