(function exposeMercuryCinemaContinuityLedger(global) {
  "use strict";

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const list = (value) => Array.isArray(value) ? value : [];
  const cleanText = (value, fallback = "") => typeof value === "string" && value.trim() ? value.trim() : fallback;
  const nowIso = (clock = Date.now) => new Date(clock()).toISOString();

  function ordinalOf(instance, segmentId) {
    return list(instance?.segments).findIndex((segment) => segment.id === segmentId);
  }

  function normalizeEvidenceOrdinals(value) {
    return list(value).map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0);
  }

  function normalizeRecord(value, fallbackDescription = "") {
    if (typeof value === "string") return { description: value, evidenceOrdinals: [] };
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
      description: cleanText(source.description, cleanText(source.fact, cleanText(source.what, fallbackDescription))),
      status: cleanText(source.status),
      who: cleanText(source.who),
      what: cleanText(source.what),
      evidenceOrdinals: normalizeEvidenceOrdinals(source.evidenceOrdinals),
    };
  }

  function normalizeLedger(notes = {}, clock = Date.now) {
    const source = notes && typeof notes === "object" && !Array.isArray(notes) ? notes : {};
    const summarySource = source.summary && typeof source.summary === "object" ? source.summary : {};
    const summaryText = cleanText(summarySource.text, cleanText(source.overview));
    const covered = Number(summarySource.coveredThroughOrdinal ?? source.coveredThroughOrdinal ?? -1);
    return {
      overview: cleanText(source.overview, summaryText),
      summary: {
        text: summaryText,
        coveredThroughOrdinal: Number.isInteger(covered) ? Math.max(-1, covered) : -1,
      },
      timeline: list(source.timeline).map((item) => normalizeRecord(item)).filter((item) => item.description),
      people: list(source.people).map((item) => normalizeRecord(item)).filter((item) => item.description),
      places: list(source.places).map((item) => normalizeRecord(item)).filter((item) => item.description),
      threads: list(source.threads).map((item) => normalizeRecord(item)).filter((item) => item.description),
      commitments: list(source.commitments).map((item) => normalizeRecord(item)).filter((item) => item.description || item.what),
      importantFacts: list(source.importantFacts).map((item) => normalizeRecord(item)).filter((item) => item.description),
      coverage: {
        coveredThroughOrdinal: Number.isInteger(covered) ? Math.max(-1, covered) : -1,
      },
      lastFailure: source.lastFailure && typeof source.lastFailure === "object" ? clone(source.lastFailure) : null,
      updatedAt: cleanText(source.updatedAt, nowIso(clock)),
    };
  }

  function uniqueByDescription(records) {
    const seen = new Set();
    return records.filter((record) => {
      const key = [record.description, record.who, record.what].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function extractContinuity(userSegment, assistantSegment, instance) {
    const userOrdinal = ordinalOf(instance, userSegment?.id);
    const assistantOrdinal = ordinalOf(instance, assistantSegment?.id);
    const ordinals = [userOrdinal, assistantOrdinal].filter((item) => item >= 0);
    const prose = [userSegment?.text, assistantSegment?.text].filter(Boolean).join("\n");
    const facts = [];
    const commitments = [];
    const threads = [];
    const timeline = [];
    const people = [];
    const places = [];
    const currentScene = list(instance?.scenes).find((scene) => scene.id === instance?.currentSceneId) || list(instance?.scenes).at(-1);
    if (prose.trim()) timeline.push({ description: prose.slice(0, 180), evidenceOrdinals: ordinals });
    if (currentScene?.title) places.push({ description: currentScene.title, evidenceOrdinals: ordinals });
    if (instance?.characterSnapshot?.displayName) people.push({ description: instance.characterSnapshot.displayName, evidenceOrdinals: ordinals });
    const promiseMatch = prose.match(/(?:promise|promises|promised|承诺|答应|约定|保证)([^。.!?\n]{0,80})/i);
    if (promiseMatch) commitments.push({ who: instance?.characterSnapshot?.displayName || "角色", what: promiseMatch[0], status: "open", evidenceOrdinals: ordinals });
    const importantMatch = prose.match(/(?:important|remember|secret|关键|重要|记住|秘密|事实)([^。.!?\n]{0,100})/i);
    if (importantMatch) facts.push({ description: importantMatch[0], evidenceOrdinals: ordinals });
    const threadMatch = prose.match(/(?:unresolved|thread|mystery|later|未解决|线索|以后|稍后|等会)([^。.!?\n]{0,100})/i);
    if (threadMatch) threads.push({ description: threadMatch[0], status: "open", evidenceOrdinals: ordinals });
    return { timeline, people, places, commitments, importantFacts: facts, threads };
  }

  function advance(previousNotes, committedUserSegment, committedAssistantSegment, instance, options = {}) {
    const clock = options.clock || Date.now;
    if (options.fail === true) throw Object.assign(new Error("Continuity advancement failed."), { code: "CINEMA_CONTINUITY_FAILED", retryable: true });
    const previous = normalizeLedger(previousNotes, clock);
    const extracted = extractContinuity(committedUserSegment, committedAssistantSegment, instance);
    const assistantOrdinal = ordinalOf(instance, committedAssistantSegment?.id);
    const uncoveredLength = list(instance?.segments)
      .filter((_, ordinal) => ordinal > previous.summary.coveredThroughOrdinal)
      .map((segment) => segment.text || "")
      .join("\n").length;
    const shouldSummarize = options.forceSummary === true || uncoveredLength >= (Number(options.summaryThreshold) || 2400);
    const nextCovered = shouldSummarize && assistantOrdinal >= 0 ? Math.max(previous.summary.coveredThroughOrdinal, assistantOrdinal) : previous.summary.coveredThroughOrdinal;
    const summaryAddition = shouldSummarize ? list(instance?.segments)
      .filter((_, ordinal) => ordinal > previous.summary.coveredThroughOrdinal && ordinal <= nextCovered)
      .map((segment) => segment.text)
      .filter(Boolean)
      .join(" ")
      .slice(0, 900) : "";
    const summaryText = shouldSummarize
      ? [previous.summary.text, summaryAddition].filter(Boolean).join("\n").slice(-3200)
      : previous.summary.text;
    const next = {
      ...previous,
      summary: { text: summaryText, coveredThroughOrdinal: nextCovered },
      coverage: { coveredThroughOrdinal: nextCovered },
      timeline: uniqueByDescription([...previous.timeline, ...extracted.timeline]).slice(-80),
      people: uniqueByDescription([...previous.people, ...extracted.people]).slice(-50),
      places: uniqueByDescription([...previous.places, ...extracted.places]).slice(-50),
      commitments: uniqueByDescription([...previous.commitments, ...extracted.commitments]).slice(-50),
      importantFacts: uniqueByDescription([...previous.importantFacts, ...extracted.importantFacts]).slice(-80),
      threads: uniqueByDescription([...previous.threads, ...extracted.threads]).slice(-50),
      lastFailure: null,
      updatedAt: nowIso(clock),
    };
    next.overview = next.summary.text || previous.overview || list(next.timeline).at(-1)?.description || "";
    return next;
  }

  const api = { normalizeLedger, advance };
  global.MercuryCinemaContinuityLedger = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
