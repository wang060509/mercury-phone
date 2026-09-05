"use strict";

const assert = require("node:assert/strict");
global.window = global;
const contracts = require("../core/resource-contracts.js");

let n = 0;
const eq = (actual, expected, message) => { assert.equal(actual, expected, message); n += 1; };
const ok = (value, message) => { assert.ok(value, message); n += 1; };

const role = {
  kind: "mercury.roleCard",
  schemaVersion: 1,
  data: {
    id: "role-ao",
    displayName: "Ao",
    identity: "A quiet keeper",
    summary: "Keeps the threshold.",
    profile: { stableTraits: ["calm", "stern"], values: ["honesty"] },
  },
};
const roleReport = contracts.preflightMercuryResourceImport(JSON.stringify(role));
eq(roleReport.ok, true, "Mercury role card passes preflight");
eq(roleReport.format, "mercury-v1", "Mercury v1 format detected");
eq(roleReport.resource.kind, contracts.ROLE_KIND, "role card kind is normalized");
eq(roleReport.resource.displayName, "Ao", "role displayName normalized");

const contact = contracts.contactFromRoleCard(roleReport.resource, { id: "contact-ao", avatar: "fallback.png" });
eq(contact.id, "contact-ao", "role card maps to a contact id");
eq(contact.persona.displayName, "Ao", "contact persona keeps displayName");
eq(contact.sourceKind, contracts.ROLE_KIND, "contact sourceKind is Mercury role card");

const legacy = contracts.preflightMercuryResourceImport(JSON.stringify({ kind: "runtime-profile", schemaVersion: 1, displayName: "River", identity: "Guide", stableTraits: ["careful"] }));
eq(legacy.ok, true, "legacy runtime profile migrates");
eq(legacy.resource.kind, contracts.ROLE_KIND, "legacy profile becomes a Mercury role card");
ok(legacy.migrations.some((item) => item.code === "role_card_migrated"), "legacy migration is reported");

const generic = contracts.preflightMercuryResourceImport(JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", name: "Card One", description: "A long persona body.", personality: "Calm.", scenario: "A quiet room.", mes_example: "They greet you quietly." }));
eq(generic.ok, true, "generic character-card shape migrates");
eq(generic.resource.profile.background, "A long persona body.", "description maps to background");
ok(generic.resource.profile.voiceStyle.includes("greet"), "example dialogue maps to voice style");
eq(generic.resource.profile.scenePresentation, "A quiet room.", "scenario remains a scene field instead of a world binding");

const yamlCharacter = contracts.preflightMercuryResourceImport(JSON.stringify({
  spec: "chara_card_v2",
  spec_version: "2.0",
  name: "Structured Card",
  description: "<card>\n```yaml\nCharacter:\n  identity:\n    - Crown regent\n    - A formal public figure\n  personality:\n    default:\n      traits:\n        - Reserved\n        - Deliberate\n  language_style:\n    overall: |\n      Uses concise, formal language.\n  writing_rule: |\n    Keep rank and distance consistent in early conversations.\n```\n</card>",
}));
eq(yamlCharacter.resource.identity, "Crown regent；A formal public figure", "embedded YAML identity becomes the runtime identity");
eq(yamlCharacter.resource.profile.stableTraits.length, 2, "embedded YAML default traits become stable traits");
ok(yamlCharacter.resource.profile.voiceStyle.includes("concise, formal"), "embedded YAML language guidance becomes the voice style");
ok(yamlCharacter.resource.profile.voiceStyle.includes("rank and distance"), "embedded YAML writing guidance is retained for runtime output");

const genericV3 = contracts.preflightMercuryResourceImport(JSON.stringify({ spec: "chara_card_v3", spec_version: "3.0", name: "", description: "", data: { name: "Nested Card", description: "The nested description is the character background.", personality: "Deliberate and observant.", scenario: "A quiet library.", first_mes: "Welcome back.", mes_example: "They speak softly." } }));
eq(genericV3.ok, true, "v3 character card passes preflight");
eq(genericV3.resource.displayName, "Nested Card", "nested v3 name overrides an empty root placeholder");
eq(genericV3.resource.profile.background, "The nested description is the character background.", "nested v3 description becomes the background");
eq(genericV3.resource.profile.scenePresentation, "A quiet library.", "nested v3 scenario becomes scene presentation");
eq(genericV3.resource.openingMessage, "Welcome back.", "nested v3 opening message is preserved");

const legacyAliases = contracts.preflightMercuryResourceImport(JSON.stringify({ char_name: "Alias Card", char_persona: "A concise source profile.", char_personality: "careful, direct", world_scenario: "A bright room.", char_greeting: "Hello.", example_dialogue: "A short example." }));
eq(legacyAliases.ok, true, "legacy character-card aliases are recognized");
eq(legacyAliases.resource.displayName, "Alias Card", "legacy name alias maps to the Mercury display name");
eq(legacyAliases.resource.openingMessage, "Hello.", "legacy greeting alias maps to the opening message");

const versionedGeneric = contracts.preflightMercuryResourceImport(JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", name: "Lian1.3", description: "Long character material.".repeat(180) }));
eq(versionedGeneric.resource.displayName, "Lian", "a decimal version suffix is not kept as the contact name");
eq(versionedGeneric.resource.summary, "", "a description-only card does not duplicate its long body as the summary");
eq(versionedGeneric.resource.profile.background.length, "Long character material.".repeat(180).length, "a description-only card preserves its body as background");
ok(versionedGeneric.warnings.some((item) => item.code === "role_description_preserved_as_background"), "long unstructured descriptions are reported for review");

const serializedRoleField = contracts.preflightMercuryResourceImport(JSON.stringify({ spec: "chara_card_v3", name: "Safe Card", description: JSON.stringify({ unexpected: "raw export" }), data: { name: "Safe Card", description: JSON.stringify({ unexpected: "raw export" }) } }));
eq(serializedRoleField.resource.profile.background, undefined, "serialized JSON is not rendered as a role background");

const pngChunk = (type, data) => {
  const body = Buffer.from(data, "latin1");
  const chunk = Buffer.alloc(body.length + 12);
  chunk.writeUInt32BE(body.length, 0);
  chunk.write(type, 4, 4, "latin1");
  body.copy(chunk, 8);
  return chunk;
};
const pngRoleSource = { spec: "chara_card_v3", spec_version: "3.0", data: { name: "Image Card", description: "A role card stored in image metadata.", personality: "Measured." } };
const pngRole = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk("tEXt", `chara\0${Buffer.from(JSON.stringify(pngRoleSource), "utf8").toString("base64")}`),
  pngChunk("IEND", ""),
]);
const pngRoleReport = contracts.preflightMercuryResourceBinary(pngRole, { filename: "image-card.png" });
eq(pngRoleReport.ok, true, "PNG role card metadata passes preflight");
eq(pngRoleReport.carrier, "png-character-card", "PNG carrier is reported separately from the role-card schema");
eq(pngRoleReport.resource.displayName, "Image Card", "PNG metadata maps through the normal role-card contract");
eq(pngRoleReport.sourceText.includes("Image Card"), true, "PNG preflight returns extracted JSON for source persistence");
const nonCardPng = contracts.preflightMercuryResourceBinary(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("tEXt", "note\0not a role card"), pngChunk("IEND", "")]));
eq(nonCardPng.ok, false, "an ordinary PNG is not accepted as a role card");
eq(nonCardPng.errors[0].code, "png_character_metadata_missing", "ordinary PNG failure is explicit");

const world = contracts.preflightMercuryResourceImport(JSON.stringify({ kind: "mercury.worldBook", schemaVersion: 1, data: { name: "Harbor", entries: [{ title: "Pier", content: "The ferry leaves at dusk.", keys: ["ferry"] }] } }));
eq(world.ok, true, "Mercury world book passes");
eq(world.resource.entries[0].keys[0], "ferry", "world entry keys normalize");
const legacyUniversalWorld = contracts.preflightMercuryResourceImport(JSON.stringify({ entries: [{ comment: "Universal rule", content: "This legacy rule is intended for every eligible prompt.", key: [], keysecondary: [], selective: true, useProbability: true, probability: 100 }] }), { filename: "legacy-universal.json" });
eq(legacyUniversalWorld.resource.entries[0].activationMode, "unkeyed-universal", "legacy empty-key activation is translated explicitly");
eq(legacyUniversalWorld.resource.entries[0].alwaysActive, true, "a 100-percent legacy universal entry becomes an active candidate");
const scopedWorld = contracts.preflightMercuryResourceImport(JSON.stringify({ kind: "mercury.worldBook", schemaVersion: 1, data: { name: "Scoped Harbor", worldVariantId: "harbor", timelineId: "timeline-1", entries: [{ title: "Restricted route", content: "Only the linked role may use this route.", visibility: "restricted", runtimeProfileId: "profile-river", worldVariantId: "harbor", timelineId: "timeline-1" }] } }));
eq(scopedWorld.resource.worldVariantId, "harbor", "world import keeps the world-variant scope");
eq(scopedWorld.resource.timelineId, "timeline-1", "world import keeps the timeline scope");
eq(scopedWorld.resource.entries[0].visibility, "restricted", "world import keeps entry visibility");
eq(scopedWorld.resource.entries[0].runtimeProfileId, "profile-river", "world import keeps the character authorization target");

const mappedWorld = contracts.preflightMercuryResourceImport(JSON.stringify({ entries: { alpha: { uid: "alpha", key: ["harbor"], keysecondary: ["dock"], comment: "Pier", content: "The ferry leaves at dusk.", constant: true, disable: false, order: 4 } } }), { filename: "harbor-notes.json" });
eq(mappedWorld.ok, true, "object-keyed world entries pass when the filename supplies the local name");
eq(mappedWorld.resource.name, "harbor-notes", "filename becomes the explicit local world name");
eq(mappedWorld.resource.entries[0].alwaysActive, true, "constant world entry becomes always active");
eq(mappedWorld.resource.entries[0].keys[1], "dock", "secondary world key is retained");
ok(mappedWorld.migrations.some((item) => item.code === "world_entries_object_migrated"), "object-keyed world entry migration is reported");
const exportedWorld = contracts.preflightMercuryResourceImport(contracts.exportMercuryResource(mappedWorld.resource));
eq(exportedWorld.ok, true, "exported world book imports again");
eq(exportedWorld.resource.entries.length, mappedWorld.resource.entries.length, "world export loop keeps entries");
eq(exportedWorld.resource.entries[0].keys[0], "harbor", "world export loop keeps entry keys");

const partialWorld = contracts.preflightMercuryResourceImport(JSON.stringify({ entries: [{ comment: "Complete", content: "This entry is usable." }, { comment: "Empty source record" }] }), { filename: "partial-world.json" });
eq(partialWorld.ok, true, "a world book with some incomplete rows remains importable");
eq(partialWorld.resource.entries.length, 1, "incomplete world rows are not promoted to runnable entries");
ok(partialWorld.warnings.some((item) => item.code === "world_entry_skipped_empty_content"), "skipped world rows are reported for review");

const cardWithWorld = contracts.preflightMercuryResourceImport(JSON.stringify({ spec: "chara_card_v2", spec_version: "2.0", name: "Card Two", description: "A person with a linked setting.", data: { name: "Card Two", description: "A person with a linked setting.", character_book: { name: "Card Two notes", entries: [{ id: "entry-1", keys: ["garden"], comment: "Garden", content: "The gate is green.", constant: true }, { id: "entry-empty", comment: "Empty" }] } } }));
eq(cardWithWorld.ok, true, "character card with an embedded world passes");
eq(cardWithWorld.relatedResources.length, 1, "embedded world is extracted as a separate resource");
eq(cardWithWorld.relatedResources[0].entries.length, 1, "empty embedded world entries are skipped");
eq(cardWithWorld.relatedResources[0].entries[0].alwaysActive, true, "embedded world preserves its active state");
ok(cardWithWorld.warnings.some((item) => item.code === "world_entry_skipped_empty_content"), "skipped embedded entry is reported");

const preset = contracts.preflightMercuryResourceImport(JSON.stringify({ kind: "mercury.preset", schemaVersion: 1, data: { name: "Quiet", modules: { order: ["group.int.slow"], enabled: { "group.int.slow": true } } } }));
eq(preset.ok, true, "Mercury preset passes");
eq(preset.resource.kind, "mercury.generation-profile", "legacy Mercury preset converts to the canonical Generation Profile kind");
ok(preset.migrations.some((item) => item.from === "mercury-preset-v1"), "legacy Mercury preset conversion is reported");
eq(preset.resource.data.modules.enabled["group.int.slow"], true, "preset enabled map normalizes");

const canonicalProfile = contracts.preflightMercuryResourceImport(JSON.stringify({ kind: "mercury.generation-profile", schemaVersion: 1, data: { name: "Canonical", description: "Portable Generation Profile", cover: { kind: "asset", value: "archive:glass-water-v1" }, modules: { order: ["group.int.balanced"], enabled: { "group.int.balanced": true } }, instructionBlocks: [{ id: "block-portable", content: "Portable instruction.", enabled: true, runtimeEligible: true }] } }));
eq(canonicalProfile.ok, true, "canonical Generation Profile imports directly");
eq(canonicalProfile.migrations.length, 0, "canonical Generation Profile needs no format migration");
eq(canonicalProfile.resource.data.instructionBlocks[0].content, "Portable instruction.", "canonical Instruction Blocks survive preflight");
eq(canonicalProfile.resource.data.cover.value, "archive:glass-water-v1", "canonical cover metadata survives preflight");

const compatibleSource = {
  name: "Portable blocks",
  prompts: [
    { name: "Primary", identifier: "primary", role: "system", content: "Keep the reply concise." },
    { name: "Relative", identifier: "relative", role: "system", content: "Keep the pacing steady.", injection_position: 0, injection_depth: 4 },
    { name: "Deferred", identifier: "deferred", role: "assistant", content: "This requires a different role.", injection_position: "chat", injection_depth: 4, injection_order: 12 },
    { name: "Future", identifier: "future", role: "system", content: "Preserve this block.", injection_position: "after_context" },
  ],
  prompt_order: [{ character_id: 100000, order: [{ identifier: "primary", enabled: true }, { identifier: "relative", enabled: true }, { identifier: "deferred", enabled: true }, { identifier: "future", enabled: false }] }],
  future_setting: { keep: ["this", "unchanged"] },
};
const compatible = contracts.preflightMercuryResourceImport(JSON.stringify(compatibleSource));
eq(compatible.ok, true, "compatible prompt preset passes preflight");
eq(compatible.format, "external-chat-preset", "compatible prompt preset format is recognized");
eq(compatible.resource.data.modules.enabled["compat.block.primary"], true, "equivalent system block is active in Mercury runtime");
eq(compatible.resource.data.modules.enabled["compat.block.relative"], true, "relative system blocks remain eligible even when the source stores an ignored depth value");
eq(compatible.resource.data.modules.enabled["compat.block.deferred"], false, "non-equivalent block is preserved without runtime injection");
const deferredBlock = compatible.resource.data.compatibility.blocks.find((block) => block.id === "deferred");
eq(deferredBlock.injection.depth, 4, "injection depth is preserved");
eq(deferredBlock.role, "assistant", "source role is preserved");
eq(compatible.resource.data.compatibility.rawSource.future_setting.keep[1], "unchanged", "unknown source fields are preserved");
ok(compatible.warnings.some((item) => item.code === "preset_blocks_preserved_inactive"), "inactive compatible blocks are reported");
assert.deepEqual(JSON.parse(contracts.exportPresetCompatibility(compatible.resource.data)), compatibleSource, "compatible preset export round-trips the full source object"); n += 1;

const unorderedPresetSource = {
  name: "Unordered blocks",
  prompts: [
    { id: "system", role: "system", text: "Keep the prose restrained." },
    { id: "assistant", role: "assistant", text: "A preserved prefill." },
  ],
  future: { untouched: true },
};
const unorderedPreset = contracts.preflightMercuryResourceImport(JSON.stringify(unorderedPresetSource));
eq(unorderedPreset.ok, true, "prompt arrays do not require a prompt_order sidecar");
eq(unorderedPreset.format, "external-prompt-preset", "unordered prompt arrays receive a generic external format");
eq(unorderedPreset.resource.data.compatibility.runtime.activeCount, 1, "equivalent system content remains runtime eligible without an order sidecar");
eq(unorderedPreset.resource.data.compatibility.runtime.preservedCount, 1, "non-system content is preserved without being injected");
eq(unorderedPreset.resource.data.compatibility.rawSource.future.untouched, true, "generic external imports preserve unknown root fields");

const nestedPresetSource = {
  exportTool: "fixture",
  preset: {
    name: "Nested profile",
    promptBlocks: [{ key: "voice", content: "Use a quiet voice.", role: "system" }],
  },
};
const nestedPreset = contracts.preflightMercuryResourceImport(JSON.stringify(nestedPresetSource));
eq(nestedPreset.ok, true, "a common nested preset wrapper is recognized");
eq(nestedPreset.resource.data.name, "Nested profile", "the nested preset name is retained");
eq(nestedPreset.resource.data.compatibility.sourcePath, "$.preset.promptBlocks", "the detected nested source path is recorded");
eq(nestedPreset.resource.data.compatibility.rawSource.exportTool, "fixture", "the complete wrapper survives compatibility storage");

const singleInstruction = contracts.preflightMercuryResourceImport(JSON.stringify({ instructions: "Prefer concrete sensory details.", temperature: 0.72 }), { filename: "sensory-style.json" });
eq(singleInstruction.ok, true, "a single instruction preset is recognized");
eq(singleInstruction.format, "external-instruction-preset", "single instruction resources have a stable format");
eq(singleInstruction.resource.data.name, "sensory-style", "an unnamed external preset uses its filename");
eq(singleInstruction.resource.data.compatibility.runtime.activeCount, 1, "single system instructions enter the existing preset lane");
eq(singleInstruction.resource.data.compatibility.runtime.preservedSettingsCount, 1, "generation settings are preserved separately from prompt text");

const messagePreset = contracts.preflightMercuryResourceImport(JSON.stringify({
  name: "Message preset",
  messages: [
    { role: "system", content: "Write with clean imagery." },
    { role: "user", content: "This message role cannot enter Mercury's system lane." },
  ],
}));
eq(messagePreset.ok, true, "message-array presets are recognized");
eq(messagePreset.format, "external-message-preset", "message-array presets retain a distinct source format");
eq(messagePreset.resource.data.compatibility.runtime.activeCount, 1, "system messages are runtime eligible");
eq(messagePreset.resource.data.compatibility.runtime.preservedCount, 1, "user messages are preserved without role flattening");

const mappedPrompts = contracts.preflightMercuryResourceImport(JSON.stringify({ prompts: { voice: "Use measured dialogue.", pacing: { role: "system", content: "Do not rush the scene." } } }), { filename: "mapped-prompts.json" });
eq(mappedPrompts.ok, true, "object-mapped prompt collections are recognized");
eq(mappedPrompts.resource.data.compatibility.blocks.length, 2, "object-mapped prompt entries become separate compatibility blocks");

const arrayPreset = contracts.preflightMercuryResourceImport(JSON.stringify([
  { role: "system", content: "Use lucid prose." },
  { role: "assistant", content: "Preserve this role." },
]), { filename: "array-profile.json" });
eq(arrayPreset.ok, true, "top-level prompt arrays are recognized");
eq(arrayPreset.format, "external-prompt-list", "top-level arrays have a stable external format");
eq(arrayPreset.resource.data.name, "array-profile", "top-level arrays use the import filename for identity");

const settingsOnly = contracts.preflightMercuryResourceImport(JSON.stringify({ temperature: 0.8, top_p: 0.9, seed: 42 }), { filename: "parameter-only.json" });
eq(settingsOnly.ok, true, "parameter-only generation presets are retained instead of rejected");
eq(settingsOnly.resource.data.compatibility.runtime.activeCount, 0, "deferred generation parameters do not pretend to affect runtime");
eq(settingsOnly.resource.data.compatibility.runtime.preservedSettingsCount, 3, "all recognized generation parameters are counted as preserved");

const partlyMalformedPreset = contracts.preflightMercuryResourceImport(JSON.stringify({ prompts: [null, { role: "system", content: "A valid block." }, { unknown: true }] }));
eq(partlyMalformedPreset.ok, true, "valid prompt content survives alongside malformed items");
ok(partlyMalformedPreset.warnings.some((item) => item.code === "preset_prompt_items_skipped"), "skipped prompt items are reported without discarding the valid block");

const unusablePreset = contracts.preflightMercuryResourceImport(JSON.stringify({ prompts: [null, { unknown: true }] }));
eq(unusablePreset.ok, false, "a prompt-shaped file with no usable content fails safely");
ok(unusablePreset.errors.some((item) => item.code === "preset_no_recognizable_content"), "unusable prompt collections have a stable error code");

const arbitraryJson = contracts.preflightMercuryResourceImport(JSON.stringify({ shopping: ["tea"], checked: true }));
eq(arbitraryJson.ok, false, "arbitrary valid JSON is not mislabeled as a Generation Profile");
eq(arbitraryJson.errors[0].code, "unsupported_resource", "valid but unrelated JSON receives an unsupported-resource error");

const cardWithSystemPrompt = contracts.preflightMercuryResourceImport(JSON.stringify({ spec: "chara_card_v3", data: { name: "Card with prompt", description: "A complete character.", system_prompt: "Character-specific helper text." } }));
eq(cardWithSystemPrompt.resourceKind, "roleCard", "character-card identity wins over nested prompt-like fields");

const bad = contracts.preflightMercuryResourceImport("not json");
eq(bad.ok, false, "invalid JSON fails");
eq(bad.errors[0].code, "invalid_json", "invalid JSON has stable error code");

const exported = contracts.exportMercuryResource(roleReport.resource);
const roundTrip = contracts.preflightMercuryResourceImport(exported);
eq(roundTrip.ok, true, "exported resource imports again");
eq(roundTrip.resource.displayName, roleReport.resource.displayName, "export loop keeps displayName");

console.log(`resource-contracts: ${n} assertions passed`);
