(function exposeMercuryResourceContracts(global) {
  "use strict";

  const ROLE_KIND = "mercury.roleCard";
  const WORLD_KIND = "mercury.worldBook";
  const PRESET_KIND = "mercury.generation-profile";
  const LEGACY_PRESET_KIND = "mercury.preset";
  const SCHEMA_VERSION = 1;
  const WORLD_VISIBILITIES = new Set(["objective", "public", "restricted", "character-specific"]);
  const PROMPT_COLLECTION_KEYS = Object.freeze(["prompts", "prompt_blocks", "promptBlocks", "prompt_list", "promptList", "messages", "instructions", "instructionBlocks", "blocks"]);
  const PRESET_WRAPPER_KEYS = Object.freeze(["preset", "generationProfile", "generation_profile", "configuration", "config", "settings", "generation_config", "generationConfig", "payload", "data", "profile"]);
  const PROMPT_TEXT_FIELDS = Object.freeze([
    { key: "system_prompt", role: "system", position: null },
    { key: "systemPrompt", role: "system", position: null },
    { key: "main_prompt", role: "system", position: null },
    { key: "mainPrompt", role: "system", position: null },
    { key: "prompt", role: "system", position: null },
    { key: "instruction", role: "system", position: null },
    { key: "instructions", role: "system", position: null },
    { key: "rules", role: "system", position: null },
    { key: "style_guide", role: "system", position: null },
    { key: "styleGuide", role: "system", position: null },
    { key: "post_history_instructions", role: "system", position: "after_history" },
    { key: "postHistoryInstructions", role: "system", position: "after_history" },
    { key: "assistant_prefill", role: "assistant", position: "prefill" },
    { key: "assistantPrefill", role: "assistant", position: "prefill" },
  ]);
  const GENERATION_PARAMETER_KEYS = new Set([
    "temperature", "top_p", "top_k", "top_a", "min_p", "typical_p", "tfs", "epsilon_cutoff", "eta_cutoff",
    "frequency_penalty", "presence_penalty", "repetition_penalty", "repetition_penalty_range", "encoder_repetition_penalty",
    "max_tokens", "max_new_tokens", "openai_max_tokens", "openai_max_context", "seed", "n", "reasoning_effort", "verbosity",
  ]);

  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const roleText = (value) => {
    const result = text(value);
    if (!result || !/^[{[]/.test(result)) return result;
    try { return JSON.parse(result) && typeof JSON.parse(result) === "object" ? "" : result; }
    catch (_) { return result; }
  };
  const list = (value) => Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean).slice(0, 48) : text(value) ? [text(value)] : [];
  const mergedList = (...inputs) => Array.from(new Set(inputs.flatMap(list))).slice(0, 48);
  const values = (value) => Array.isArray(value) ? value : isObject(value) ? Object.values(value) : [];
  const clone = (value) => value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
  const slug = (value, fallback = "resource") => (text(value).toLowerCase() || fallback).replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || fallback;
  const filenameStem = (value) => text(value).replace(/\.[^.]+$/, "");
  const roleDisplayName = (value) => {
    const source = text(value);
    const cleaned = source.replace(/(?:\s*[-_]?\s*(?:v(?:er(?:sion)?)?\s*)?)?\d+\.\d+(?:\.\d+){0,2}$/i, "").trim();
    return cleaned || source;
  };
  const now = () => new Date().toISOString();
  const error = (code, path, message) => ({ code, path, message });
  const warning = (code, path, message) => ({ code, path, message });
  const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);

  const byteView = (input) => {
    if (input instanceof Uint8Array) return input;
    if (typeof ArrayBuffer !== "undefined" && input instanceof ArrayBuffer) return new Uint8Array(input);
    if (ArrayBuffer.isView?.(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    return null;
  };
  const latin1 = (bytes) => {
    let output = "";
    for (let index = 0; index < bytes.length; index += 1) output += String.fromCharCode(bytes[index]);
    return output;
  };
  const utf8 = (bytes) => {
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("utf8");
    return latin1(bytes);
  };
  const decodeBase64Utf8 = (value) => {
    const source = String(value || "").trim().replace(/^data:[^,]+,/, "");
    if (!source) return "";
    try {
      if (typeof atob === "function") {
        const binary = atob(source);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return utf8(bytes);
      }
      if (typeof Buffer !== "undefined") return Buffer.from(source, "base64").toString("utf8");
    } catch (_) { return ""; }
    return "";
  };

  function parseJson(rawText) {
    const source = String(rawText || "").replace(/^\uFEFF/, "").trim();
    if (!source) return { parsed: null, error: error("empty_input", "$", "Import file is empty.") };
    try { return { parsed: JSON.parse(source), error: null }; }
    catch (_) { return { parsed: null, error: error("invalid_json", "$", "Import file is not valid JSON.") }; }
  }

  function pngTextMetadata(bytes) {
    const view = byteView(bytes);
    if (!view || view.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((value, index) => view[index] !== value)) return { error: "not_png", values: [] };
    const values = [];
    let offset = PNG_SIGNATURE.length;
    while (offset + 12 <= view.length) {
      const length = ((view[offset] << 24) >>> 0) + (view[offset + 1] << 16) + (view[offset + 2] << 8) + view[offset + 3];
      const next = offset + 12 + length;
      if (length > 16 * 1024 * 1024 || next > view.length) return { error: "invalid_png", values };
      const type = latin1(view.subarray(offset + 4, offset + 8));
      if (type === "tEXt") {
        const data = view.subarray(offset + 8, offset + 8 + length);
        const separator = data.indexOf(0);
        if (separator > 0) values.push({ key: latin1(data.subarray(0, separator)), value: latin1(data.subarray(separator + 1)) });
      }
      offset = next;
      if (type === "IEND") break;
    }
    return { error: null, values };
  }

  function preflightMercuryResourceBinary(bytes, options = {}) {
    const metadata = pngTextMetadata(bytes);
    if (metadata.error === "not_png") {
      return Object.freeze({ ok: false, format: "binary", carrier: "binary", resourceKind: "unknown", migrations: [], errors: [error("unsupported_binary", "$", "Only JSON resources and PNG role cards with embedded metadata are supported.")], warnings: [], resource: null, relatedResources: [] });
    }
    if (metadata.error) {
      return Object.freeze({ ok: false, format: "png-character-card", carrier: "png-character-card", resourceKind: "unknown", migrations: [], errors: [error("invalid_png", "$", "PNG metadata could not be read.")], warnings: [], resource: null, relatedResources: [] });
    }
    const encodedCard = metadata.values.find((item) => item.key.toLowerCase() === "chara")?.value || "";
    if (!encodedCard) {
      return Object.freeze({ ok: false, format: "png-character-card", carrier: "png-character-card", resourceKind: "unknown", migrations: [], errors: [error("png_character_metadata_missing", "$", "PNG does not contain embedded role-card metadata.")], warnings: [], resource: null, relatedResources: [] });
    }
    const sourceText = encodedCard.trim().startsWith("{") ? encodedCard : decodeBase64Utf8(encodedCard);
    const report = preflightMercuryResourceImport(sourceText, options);
    if (report.resourceKind !== "roleCard") {
      return Object.freeze({ ...report, ok: false, carrier: "png-character-card", sourceText, errors: [...report.errors, error("png_metadata_not_role_card", "$", "PNG metadata is not a supported role card.")] });
    }
    return Object.freeze({ ...report, carrier: "png-character-card", sourceText });
  }

  function scalarText(value) {
    return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  }

  function promptContent(value) {
    if (typeof value === "string") return value;
    if (!isObject(value)) return "";
    const fields = [value.content, value.text, value.prompt, value.instruction, value.system_prompt, value.systemPrompt, value.value];
    return fields.find((item) => typeof item === "string") || "";
  }

  function normalizeExternalPromptCollection(value, collectionKey) {
    const sourceEntries = Array.isArray(value)
      ? value.map((item, index) => [`${index + 1}`, item])
      : isObject(value) ? Object.entries(value) : [];
    let malformedCount = 0;
    const prompts = [];
    sourceEntries.slice(0, 1000).forEach(([mapKey, item], index) => {
      if (typeof item !== "string" && !isObject(item)) { malformedCount += 1; return; }
      const raw = typeof item === "string" ? { content: item } : item;
      const content = promptContent(raw);
      const marker = raw.marker === true;
      if (!content.trim() && !marker) { malformedCount += 1; return; }
      const fallbackRole = collectionKey === "messages" ? "user" : null;
      const roleCandidate = text(raw.role) || text(raw.type) || fallbackRole;
      const role = ["system", "user", "assistant"].includes(roleCandidate) ? roleCandidate : null;
      const identifier = scalarText(raw.identifier) || scalarText(raw.id) || scalarText(raw.key) || `${collectionKey}-${mapKey}`;
      prompts.push({
        identifier,
        name: text(raw.name) || text(raw.title) || identifier || `Block ${index + 1}`,
        role,
        content,
        enabled: raw.disabled === true ? false : raw.enabled !== false,
        marker,
        injection_position: raw.injection_position ?? raw.position ?? null,
        injection_depth: raw.injection_depth ?? raw.depth ?? null,
        injection_order: raw.injection_order ?? raw.order ?? index,
      });
    });
    if (sourceEntries.length > 1000) malformedCount += sourceEntries.length - 1000;
    return { prompts, malformedCount, inputCount: sourceEntries.length };
  }

  function directPromptDescriptor(source, path = "$") {
    if (Array.isArray(source)) {
      const normalized = normalizeExternalPromptCollection(source, "prompts");
      if (!normalized.inputCount) return null;
      return { format: "external-prompt-list", path, payload: { prompts: normalized.prompts, prompt_order: [] }, ...normalized, parameterKeys: [] };
    }
    if (!isObject(source)) return null;

    for (const key of PROMPT_COLLECTION_KEYS) {
      if (!Array.isArray(source[key]) && !isObject(source[key])) continue;
      const normalized = normalizeExternalPromptCollection(source[key], key);
      const format = key === "prompts" && Array.isArray(source.prompt_order) ? "external-chat-preset" : key === "messages" ? "external-message-preset" : "external-prompt-preset";
      return {
        format,
        path: `${path}.${key}`,
        payload: { ...source, prompts: normalized.prompts, prompt_order: source.prompt_order || [] },
        ...normalized,
        parameterKeys: Object.keys(source).filter((field) => GENERATION_PARAMETER_KEYS.has(field)),
      };
    }

    const prompts = PROMPT_TEXT_FIELDS.flatMap((field, index) => {
      const content = typeof source[field.key] === "string" ? source[field.key] : "";
      if (!content.trim()) return [];
      return [{
        identifier: `field-${slug(field.key, `prompt-${index + 1}`)}`,
        name: field.key,
        role: field.role,
        content,
        enabled: true,
        injection_position: field.position,
        injection_depth: null,
        injection_order: index,
      }];
    });
    const parameterKeys = Object.keys(source).filter((field) => GENERATION_PARAMETER_KEYS.has(field));
    if (prompts.length) return { format: "external-instruction-preset", path, payload: { ...source, prompts, prompt_order: [] }, prompts, malformedCount: 0, inputCount: prompts.length, parameterKeys };
    if (parameterKeys.length) return { format: "external-generation-settings", path, payload: { ...source, prompts: [], prompt_order: [] }, prompts: [], malformedCount: 0, inputCount: 0, parameterKeys };
    return null;
  }

  function promptPresetDescriptor(source, path = "$", depth = 0) {
    const direct = directPromptDescriptor(source, path);
    if (direct) return direct;
    if (!isObject(source) || depth >= 3) return null;
    for (const key of PRESET_WRAPPER_KEYS) {
      if (!isObject(source[key]) && !Array.isArray(source[key])) continue;
      const nested = promptPresetDescriptor(source[key], `${path}.${key}`, depth + 1);
      if (nested) return nested;
    }
    return null;
  }

  function detectFormat(source) {
    if (!isObject(source) && !Array.isArray(source)) return { format: "unsupported-json", resourceKind: "unknown" };
    if (Array.isArray(source)) {
      const presetDescriptor = promptPresetDescriptor(source);
      return presetDescriptor ? { format: presetDescriptor.format, resourceKind: "preset", presetDescriptor } : { format: "unsupported-json", resourceKind: "unknown" };
    }
    if (source.kind === ROLE_KIND) return { format: "mercury-v1", resourceKind: "roleCard" };
    if (source.kind === WORLD_KIND) return { format: "mercury-v1", resourceKind: "worldBook" };
    if (source.kind === PRESET_KIND) return { format: "mercury-generation-profile-v1", resourceKind: "preset" };
    if (source.kind === LEGACY_PRESET_KIND) return { format: "mercury-preset-v1", resourceKind: "preset" };
    if (source.kind === "runtime-profile") return { format: "mercury-runtime-profile-v1", resourceKind: "roleCard" };
    const strongCharacter = ((source.spec === "chara_card_v2" || source.spec === "chara_card_v3" || source.spec_version !== undefined) && (source.name || source.char_name || source.data?.name || source.data?.char_name || source.description || source.char_persona || source.data?.description || source.data?.char_persona)) || ((source.char_name || source.data?.char_name) && (source.char_persona || source.data?.char_persona || source.personality || source.data?.personality || source.first_mes || source.data?.first_mes));
    if (strongCharacter) return { format: "generic-character-card", resourceKind: "roleCard" };
    if (source.modules?.order || source.modules?.enabled) return { format: "mercury-preset-legacy", resourceKind: "preset" };
    if (source.entries || source.world?.entries || source.worldProfile?.entries || source.world_info || source.lorebook) return { format: "world-json", resourceKind: "worldBook" };
    const presetDescriptor = promptPresetDescriptor(source);
    if (presetDescriptor) return { format: presetDescriptor.format, resourceKind: "preset", presetDescriptor };
    if ((source.data?.name || source.profile?.name || source.persona?.name || source.name) && (source.description || source.identity || source.personality || source.traits || source.data?.description || source.profile?.description)) return { format: "generic-character-card", resourceKind: "roleCard" };
    return { format: "unknown-json", resourceKind: "unknown" };
  }

  function roleData(source) {
    return source.kind === ROLE_KIND ? (isObject(source.data) ? source.data : source) : source;
  }

  function yamlKeyBlock(source, keys) {
    const wanted = new Set(keys.map((key) => String(key).trim().toLowerCase()));
    const lines = String(source || "").replace(/\r/g, "").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(/^(\s*)([^:#][^:]*):\s*(.*)$/);
      if (!match || !wanted.has(match[2].trim().toLowerCase())) continue;
      const baseIndent = match[1].length;
      const blockScalar = /[|>]/.test(match[3]);
      const output = match[3] && !blockScalar ? [match[3]] : [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const line = lines[cursor];
        if (/^\s*<\//.test(line)) break;
        const indent = (line.match(/^\s*/) || [""])[0].length;
        if (!blockScalar && line.trim() && indent <= baseIndent) break;
        if (blockScalar && line.trim() && indent <= baseIndent && /^[^:#][^:]*:\s*/.test(line.trim())) break;
        output.push(line);
      }
      return output.join("\n").trim();
    }
    return "";
  }

  function yamlList(block) {
    return String(block || "").split("\n")
      .map((line) => line.match(/^\s*-\s+(.+)$/)?.[1] || "")
      .map((item) => item.replace(/\s+#.*$/, "").trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean)
      .slice(0, 16);
  }

  function yamlFirstScalar(block) {
    const source = String(block || "");
    const match = source.match(/^\s*[^:\n]+:\s*[|>]\s*\n([\s\S]*?)(?=\n\s*[^:\n]+:\s*(?:[|>]|$)|$)/m);
    return (match ? match[1] : source).replace(/^\s*-\s*/gm, "").trim();
  }

  function embeddedYamlProfile(description) {
    const source = roleText(description);
    const fenced = source.match(/```ya?ml\s*\r?\n([\s\S]*?)(?=```|<\/(?:character|info)>|$)/i)?.[1] || "";
    if (!fenced) return { identity: "", stableTraits: [], voiceStyle: "" };
    const identity = yamlList(yamlKeyBlock(fenced, ["identity", "身份"])).join("；");
    const stableTraits = yamlList(yamlKeyBlock(fenced, ["traits", "stable_traits", "稳定特质"]));
    const language = yamlFirstScalar(yamlKeyBlock(fenced, ["language_style", "speech_style", "dialogue_style", "说话风格"]));
    const writingRule = yamlFirstScalar(yamlKeyBlock(fenced, ["writing_rule", "writing_rules", "写作规则"]));
    const voiceStyle = [language, writingRule].filter(Boolean).join("\n").slice(0, 1800);
    return { identity, stableTraits, voiceStyle };
  }

  function normalizeRoleCard(source, report) {
    const data = roleData(source);
    // Character-card exports duplicate some fields at the root. The nested data
    // block is authoritative, including when root fields are empty placeholders.
    const cardSource = isObject(data.data) && (data.data.name || data.data.char_name || data.data.description || data.data.char_persona) ? { ...data, ...data.data } : data;
    if (report.format !== "mercury-v1") report.migrations.push({ code: "role_card_migrated", from: report.format, to: ROLE_KIND });
    const displayName = roleDisplayName(cardSource.displayName || cardSource.name || cardSource.char_name);
    if (!displayName) report.errors.push(error("missing_display_name", "$.displayName", "Role card requires a displayName or name."));
    const profile = isObject(cardSource.profile) ? clone(cardSource.profile) : {};
    const description = roleText(cardSource.description || cardSource.char_persona || cardSource.summary || cardSource.background);
    const embedded = embeddedYamlProfile(description);
    const personality = cardSource.personality || cardSource.char_personality || cardSource.stableTraits || cardSource.traits;
    const scenario = roleText(cardSource.scenario || cardSource.world_scenario);
    const examples = cardSource.mes_example || cardSource.example_dialogue || cardSource.exampleDialogues;
    if (description && !profile.background && !profile.summary) profile.background = description;
    if (description.length > 2500 && !text(cardSource.summary || profile.summary)) report.warnings.push(warning("role_description_preserved_as_background", "$.description", "A long unstructured role description was preserved as background; review the concise profile fields after import."));
    if (personality && !profile.stableTraits) profile.stableTraits = list(personality);
    if (embedded.identity && !profile.identity) profile.identity = embedded.identity;
    if (embedded.stableTraits.length && !profile.stableTraits) profile.stableTraits = embedded.stableTraits;
    if (embedded.voiceStyle && !profile.voiceStyle) profile.voiceStyle = embedded.voiceStyle;
    if (scenario && !profile.scenePresentation) profile.scenePresentation = scenario;
    if (Array.isArray(cardSource.worldBindings) && !profile.worldBindings) profile.worldBindings = list(cardSource.worldBindings);
    if (examples && !profile.voiceStyle) profile.voiceStyle = roleText(examples);
    if (cardSource.creator_notes && !profile.creatorNotes) profile.creatorNotes = roleText(cardSource.creator_notes);
    if (cardSource.alternate_greetings && !profile.alternateGreetings) profile.alternateGreetings = list(cardSource.alternate_greetings);
    const listFields = new Set(["motivations", "fears", "values", "boundaries", "cognitionLimits", "changeThresholds"]);
    const textFields = new Set(["identity", "summary", "careStyle", "conflictStyle", "defenseStyle", "voiceStyle", "background", "inner_conflict", "politics", "signature_details", "scenePresentation", "creatorNotes"]);
    ["identity", "summary", "motivations", "fears", "values", "boundaries", "careStyle", "conflictStyle", "defenseStyle", "voiceStyle", "cognitionLimits", "changeThresholds", "background", "inner_conflict", "politics", "signature_details", "scenePresentation", "creatorNotes", "lore"].forEach((key) => {
      if (profile[key] !== undefined || cardSource[key] === undefined) return;
      if (listFields.has(key)) profile[key] = list(cardSource[key]);
      else if (textFields.has(key)) profile[key] = roleText(cardSource[key]);
      else if (key === "lore" && isObject(cardSource[key])) profile[key] = clone(cardSource[key]);
    });
    return {
      kind: ROLE_KIND,
      schemaVersion: SCHEMA_VERSION,
      id: text(cardSource.id) || `role-${slug(displayName || "character")}`,
      displayName: displayName || "Untitled character",
      identity: roleText(cardSource.identity || cardSource.role || profile.identity) || "Imported character",
      summary: roleText(cardSource.summary || profile.summary),
      profile,
      openingMessage: roleText(cardSource.openingMessage || cardSource.first_mes || cardSource.char_greeting || cardSource.firstMessage),
      tags: list(cardSource.tags),
      createdAt: text(cardSource.createdAt) || now(),
      updatedAt: text(cardSource.updatedAt) || now(),
    };
  }

  function normalizeWorldBook(source, report, options = {}) {
    const data = source.kind === WORLD_KIND ? (isObject(source.data) ? { ...source, ...source.data } : source) : (source.world || source.worldProfile || source.world_info || source.lorebook || source);
    if (report.format !== "mercury-v1") report.migrations.push({ code: "world_book_migrated", from: report.format, to: WORLD_KIND });
    const name = text(data.name || data.title || source.name || options.name || filenameStem(options.filename));
    if (!name) report.errors.push(error("missing_world_name", "$.data.name", "World book requires a name."));
    const rawEntries = values(data.entries);
    if (isObject(data.entries)) report.migrations.push({ code: "world_entries_object_migrated", from: "object-map", to: "array" });
    if (!rawEntries.length) report.warnings.push(warning("world_entries_empty", "$.data.entries", "World book has no entries."));
    const entries = rawEntries.filter(isObject).map((entry, index) => {
      const keys = mergedList(entry.keys || entry.key || entry.aliases, entry.secondary_keys || entry.keysecondary);
      const hasLegacyActivationFields = ["constant", "selective", "useProbability", "probability", "position", "depth", "scanDepth", "matchScenario", "matchCharacterDescription", "matchCharacterPersonality", "characterFilter"].some((key) => Object.prototype.hasOwnProperty.call(entry, key));
      const probability = Number(entry.probability);
      const isUnkeyedUniversal = !keys.length && hasLegacyActivationFields && entry.useProbability !== true || !keys.length && hasLegacyActivationFields && entry.useProbability === true && (!Number.isFinite(probability) || probability >= 100);
      return {
      id: text(entry.id || entry.uid) || `entry-${index + 1}`,
      title: text(entry.title || entry.name || entry.comment) || `Entry ${index + 1}`,
      content: text(entry.content || entry.summary),
      enabled: entry.enabled !== false && entry.disable !== true,
      alwaysActive: entry.alwaysActive === true || entry.constant === true || isUnkeyedUniversal,
      priority: Number.isFinite(entry.priority) ? Number(entry.priority) : Number.isFinite(entry.insertion_order) ? Number(entry.insertion_order) : Number.isFinite(entry.order) ? Number(entry.order) : 0,
      keys,
      tags: list(entry.tags),
      activationMode: isUnkeyedUniversal ? "unkeyed-universal" : keys.length ? "keyword" : "title-fallback",
      visibility: WORLD_VISIBILITIES.has(text(entry.visibility)) ? text(entry.visibility) : "public",
      worldVariantId: text(entry.worldVariantId || entry.variantId),
      worldVariantIds: list(entry.worldVariantIds || entry.variantIds),
      timelineId: text(entry.timelineId),
      timelineIds: list(entry.timelineIds),
      runtimeProfileId: text(entry.runtimeProfileId || entry.profileId || entry.characterId),
      runtimeProfileIds: list(entry.runtimeProfileIds || entry.profileIds || entry.characterIds),
      relatedProfileIds: list(entry.relatedProfileIds || entry.relatedProfiles),
      scope: isObject(entry.scope) ? clone(entry.scope) : undefined,
      };
    });
    const usableEntries = entries.filter((entry, index) => {
      if (entry.content) return true;
      const path = `$.data.entries[${index}].content`;
      report.warnings.push(warning("world_entry_skipped_empty_content", path, "World entry without content was skipped."));
      return false;
    });
    return {
      kind: WORLD_KIND,
      schemaVersion: SCHEMA_VERSION,
      id: text(data.id) || `world-${slug(name || "book")}`,
      name: name || "Untitled world",
      summary: text(data.summary || data.description),
      entries: usableEntries,
      tags: list(data.tags),
      relatedProfileIds: list(data.relatedProfileIds || data.relatedProfiles),
      worldVariantId: text(data.worldVariantId || data.variantId),
      worldVariantIds: list(data.worldVariantIds || data.variantIds),
      timelineId: text(data.timelineId),
      timelineIds: list(data.timelineIds),
      scope: isObject(data.scope) ? clone(data.scope) : undefined,
      createdAt: text(data.createdAt) || now(),
      updatedAt: text(data.updatedAt) || now(),
    };
  }

  function embeddedWorldBooks(source, role, outerReport) {
    const data = roleData(source);
    const nested = isObject(data.data) ? data.data : {};
    const book = isObject(data.character_book) ? data.character_book : isObject(nested.character_book) ? nested.character_book : null;
    if (!book || !values(book.entries).length) return [];
    const report = { format: "embedded-world-book", resourceKind: "worldBook", migrations: [], errors: [], warnings: [] };
    const resource = normalizeWorldBook(book, report, { name: `${role.displayName} world`, skipEmptyEntries: true });
    if (report.errors.length) return [];
    outerReport.warnings.push(...report.warnings);
    if (!resource.entries.length) return [];
    resource.id = `world-${slug(role.id || role.displayName)}-embedded`;
    return [resource];
  }

  function preferredPromptOrder(value) {
    if (Array.isArray(value)) {
      const orderSets = value.filter(isObject).filter((item) => Array.isArray(item.order));
      if (orderSets.length) return orderSets.find((item) => Number(item.character_id) === 100000)?.order || orderSets[0].order;
      return value;
    }
    if (!isObject(value)) return [];
    if (Array.isArray(value.order)) return value.order;
    for (const nested of Object.values(value)) {
      const order = preferredPromptOrder(nested);
      if (order.length) return order;
    }
    return Object.entries(value).map(([identifier, enabled]) => ({ identifier, enabled: enabled !== false }));
  }

  function compatiblePromptPreset(source, report, context = {}) {
    const preferredOrder = preferredPromptOrder(source.prompt_order);
    const orderByIdentifier = new Map();
    preferredOrder.forEach((item, index) => {
      const identifier = isObject(item) ? scalarText(item.identifier) || scalarText(item.id) : scalarText(item);
      if (identifier) orderByIdentifier.set(identifier, { enabled: !isObject(item) || item.enabled !== false, order: index });
    });
    const occupiedBlockIds = new Set();
    const blocks = source.prompts.filter(isObject).map((prompt, index) => {
      const baseId = scalarText(prompt.identifier) || scalarText(prompt.id) || `block-${index + 1}`;
      let id = baseId;
      let suffix = 2;
      while (occupiedBlockIds.has(id)) id = `${baseId}-${suffix++}`;
      occupiedBlockIds.add(id);
      const configured = orderByIdentifier.get(id);
      const enabled = configured ? configured.enabled : prompt.enabled !== false;
      const position = prompt.injection_position ?? prompt.position ?? null;
      const rawDepth = prompt.injection_depth ?? prompt.depth;
      const rawOrder = prompt.injection_order ?? prompt.order;
      const depth = rawDepth === null || rawDepth === undefined || rawDepth === "" ? null : Number.isFinite(Number(rawDepth)) ? Number(rawDepth) : null;
      const order = rawOrder === null || rawOrder === undefined || rawOrder === "" ? configured?.order ?? index : Number.isFinite(Number(rawOrder)) ? Number(rawOrder) : configured?.order ?? index;
      const role = text(prompt.role) || null;
      const content = typeof prompt.content === "string" ? prompt.content : "";
      // Mercury's current request assembly has one system-instruction lane. A
      // prompt may enter it only when its source role and insertion semantics
      // are equivalent; every other source field remains preserved but inactive.
      const positionCompatible = position === null || position === 0 || position === "0" || position === "system" || position === "relative";
      // Relative prompts live in the ordered prompt list. Their depth value is
      // ignored by the source format, so they can use Mercury's system lane.
      // In-chat positions still remain preserved until Chat supports role/depth
      // insertion without flattening them into a system instruction.
      const runtimeActive = Boolean(enabled && content.trim() && (!role || role === "system") && positionCompatible);
      return { id, name: text(prompt.name) || id, content, enabled, role, injection: { position, depth, order }, runtimeActive };
    }).sort((a, b) => a.injection.order - b.injection.order);
    const modules = { order: [], enabled: {}, texts: {} };
    blocks.forEach((block) => {
      if (!block.content.trim()) return;
      const moduleId = `compat.block.${slug(block.id, "block")}`;
      modules.order.push(moduleId);
      modules.enabled[moduleId] = block.runtimeActive;
      modules.texts[moduleId] = block.content;
    });
    if (!modules.order.length) report.warnings.push(warning("preset_no_usable_prompt_blocks", "$.prompts", "No non-empty prompt blocks were found."));
    const activeCount = blocks.filter((block) => block.runtimeActive).length;
    const preservedCount = blocks.filter((block) => block.enabled && !block.runtimeActive).length;
    const parameterKeys = Array.from(new Set(context.descriptor?.parameterKeys || []));
    const preservedSettingsCount = parameterKeys.length;
    report.migrations.push({ code: "external_prompt_preset_migrated", from: report.format, to: PRESET_KIND });
    if (context.descriptor?.malformedCount) report.warnings.push(warning("preset_prompt_items_skipped", context.descriptor.path || "$.prompts", `${context.descriptor.malformedCount} prompt items could not be normalized and remain only in the preserved source.`));
    if (preservedCount) report.warnings.push(warning("preset_blocks_preserved_inactive", "$.prompts", `${preservedCount} enabled prompt blocks were preserved without runtime injection.`));
    if (preservedSettingsCount) report.warnings.push(warning("preset_generation_settings_preserved", context.descriptor?.path || "$", `${preservedSettingsCount} generation settings were preserved for a later parameter adapter.`));
    if (!blocks.length && !preservedSettingsCount) report.errors.push(error("preset_no_recognizable_content", context.descriptor?.path || "$", "Preset contains no recognizable prompt blocks or generation settings."));
    const importName = text(source.name) || text(context.rawSource?.name) || filenameStem(context.options?.filename) || "Imported preset";
    return {
      kind: PRESET_KIND,
      schemaVersion: SCHEMA_VERSION,
      data: {
        id: `preset-${slug(importName || "imported")}`,
        name: importName,
        version: 1,
        modules,
        preferences: {},
        custom: { instructions: null },
        acceptedConflicts: [],
        compatibility: {
          format: report.format,
          sourcePath: context.descriptor?.path || "$",
          capabilities: { textVariables: true },
          blocks,
          runtime: { activeCount, preservedCount, preservedSettingsCount },
          preservedSettings: parameterKeys,
          rawSource: clone(context.rawSource || source),
        },
      },
    };
  }

  function normalizePreset(source, report, context = {}) {
    if (context.descriptor) return compatiblePromptPreset(context.descriptor.payload, report, context);
    const data = source.kind === PRESET_KIND || source.kind === LEGACY_PRESET_KIND ? (isObject(source.data) ? source.data : {}) : source;
    if (report.format !== "mercury-generation-profile-v1") report.migrations.push({ code: "preset_migrated", from: report.format, to: PRESET_KIND });
    if (!text(data.name)) report.errors.push(error("missing_preset_name", "$.data.name", "Preset requires a name."));
    const modules = isObject(data.modules) ? data.modules : {};
    if (!Array.isArray(modules.order)) report.errors.push(error("missing_preset_order", "$.data.modules.order", "Preset modules require an order array."));
    if (!isObject(modules.enabled)) report.errors.push(error("missing_preset_enabled", "$.data.modules.enabled", "Preset modules require an enabled map."));
    return {
      kind: PRESET_KIND,
      schemaVersion: SCHEMA_VERSION,
      data: {
        id: text(data.id) || `preset-${slug(data.name || "custom")}`,
        name: text(data.name) || "Untitled preset",
        description: typeof data.description === "string" ? data.description : "",
        version: Number.isFinite(data.version) ? Number(data.version) : 1,
        origin: text(data.origin) || undefined,
        creationMode: text(data.creationMode) || undefined,
        remixOf: text(data.remixOf) || null,
        cover: isObject(data.cover) ? clone(data.cover) : undefined,
        modules: {
          order: Array.isArray(modules.order) ? modules.order.map(String) : [],
          enabled: isObject(modules.enabled) ? Object.fromEntries(Object.entries(modules.enabled).map(([key, value]) => [String(key), value === true])) : {},
          texts: isObject(modules.texts) ? clone(modules.texts) : undefined,
        },
        preferences: isObject(data.preferences) ? clone(data.preferences) : {},
        instructionBlocks: Array.isArray(data.instructionBlocks) ? clone(data.instructionBlocks) : [],
        custom: isObject(data.custom) ? { instructions: typeof data.custom.instructions === "string" ? data.custom.instructions : null } : { instructions: null },
        acceptedConflicts: Array.isArray(data.acceptedConflicts) ? data.acceptedConflicts.map(String).filter(Boolean) : [],
        compatibility: isObject(data.compatibility) ? clone(data.compatibility) : undefined,
        provenance: isObject(data.provenance) ? clone(data.provenance) : undefined,
        createdAt: Number(data.createdAt) || undefined,
        updatedAt: Number(data.updatedAt) || undefined,
      },
    };
  }

  function preflightMercuryResourceImport(rawText, options = {}) {
    const report = { ok: false, format: "unknown", resourceKind: "unknown", migrations: [], errors: [], warnings: [], resource: null, relatedResources: [] };
    const parsed = parseJson(rawText);
    if (parsed.error) { report.errors.push(parsed.error); return Object.freeze(report); }
    const detected = detectFormat(parsed.parsed);
    report.format = detected.format;
    report.resourceKind = detected.resourceKind;
    if (detected.resourceKind === "unknown") {
      report.errors.push(error("unsupported_resource", "$", "JSON is not a supported Mercury resource."));
      return Object.freeze(report);
    }
    report.resource = detected.resourceKind === "roleCard"
      ? normalizeRoleCard(parsed.parsed, report)
      : detected.resourceKind === "worldBook"
        ? normalizeWorldBook(parsed.parsed, report, options)
        : normalizePreset(parsed.parsed, report, { descriptor: detected.presetDescriptor, rawSource: parsed.parsed, options });
    if (detected.resourceKind === "roleCard") report.relatedResources = embeddedWorldBooks(parsed.parsed, report.resource, report);
    report.ok = report.errors.length === 0;
    return Object.freeze(report);
  }

  function contactFromRoleCard(resource, defaults = {}) {
    if (!isObject(resource) || resource.kind !== ROLE_KIND) throw new TypeError("Role card resource required.");
    return {
      id: defaults.id || `profile-${slug(resource.displayName)}`,
      name: resource.displayName,
      identity: resource.identity || "Imported character",
      relationship: defaults.relationship || "Imported character",
      avatar: defaults.avatar || null,
      profileBackground: defaults.profileBackground || null,
      persona: { displayName: resource.displayName, identity: resource.identity, summary: resource.summary, ...clone(resource.profile), openingMessage: resource.openingMessage, tags: resource.tags },
      sourceKind: ROLE_KIND,
      runtimeProfileId: resource.id,
    };
  }

  function exportMercuryResource(resource) {
    if (!isObject(resource) || ![ROLE_KIND, WORLD_KIND, PRESET_KIND].includes(resource.kind)) throw new TypeError("Supported Mercury resource required.");
    return JSON.stringify(clone(resource), null, 2);
  }

  function exportPresetCompatibility(preset) {
    const source = preset?.compatibility?.rawSource;
    if (!isObject(source)) throw new TypeError("Compatible preset source required.");
    return JSON.stringify(clone(source), null, 2);
  }

  const api = { ROLE_KIND, WORLD_KIND, PRESET_KIND, LEGACY_PRESET_KIND, SCHEMA_VERSION, preflightMercuryResourceImport, preflightMercuryResourceBinary, contactFromRoleCard, exportMercuryResource, exportPresetCompatibility };
  global.MercuryResourceContracts = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
