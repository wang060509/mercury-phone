(function exposeMercuryCinemaContextCompiler(global) {
  "use strict";

  const contracts = global.MercuryCinemaContracts
    || (typeof require === "function" ? require("../core/cinema-contracts.js") : null);
  const ledger = global.MercuryCinemaContinuityLedger
    || (typeof require === "function" ? require("./cinema-continuity-ledger.js") : null);

  const list = (value) => Array.isArray(value) ? value : [];
  const cleanText = (value) => typeof value === "string" ? value.trim() : "";
  const estimateTextSize = (value) => cleanText(value).length;
  const DEFAULT_TEXT_BUDGET = 24000;
  const MIN_TEXT_BUDGET = 8000;
  const MAX_TEXT_BUDGET = 48000;
  const MAX_SYSTEM_PROMPT_SIZE = 32000;
  const MAX_HISTORY_ITEMS = 30;
  const CONTINUITY_AUTHORITY = "连续性权威规则：若记录相互冲突，以 evidence ordinal 较大的明确更正或状态变化为准；较早记录仍可作为历史认知，但不再视为同等权威。";

  function recordLine(record) {
    if (typeof record === "string") return record;
    const evidence = list(record?.evidenceOrdinals).length ? ` [evidence ordinals: ${record.evidenceOrdinals.join(", ")}]` : "";
    const core = cleanText(record?.description) || [record?.who, record?.what].filter(Boolean).join(": ");
    const status = cleanText(record?.status) ? ` (${record.status})` : "";
    return core ? `${core}${status}${evidence}` : "";
  }

  function appendWithinBudget(target, entry, budget) {
    const text = cleanText(entry.text);
    if (!text) return false;
    const cost = estimateTextSize(text);
    if (target.used + cost > budget) return false;
    target.items.push(entry);
    target.used += cost;
    return true;
  }

  function currentScene(instance) {
    return list(instance.scenes).find((scene) => scene.id === instance.currentSceneId) || list(instance.scenes).at(-1) || null;
  }

  function frozenTruth(instance, profileOverride = null) {
    const scene = currentScene(instance);
    const basePrompt = contracts.buildSystemPrompt(instance, profileOverride);
    const currentStructure = instance.structureProvenance?.scenes === "runtime"
      ? `当前实际场景：${scene?.title || "未命名场景"}。Act ${scene?.actNumber || 1}, Scene ${scene?.sceneNumber || 1}。`
      : "当前演出没有可靠的 Act/Scene 结构标注。不要把兼容占位场景当作已发生的结构事实。";
    return [
      basePrompt.replace(/当前场景：[^\n]+/g, `开场情境：${instance.scenarioSnapshot.title}${instance.scenarioSnapshot.summary ? `。${instance.scenarioSnapshot.summary}` : ""}`),
      currentStructure,
    ].join("\n\n");
  }

  function continuityPayload(notes) {
    return [
      notes.people.length ? `人物状态：\n${notes.people.map(recordLine).filter(Boolean).join("\n")}` : "",
      notes.places.length ? `地点状态：\n${notes.places.map(recordLine).filter(Boolean).join("\n")}` : "",
      notes.summary.text ? `累计摘要（覆盖至 ordinal ${notes.summary.coveredThroughOrdinal}）：${notes.summary.text}` : "",
      notes.threads.length ? `未收束线索：\n${notes.threads.map(recordLine).filter(Boolean).join("\n")}` : "",
      notes.commitments.length ? `承诺与约定：\n${notes.commitments.map(recordLine).filter(Boolean).join("\n")}` : "",
      notes.importantFacts.length ? `重要事实：\n${notes.importantFacts.map(recordLine).filter(Boolean).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
  }

  function continuityBlock(instance, budget = Number.POSITIVE_INFINITY) {
    const notes = ledger.normalizeLedger(instance.notes);
    const payload = continuityPayload(notes);
    const fullText = [CONTINUITY_AUTHORITY, payload].filter(Boolean).join("\n\n");
    const admittedBudget = Number.isFinite(budget) ? Math.max(0, Math.floor(budget)) : Number.POSITIVE_INFINITY;
    if (fullText.length <= admittedBudget) return { text: fullText, ledger: notes, fullSize: fullText.length, truncated: false };
    if (admittedBudget < CONTINUITY_AUTHORITY.length) return { text: "", ledger: notes, fullSize: fullText.length, truncated: Boolean(fullText) };
    const marker = "[较早或低优先级的连续性内容已因预算省略]";
    const payloadBudget = Math.max(0, admittedBudget - CONTINUITY_AUTHORITY.length - marker.length - 4);
    let tail = payloadBudget > 0 ? payload.slice(-payloadBudget) : "";
    const firstBreak = tail.indexOf("\n");
    if (firstBreak > 0 && firstBreak < Math.floor(tail.length / 3)) tail = tail.slice(firstBreak + 1);
    return {
      text: [CONTINUITY_AUTHORITY, marker, tail].filter(Boolean).join("\n\n"),
      ledger: notes,
      fullSize: fullText.length,
      truncated: true,
    };
  }

  function recentHistory(instance, coveredThroughOrdinal, currentUserSegmentId, budget) {
    const bucket = { items: [], used: 0 };
    list(instance.segments)
      .map((segment, ordinal) => ({ segment, ordinal }))
      .filter(({ segment, ordinal }) => segment.id !== currentUserSegmentId && ordinal > coveredThroughOrdinal && segment.status === "complete" && cleanText(segment.text))
      .reverse()
      .some(({ segment, ordinal }) => bucket.items.length >= MAX_HISTORY_ITEMS || !appendWithinBudget(bucket, { role: segment.role, text: `[ordinal ${ordinal}] ${segment.text}` }, budget));
    return bucket.items.reverse();
  }

  function makeSystemPrompt(frozen, continuityText) {
    return [
      "Layer A - Frozen Truth",
      frozen,
      "Layer B - Continuity",
      continuityText,
      "Layer C - Recent / Uncovered Story",
      "未覆盖原文如有准入，将作为 history 按 ordinal 注入。",
      "Layer D - Current Turn",
      "当前用户输入只在 request.userText 中提供，不在 history 中重复。",
    ].join("\n\n");
  }

  function contextError(code, message) {
    return Object.assign(new Error(message), { code, retryable: false, recovery: "cinema-context" });
  }

  function compile(input = {}) {
    const instance = contracts.normalizeInstance(input.instance);
    const currentUserSegmentId = cleanText(input.currentUserSegmentId);
    const userSegment = list(instance.segments).find((segment) => segment.id === currentUserSegmentId);
    const userText = cleanText(input.userText || userSegment?.text);
    const requestId = cleanText(input.requestId);
    const requestedBudget = Number(input.textBudget);
    const totalBudget = Math.min(MAX_TEXT_BUDGET, Math.max(MIN_TEXT_BUDGET, Number.isFinite(requestedBudget) ? Math.floor(requestedBudget) : DEFAULT_TEXT_BUDGET));
    const frozen = frozenTruth(instance, input.profileOverride);
    const emptySystemPrompt = makeSystemPrompt(frozen, "");
    if (estimateTextSize(emptySystemPrompt) > MAX_SYSTEM_PROMPT_SIZE) {
      throw contextError("CINEMA_FROZEN_TRUTH_TOO_LARGE", "Cinema 的冻结事实超过系统提示硬上限；内容没有被静默裁剪。");
    }
    const normalizedNotes = ledger.normalizeLedger(instance.notes);
    const hasUncoveredStory = list(instance.segments).some((segment, ordinal) => segment.id !== currentUserSegmentId && ordinal > normalizedNotes.summary.coveredThroughOrdinal && segment.status === "complete" && cleanText(segment.text));
    const availableAfterRequired = Math.max(0, totalBudget - estimateTextSize(emptySystemPrompt) - estimateTextSize(userText));
    const recentReserve = hasUncoveredStory ? Math.min(4000, Math.floor(availableAfterRequired * .35)) : 0;
    const continuityBudget = Math.min(
      MAX_SYSTEM_PROMPT_SIZE - estimateTextSize(emptySystemPrompt),
      Math.max(0, availableAfterRequired - recentReserve),
    );
    const continuity = continuityBlock(instance, continuityBudget);
    const systemPrompt = makeSystemPrompt(frozen, continuity.text);
    const recentBudget = Math.max(0, totalBudget - estimateTextSize(systemPrompt) - estimateTextSize(userText));
    const history = recentHistory(instance, continuity.ledger.summary.coveredThroughOrdinal, currentUserSegmentId, recentBudget);
    const historySize = history.reduce((sum, entry) => sum + estimateTextSize(entry.text), 0);
    const actualSize = estimateTextSize(systemPrompt) + estimateTextSize(userText) + historySize;
    const request = {
      requestId,
      instanceId: instance.id,
      userText,
      systemPrompt,
      history,
      generationProfileId: cleanText(input.generationProfileId) || instance.generationProfileId,
      retry: input.retry === true,
    };
    contracts.validateGenerationRequest(request);
    return Object.freeze({
      request,
      layers: Object.freeze({ frozenTruth: frozen, continuity: continuity.text, recentHistory: history, currentTurn: userText }),
      budget: Object.freeze({
        total: totalBudget,
        actual: actualSize,
        requiredOverflow: Math.max(0, estimateTextSize(emptySystemPrompt) + estimateTextSize(userText) - totalBudget),
        continuity: continuityBudget,
        continuityFull: continuity.fullSize,
        continuityTruncated: continuity.truncated,
        recent: recentBudget,
      }),
    });
  }

  const api = { compile, estimateTextSize };
  global.MercuryCinemaContextCompiler = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
