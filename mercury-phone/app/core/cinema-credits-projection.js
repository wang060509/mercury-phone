(function exposeMercuryCinemaCreditsProjection(global) {
  "use strict";

  const text = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const list = (value) => Array.isArray(value) ? value : [];

  function dateLabel(value) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "";
    const date = new Date(timestamp);
    return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join(".");
  }

  function narrativeWordCount(instance) {
    return list(instance?.segments).reduce((total, segment) => total + text(segment?.text).replace(/\s+/g, "").length, 0);
  }

  function reliableStructure(instance) {
    if (instance?.structureProvenance?.scenes !== "runtime") return null;
    const scenes = list(instance.scenes);
    if (!scenes.length) return null;
    const actNumbers = scenes.map((scene) => Number(scene?.actNumber)).filter((value) => Number.isInteger(value) && value > 0);
    if (actNumbers.length !== scenes.length) return null;
    return Object.freeze({ scenes: scenes.length, acts: new Set(actNumbers).size });
  }

  function buildCinemaCreditsProjection(instanceValue) {
    if (!instanceValue || typeof instanceValue !== "object" || instanceValue.status !== "ended" || !text(instanceValue.endedAt)) return null;
    const instance = instanceValue;
    const structure = reliableStructure(instance);
    const playerName = text(instance.player?.name);
    const explicitPlayerName = playerName && playerName !== "你" ? playerName : "";
    const metadata = [
      { key: "character", label: "角色", value: text(instance.characterSnapshot?.displayName, "未命名角色") },
      explicitPlayerName ? { key: "player", label: "共演", value: explicitPlayerName } : null,
      { key: "world", label: "世界", value: text(instance.stageSnapshot?.title, "未知世界") },
      { key: "opened", label: "开演", value: dateLabel(instance.createdAt) },
      { key: "ended", label: "谢幕", value: dateLabel(instance.endedAt) },
      { key: "words", label: "正文字数", value: `${narrativeWordCount(instance).toLocaleString("zh-CN")} 字` },
      structure ? { key: "structure", label: "结构", value: `${structure.acts} 幕 · ${structure.scenes} 场` } : null,
    ].filter((entry) => entry && entry.value);
    return Object.freeze({
      instanceId: text(instance.id),
      title: text(instance.title, "未命名演出"),
      closingLine: "这一场演出，至此落幕。",
      structureProvenance: structure ? "runtime" : "compatibility-unknown",
      structure,
      wordCount: narrativeWordCount(instance),
      metadata: Object.freeze(metadata.map((entry) => Object.freeze(entry))),
      closureRecord: instance.closureRecord || null,
      historyAvailable: true,
      primaryAction: Object.freeze({ kind: "history", label: "阅读完整节目册" }),
      secondaryAction: Object.freeze({ kind: "programme", label: "返回节目单" }),
    });
  }

  const api = Object.freeze({ buildCinemaCreditsProjection, dateLabel, narrativeWordCount, reliableStructure });
  global.MercuryCinemaCreditsProjection = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
