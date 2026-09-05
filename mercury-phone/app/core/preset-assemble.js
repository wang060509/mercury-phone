(function exposeMercuryPresetAssemble(global) {
  "use strict";

  const content = global.MercuryPresetContent || null;
  const compatibility = global.MercuryPresetCompatibility
    || (typeof require === "function" ? require("./preset-compatibility.js") : null);
  const moduleText = (id) => (content && content.MODULE_TEXTS && content.MODULE_TEXTS[id]) || null;
  const exclusiveGroupOf = (id, groups) => {
    if (!content || !content.EXCLUSIVE_GROUPS) return "";
    const list = content.EXCLUSIVE_GROUPS;
    const groupNames = Object.keys(list);
    for (let i = 0; i < groupNames.length; i += 1) {
      if (list[groupNames[i]].indexOf(id) >= 0) return groupNames[i];
    }
    return "";
  };
  const placeholderOf = (id) => (content && content.PREF_PLACEHOLDERS && content.PREF_PLACEHOLDERS[id]) || "";

  function collectPreferences(preset) {
    if (!preset || typeof preset !== "object") return {};
    const source = preset.preferences
      || (preset.modules && preset.modules.values)
      || {};
    const out = {};
    Object.keys(source).forEach((key) => {
      const raw = source[key];
      if (typeof raw === "string" && raw.trim()) out[key] = raw.trim();
    });
    return out;
  }

  function placeholderText(template, key, value) {
    return value ? String(template).split(`{${key}}`).join(value) : null;
  }

  // 按 modules.order 依序装配已启用模块的文本；段间空行，custom 追加末尾。
  // 返回 string（对接 compileRuntime.userPreset.instructions 与 diff 断言）；
  // options.withWarnings === true 时返回 { text, warnings }。
  function assemblePresetInstructions(preset, options = {}) {
    const warnings = [];
    if (!preset || typeof preset !== "object" || !preset.modules || typeof preset.modules !== "object") {
      const empty = "";
      return options.withWarnings ? { text: empty, warnings } : empty;
    }
    const order = Array.isArray(preset.modules.order) ? preset.modules.order.map(String) : [];
    const enabled = (preset.modules.enabled && typeof preset.modules.enabled === "object")
      ? preset.modules.enabled
      : {};
    const carriedTexts = (preset.modules.texts && typeof preset.modules.texts === "object")
      ? preset.modules.texts
      : {};
    const preferences = collectPreferences(preset);

    // 互斥组已取过候选则不再取第二个，但记 warning（defective）。按 order 顺序。
    const takenGroup = {};
    const parts = [];
    for (let i = 0; i < order.length; i += 1) {
      const id = String(order[i]);
      if (enabled[id] !== true) continue; // 只拼 enabled 的模块
      const group = exclusiveGroupOf(id, content && content.EXCLUSIVE_GROUPS);
      if (group) {
        if (takenGroup[group]) {
          warnings.push({ code: "exclusive_group_multiple", group, moduleId: id });
          continue; // 组内已取过第一个，跳过
        }
        takenGroup[group] = true;
      }

      let text = moduleText(id);
      let fromCarry = false;
      if (text == null) {
        const carried = carriedTexts[id];
        if (typeof carried === "string" && carried.trim()) {
          text = carried.trim();
          fromCarry = true;
        }
      }
      if (text == null || !String(text).trim()) {
        warnings.push({ code: "no_text", moduleId: id, fromCarry });
        continue; // 未知且无携带文本 → 跳过
      }

      const ph = placeholderOf(id);
      if (ph) {
        const value = preferences[ph];
        if (!value) {
          warnings.push({ code: "placeholder_missing", moduleId: id, placeholder: ph });
          continue; // 占位未填则不生成对应段
        }
        text = placeholderText(text, ph, value);
      }
      parts.push(String(text).trim());
    }

    // Generation Profile Instruction Blocks are the canonical home for
    // migrated free-form and compatibility content. Only blocks that are both
    // user-enabled and runtime-eligible enter the existing userPreset lane.
    const instructionBlocks = Array.isArray(preset.instructionBlocks)
      ? preset.instructionBlocks.slice().sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0))
      : [];
    instructionBlocks.forEach((block) => {
      if (!block || block.enabled !== true) return;
      if (block.runtimeEligible === false) {
        warnings.push({ code: "instruction_block_preserved_inactive", blockId: block.id || null });
        return;
      }
      if (typeof block.content !== "string" || !block.content.trim()) {
        warnings.push({ code: "instruction_block_no_text", blockId: block.id || null });
        return;
      }
      parts.push(block.content.trim());
    });

    // Legacy editor compatibility: custom.instructions mirrors block-custom
    // until the Archive workbench replaces the old Chat editor. Never append
    // both copies.
    const custom = preset.custom && typeof preset.custom === "object" ? preset.custom : {};
    const hasCustomBlock = instructionBlocks.some((block) => block?.id === "block-custom" && block.enabled === true && block.runtimeEligible !== false && typeof block.content === "string" && block.content.trim());
    if (!hasCustomBlock && typeof custom.instructions === "string" && custom.instructions.trim()) {
      parts.push(custom.instructions.trim());
    }

    const rawText = parts.filter(Boolean).join("\n\n");
    const compatibilityResult = compatibility?.resolveCompatibilityText
      ? compatibility.resolveCompatibilityText(preset, rawText, { templateValues: options.templateValues })
      : { text: rawText, compatible: false, warnings: [] };
    warnings.push(...(compatibilityResult.warnings || []));
    const resolvedText = compatibilityResult.text;
    return options.withWarnings ? { text: resolvedText, warnings, compatibility: compatibilityResult } : resolvedText;
  }

  function inspectPresetInstructions(preset, options = {}) {
    const assembled = assemblePresetInstructions(preset, { withWarnings: true, templateValues: options.templateValues });
    const runtime = preset?.compatibility && typeof preset.compatibility === "object"
      ? preset.compatibility.runtime
      : null;
    const instructionBlocks = Array.isArray(preset?.instructionBlocks) ? preset.instructionBlocks : [];
    const activeInstructionBlocks = instructionBlocks.filter((block) => block?.enabled === true && block.runtimeEligible !== false && typeof block.content === "string" && block.content.trim());
    const preservedInstructionBlocks = instructionBlocks.filter((block) => block?.enabled === true && block.runtimeEligible === false);
    const enabledModules = Object.values(preset?.modules?.enabled || {}).filter((value) => value === true).length;
    const hasCustomBlock = activeInstructionBlocks.some((block) => block.id === "block-custom");
    const hasLegacyCustom = !hasCustomBlock && typeof preset?.custom?.instructions === "string" && preset.custom.instructions.trim();
    const runtimeActiveCount = Number.isFinite(runtime?.activeCount)
      ? Number(runtime.activeCount)
      : enabledModules + activeInstructionBlocks.length + (hasLegacyCustom ? 1 : 0);
    const preservedCount = Number.isFinite(runtime?.preservedCount)
      ? Number(runtime.preservedCount)
      : preservedInstructionBlocks.length;
    const preservedSettingsCount = Number.isFinite(runtime?.preservedSettingsCount)
      ? Number(runtime.preservedSettingsCount)
      : 0;
    const unresolvedMacros = Array.from(new Set((assembled.text.match(/{{\s*[^{}\r\n]+?\s*}}/g) || []).map((token) => token.trim())));
    const hasRuntimeText = Boolean(assembled.text.trim());
    const status = !hasRuntimeText
      ? (preservedCount > 0 || preservedSettingsCount > 0 ? "preserved" : "empty")
      : (unresolvedMacros.length > 0 || preservedCount > 0 || preservedSettingsCount > 0 ? "partial" : "ready");
    return {
      status,
      hasRuntimeText,
      runtimeActiveCount,
      preservedCount,
      preservedSettingsCount,
      resolvedMacroCount: Number(assembled.compatibility?.resolvedReferenceCount) || 0,
      resolvedVariableCount: Number(assembled.compatibility?.resolvedVariableCount) || 0,
      resolvedTemplateCount: Number(assembled.compatibility?.resolvedTemplateCount) || 0,
      definedVariableCount: Number(assembled.compatibility?.definedVariableCount) || 0,
      unresolvedVariableCount: Number(assembled.compatibility?.unresolvedVariableCount) || 0,
      unresolvedTemplateCount: Number(assembled.compatibility?.unresolvedTemplateCount) || 0,
      unresolvedMacroCount: unresolvedMacros.length,
      unresolvedMacros,
      warnings: assembled.warnings.slice(),
    };
  }

  const api = { assemblePresetInstructions, inspectPresetInstructions };
  global.MercuryPresetAssemble = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
