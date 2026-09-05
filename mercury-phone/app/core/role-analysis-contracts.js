(function exposeMercuryRoleAnalysisContracts(global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const MAX_SOURCE_CHARACTERS = 24000;
  const LIST_FIELDS = Object.freeze(["stableTraits", "motivations", "fears", "values", "boundaries", "cognitionLimits", "changeThresholds", "alternateGreetings", "exampleDialogues", "tags"]);
  const TEXT_FIELDS = Object.freeze(["identity", "summary", "background", "careStyle", "conflictStyle", "defenseStyle", "voiceStyle", "relationshipSummary", "openingMessage", "scenePresentation", "creatorNotes"]);
  const PROFILE_FIELDS = Object.freeze([...TEXT_FIELDS, ...LIST_FIELDS]);
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const truncate = (value, limit) => text(value).slice(0, limit);
  const list = (value, limit = 16) => (Array.isArray(value) ? value : text(value) ? [value] : []).map((item) => truncate(item, 420)).filter(Boolean).slice(0, limit);

  function structuredLines(value) {
    const block = text(value).match(/```(?:ya?ml)?\s*([\s\S]*?)```/i);
    const source = block ? block[1] : text(value);
    const stack = [];
    const rows = [];
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const match = line.match(/^(\s*)([A-Za-z][A-Za-z0-9 _-]{0,60})\s*:\s*(.*?)\s*$/);
      if (!match) continue;
      const indent = match[1].replace(/\t/g, "  ").length;
      const key = match[2].trim().toLowerCase().replace(/[ -]+/g, "_");
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const path = [...stack.map((item) => item.key), key];
      let valueText = match[3].trim();
      if (/^[>|][+-]?$/.test(valueText)) {
        const fragments = [];
        let cursor = index + 1;
        while (cursor < lines.length) {
          const next = lines[cursor];
          if (!next.trim()) { fragments.push(""); cursor += 1; continue; }
          const nextIndent = (next.match(/^\s*/) || [""])[0].replace(/\t/g, "  ").length;
          if (nextIndent <= indent) break;
          fragments.push(next.trim());
          cursor += 1;
        }
        valueText = fragments.join("\n").trim();
        index = cursor - 1;
      }
      if (!valueText) {
        const fragments = [];
        let cursor = index + 1;
        while (cursor < lines.length) {
          const next = lines[cursor];
          if (!next.trim()) { cursor += 1; continue; }
          const nextIndent = (next.match(/^\s*/) || [""])[0].replace(/\t/g, "  ").length;
          if (nextIndent <= indent) break;
          const item = next.match(/^\s*-\s+(.+?)\s*$/);
          if (item) fragments.push(item[1]);
          cursor += 1;
        }
        valueText = fragments.join("\n").trim();
      }
      valueText = valueText.replace(/^['"]|['"]$/g, "");
      if (valueText) rows.push({ path, value: valueText });
      stack.push({ indent, key });
    }
    return rows;
  }

  function splitTraits(value) {
    return text(value).split(/[、，,;；\n]|(?:\s*\/\s*)/).map((item) => truncate(item, 180)).filter(Boolean).slice(0, 8);
  }

  function extractLocalAnalysis(profile) {
    const rows = structuredLines(profile?.background);
    const finalKey = (row) => row.path[row.path.length - 1];
    const find = (...names) => rows.find((row) => names.some((name) => row.path.join(".") === name || finalKey(row) === name))?.value || "";
    const traits = rows.filter((row) => ["personality.default", "personality.traits", "traits", "archetype"].includes(row.path.join(".")) || ["traits", "archetype"].includes(finalKey(row))).flatMap((row) => splitTraits(row.value)).slice(0, 8);
    const analysis = normalizeAnalysis({
      identity: find("identity", "social_status"),
      background: find("background_story", "background", "history"),
      stableTraits: traits,
      motivations: rows.filter((row) => row.path.includes("goals") || finalKey(row) === "core_drivers").flatMap((row) => splitTraits(row.value)).slice(0, 8),
      fears: find("fears", "fear") ? splitTraits(find("fears", "fear")) : [],
      relationshipSummary: find("relationship_logic", "relationship"),
      conflictStyle: find("conflict_handling", "conflict_style"),
      voiceStyle: find("language_style", "voice_style", "speech_style"),
    });
    const filledFields = PROFILE_FIELDS.filter((field) => hasValue(field, analysis[field]));
    return Object.freeze({ schemaVersion: SCHEMA_VERSION, analysis, sourceTruncated: false, warnings: filledFields.length ? ["local_structured_text_extracted"] : [], local: true, filledFields });
  }

  function normalizeAnalysis(value) {
    const source = isObject(value) ? (isObject(value.analysis) ? value.analysis : value) : {};
    const analysis = {};
    TEXT_FIELDS.forEach((field) => { analysis[field] = truncate(source[field], field === "background" ? 7000 : 1400); });
    LIST_FIELDS.forEach((field) => { analysis[field] = list(source[field], field === "exampleDialogues" ? 12 : 16); });
    return Object.freeze(analysis);
  }

  function createInput(profile) {
    const source = isObject(profile) ? profile : {};
    const sections = [];
    const add = (label, value) => { const content = Array.isArray(value) ? value.join("\n") : text(value); if (content) sections.push(`${label}:\n${content}`); };
    add("Name", source.displayName);
    add("Identity", source.identity === "Imported character" ? "" : source.identity);
    add("Summary", source.summary);
    add("Background", source.background);
    add("Opening message", source.openingMessage);
    add("Example dialogue", source.exampleDialogues);
    add("Voice style", source.voiceStyle);
    add("Scene", source.scenePresentation);
    add("Existing traits", source.stableTraits);
    add("Existing tags", source.tags);
    const sourceText = sections.join("\n\n").slice(0, MAX_SOURCE_CHARACTERS);
    return Object.freeze({ schemaVersion: SCHEMA_VERSION, displayName: truncate(source.displayName, 160), sourceText, truncated: sections.join("\n\n").length > sourceText.length });
  }

  function validateInput(value) {
    if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || !text(value.displayName) || !text(value.sourceText) || value.sourceText.length > MAX_SOURCE_CHARACTERS || typeof value.truncated !== "boolean") throw new TypeError("Invalid RoleAnalysisRequest.");
    return true;
  }

  function validateResponse(value) {
    if (!isObject(value) || value.schemaVersion !== SCHEMA_VERSION || !isObject(value.analysis) || !Array.isArray(value.warnings)) throw new TypeError("Invalid RoleAnalysisResponse.");
    normalizeAnalysis(value.analysis);
    return true;
  }

  function hasValue(field, value) {
    if (Array.isArray(value)) return value.length > 0;
    if (!text(value)) return false;
    return !(field === "identity" && text(value) === "Imported character");
  }

  function mergeIntoProfile(profile, response, now = new Date().toISOString()) {
    const base = isObject(profile) ? clone(profile) : {};
    validateResponse(response);
    const analysis = normalizeAnalysis(response.analysis);
    const filledFields = [];
    PROFILE_FIELDS.forEach((field) => {
      if (hasValue(field, base[field]) || !hasValue(field, analysis[field])) return;
      base[field] = Array.isArray(analysis[field]) ? [...analysis[field]] : analysis[field];
      filledFields.push(field);
    });
    base.analysis = { schemaVersion: SCHEMA_VERSION, generatedAt: now, reviewRequired: true, filledFields, sourceTruncated: response.sourceTruncated === true, warnings: response.warnings.filter((warning) => typeof warning === "string").slice(0, 12) };
    base.status = "needs-review";
    return Object.freeze(base);
  }

  const api = Object.freeze({ SCHEMA_VERSION, MAX_SOURCE_CHARACTERS, TEXT_FIELDS, LIST_FIELDS, PROFILE_FIELDS, normalizeAnalysis, createInput, validateInput, validateResponse, mergeIntoProfile, extractLocalAnalysis });
  global.MercuryRoleAnalysisContracts = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
