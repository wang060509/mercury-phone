(function exposeMercuryCinemaIntermissionProjection(global) {
  "use strict";

  const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const list = (value) => Array.isArray(value) ? value : [];
  const pad = (value) => String(Math.max(1, Number(value) || 1)).padStart(2, "0");

  function chineseNumber(value) {
    const number = Math.max(1, Math.floor(Number(value) || 1));
    const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    if (number <= 10) return number === 10 ? "十" : digits[number];
    if (number < 20) return `十${digits[number - 10]}`;
    if (number < 100) return `${digits[Math.floor(number / 10)]}十${number % 10 ? digits[number % 10] : ""}`;
    return String(number);
  }

  function currentSceneFor(instance) {
    const scenes = list(instance?.scenes);
    return scenes.find((scene) => scene?.id && scene.id === instance?.currentSceneId) || scenes.at(-1) || null;
  }

  function lastCompletedAssistantOrdinal(instance) {
    let last = -1;
    list(instance?.segments).forEach((segment, ordinal) => {
      if (segment?.role === "assistant" && segment?.status !== "pending" && segment?.status !== "failed" && text(segment?.text)) last = ordinal;
    });
    return last;
  }

  function recapExcerpt(value, maximumLength = 84) {
    const normalized = text(value).replace(/\s+/g, " ");
    const limit = Math.max(24, Math.floor(Number(maximumLength) || 84));
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit - 1).trimEnd()}…`;
  }

  function buildCinemaIntermissionProjection(instanceValue, workflowValue = {}) {
    if (!instanceValue || typeof instanceValue !== "object") return null;
    const instance = instanceValue;
    const workflow = workflowValue && typeof workflowValue === "object" ? workflowValue : {};
    const provenance = instance.structureProvenance?.scenes === "runtime" ? "runtime" : "compatibility-unknown";
    const structureReliable = provenance === "runtime";
    const currentScene = structureReliable ? currentSceneFor(instance) : null;
    const assistantOrdinal = lastCompletedAssistantOrdinal(instance);
    const summaryText = text(instance.notes?.summary?.text);
    const coverageValue = instance.notes?.summary?.coveredThroughOrdinal ?? instance.notes?.coverage?.coveredThroughOrdinal ?? -1;
    const coveredThroughOrdinal = typeof coverageValue === "number" && Number.isInteger(coverageValue) ? coverageValue : -1;
    const recapReliable = Boolean(summaryText)
      && Number.isInteger(coveredThroughOrdinal)
      && assistantOrdinal >= 0
      && coveredThroughOrdinal >= assistantOrdinal;
    const pending = instance.pendingContinuation && typeof instance.pendingContinuation === "object"
      ? instance.pendingContinuation
      : null;
    const requestInFlight = workflow.phase === "running"
      && (!pending?.requestId || !workflow.requestId || workflow.requestId === pending.requestId);
    const mode = requestInFlight ? "in-flight" : pending ? "pending" : "paused";
    const stateCopy = mode === "in-flight"
      ? "续写仍在进行。返回演出可以查看当前状态。"
      : mode === "pending"
        ? "刚才写下的内容已经保留。只有你明确重试时，Mercury 才会再次请求续写。"
        : "演出暂时停在这里";
    const primaryAction = mode === "in-flight"
      ? { kind: "return-to-running", label: "返回演出" }
      : mode === "pending"
        ? { kind: "pending-recovery", label: "处理待续写" }
        : { kind: "resume", label: "继续演出" };

    return Object.freeze({
      instanceId: text(instance.id),
      title: text(instance.title, "未命名演出"),
      status: text(instance.status, "intermission"),
      mode,
      structureProvenance: provenance,
      structureReliable,
      position: currentScene ? Object.freeze({
        actNumber: Math.max(1, Number(currentScene.actNumber) || 1),
        sceneNumber: Math.max(1, Number(currentScene.sceneNumber) || 1),
        label: `第${chineseNumber(currentScene.actNumber)}幕 · 场景 ${pad(currentScene.sceneNumber)}`,
        location: text(currentScene.title),
      }) : null,
      recap: recapReliable ? recapExcerpt(summaryText) : "故事仍停在你离开的地方。回来时，可以从这里继续。",
      recapReliable,
      recapEvidence: Object.freeze({ lastCompletedAssistantOrdinal: assistantOrdinal, coveredThroughOrdinal }),
      stateCopy,
      pendingRequestId: text(pending?.requestId),
      primaryAction: Object.freeze(primaryAction),
      notesAction: Object.freeze({ kind: "notes", label: "查看场记" }),
      programmeAction: Object.freeze({ kind: "programme", label: "返回节目单" }),
    });
  }

  const api = Object.freeze({
    buildCinemaIntermissionProjection,
    currentSceneFor,
    lastCompletedAssistantOrdinal,
    recapExcerpt,
  });
  global.MercuryCinemaIntermissionProjection = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
