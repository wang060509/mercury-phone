(function exposeMercuryChatExperienceContracts(global) {
  "use strict";

  const STORAGE_KEY = "chat-experience.v1";
  const DEFAULT_CONVERSATION_SETTINGS = Object.freeze({ timeFlow: "realtime", initiative: "standard", relationshipPace: "respect_card", dramaticIntensity: "balanced", unspokenAside: "occasional", contextScope: "standard", memoryHandling: "automatic", userPresetId: "preset-default" });
  const SETTING_OPTIONS = Object.freeze({ timeFlow: ["realtime", "narrative"], initiative: ["low", "standard", "high"], relationshipPace: ["respect_card", "slow", "faster"], dramaticIntensity: ["daily", "balanced", "strong"], unspokenAside: ["off", "occasional", "often"], contextScope: ["compact", "standard", "deep"], memoryHandling: ["automatic", "confirm"] });
  const DEFAULT_APPEARANCE = Object.freeze({
    background: null,
    bubbleStyle: "default",
    chatFont: "system",
    chatFontSize: "medium",
    cropPosition: "50% 50%",
    showAvatar: true,
    showTime: true,
    showDate: true,
    messageSpacing: "comfortable",
  });
  const DEFAULT_RESOURCE_BINDINGS = Object.freeze({ runtimeProfileId: null, worldVariantId: "default", worldBookMode: "inherit", worldBookIds: Object.freeze([]), presetId: "preset-default" });
  // The starter roster is intentionally small and ordinary: it gives the
  // conversation list, contacts grid, and direct-message picker useful
  // content on a clean install without inventing any role-memory behavior.
  // Every contact remains a normal local contact and can immediately start a
  // durable, independent text conversation.
  const DEFAULT_CONTACT = Object.freeze({ id: "contact-a", name: "Mercury", identity: "摄影师", relationship: "在线", avatar: "assets/visual/mercury-contact-avatar.png", profileBackground: "assets/visual/mercury-contact-background.png", cropPosition: "50% 50%", preview: "你：晚安，明天聊。", previewTime: "2026-08-10T22:48:00.000Z" });
  const DEFAULT_CONTACTS = Object.freeze([
    DEFAULT_CONTACT,
    Object.freeze({ id: "contact-echo", name: "Echo", identity: "音乐人", relationship: "在线", avatar: "assets/archive/archive-wind-chimes-v1.webp", profileBackground: "assets/visual/mercury-contact-background.png", cropPosition: "50% 50%", preview: "最近怎么样？", previewTime: "2026-08-10T21:36:00.000Z" }),
    Object.freeze({ id: "contact-sol", name: "Sol", identity: "作家", relationship: "在线", avatar: "assets/visual/mercury-sky-avatar.png", profileBackground: "assets/visual/mercury-chat-background.png", cropPosition: "50% 50%", preview: "已发送一张图片", previewTime: "2026-08-10T18:41:00.000Z" }),
    Object.freeze({ id: "contact-lumi", name: "Lumi", identity: "设计师", relationship: "在线", avatar: "assets/visual/mercury-contact-background.png", profileBackground: "assets/visual/mercury-contact-background.png", cropPosition: "50% 50%", preview: "好的，我知道了。", previewTime: "2026-08-10T17:22:00.000Z" }),
    Object.freeze({ id: "contact-astra", name: "Astra", identity: "天文学家", relationship: "在线", avatar: "assets/archive/archive-water-starlight-v1.png", profileBackground: "assets/visual/mercury-chat-background.png", cropPosition: "50% 50%", preview: "下次一起去看海吧。", previewTime: "2026-08-10T16:05:00.000Z" }),
    Object.freeze({ id: "contact-noah", name: "Noah", identity: "咖啡店主", relationship: "在线", avatar: "assets/visual/mercury-avatar-fallback.png", profileBackground: "assets/visual/mercury-contact-background.png", cropPosition: "50% 50%", preview: "你：嗯嗯", previewTime: "2026-08-09T22:08:00.000Z" }),
    Object.freeze({ id: "contact-rhea", name: "Rhea", identity: "学生", relationship: "在线", avatar: "assets/visual/mercury-ice-avatar.png", profileBackground: "assets/visual/mercury-contact-background.png", cropPosition: "50% 50%", preview: "好久没见了。", previewTime: "2026-08-09T19:35:00.000Z" }),
    Object.freeze({ id: "contact-kai", name: "Kai", identity: "程序员", relationship: "在线", avatar: "assets/visual/mercury-sky-avatar.png", profileBackground: "assets/visual/mercury-chat-background.png", cropPosition: "50% 50%", preview: "晚些时候见。", previewTime: "2026-08-09T16:20:00.000Z" }),
  ]);
  const DEFAULT_USER = Object.freeze({ name: "Me", status: "A small place of my own.", avatar: "assets/archive/archive-glass-water-v1.webp", profileBackground: "assets/archive/archive-water-starlight-v1.png", cropPosition: "54% 55%" });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const nonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;
  function normalizeConversationSettings(value) {
    const source = isObject(value) ? value : {};
    const settings = { ...DEFAULT_CONVERSATION_SETTINGS };
    Object.keys(SETTING_OPTIONS).forEach((key) => { if (SETTING_OPTIONS[key].includes(source[key])) settings[key] = source[key]; });
    settings.userPresetId = nonEmptyText(source.userPresetId) ? source.userPresetId.trim() : DEFAULT_CONVERSATION_SETTINGS.userPresetId;
    return settings;
  }
  // Drafts sit beside a conversation transcript. They can survive leaving a
  // conversation and a refresh, but never become a message or runtime input.
  function normalizeDrafts(value) {
    if (!isObject(value)) return {};
    const drafts = {};
    Object.entries(value).forEach(([key, draft]) => {
      if (!nonEmptyText(key) || !isObject(draft) || typeof draft.text !== "string" || !draft.text) return;
      drafts[key] = {
        text: draft.text,
        updatedAt: nonEmptyText(draft.updatedAt) ? draft.updatedAt : null,
      };
    });
    return drafts;
  }
  function normalizeResourceBindings(value, contact, settings) {
    const source = isObject(value) ? value : {};
    const fallbackWorlds = Array.isArray(contact?.worldBookIds)
      ? contact.worldBookIds
      : Array.isArray(contact?.persona?.worldBindings) ? contact.persona.worldBindings : [];
    const sourceHasWorldBookIds = Array.isArray(source.worldBookIds);
    // Older sessions stored only worldBookIds. Treat those as a deliberate
    // session mapping, rather than widening back to every profile world.
    const worldBookMode = source.worldBookMode === "inherit"
      ? "inherit"
      : source.worldBookMode === "explicit" || sourceHasWorldBookIds || fallbackWorlds.length ? "explicit" : "inherit";
    const worldBookIds = Array.from(new Set((worldBookMode === "inherit" ? fallbackWorlds : sourceHasWorldBookIds ? source.worldBookIds : fallbackWorlds)
      .filter(nonEmptyText)
      .map((item) => String(item).trim())));
    return {
      runtimeProfileId: nonEmptyText(source.runtimeProfileId) ? source.runtimeProfileId.trim() : nonEmptyText(contact?.runtimeProfileId) ? String(contact.runtimeProfileId).trim() : null,
      // A world variant is part of the conversation identity. Keep it with
      // the binding so every derived runtime store can enforce the same scope.
      worldVariantId: nonEmptyText(source.worldVariantId) ? source.worldVariantId.trim() : nonEmptyText(contact?.worldVariantId) ? String(contact.worldVariantId).trim() : "default",
      worldBookMode,
      worldBookIds,
      presetId: nonEmptyText(source.presetId) ? source.presetId.trim() : settings.userPresetId,
    };
  }
  function normalizeSceneContext(value) {
    if (!isObject(value) || !nonEmptyText(value.content)) return null;
    return {
      id: nonEmptyText(value.id) ? value.id.trim() : "scene-local",
      title: nonEmptyText(value.title) ? value.title.trim().slice(0, 120) : "已选场景",
      content: value.content.trim(),
      source: nonEmptyText(value.source) ? value.source.trim() : "local",
      requirementHint: nonEmptyText(value.requirementHint) ? value.requirementHint.trim().slice(0, 180) : "",
      selectedAt: nonEmptyText(value.selectedAt) ? value.selectedAt : null,
    };
  }
  const keyFor = (contactId = "contact-a", timelineId = "default") => `${contactId}:${timelineId}`;
  function createState() {
    return {
      schemaVersion: 1,
      user: clone(DEFAULT_USER),
      contacts: Object.fromEntries(DEFAULT_CONTACTS.map((contact) => [contact.id, clone(contact)])),
      conversations: { [keyFor()]: { settings: clone(DEFAULT_CONVERSATION_SETTINGS), appearance: clone(DEFAULT_APPEARANCE), pinned: false, hidden: false, muted: false, unread: false, deleted: false } },
      drafts: {},
    };
  }
  function contactFromProfile(card) {
    const source = (card && typeof card === "object") ? card : {};
    if (isCompatibleCharacterCard(source)) return contactFromCompatibleCharacterCard(source);
    const personaFields = ["identity", "summary", "stableTraits", "motivations", "fears", "values", "boundaries", "careStyle", "conflictStyle", "defenseStyle", "voiceStyle", "cognitionLimits", "changeThresholds", "worldBindings", "background", "inner_conflict", "politics", "signature_details", "lore"];
    const persona = { displayName: source.displayName || "Untitled" };
    personaFields.forEach((key) => { if (source[key] !== undefined && source[key] !== null) persona[key] = source[key]; });
    const named = (String(source.displayName || "").toLowerCase().trim() || "character").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "character";
    const contact = { id: `profile-${named}`, name: persona.displayName, identity: source.identity || "角色卡", relationship: "来自档案馆", avatar: clone(DEFAULT_CONTACT.avatar), profileBackground: clone(DEFAULT_CONTACT.profileBackground), persona, sourceKind: "runtime-profile" };
    if (source.id) contact.runtimeProfileId = String(source.id);
    return contact;
  }
  function isCompatibleCharacterCard(source) {
    const field = (a, b) => a ?? b;
    const name = field(source.name, source.data?.name);
    const description = field(source.description, source.data?.description);
    return (source.spec === "chara_card_v2" || source.spec_version !== undefined || Object.prototype.hasOwnProperty.call(source, "character_book")) && (name || description);
  }
  function contactFromCompatibleCharacterCard(source) {
    const pick = (...keys) => { for (const k of keys) { const v = (source[k] !== undefined && source[k] !== null) ? source[k] : source.data?.[k]; if (v !== undefined && v !== null) return v; } return undefined; };
    const name = String(pick("name", "displayName") ?? "Untitled");
    const named = (name.toLowerCase().trim() || "character").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "character";
    const str = (v) => (typeof v === "string" && v) ? v : undefined;
    const persona = { displayName: name };
    const background = str(pick("description"));
    if (background) persona.background = background;
    const traits = str(pick("personality"));
    if (traits) persona.stableTraits = traits;
    const world = str(pick("scenario"));
    if (world) persona.worldBindings = world;
    const dialogue = str(pick("mes_example"));
    if (dialogue) persona.voiceStyle = dialogue;
    const opening = str(pick("first_mes"));
    if (opening) persona.signature_details = opening;
    return { id: `profile-${named}`, name, identity: "角色卡", relationship: "导入的角色卡", avatar: clone(DEFAULT_CONTACT.avatar), profileBackground: clone(DEFAULT_CONTACT.profileBackground), persona, sourceKind: "compatible-character-card" };
  }
  function normalize(value) {
    const base = createState();
    if (!value || typeof value !== "object" || value.schemaVersion !== 1) return base;
    const safe = clone(base);
    safe.user = { ...safe.user, ...(value.user || {}) };
    safe.contacts = { ...safe.contacts, ...(value.contacts || {}) };
    safe.conversations = { ...safe.conversations, ...(value.conversations || {}) };
    safe.drafts = normalizeDrafts(value.drafts);
    Object.keys(safe.conversations).forEach((key) => {
      const item = safe.conversations[key] || {};
      const settings = normalizeConversationSettings(item.settings);
      const contactId = key.split(":")[0];
      safe.conversations[key] = { settings, appearance: { ...DEFAULT_APPEARANCE, ...(item.appearance || {}) }, resourceBindings: normalizeResourceBindings(item.resourceBindings, safe.contacts[contactId], settings), sceneContext: normalizeSceneContext(item.sceneContext), pinned: Boolean(item.pinned), hidden: Boolean(item.hidden), muted: Boolean(item.muted), unread: Boolean(item.unread), deleted: Boolean(item.deleted) };
    });
    return safe;
  }
  global.MercuryChatExperienceContracts = Object.freeze({ STORAGE_KEY, DEFAULT_CONVERSATION_SETTINGS, DEFAULT_APPEARANCE, DEFAULT_RESOURCE_BINDINGS, DEFAULT_CONTACT, DEFAULT_CONTACTS, DEFAULT_USER, keyFor, createState, normalize, normalizeDrafts, normalizeResourceBindings, normalizeSceneContext, contactFromProfile });
})(window);
