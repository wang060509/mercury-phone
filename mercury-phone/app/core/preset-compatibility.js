(function exposeMercuryPresetCompatibility(global) {
  "use strict";

  const LIMITS = Object.freeze({
    blocks: 1000,
    variables: 256,
    variableNameChars: 128,
    variableValueChars: 12000,
    variableTotalChars: 120000,
    expandedTextChars: 120000,
    resolutionDepth: 8,
  });

  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value) => typeof value === "string" ? value : "";

  function scanMacros(value) {
    const source = text(value);
    const macros = [];
    let cursor = 0;
    while (cursor < source.length) {
      const start = source.indexOf("{{", cursor);
      if (start < 0) break;
      let depth = 1;
      let index = start + 2;
      while (index < source.length && depth > 0) {
        if (source.startsWith("{{", index)) {
          depth += 1;
          index += 2;
        } else if (source.startsWith("}}", index)) {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      if (depth > 0) {
        cursor = start + 2;
        continue;
      }
      macros.push({
        start,
        end: index,
        raw: source.slice(start, index),
        body: source.slice(start + 2, index - 2),
      });
      cursor = index;
    }
    return macros;
  }

  function parseVariableMacro(macro) {
    const matched = /^\s*(setglobalvar|setvar|getglobalvar|getvar)\s*::([\s\S]*)$/i.exec(macro?.body || "");
    if (!matched) return null;
    const kind = matched[1].toLowerCase();
    const payload = matched[2];
    const separator = payload.indexOf("::");
    const name = (separator >= 0 ? payload.slice(0, separator) : payload).trim();
    if (!name || name.length > LIMITS.variableNameChars || /[{}:\r\n]/.test(name)) return null;
    const write = kind === "setvar" || kind === "setglobalvar";
    if (write && separator < 0) return null;
    return {
      kind,
      name,
      global: kind === "setglobalvar" || kind === "getglobalvar",
      write,
      value: write ? payload.slice(separator + 2) : null,
      hasDefault: !write && separator >= 0,
    };
  }

  function orderedCompatibilityBlocks(preset) {
    const blocks = Array.isArray(preset?.compatibility?.blocks) ? preset.compatibility.blocks : [];
    return blocks.slice(0, LIMITS.blocks).map((block, index) => ({ block, index })).sort((left, right) => {
      const leftOrder = Number.isFinite(left.block?.injection?.order) ? Number(left.block.injection.order) : left.index;
      const rightOrder = Number.isFinite(right.block?.injection?.order) ? Number(right.block.injection.order) : right.index;
      return leftOrder - rightOrder || left.index - right.index;
    });
  }

  function buildVariableContext(preset) {
    const local = new Map();
    const shared = new Map();
    const warnings = [];
    let assignmentCount = 0;
    let totalChars = 0;
    const blocks = orderedCompatibilityBlocks(preset);
    if ((preset?.compatibility?.blocks?.length || 0) > LIMITS.blocks) warnings.push({ code: "compat_block_limit", limit: LIMITS.blocks });

    blocks.forEach(({ block }) => {
      if (!isObject(block) || block.enabled !== true || typeof block.content !== "string") return;
      scanMacros(block.content).forEach((macro) => {
        const parsed = parseVariableMacro(macro);
        if (!parsed?.write) return;
        assignmentCount += 1;
        if (parsed.value.length > LIMITS.variableValueChars) {
          warnings.push({ code: "compat_variable_value_limit", variable: parsed.name, limit: LIMITS.variableValueChars });
          return;
        }
        const target = parsed.global ? shared : local;
        const alreadyExists = target.has(parsed.name);
        if (!alreadyExists && (local.size + shared.size) >= LIMITS.variables) {
          warnings.push({ code: "compat_variable_count_limit", variable: parsed.name, limit: LIMITS.variables });
          return;
        }
        const previousLength = alreadyExists ? text(target.get(parsed.name)).length : 0;
        const nextTotal = totalChars - previousLength + parsed.value.length;
        if (nextTotal > LIMITS.variableTotalChars) {
          warnings.push({ code: "compat_variable_total_limit", variable: parsed.name, limit: LIMITS.variableTotalChars });
          return;
        }
        target.set(parsed.name, parsed.value);
        totalChars = nextTotal;
      });
    });

    return { local, shared, assignmentCount, warnings, sourceBlockCount: blocks.length };
  }

  function resolveCompatibilityText(preset, input, options = {}) {
    const source = text(input);
    const context = buildVariableContext(preset);
    const templateValues = {};
    ["user", "char"].forEach((key) => {
      const value = options?.templateValues?.[key];
      if (typeof value === "string" && value.trim()) templateValues[key] = value.trim().slice(0, 256);
    });
    const resolvedNames = new Set();
    const unresolvedNames = new Set();
    const warnings = context.warnings.slice();
    let resolvedReferenceCount = 0;
    let resolvedTemplateCount = 0;

    function resolveText(value, stack = [], depth = 0) {
      const current = text(value);
      if (depth > LIMITS.resolutionDepth) return current;
      const macros = scanMacros(current);
      if (!macros.length) return current;
      let cursor = 0;
      let output = "";
      macros.forEach((macro) => {
        output += current.slice(cursor, macro.start);
        const simpleMacro = String(macro.body || "").trim().toLowerCase();
        if (simpleMacro === "newline") {
          output += "\n";
          resolvedTemplateCount += 1;
          cursor = macro.end;
          return;
        }
        if (Object.prototype.hasOwnProperty.call(templateValues, simpleMacro)) {
          output += templateValues[simpleMacro];
          resolvedTemplateCount += 1;
          cursor = macro.end;
          return;
        }
        const parsed = parseVariableMacro(macro);
        if (parsed?.write) {
          cursor = macro.end;
          return;
        }
        if (!parsed || parsed.hasDefault) {
          output += macro.raw;
          cursor = macro.end;
          return;
        }
        const target = parsed.global ? context.shared : context.local;
        const stackKey = `${parsed.global ? "global" : "local"}:${parsed.name}`;
        if (!target.has(parsed.name) || stack.includes(stackKey)) {
          unresolvedNames.add(stackKey);
          if (stack.includes(stackKey)) warnings.push({ code: "compat_variable_cycle", variable: parsed.name });
          output += macro.raw;
          cursor = macro.end;
          return;
        }
        const replacement = resolveText(target.get(parsed.name), [...stack, stackKey], depth + 1);
        if ((output.length + replacement.length + current.length - macro.end) > LIMITS.expandedTextChars) {
          warnings.push({ code: "compat_expansion_limit", variable: parsed.name, limit: LIMITS.expandedTextChars });
          unresolvedNames.add(stackKey);
          output += macro.raw;
          cursor = macro.end;
          return;
        }
        resolvedNames.add(stackKey);
        resolvedReferenceCount += 1;
        output += replacement;
        cursor = macro.end;
      });
      output += current.slice(cursor);
      return output;
    }

    const compatible = Boolean(
      context.sourceBlockCount > 0
      && (preset?.compatibility?.format === "external-chat-preset" || preset?.compatibility?.capabilities?.textVariables === true)
    );
    const resolvedText = compatible ? resolveText(source) : source;
    const unresolvedMacros = Array.from(new Set(scanMacros(resolvedText).map((macro) => macro.raw.trim())));
    const result = {
      text: resolvedText,
      compatible,
      sourceBlockCount: context.sourceBlockCount,
      assignmentCount: context.assignmentCount,
      definedVariableCount: context.local.size + context.shared.size,
      resolvedReferenceCount,
      resolvedVariableCount: resolvedNames.size,
      resolvedVariableNames: Array.from(resolvedNames),
      resolvedTemplateCount,
      unresolvedVariableCount: unresolvedNames.size,
      unresolvedVariableNames: Array.from(unresolvedNames),
      unresolvedTemplateCount: Math.max(0, unresolvedMacros.length - unresolvedNames.size),
      unresolvedMacros,
      warnings,
    };
    return options.withDetails === false ? result.text : result;
  }

  const api = { LIMITS, scanMacros, parseVariableMacro, buildVariableContext, resolveCompatibilityText };
  global.MercuryPresetCompatibility = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
