(function exposeMercuryPresetValidate(global) {
  "use strict";

  const content = global.MercuryPresetContent || null;
  const exclusiveGroups = (content && content.EXCLUSIVE_GROUPS) || {};

  // 校验一份 UserPreset 契约是否合法。返回 { ok, errors, warnings }，不 throw。
  // - errors：硬错误，提交前必须处理（被弹窗拦下的那类）。
  // - warnings：可继续（用户选「不更改继续」后仍能生效的那类）。
  // - 互斥组冲突精确列出「组 + 冲突候选」，供 UI 弹窗点名是哪几条撞了。
  // - 已授权（acceptedConflicts 含该组）的互斥多选不再算 error，降级为 warning（允许过就记住）。
  function validateUserPreset(preset) {
    const errors = [];
    const warnings = [];

    if (!preset || typeof preset !== "object") {
      errors.push({ code: "not_object", message: "预设必须是对象。" });
      return { ok: false, errors, warnings };
    }

    // 顶层 id / name。
    if (!(typeof preset.id === "string" && preset.id.trim())) {
      errors.push({ code: "missing_id", message: "预设缺少 id。" });
    }
    if (!(typeof preset.name === "string" && preset.name.trim())) {
      errors.push({ code: "missing_name", message: "预设缺少 name。" });
    }

    // modules 形状。
    const modules = preset.modules;
    if (!modules || typeof modules !== "object") {
      errors.push({ code: "missing_modules", message: "预设缺少 modules。" });
      return { ok: errors.length === 0, errors, warnings };
    }
    const order = modules.order;
    const enabled = modules.enabled;
    const hasEnabled = Boolean(enabled && typeof enabled === "object");
    if (!Array.isArray(order)) {
      errors.push({ code: "missing_order", message: "modules 缺少 order 数组。" });
    }
    if (!hasEnabled) {
      errors.push({ code: "missing_enabled", message: "modules 缺少 enabled 对象。" });
    }

    // 已授权冲突的组集合：这些组的重复启用不再硬拦。
    const accepted = new Set(
      (Array.isArray(preset.acceptedConflicts) ? preset.acceptedConflicts : []).map(String)
    );
    if (Array.isArray(preset.acceptedConflicts)) {
      preset.acceptedConflicts.forEach((groupName) => {
        if (!Object.prototype.hasOwnProperty.call(exclusiveGroups, String(groupName))) {
          warnings.push({ code: "unknown_accepted_group", group: String(groupName), message: "acceptedConflicts 里有未识别的组。" });
        }
      });
    }

    // 互斥组不多选：精确列出同组同时启用的候选（enabled 缺失时不检查此项）。
    if (hasEnabled) {
      const groupNames = Object.keys(exclusiveGroups);
      for (let i = 0; i < groupNames.length; i += 1) {
        const group = groupNames[i];
        const candidates = exclusiveGroups[group];
        const on = candidates.filter((c) => enabled[c] === true);
        if (on.length > 1) {
          const detail = on.map(String).join("、");
          const err = { code: "exclusive_multiple", group, conflictModules: on.slice(), message: `关系互斥组「${group}」同时启用了多条：${detail}。` };
          if (accepted.has(group)) {
            warnings.push({ ...err, code: "exclusive_multiple_accepted", message: `「${group}」已被允许的多条设定仍在生效（用户确认过）。` });
          } else {
            errors.push(err);
          }
        }
      }
    }

    // order 与 enabled 的一致性。
    if (Array.isArray(order)) {
      order.forEach((id) => {
        const key = String(id);
        if (!hasEnabled || !Object.prototype.hasOwnProperty.call(enabled, key)) {
          errors.push({ code: "order_unknown_module", moduleId: key, message: `order 里含未定义的模块「${key}」。` });
        } else if (enabled[key] !== true) {
          warnings.push({ code: "order_inactive_module", moduleId: key, message: `order 里含未启用的模块「${key}」，将被忽略。` });
        }
      });
    }

    // 未知模块：库不认且未携带文本 → 导入端可丢弃（不硬拦）。
    if (modules.texts && typeof modules.texts === "object") {
      Object.keys(modules.texts).forEach((id) => {
        if (!Object.prototype.hasOwnProperty.call(exclusiveGroups, id) && !(content && content.MODULE_TEXTS && content.MODULE_TEXTS[id])) {
          if (typeof modules.texts[id] !== "string" || !modules.texts[id].trim()) {
            warnings.push({ code: "unknown_module_no_text", moduleId: id, message: `未知模块「${id}」未带可用文本。` });
          }
        }
      });
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  const api = { validateUserPreset };
  global.MercuryPresetValidate = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
