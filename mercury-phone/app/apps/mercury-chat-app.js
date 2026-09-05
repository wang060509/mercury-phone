(function exposeMercuryChatApp(global) {
  "use strict";

  const ICON_ROOT = "assets/icons/iconoir/";
  const MERCURY_ICON = Object.freeze({
    add: "plus-circle",
    attachment: "attachment",
    back: "nav-arrow-left",
    copy: "copy",
    delete: "trash",
    emoji: "emoji",
    gallery: "media-image",
    more: "more-horiz",
    quote: "quote-message",
    regenerate: "refresh-double",
    search: "search",
    send: "send",
  });
  const VISUAL_CHAT_BACKGROUND = "assets/visual/mercury-chat-background.png";
  const VISUAL_CONTACT_AVATAR = "assets/visual/mercury-contact-avatar.png";
  const VISUAL_CONTACT_BACKGROUND = "assets/visual/mercury-contact-background.png";
  const AVATAR_FALLBACK = "assets/visual/mercury-avatar-fallback.png";
  const LEGACY_DEFAULT_CONTACT_AVATAR = "assets/wallpapers/rain-window-leaves-v1.webp";
  const LEGACY_DEFAULT_CONTACT_BACKGROUND = "assets/archive/archive-wind-chimes-v1.webp";
  const HISTORY_PAGE_SIZE = 40;
  const MESSAGE_LONG_PRESS_DELAY_MS = 480;
  const MESSAGE_LONG_PRESS_MOVE_PX = 12;
  const MESSAGE_LONG_PRESS_CLICK_BLOCK_MS = 650;
  const CHAT_FALLBACK_LABELS = Object.freeze({
    "chat.filterLabel": "\u4f1a\u8bdd\u7b5b\u9009",
    "chat.filterAll": "\u5168\u90e8",
    "chat.filterPinned": "\u7f6e\u9876",
    "chat.filterUnread": "\u672a\u8bfb",
    "chat.filterMuted": "\u9759\u97f3",
    "chat.filterHidden": "\u9690\u85cf",
    "chat.threadMore": "\u4f1a\u8bdd\u66f4\u591a\u64cd\u4f5c",
    "chat.settingsShort": "\u8bbe\u7f6e",
    "chat.personaShort": "\u8d44\u6599",
    "chat.viewPersona": "\u67e5\u770b\u89d2\u8272\u8d44\u6599",
    "chat.presetShort": "\u9884\u8bbe",
    "chat.contactOnline": "\u5728\u7ebf",
    "chat.importRoleCard": "\u5bfc\u5165\u89d2\u8272\u5361",
    "chat.cancelShort": "\u53d6\u6d88",
    "chat.newConversationTitle": "新建对话",
    "chat.chooseContact": "选择一个联系人，开始一段新的空会话。",
    "chat.startConversation": "开始聊天",
    "chat.emptyConversation": "新的空会话",
    "chat.showHidden": "显示已隐藏",
    "chat.hideHidden": "收起已隐藏",
    "chat.pinned": "置顶",
    "chat.muted": "静音",
    "chat.unread": "未读",
    "chat.hidden": "已隐藏",
    "chat.conversationSettingsTitle": "当前对话设置",
    "chat.pinConversation": "置顶会话",
    "chat.unpinConversation": "取消置顶",
    "chat.muteConversation": "静音会话",
    "chat.unmuteConversation": "取消静音会话",
    "chat.hideConversation": "隐藏会话",
    "chat.unhideConversation": "显示会话",
    "chat.viewContact": "查看联系人",
    "chat.conversationActions": "会话操作",
    "chat.searchHistory": "搜索聊天记录",
    "chat.historySearchTitle": "聊天记录",
    "chat.historySearchPlaceholder": "搜索消息",
    "chat.loadEarlier": "加载更早消息",
    "chat.historyNoResults": "没有找到匹配的消息",
    "chat.copyMessage": "复制",
    "chat.copiedMessage": "已复制",
    "chat.quoteMessage": "引用",
    "chat.cancelQuote": "取消引用",
    "chat.retryMessage": "重试",
    "chat.regenerateMessage": "重新回复",
    "chat.deleteMessage": "删除",
    "chat.messageActions": "消息操作",
    "chat.closeMessageActions": "关闭消息操作",
    "chat.messageUser": "我的消息",
    "chat.messageAssistant": "角色消息",
    "chat.typing": "角色正在回复",
    "chat.send": "发送",
    "chat.cancelRequest": "停止回复",
    "chat.delivery.sending": "正在发送",
    "chat.delivery.queued": "正在发送",
    "chat.delivery.processing": "正在发送",
    "chat.delivery.complete": "已发送",
    "chat.delivery.failed": "发送失败，可重试",
    "chat.delivery.cancelled": "已取消，可重试",
    "chat.previousVersion": "上一版",
    "chat.nextVersion": "下一版",
    "chat.messageVersion": "版本",
    "chat.imageMessage": "图片",
    "chat.emojiMessage": "表情",
    "chat.removeAttachment": "移除附件",
    "chat.imageTooLarge": "图片不能超过 2 MB",
    "chat.imageUnsupported": "请选择 PNG、JPG、GIF 或 WebP 图片",
    "contacts.importStorageError": "角色卡已识别，但本地保存失败；原有数据未改动，请检查浏览器存储后重试。",
  });

  class MercuryChatAppController {
    constructor(options = {}) {
      this.dateTimeFormat = options.dateTimeFormat || global.Intl.DateTimeFormat;
      this.messageLongPressDelayMs = Number.isFinite(options.messageLongPressDelayMs) ? Math.max(0, options.messageLongPressDelayMs) : MESSAGE_LONG_PRESS_DELAY_MS;
      this.messageLongPressMovePx = Number.isFinite(options.messageLongPressMovePx) ? Math.max(1, options.messageLongPressMovePx) : MESSAGE_LONG_PRESS_MOVE_PX;
      this.messageLongPressClickBlockMs = Number.isFinite(options.messageLongPressClickBlockMs) ? Math.max(0, options.messageLongPressClickBlockMs) : MESSAGE_LONG_PRESS_CLICK_BLOCK_MS;
      this.scheduleTimeout = options.scheduleTimeout || ((callback, delay) => global.setTimeout(callback, delay));
      this.cancelTimeout = options.cancelTimeout || ((timerId) => global.clearTimeout(timerId));
      this.clock = options.now || (() => Date.now());
      this.messagePress = null;
      this.suppressedMessageClick = null;
    }

    render(root, context) {
      this.root = root;
      this.context = context;
      context.state ||= {};
      this.presentationAdapter = global.MercuryPresentationAdapter || null;
      this.ui = context.state.mercuryChatUi || { route: this.presentationAdapter?.initialRoute || "chats", selectedMessageId: null, panelOpen: false, selectedContactId: "contact-a", selectedTimelineId: "default", showHidden: false };
      context.state.mercuryChatUi = this.ui;
      this.ui.selectedTimelineId ||= "default";
      this.ui.showHidden ||= false;
      this.ui.chatFilter ||= "all";
      this.ui.threadMenuKey ||= null;
      this.ui.composerParts = Array.isArray(this.ui.composerParts) ? this.ui.composerParts : [];
      this.ui.emojiPickerOpen ||= false;
      this.experienceStorage = context.services?.sharedStorage || context.services?.storage;
      this.experience = global.MercuryChatExperienceContracts.normalize(this.experienceStorage?.get(global.MercuryChatExperienceContracts.STORAGE_KEY, null));
      if (!global.MercuryConversationStore) throw new Error("Conversation Store is unavailable.");
      this.conversationStore = new global.MercuryConversationStore({ storage: context.services?.storage || null });
      const ConversationTransfer = global.MercuryConversationTransferWorkflow;
      this.conversationTransfer = ConversationTransfer && context.services?.storage && this.experienceStorage
        ? new ConversationTransfer({
          conversationStorage: context.services.storage,
          experienceStorage: this.experienceStorage,
          conversationStore: this.conversationStore,
        })
        : null;
      this.archiveStore = this.experienceStorage && global.MercuryArchiveContracts?.createArchiveStore?.(this.experienceStorage);
      this.repairSerializedRoleImports();
      this.repairImportedRoleProfiles();
      this.migrateVisualDefaults();
      this.presetStore = null;
      this.presetAssemble = null;
      this.initPresetLayer();
      const ResourceIntake = global.MercuryResourceIntakeWorkflow;
      this.resourceIntake = ResourceIntake && this.archiveStore
        ? new ResourceIntake({ storage: this.experienceStorage, archiveStore: this.archiveStore, profileStore: this.presetStore })
        : null;
      const VectorMemoryStore = global.MercuryVectorMemoryStore?.MercuryVectorMemoryStore;
      this.vectorMemoryStore = VectorMemoryStore ? new VectorMemoryStore() : null;
      const LocalEmbeddingRuntime = global.MercuryLocalEmbeddingRuntime?.LocalEmbeddingRuntime;
      this.localEmbeddingRuntime = LocalEmbeddingRuntime ? new LocalEmbeddingRuntime() : null;
      this.vectorMemoryState = context.state.mercuryVectorMemoryState || { mode: "keyword", semanticEnabled: false, lastError: null, lastRecall: null };
      this.vectorMemoryState.semanticEnabled = this.vectorMemoryState.semanticEnabled === true;
      this.vectorMemoryState.prepareToken = Number.isInteger(this.vectorMemoryState.prepareToken) ? this.vectorMemoryState.prepareToken : 0;
      this.vectorMemoryState.prepareProgress = this.vectorMemoryState.prepareProgress || null;
      context.state.mercuryVectorMemoryState = this.vectorMemoryState;
      this.messageSource = "stored";
      this.messages = this.resolveMessages();
      context.state.mercuryChatMessages = this.messages;
      global.dispatchEvent?.(new global.Event("mercury:chat-ready"));
      this.messageSequence = 0;
      this.timelineSequence = 0;
      root.classList.add("mercury-chat-app");
      root.dataset.chatStage = "conversation-shell";
      root.setAttribute("aria-label", this.t("apps.mercuryChat"));
      if (!global.MercuryChatGenerationWorkflow) throw new Error("Chat Generation Workflow is unavailable.");
      this.generationWorkflow = this.createGenerationWorkflow();
      this.ui.pending = false;
      if (typeof document !== "undefined" && typeof root.replaceChildren === "function") this.paint();
    }

    onMount() { this.root.dataset.lifecycle = "mounted"; }
    onPause() {
      this.cancelMessageLongPress();
      if (this.ui) this.ui.messageActionSheetId = null;
      this.root.dataset.lifecycle = "paused";
    }
    onResume() {
      this.root.dataset.lifecycle = "resumed";
      if (this.context?.services?.storage || this.context?.services?.sharedStorage) {
        this.experienceStorage = this.context.services.sharedStorage || this.context.services.storage;
        this.experience = global.MercuryChatExperienceContracts.normalize(this.experienceStorage.get(global.MercuryChatExperienceContracts.STORAGE_KEY, null));
        if (typeof this.paint === "function") this.paint();
      }
    }
    onUnmount() { this.cancelMessageLongPress(); this.cancelRequest({ silent: true }); this.generationWorkflow = null; this.resourceIntake = null; this.conversationTransfer = null; this.root = null; this.context = null; this.ui = null; this.conversationStore = null; }

    t(key) {
      const translated = this.context.i18n?.t(key);
      return translated && translated !== key ? translated : CHAT_FALLBACK_LABELS[key] || translated || key;
    }
    resolveMessages() {
      if (this.context.state.mercuryChatMessages) return this.context.state.mercuryChatMessages;
      return this.loadPersistedMessages();
    }
    activeContactId() { return this.ui.selectedContactId && this.experience.contacts[this.ui.selectedContactId] ? this.ui.selectedContactId : "contact-a"; }
    activeTimelineId() { return this.ui.selectedTimelineId || "default"; }
    activeContact() { return this.experience.contacts[this.activeContactId()] || this.experience.contacts["contact-a"]; }
    conversationKeyFor(contactId, timelineId = "default") {
      return this.conversationStore.keyFor(contactId, timelineId);
    }
    loadPersistedMessages(contactId = this.activeContactId(), timelineId = this.activeTimelineId()) {
      const fallback = contactId === "contact-a" ? global.MercuryChatData.contactAStaticMessages() : [];
      const loaded = this.conversationStore.load(contactId, timelineId, { fallbackMessages: fallback });
      this.conversation = loaded.conversation;
      // An explicitly persisted empty conversation means the user cleared it.
      // Only an absent storage record may fall back to the starter transcript.
      return loaded.messages.length || loaded.hadStoredValue ? global.MercuryChatData.hydrateMessages({ messages: loaded.messages }, fallback) : fallback;
    }
    persistMessages() {
      this.context.state.mercuryChatMessages = this.messages;
      this.conversation ||= global.MercuryChatContracts.loadConversation(null).conversation;
      this.conversation = this.conversationStore.save(this.activeContactId(), this.activeTimelineId(), this.conversation);
    }
    createGenerationWorkflow() {
      const aiTransport = this.context.services?.aiTransport;
      const generation = typeof aiTransport?.chat === "function" ? {
        ...(typeof aiTransport.connectionStatus === "function" ? { preflight: () => aiTransport.connectionStatus() } : {}),
        generate: async ({ message, previousEntries, requestId, signal }) => {
          const memoryResolution = await this.recallMemoryForMessage(message);
          if (signal?.aborted) {
            const error = new Error("Generation aborted.");
            error.name = "AbortError";
            throw error;
          }
          return aiTransport.chat(this.buildAssistantRequest(message, previousEntries, requestId, memoryResolution), { signal });
        },
      } : null;
      return new global.MercuryChatGenerationWorkflow({
        contracts: global.MercuryChatContracts,
        generation,
        host: {
          read: () => ({ conversation: this.conversation, scope: { contactId: this.activeContactId(), timelineId: this.activeTimelineId() } }),
          commit: (conversation, meta) => this.commitGenerationConversation(conversation, meta),
          changed: (snapshot) => this.applyGenerationSnapshot(snapshot),
          effect: (event) => this.applyGenerationEffect(event),
        },
      });
    }
    commitGenerationConversation(conversation, meta = {}) {
      const contactId = meta.scope?.contactId || this.activeContactId();
      const timelineId = meta.scope?.timelineId || this.activeTimelineId();
      const saved = this.conversationStore.save(contactId, timelineId, conversation);
      if (contactId === this.activeContactId() && timelineId === this.activeTimelineId()) {
        this.conversation = saved;
        this.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(saved));
        this.context.state.mercuryChatMessages = this.messages;
      }
      return saved;
    }
    applyGenerationSnapshot(snapshot) {
      if (!this.ui) return;
      this.ui.pending = snapshot.phase === "running";
      this.ui.generationError = snapshot.phase === "failed" ? Object.freeze({
        ...(snapshot.error || {}),
        operation: snapshot.operation || null,
        messageId: snapshot.messageId || null,
      }) : null;
      this.ui.lastError = snapshot.phase === "failed"
        ? (snapshot.error?.kind === "cancelled" ? this.t("chat.delivery.cancelled") : snapshot.error?.message || "Generation failed.")
        : null;
      if (this.root && typeof this.paint === "function") this.paint();
    }
    clearGenerationError() {
      if (!this.ui) return;
      this.ui.generationError = null;
      this.ui.lastError = null;
    }
    applyGenerationEffect(event) {
      if (event?.type !== "assistant-completed") return;
      this.markAssistantActivity(event.request, event.assistantTurn);
      if (event.operation !== "regenerate") {
        this.queueMemoryCandidates(event.response?.memoryCandidates, { requestId: event.request.requestId, userMessageId: event.request.userMessageId, assistantTurnId: event.response?.assistantTurn?.id, timelineId: event.request.timelineId });
      }
    }
    roleSceneState(contactId = this.activeContactId()) {
      const contact = this.experience.contacts[contactId];
      if (!contact) return { candidates: [], rejected: [], rawCount: 0 };
      const archive = global.MercuryArchiveContracts;
      const storage = this.context?.services?.sharedStorage || this.context?.services?.storage;
      const profile = archive && contact.runtimeProfileId && typeof storage?.get === "function"
        ? archive.normalizeArchiveState(storage.get(archive.STORAGE_KEY, null)).runtimeProfiles.find((item) => item.id === contact.runtimeProfileId)
        : null;
      const raw = [
        { id: "opening", source: "角色卡首条", content: profile?.openingMessage || contact.persona?.openingMessage || "" },
        ...(Array.isArray(profile?.alternateGreetings) ? profile.alternateGreetings.map((content, index) => ({ id: `alternate-${index + 1}`, source: "角色卡备选", content })) : []),
      ];
      const rejected = [];
      const candidates = raw.map((item, index) => {
        const content = String(item.content || "").trim();
        if (!content) {
          rejected.push({ id: item.id, source: item.source, reason: "empty" });
          return null;
        }
        if (/(?:^|\n)\s*(?:作者|卡名|测试模型)[：:]|右划开场白|二传|食用愉快/.test(content)) {
          rejected.push({ id: item.id, source: item.source, reason: "source-metadata" });
          return null;
        }
        const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const hintLine = lines.find((line) => /^[\[【].*[\]】]$/.test(line) && /世界书|身份|路线|支线/.test(line)) || "";
        const titleLine = lines.find((line) => /^「.+」$/.test(line)) || lines.find((line) => !/^[\[【>]/.test(line)) || "";
        return { id: item.id, title: titleLine.replace(/^「|」$/g, "").slice(0, 80) || `场景 ${index + 1}`, content, source: item.source, requirementHint: hintLine.replace(/^[\[【]|[\]】]$/g, "") };
      }).filter(Boolean);
      return { candidates, rejected, rawCount: raw.length };
    }
    roleSceneCandidates(contactId = this.activeContactId()) { return this.roleSceneState(contactId).candidates; }
    archiveState() {
      const archive = global.MercuryArchiveContracts;
      const storage = this.context?.services?.sharedStorage || this.context?.services?.storage;
      return archive && typeof storage?.get === "function" ? archive.normalizeArchiveState(storage.get(archive.STORAGE_KEY, null)) : null;
    }
    contactImportSource(contact) {
      const state = contact?.runtimeProfileId ? this.archiveState() : null;
      const profile = state?.runtimeProfiles?.find((item) => item.id === contact.runtimeProfileId) || null;
      const asset = profile?.sourceAssetId ? state.sourceAssets?.find((item) => item.id === profile.sourceAssetId) || null : null;
      const filename = String(asset?.filename || "").split(/[\\/]/).filter(Boolean).at(-1) || null;
      if (filename) return { kind: "local-import", filename, importedAt: asset.importedAt || null, sourceAssetId: asset.id };
      if (contact?.runtimeProfileId || contact?.sourceKind) return { kind: "local-archive", filename: null, importedAt: null, sourceAssetId: profile?.sourceAssetId || null };
      return { kind: "built-in", filename: null, importedAt: null, sourceAssetId: null };
    }
    contactSourceLabel(contact) {
      const source = this.contactImportSource(contact);
      const base = source.kind === "local-import" ? `本地导入 · ${source.filename}` : source.kind === "local-archive" ? "本地档案" : "Mercury 内置";
      const sameName = this.sameNameContacts(contact);
      if (sameName.length < 2) return base;
      const sameSource = sameName.filter((item) => {
        const candidate = this.contactImportSource(item);
        return candidate.kind === source.kind && candidate.filename === source.filename;
      });
      if (sameSource.length < 2) return base;
      const copyIndex = sameSource.findIndex((item) => item.id === contact.id) + 1;
      return copyIndex > 0 ? `${base} · 副本 ${copyIndex}` : base;
    }
    sameNameContacts(contact) {
      const name = String(contact?.name || "").trim().toLocaleLowerCase();
      return name ? Object.values(this.experience.contacts).filter((item) => String(item?.name || "").trim().toLocaleLowerCase() === name) : [];
    }
    sameNameContactCount(contact) {
      return this.sameNameContacts(contact).length;
    }
    recordCharacterImport(result) {
      const contact = result?.contact;
      if (!contact || !this.ui) return null;
      this.ui.newConversationQuery = "";
      const opening = this.roleSceneState(contact.id);
      this.ui.importReceipt = {
        ...(result.outcome || {}),
        contactId: contact.id,
        displayName: contact.name,
        filename: result.outcome?.filename || result.sourceAsset?.filename || null,
        importedAt: result.sourceAsset?.importedAt || null,
        sameNameContactCount: result.outcome?.sameNameContactCount || this.sameNameContactCount(contact),
        sceneCandidateCount: opening.candidates.length,
        rejectedOpeningCount: opening.rejected.filter((item) => item.reason === "source-metadata").length,
      };
      return this.ui.importReceipt;
    }
    importReceiptView() {
      const receipt = this.ui?.importReceipt;
      const contact = receipt?.contactId ? this.experience.contacts[receipt.contactId] : null;
      if (!receipt || !contact) return null;
      const section = document.createElement("section");
      section.className = "mercury-chat-import-receipt";
      section.dataset.contactId = contact.id;
      const title = document.createElement("h2");
      title.textContent = `已导入 ${contact.name}`;
      const detail = document.createElement("p");
      const parts = [];
      if (receipt.filename) parts.push(`来源：${String(receipt.filename).split(/[\\/]/).filter(Boolean).at(-1)}`);
      if (receipt.sameNameContactCount > 1) parts.push(`同名角色 ${receipt.sameNameContactCount} 个，已按来源标记`);
      if (receipt.sceneCandidateCount > 0) parts.push(`找到 ${receipt.sceneCandidateCount} 个可用开场`);
      else parts.push(receipt.rejectedOpeningCount > 0 ? "未找到可用开场，已跳过来源说明" : "未找到可用开场");
      detail.textContent = parts.join(" · ");
      const actions = document.createElement("div");
      actions.className = "mercury-chat-import-receipt__actions";
      const primaryText = receipt.sceneCandidateCount > 0 ? "选择开场" : "开始空白聊天";
      const primary = this.button(primaryText, "mercury-chat-import-receipt__primary", receipt.sceneCandidateCount > 0 ? "spark" : "chat-bubble");
      const primaryLabel = document.createElement("span");
      primaryLabel.textContent = primaryText;
      primary.append(primaryLabel);
      primary.addEventListener("click", () => {
        if (receipt.sceneCandidateCount > 0) {
          this.ui.selectedContactId = contact.id;
          this.ui.sceneCandidateId = this.roleSceneCandidates(contact.id)[0]?.id || null;
          this.ui.route = "sceneLibrary";
          this.paint();
          return;
        }
        this.startNewConversation(contact.id);
      });
      actions.append(primary);
      if (receipt.sceneCandidateCount > 0) {
        const blank = this.button("直接空白聊天", "mercury-chat-import-receipt__blank");
        const blankLabel = document.createElement("span");
        blankLabel.textContent = "直接空白聊天";
        blank.append(blankLabel);
        blank.addEventListener("click", () => this.startNewConversation(contact.id));
        actions.append(blank);
      }
      const dismiss = this.button("稍后", "mercury-chat-import-receipt__dismiss");
      const dismissLabel = document.createElement("span");
      dismissLabel.textContent = "稍后";
      dismiss.append(dismissLabel);
      dismiss.addEventListener("click", () => { this.ui.importReceipt = null; this.paint(); });
      actions.append(dismiss);
      section.append(title, detail, actions);
      return section;
    }
    defaultTimelineForContact(contactId) {
      const archive = global.MercuryArchiveContracts;
      const storage = this.context?.services?.sharedStorage || this.context?.services?.storage;
      const contact = this.experience.contacts[contactId] || null;
      if (!archive || typeof storage?.get !== "function" || !contact?.runtimeProfileId) return "default";
      const instances = archive.normalizeArchiveState(storage.get(archive.STORAGE_KEY, null)).contactInstances
        .filter((item) => item.active !== false && item.runtimeProfileId === contact.runtimeProfileId);
      const exact = instances.find((item) => item.chatContactId === contactId);
      return exact?.timelineId || (instances.length === 1 ? instances[0].timelineId : "default");
    }
    openConversation(contactId, timelineId = null) {
      timelineId ||= this.defaultTimelineForContact(contactId);
      const scopeChanged = contactId !== this.activeContactId() || timelineId !== this.activeTimelineId();
      this.cancelRequest({ silent: true });
      if (scopeChanged) this.clearGenerationError();
      this.ui.selectedContactId = contactId;
      this.ui.selectedTimelineId = timelineId;
      this.ui.draft = this.draftFor(contactId, timelineId);
      this.messages = this.loadPersistedMessages(contactId, timelineId);
      if (this.conversation && this.conversation.id === "conversation-default") this.conversation = { ...this.conversation, id: `${contactId}:direct` };
      this.resetHistoryWindow(contactId, timelineId);
      this.ui.messageViewportIntent = { kind: "latest" };
      this.context.state.mercuryChatMessages = this.messages;
      const state = this.experienceFor(contactId, timelineId);
      state.deleted = false;
      state.unread = false;
      this.saveExperience();
      this.ui.route = "conversation";
      this.ui.selectedMessageId = null;
      this.paint();
    }
    conversationPreview(contactId, timelineId = "default") {
      const messages = this.conversationStore.load(contactId, timelineId).messages;
      const sceneContext = this.experienceFor(contactId, timelineId).sceneContext;
      const fallback = sceneContext?.title ? `场景：${sceneContext.title}` : (this.experience.contacts[contactId]?.preview || "");
      return this.messagePreview(messages.at(-1)) || fallback;
    }
    hasConversationContent(contactId) {
      const prefix = `${contactId}:`;
      const stateKeys = Object.keys(this.experience.conversations)
        .filter((key) => key.startsWith(prefix));
      const timelineIds = new Set([this.defaultTimelineForContact(contactId), ...stateKeys.map((key) => key.slice(prefix.length) || "default")]);
      return Array.from(timelineIds).some((timelineId) => {
        return this.conversationStore.load(contactId, timelineId).messages.length > 0
          || Boolean(this.experienceFor(contactId, timelineId).sceneContext);
      });
    }
    previewTime(contactId, timelineId = "default") {
      return this.conversationStore.load(contactId, timelineId).messages.at(-1)?.createdAt || this.experience.contacts[contactId]?.previewTime || null;
    }
    conversationItems() {
      const items = [];
      Object.values(this.experience.contacts).forEach((contact) => {
        const prefix = `${contact.id}:`;
        const keys = Object.keys(this.experience.conversations).filter((key) => key === `${prefix}default` || key.startsWith(prefix));
        const defaultTimelineId = this.defaultTimelineForContact(contact.id);
        const conversationKeys = Array.from(new Set(keys.length ? keys : [`${prefix}${defaultTimelineId}`]));
        conversationKeys.forEach((key) => {
          const timelineId = key.slice(prefix.length) || "default";
          const state = this.experienceFor(contact.id, timelineId);
          if (state.deleted) return;
          items.push({ contact, timelineId, state, preview: this.conversationPreview(contact.id, timelineId), previewTime: this.previewTime(contact.id, timelineId) });
        });
      });
      return items;
    }
    markAssistantActivity(request, assistantTurn) {
      const state = this.experienceFor(request.contactId, request.timelineId);
      const isActive = this.ui.route === "conversation" && this.activeContactId() === request.contactId && this.activeTimelineId() === request.timelineId;
      state.unread = !isActive;
      this.saveExperience();
      // Muted and hidden conversations still retain unread state, but they do
      // not surface a system notification. This makes the two controls affect
      // delivery behavior rather than only changing a visual flag.
      if (isActive || state.muted || state.hidden || typeof this.context.services?.notify !== "function") return;
      const preview = Array.isArray(assistantTurn?.parts)
        ? assistantTurn.parts.map((part) => part?.text || "").join("").trim()
        : String(assistantTurn?.text || "").trim();
      try {
        this.context.services.notify({
          id: `conversation:${request.contactId}:${request.timelineId}:${assistantTurn?.id || request.requestId}`,
          title: this.activeContact()?.name || request.contactId,
          body: preview.slice(0, 120),
        });
      } catch (_) {
        // Notification delivery is best-effort; conversation state remains
        // durable even when a host has no notification bridge.
      }
    }
    startNewConversation(contactId) {
      if (!this.experience.contacts[contactId]) return false;
      this.cancelRequest({ silent: true });
      this.clearGenerationError();
      const timelineId = `timeline-${Date.now()}-${++this.timelineSequence}`;
      this.ui.selectedContactId = contactId;
      this.ui.selectedTimelineId = timelineId;
      this.ui.draft = this.draftFor(contactId, timelineId);
      this.ui.selectedMessageId = null;
      this.ui.showHidden = false;
      this.conversation = { ...global.MercuryChatContracts.loadConversation(null).conversation, id: `${contactId}:${timelineId}` };
      this.messages = Object.freeze([]);
      this.resetHistoryWindow(contactId, timelineId);
      this.ui.messageViewportIntent = { kind: "latest" };
      this.context.state.mercuryChatMessages = this.messages;
      const state = this.experienceFor(contactId, timelineId);
      state.unread = false;
      this.saveExperience();
      this.persistMessages();
      if (this.ui.importReceipt?.contactId === contactId) this.ui.importReceipt = null;
      this.ui.route = "conversation";
      this.paint();
      return true;
    }
    startSceneConversation(contactId, candidate) {
      if (!this.experience.contacts[contactId] || !candidate?.content) return false;
      this.cancelRequest({ silent: true });
      this.clearGenerationError();
      const timelineId = `scene-${Date.now()}-${++this.timelineSequence}`;
      this.ui.selectedContactId = contactId;
      this.ui.selectedTimelineId = timelineId;
      this.ui.draft = "";
      this.ui.selectedMessageId = null;
      this.conversation = { ...global.MercuryChatContracts.loadConversation(null).conversation, id: `${contactId}:${timelineId}` };
      this.messages = Object.freeze([]);
      this.resetHistoryWindow(contactId, timelineId);
      this.ui.messageViewportIntent = { kind: "latest" };
      this.context.state.mercuryChatMessages = this.messages;
      const state = this.experienceFor(contactId, timelineId);
      state.unread = false;
      state.sceneContext = global.MercuryChatExperienceContracts.normalizeSceneContext({ ...candidate, source: "role-card", selectedAt: new Date().toISOString() });
      this.saveExperience();
      this.persistMessages();
      if (this.ui.importReceipt?.contactId === contactId) this.ui.importReceipt = null;
      this.ui.route = "conversation";
      this.paint();
      return true;
    }
    saveExperience() { this.experienceStorage?.set(global.MercuryChatExperienceContracts.STORAGE_KEY, this.experience); }
    conversationUiKeyFor(contactId = this.activeContactId(), timelineId = this.activeTimelineId()) {
      return global.MercuryChatExperienceContracts.keyFor(contactId, timelineId);
    }
    draftKeyFor(contactId = this.activeContactId(), timelineId = this.activeTimelineId()) {
      return this.conversationUiKeyFor(contactId, timelineId);
    }
    draftFor(contactId = this.activeContactId(), timelineId = this.activeTimelineId()) {
      const draft = this.experience?.drafts?.[this.draftKeyFor(contactId, timelineId)];
      return typeof draft?.text === "string" ? draft.text : "";
    }
    saveDraft(text = this.ui.draft) {
      const next = String(text ?? "");
      const key = this.draftKeyFor();
      this.experience.drafts ||= {};
      if (next) this.experience.drafts[key] = { text: next, updatedAt: new Date().toISOString() };
      else delete this.experience.drafts[key];
      this.ui.draft = next;
      this.saveExperience();
    }
    clearDraft(contactId = this.activeContactId(), timelineId = this.activeTimelineId(), options = {}) {
      const key = this.draftKeyFor(contactId, timelineId);
      if (this.experience?.drafts) delete this.experience.drafts[key];
      if (contactId === this.activeContactId() && timelineId === this.activeTimelineId()) this.ui.draft = "";
      if (options.persist !== false) this.saveExperience();
    }
    resetHistoryWindow(contactId = this.activeContactId(), timelineId = this.activeTimelineId()) {
      this.ui.historyVisibleEntries ||= {};
      this.ui.historyVisibleEntries[this.conversationUiKeyFor(contactId, timelineId)] = HISTORY_PAGE_SIZE;
    }
    historyEntryLimit(entries = this.conversation?.entries || []) {
      const total = Array.isArray(entries) ? entries.length : 0;
      if (!total) return 0;
      this.ui.historyVisibleEntries ||= {};
      const key = this.conversationUiKeyFor();
      const stored = Number(this.ui.historyVisibleEntries[key]);
      const limit = Number.isFinite(stored) && stored > 0 ? stored : HISTORY_PAGE_SIZE;
      return Math.min(total, Math.max(1, Math.floor(limit)));
    }
    visibleMessages() {
      const entries = Array.isArray(this.conversation?.entries) ? this.conversation.entries : [];
      if (!entries.length) return this.messages;
      const visibleEntries = entries.slice(-this.historyEntryLimit(entries));
      const visibleTurnIds = new Set(visibleEntries.map((entry) => entry.id));
      return this.messages.filter((message) => visibleTurnIds.has(message.role === "assistant" ? (message.turnId || message.id) : message.id));
    }
    hiddenHistoryEntryCount() {
      const entries = Array.isArray(this.conversation?.entries) ? this.conversation.entries : [];
      return Math.max(0, entries.length - this.historyEntryLimit(entries));
    }
    loadEarlierHistory() {
      const entries = Array.isArray(this.conversation?.entries) ? this.conversation.entries : [];
      const current = this.historyEntryLimit(entries);
      if (!entries.length || current >= entries.length) return false;
      const anchorMessageId = this.visibleMessages()[0]?.id || null;
      this.ui.historyVisibleEntries[this.conversationUiKeyFor()] = Math.min(entries.length, current + HISTORY_PAGE_SIZE);
      if (anchorMessageId) this.ui.messageViewportIntent = { kind: "anchor", messageId: anchorMessageId };
      this.paint();
      return true;
    }
    historyEntryIndexForMessage(messageId) {
      return (this.conversation?.entries || []).findIndex((entry) => entry.id === messageId || entry.legacyMessageId === messageId || (Array.isArray(entry.parts) && entry.parts.some((part) => part.id === messageId)));
    }
    jumpToHistoryMessage(messageId) {
      const entries = Array.isArray(this.conversation?.entries) ? this.conversation.entries : [];
      const entryIndex = this.historyEntryIndexForMessage(messageId);
      if (entryIndex < 0) return false;
      this.ui.historyVisibleEntries ||= {};
      const key = this.conversationUiKeyFor();
      this.ui.historyVisibleEntries[key] = Math.max(this.historyEntryLimit(entries), entries.length - entryIndex);
      this.ui.messageViewportIntent = { kind: "anchor", messageId };
      this.ui.route = "conversation";
      this.paint();
      return true;
    }
    setConversationListState(contactId, timelineId, key, value) {
      if (!["pinned", "muted", "hidden"].includes(key)) return false;
      const state = this.experienceFor(contactId, timelineId);
      const next = Boolean(value);
      if (state[key] === next) return false;
      state[key] = next;
      // A hidden thread must immediately leave the ordinary list, even when
      // the user had temporarily opened the hidden-conversation reveal mode.
      if (key === "hidden" && next) this.ui.showHidden = false;
      this.saveExperience();
      return true;
    }
    migrateVisualDefaults() {
      let changed = false;
      const contact = this.experience.contacts?.["contact-a"];
      // Replace only the old built-in defaults. User-uploaded data and any
      // previously selected custom asset remain untouched.
      if (contact && (!contact.avatar || contact.avatar === LEGACY_DEFAULT_CONTACT_AVATAR)) {
        contact.avatar = VISUAL_CONTACT_AVATAR;
        changed = true;
      }
      if (contact && (!contact.profileBackground || contact.profileBackground === LEGACY_DEFAULT_CONTACT_BACKGROUND)) {
        contact.profileBackground = VISUAL_CONTACT_BACKGROUND;
        changed = true;
      }
      if (contact && contact.name === "Contact A") {
        contact.name = "Mercury";
        contact.identity = "摄影师";
        contact.relationship = "在线";
        changed = true;
      }
      if (changed) this.saveExperience();
    }
    clearActiveConversation() {
      this.cancelRequest({ silent: true });
      const contactId = this.activeContactId();
      const timelineId = this.activeTimelineId();
      this.conversation = { ...global.MercuryChatContracts.loadConversation(null).conversation, id: `${contactId}:${timelineId}` };
      this.messages = Object.freeze([]);
      this.context.state.mercuryChatMessages = this.messages;
      this.resetHistoryWindow(contactId, timelineId);
      this.ui.messageViewportIntent = { kind: "latest" };
      this.persistMessages();
      this.ui.selectedMessageId = null;
      this.paint();
    }
    deleteActiveConversation() {
      this.cancelRequest({ silent: true });
      const state = this.experienceFor(this.activeContactId(), this.activeTimelineId());
      state.deleted = true;
      state.hidden = false;
      state.unread = false;
      this.clearDraft(this.activeContactId(), this.activeTimelineId(), { persist: false });
      this.conversation = { ...global.MercuryChatContracts.loadConversation(null).conversation, id: `${this.activeContactId()}:${this.activeTimelineId()}` };
      this.messages = Object.freeze([]);
      this.context.state.mercuryChatMessages = this.messages;
      if (this.ui.historyVisibleEntries) delete this.ui.historyVisibleEntries[this.conversationUiKeyFor()];
      this.persistMessages();
      this.saveExperience();
      this.ui.selectedMessageId = null;
      this.ui.route = "chats";
      this.paint();
    }
    relationshipRecords(contactId = null, status = null) {
      const store = global.MercuryRelationshipRecords;
      if (!store) return [];
      const storage = this.experienceStorage || this.context?.services?.storage;
      return store.list(storage, contactId || this.activeContactId(), status);
    }
    activeWorldVariantId() {
      const bindings = this.experienceFor(this.activeContactId(), this.activeTimelineId()).resourceBindings;
      return bindings?.worldVariantId || "default";
    }
    vectorMemoryScope(contactId = this.activeContactId(), timelineId = this.activeTimelineId(), worldVariantId = this.activeWorldVariantId()) {
      return { contactId, worldVariantId: worldVariantId || "default", timelineId: timelineId || "default" };
    }
    confirmedRecordsForActiveScope() {
      const timelineId = this.activeTimelineId() || "default";
      const worldVariantId = this.activeWorldVariantId();
      return this.relationshipRecords(this.activeContactId(), "confirmed").filter((record) => (record.timelineId || "default") === timelineId && (record.worldVariantId || "default") === worldVariantId);
    }
    durableEventRecordsForActiveScope() {
      return this.confirmedRecordsForActiveScope().filter((record) => record.memory?.retention === "durable" && record.memory?.state === "active");
    }
    async syncConfirmedRecordsToVectorMemory() {
      if (!this.vectorMemoryStore?.isAvailable?.()) return false;
      const records = this.durableEventRecordsForActiveScope();
      const scope = this.vectorMemoryScope();
      const indexed = await this.vectorMemoryStore.list(scope);
      const activeSourceIds = new Set(records.map((record) => String(record.id)));
      await Promise.all(indexed.filter((entry) => entry.source?.type === "relationship-record" && !activeSourceIds.has(String(entry.source.id))).map((entry) => this.vectorMemoryStore.remove(entry.id)));
      if (!records.length) return true;
      const entries = await Promise.all(records.map((record) => this.vectorMemoryStore.upsertConfirmedRecord(record, scope)));
      if (this.vectorMemoryState.semanticEnabled && this.localEmbeddingRuntime?.status === "ready") {
        for (const entry of entries.filter(Boolean)) {
          if (entry.embedding?.modelId === this.localEmbeddingRuntime.modelId) continue;
          const embedding = await this.localEmbeddingRuntime.embed(entry.content);
          await this.vectorMemoryStore.put({ ...entry, embedding, embeddingState: "ready", updatedAt: new Date().toISOString() });
        }
      }
      return true;
    }
    async enableLocalSemanticMemory(options = {}) {
      if (!this.vectorMemoryStore?.isAvailable?.() || !this.localEmbeddingRuntime) throw new Error("当前浏览器不支持本地语义记忆。");
      const prepareToken = this.vectorMemoryState.prepareToken + 1;
      this.vectorMemoryState.prepareToken = prepareToken;
      this.vectorMemoryState.lastError = null;
      this.vectorMemoryState.mode = "loading";
      this.vectorMemoryState.prepareProgress = "正在准备本地模型";
      try {
        await this.localEmbeddingRuntime.prepare({
          onProgress: (progress) => {
            if (this.vectorMemoryState.prepareToken !== prepareToken) return;
            const status = typeof progress?.status === "string" ? progress.status : "loading";
            const file = typeof progress?.file === "string" && progress.file ? ` · ${progress.file}` : "";
            this.vectorMemoryState.prepareProgress = `正在准备本地模型：${status}${file}`;
            if (this.ui?.route === "semanticMemory") this.paint();
            options.onProgress?.(progress);
          },
        });
        if (this.vectorMemoryState.prepareToken !== prepareToken) {
          // A later enable request may share this browser-level preparation.
          // Only release the runtime when no newer request is still loading.
          if (this.vectorMemoryState.mode !== "loading") await this.localEmbeddingRuntime.close();
          return { cancelled: true };
        }
        this.vectorMemoryState.semanticEnabled = true;
        await this.syncConfirmedRecordsToVectorMemory();
        this.vectorMemoryState.mode = "semantic";
        this.vectorMemoryState.prepareProgress = null;
        return this.localEmbeddingRuntime.snapshot();
      } catch (error) {
        if (this.vectorMemoryState.prepareToken !== prepareToken) return { cancelled: true };
        this.vectorMemoryState.semanticEnabled = false;
        this.vectorMemoryState.mode = "keyword";
        this.vectorMemoryState.lastError = "local-model-unavailable";
        this.vectorMemoryState.prepareProgress = null;
        throw error;
      }
    }
    disableLocalSemanticMemory() {
      this.vectorMemoryState.prepareToken += 1;
      this.vectorMemoryState.semanticEnabled = false;
      this.vectorMemoryState.mode = "keyword";
      this.vectorMemoryState.prepareProgress = null;
      return true;
    }
    async removeRelationshipRecordFromVectorMemory(record) {
      if (!record || !this.vectorMemoryStore?.isAvailable?.()) return false;
      const scope = this.vectorMemoryScope(record.contactId || this.activeContactId(), record.timelineId || "default", record.worldVariantId || "default");
      await this.vectorMemoryStore.removeSource(scope, "relationship-record", record.id);
      return true;
    }
    async recallMemoryForMessage(message) {
      const contracts = global.MercuryVectorMemoryContracts;
      const experienceSettings = global.MercuryChatContracts.normalizeExperienceSettings(this.experienceFor(this.activeContactId(), this.activeTimelineId()).settings);
      if (experienceSettings.memoryHandling !== "automatic") return { events: [], trace: { mode: "disabled", selectedIds: [], fallback: false } };
      if (!contracts) return { events: [], trace: { mode: "unavailable", selectedIds: [], fallback: false } };
      const scope = this.vectorMemoryScope();
      const query = message?.content || message?.text || "";
      const fallbackEntries = this.durableEventRecordsForActiveScope().map((record) => contracts.entryFromConfirmedRecord(record, scope)).filter(Boolean);
      try {
        const canPersist = this.vectorMemoryStore?.isAvailable?.();
        if (canPersist) await this.syncConfirmedRecordsToVectorMemory();
        const entries = canPersist ? await this.vectorMemoryStore.list(scope) : fallbackEntries;
        const embedding = canPersist && this.vectorMemoryState.semanticEnabled && this.localEmbeddingRuntime?.status === "ready" ? await this.localEmbeddingRuntime.embed(query) : null;
        const results = contracts.rankEntries(entries, { scope, query, embedding });
        const events = contracts.runtimeRecords(results);
        const mode = embedding && results.some((result) => result.match === "semantic") ? "semantic" : "keyword";
        const trace = { mode: canPersist ? mode : "keyword-fallback", selectedIds: results.map((result) => result.id), fallback: !canPersist };
        this.vectorMemoryState.mode = mode;
        this.vectorMemoryState.lastError = null;
        this.vectorMemoryState.lastRecall = trace;
        return { events, trace };
      } catch (_) {
        const results = contracts.rankEntries(fallbackEntries, { scope, query });
        const events = contracts.runtimeRecords(results);
        const trace = { mode: "keyword-fallback", selectedIds: results.map((result) => result.id), fallback: true };
        this.vectorMemoryState.lastError = "local-memory-unavailable";
        this.vectorMemoryState.lastRecall = trace;
        return { events, trace };
      }
    }
    queueMemoryCandidates(candidates, context = {}) {
      const store = global.MercuryRelationshipRecords;
      if (!store || !Array.isArray(candidates) || !candidates.length) return [];
      const storage = this.experienceStorage || this.context?.services?.storage;
      try {
        const added = store.addPending(storage, candidates, { ...context, contactId: context.contactId || this.activeContactId(), timelineId: context.timelineId || this.activeTimelineId(), worldVariantId: context.worldVariantId || this.activeWorldVariantId() });
        if (added.length) this.ui.memoryError = null;
        return added;
      } catch (_) {
        this.ui.memoryError = "关系记录暂时未保存，但聊天回复已保留";
        return [];
      }
    }
    updateRelationshipRecord(recordId, status) {
      const store = global.MercuryRelationshipRecords;
      if (!store) return null;
      const storage = this.experienceStorage || this.context?.services?.storage;
      const record = store.updateStatus(storage, recordId, status);
      if (record && status !== "confirmed") this.removeRelationshipRecordFromVectorMemory(record).catch(() => {});
      if (record) this.paint();
      return record;
    }
    confirmRelationshipRecord(recordId, content, memory = { retention: "session" }) {
      const store = global.MercuryRelationshipRecords;
      if (!store || typeof content !== "string" || !content.trim()) return null;
      const storage = this.experienceStorage || this.context?.services?.storage;
      const updated = store.updateContent(storage, recordId, content);
      if (!updated) return null;
      store.updateMemory(storage, recordId, memory);
      const record = store.updateStatus(storage, recordId, "confirmed");
      if (record) this.syncConfirmedRecordsToVectorMemory().catch(() => {});
      if (record) this.paint();
      return record;
    }
    openApp(appId, route = null) { return this.context.services?.launchApp?.(appId, route) ?? false; }
    archiveRouteForContact(contact) {
      const profileId = contact?.runtimeProfileId || contact?.persona?.runtimeProfileId;
      return profileId ? `character:${encodeURIComponent(profileId)}` : "characters";
    }
    repairSerializedRoleImports() {
      const resources = global.MercuryResourceContracts;
      const archive = global.MercuryArchiveContracts;
      const storage = this.experienceStorage;
      if (!resources || !archive || !storage || typeof storage.get !== "function") return false;
      const isSerializedJson = (value) => {
        if (typeof value !== "string" || !/^[{[]/.test(value.trim())) return false;
        try { return Boolean(JSON.parse(value)); } catch (_) { return false; }
      };
      const archiveState = archive.normalizeArchiveState(storage.get(archive.STORAGE_KEY, null));
      const profiles = new Map(archiveState.runtimeProfiles.map((profile) => [profile.id, profile]));
      const assets = new Map(archiveState.sourceAssets.map((asset) => [asset.id, asset]));
      let changed = false;
      Object.values(this.experience.contacts).forEach((contact) => {
        if (!contact?.runtimeProfileId || !contact.persona || !Object.values(contact.persona).some(isSerializedJson)) return;
        const asset = assets.get(profiles.get(contact.runtimeProfileId)?.sourceAssetId);
        if (!asset?.rawText) return;
        const report = resources.preflightMercuryResourceImport(asset.rawText, { filename: asset.filename });
        if (!report.ok || report.resourceKind !== "roleCard") return;
        const repaired = resources.contactFromRoleCard(report.resource, { id: contact.id, avatar: contact.avatar, profileBackground: contact.profileBackground, relationship: contact.relationship });
        contact.name = repaired.name;
        contact.identity = repaired.identity;
        contact.persona = repaired.persona;
        changed = true;
      });
      if (changed) this.saveExperience();
      return changed;
    }
    repairImportedRoleProfiles() {
      const resources = global.MercuryResourceContracts;
      if (!resources || typeof this.archiveStore?.repairImportedRoleProfiles !== "function") return false;
      const result = this.archiveStore.repairImportedRoleProfiles({
        resourceContracts: resources,
        runtimeProfileIds: Object.values(this.experience.contacts).map((contact) => contact?.runtimeProfileId).filter(Boolean),
      });
      const repairs = new Map(result.repairs.map((repair) => [repair.profileId, repair]));
      let contactChanged = false;
      const missing = (value) => value === undefined || value === null || value === "" || Array.isArray(value) && value.length === 0;
      Object.values(this.experience.contacts).forEach((contact) => {
        const repair = repairs.get(contact?.runtimeProfileId);
        if (!repair?.profile || !repair.role) return;
        const role = repair.role;
        const profileFields = ["summary", "stableTraits", "motivations", "fears", "values", "boundaries", "careStyle", "conflictStyle", "defenseStyle", "voiceStyle", "inner_conflict", "politics", "signature_details", "lore"];
        contact.persona ||= { displayName: contact.name || role.displayName };
        if (missing(contact.persona.identity) || contact.persona.identity === "Imported character") { contact.persona.identity = role.identity; contactChanged = true; }
        profileFields.forEach((key) => {
          if (missing(contact.persona[key]) && !missing(role.profile?.[key])) { contact.persona[key] = role.profile[key]; contactChanged = true; }
        });
        if (missing(contact.identity) || contact.identity === "Imported character") { contact.identity = role.identity; contactChanged = true; }
      });
      if (contactChanged) this.saveExperience();
      return result.changed || contactChanged;
    }
    experienceFor(contactId = "contact-a", timelineId = "default") {
      const key = global.MercuryChatExperienceContracts.keyFor(contactId, timelineId);
      const state = this.experience.conversations[key] ||= { settings: { ...global.MercuryChatExperienceContracts.DEFAULT_CONVERSATION_SETTINGS }, appearance: { ...global.MercuryChatExperienceContracts.DEFAULT_APPEARANCE }, resourceBindings: null, sceneContext: null, pinned: false, hidden: false, muted: false, unread: false, deleted: false };
      state.resourceBindings = global.MercuryChatExperienceContracts.normalizeResourceBindings(state.resourceBindings, this.experience.contacts[contactId], state.settings);
      state.sceneContext = global.MercuryChatExperienceContracts.normalizeSceneContext(state.sceneContext);
      if (state.resourceBindings.presetId !== state.settings.userPresetId) state.resourceBindings.presetId = state.settings.userPresetId;
      return state;
    }
    activeSceneContext() {
      return this.experienceFor(this.activeContactId(), this.activeTimelineId()).sceneContext;
    }
    setSessionWorldBookBindings(worldBookIds) {
      const state = this.experienceFor(this.activeContactId(), this.activeTimelineId());
      const ids = (Array.isArray(worldBookIds) ? worldBookIds : [])
        .filter((id) => typeof id === "string" && id.trim())
        .map((id) => id.trim());
      state.resourceBindings = {
        ...state.resourceBindings,
        worldBookMode: "explicit",
        worldBookIds: Array.from(new Set(ids)),
      };
      this.saveExperience();
      return state.resourceBindings;
    }
    setSessionWorldBookMode(mode) {
      const state = this.experienceFor(this.activeContactId(), this.activeTimelineId());
      if (mode !== "inherit" && mode !== "explicit") return state.resourceBindings;
      state.resourceBindings = { ...state.resourceBindings, worldBookMode: mode };
      this.saveExperience();
      return state.resourceBindings;
    }
    resourceWorldBooks() {
      const archive = global.MercuryArchiveContracts;
      const storage = this.context?.services?.sharedStorage || this.context?.services?.storage;
      if (!archive || typeof storage?.get !== "function") return { worlds: [], inheritedIds: [] };
      const state = archive.normalizeArchiveState(storage.get(archive.STORAGE_KEY, null));
      const bindings = this.experienceFor(this.activeContactId(), this.activeTimelineId()).resourceBindings;
      const profileId = bindings.runtimeProfileId || this.activeContact()?.runtimeProfileId || null;
      const profile = state.runtimeProfiles.find((item) => item.id === profileId) || null;
      const inheritedIds = state.worlds
        .filter((world) => Array.isArray(profile?.worldBindings) && (profile.worldBindings.includes(world.id) || profile.worldBindings.includes(world.name)))
        .map((world) => world.id);
      return { worlds: state.worlds.filter((world) => world.status !== "archived"), inheritedIds: Array.from(new Set(inheritedIds)) };
    }
    presetRuntimeState(item = this.experienceFor(this.activeContactId(), this.activeTimelineId())) {
      const presetId = item.resourceBindings?.presetId || item.settings.userPresetId || "preset-default";
      const name = this.presetDisplayNameById(presetId);
      if (!this.presetLayerReady()) return { name, active: false, label: "已保留，暂未生效" };
      const preset = this.presetStore.get(presetId);
      const diagnostic = this.presetRuntimeDiagnostic(preset);
      const copy = this.presetRuntimeCopy(preset, diagnostic);
      return { name, active: diagnostic.hasRuntimeText, label: copy.label, detail: copy.detail, state: diagnostic.status };
    }
    preflightCharacterImport(rawText) {
      if (!global.MercuryResourceContracts) return null;
      const report = global.MercuryResourceContracts.preflightMercuryResourceImport(rawText);
      if (report.resourceKind === "roleCard") return report;
      return { ...report, ok: false, errors: [...report.errors, { code: "not_role_card", path: "$", message: "Only role cards can be imported as contacts." }] };
    }
    importCharacterFromPreflight(preflight, rawText, source = {}) {
      this.lastImportPreflight = preflight || null;
      this.lastImportError = null;
      if (!preflight?.ok || preflight.resourceKind !== "roleCard" || !this.resourceIntake) return null;
      try {
        const sourceAsset = global.MercuryArchiveContracts.createSourceAsset({
          filename: source.filename || "imported-role.json",
          mimeType: source.mimeType || "application/json",
          fileSize: source.fileSize,
          rawText,
        });
        const result = this.resourceIntake.commit({ sourceAsset, report: preflight }, {
          destination: "chat",
          contactDefaults: { avatar: AVATAR_FALLBACK, profileBackground: VISUAL_CONTACT_BACKGROUND, relationship: "Imported character" },
        });
        this.experience = result.experience;
        this.recordCharacterImport(result);
        return result.contact;
      } catch (error) {
        this.lastImportError = error;
        if (typeof console !== "undefined" && console.error) console.error("[resource-intake] role import failed", error);
        return null;
      }
    }
    importCharacterFromJson(rawText, origin = {}) {
      const preflight = this.preflightCharacterImport(rawText);
      if (preflight) return this.importCharacterFromPreflight(preflight, rawText, origin);
      return null;
    }
    openCharacterPicker() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,.png,application/json,image/png,text/plain";
      input.hidden = true;
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.value = ""; // allow re-picking the same file later
        if (!file) return;
        this.ui.importReceipt = null;
        this.importAlert = null;
        let rawText;
        try {
          const isPng = file.type === "image/png" || /\.png$/i.test(file.name || "");
          if (isPng) {
            const bytes = typeof file.arrayBuffer === "function" ? new Uint8Array(await file.arrayBuffer()) : null;
            const report = global.MercuryResourceContracts?.preflightMercuryResourceBinary?.(bytes, { filename: file.name });
            const contact = this.importCharacterFromPreflight(report, report?.sourceText || "", { filename: file.name, mimeType: file.type || "image/png" });
            if (contact) { this.ui.selectedContactId = contact.id; this.ui.route = "newConversation"; this.importAlert = null; this.paint(); return; }
            this.importAlert = this.lastImportError ? "storage-failed" : "invalid-json";
            this.paint();
            return;
          }
          rawText = typeof file.text === "function" ? await file.text() : await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => resolve(String(reader.result || "")));
            reader.addEventListener("error", () => reject(new Error("read-failed")));
            reader.readAsText(file);
          });
        } catch { this.#importFlash("read-failed"); return; }
        const contact = this.importCharacterFromJson(rawText, { filename: file.name, mimeType: file.type || "application/json" });
        if (contact) { this.ui.selectedContactId = contact.id; this.ui.route = "newConversation"; this.importAlert = null; this.paint(); return; }
        this.importAlert = this.lastImportError ? "storage-failed" : "invalid-json";
        this.paint();
      });
      (document.body || document.documentElement).append(input);
      input.click();
      this.activePicker = input;
    }
    preflightPresetImport(rawText) {
      const contracts = global.MercuryResourceContracts;
      if (!contracts) return { ok: false, errors: [{ code: "preset_import_unavailable" }] };
      const report = contracts.preflightMercuryResourceImport(rawText);
      if (report.resourceKind !== "preset") return { ...report, ok: false, errors: [...(report.errors || []), { code: "not_a_preset" }] };
      return report;
    }
    importPresetFromJson(rawText) {
      const report = this.preflightPresetImport(rawText);
      if (!report.ok || !this.presetLayerReady()) return null;
      const preset = typeof this.presetStore.importProfile === "function"
        ? this.presetStore.importProfile(report.resource.data)
        : this.presetStore.add(report.resource.data);
      this.ui.presetImportReport = preset.compatibility?.runtime || null;
      return preset;
    }
    conversationTransferInput() {
      const contactId = this.activeContactId();
      const timelineId = this.activeTimelineId();
      let conversation = this.conversation;
      if (!conversation?.entries?.length && this.messages?.length) {
        conversation = global.MercuryChatContracts.migrateV1({ schemaVersion: 1, id: `${contactId}:${timelineId}`, messages: this.messages });
      }
      return {
        contact: this.activeContact(),
        userName: this.experience?.user?.name || "Me",
        conversation,
        session: this.experienceFor(contactId, timelineId),
      };
    }
    conversationTransferError(error) {
      const messages = {
        CONVERSATION_TRANSFER_EMPTY: "请选择 Mercury 聊天 JSON 文件。",
        CONVERSATION_TRANSFER_TOO_LARGE: "聊天文件过大，无法安全处理。",
        CONVERSATION_TRANSFER_INVALID_JSON: "文件不是有效的 JSON。",
        CONVERSATION_TRANSFER_WRONG_KIND: "这不是 Mercury 聊天文件。",
        CONVERSATION_TRANSFER_UNSUPPORTED_VERSION: "聊天文件版本暂不受支持。",
        CONVERSATION_TRANSFER_INVALID_ENVELOPE: "聊天文件元数据不完整。",
        CONVERSATION_TRANSFER_INVALID_SESSION: "聊天文件中的会话设置无效。",
        CONVERSATION_TRANSFER_INVALID_CONVERSATION: "聊天记录已损坏或格式不完整。",
        CONVERSATION_TRANSFER_DUPLICATE_ENTRY: "聊天记录包含重复消息，未导入。",
        CONVERSATION_TRANSFER_TOO_MANY_ENTRIES: "聊天记录条数超出安全上限，未导入。",
        CONVERSATION_TRANSFER_READ_FAILED: "无法读取该聊天文件。",
        CONVERSATION_TRANSFER_TARGET_MISSING: "当前联系人不可用，请返回联系人列表后重试。",
        CONVERSATION_TRANSFER_COMMIT_FAILED: "导入未保存，原有本地数据已恢复。",
        CONVERSATION_TRANSFER_ROLLBACK_FAILED: "导入失败，且本地回滚不完整，请先导出全局备份。",
      };
      return messages[error?.code] || "无法处理该聊天文件。";
    }
    recordConversationTransfer(result) {
      if (!result?.contactId || !result?.timelineId) return null;
      const unresolved = result.unresolvedBindings || {};
      const receipt = Object.freeze({
        contactId: result.contactId,
        timelineId: result.timelineId,
        entryCount: Number(result.entryCount) || 0,
        sourceContactName: String(result.source?.contactName || "").trim(),
        unresolvedWorldBookIds: Object.freeze([...(Array.isArray(unresolved.worldBookIds) ? unresolved.worldBookIds : [])]),
        unresolvedPresetId: unresolved.presetId || null,
        runtimeProfileRebound: unresolved.runtimeProfileRebound === true,
      });
      this.ui.conversationTransferReceipt = receipt;
      return receipt;
    }
    conversationTransferReceiptView() {
      const receipt = this.ui.conversationTransferReceipt;
      if (!receipt || receipt.contactId !== this.activeContactId() || receipt.timelineId !== this.activeTimelineId()) return null;
      const panel = document.createElement("section");
      panel.className = "mercury-chat-import-receipt mercury-chat-conversation-transfer-receipt";
      panel.setAttribute("role", "status");
      panel.setAttribute("aria-live", "polite");
      const title = document.createElement("h2");
      title.textContent = "聊天已导入";
      const summary = document.createElement("p");
      summary.textContent = `已新建独立会话，保留 ${receipt.entryCount} 条消息。`;
      panel.append(title, summary);
      const details = [];
      if (receipt.unresolvedWorldBookIds.length) details.push(`${receipt.unresolvedWorldBookIds.length} 本世界书未在本地找到`);
      if (receipt.unresolvedPresetId) details.push("原玩法预设未在本地找到，已使用默认预设");
      if (receipt.runtimeProfileRebound) details.push("角色资料已按当前联系人重新绑定");
      const detail = document.createElement("p");
      detail.textContent = details.length ? details.join("；") + "。" : "本地可用的角色、世界书与玩法预设绑定已恢复。";
      panel.append(detail);
      const actions = document.createElement("div");
      actions.className = "mercury-chat-import-receipt__actions";
      if (receipt.unresolvedWorldBookIds.length || receipt.unresolvedPresetId || receipt.runtimeProfileRebound) {
        const inspect = this.button("检查资源", "mercury-chat-import-receipt__primary", "settings");
        const inspectLabel = document.createElement("span");
        inspectLabel.textContent = "检查资源";
        inspect.append(inspectLabel);
        inspect.addEventListener("click", () => { this.ui.route = "conversationResources"; this.paint(); });
        actions.append(inspect);
      }
      const dismiss = this.button("知道了", "mercury-chat-import-receipt__dismiss");
      const dismissLabel = document.createElement("span");
      dismissLabel.textContent = "知道了";
      dismiss.append(dismissLabel);
      dismiss.addEventListener("click", () => { this.ui.conversationTransferReceipt = null; this.paint(); });
      actions.append(dismiss);
      panel.append(actions);
      return panel;
    }
    downloadConversation(format = global.MercuryConversationTransferContracts?.FORMATS?.PORTABLE) {
      if (!this.conversationTransfer) return false;
      try {
        const result = this.conversationTransfer.export(this.conversationTransferInput(), format);
        this.ui.conversationTransferError = null;
        if (typeof document !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && typeof Blob !== "undefined") {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(new Blob([result.text], { type: result.mimeType }));
          link.download = result.filename;
          link.hidden = true;
          (document.body || document.documentElement)?.append?.(link);
          link.click?.();
          link.remove?.();
          URL.revokeObjectURL(link.href);
        }
        return result;
      } catch (error) {
        this.ui.conversationTransferError = this.conversationTransferError(error);
        this.paint();
        return false;
      }
    }
    availableConversationTransferResources() {
      let worldBookIds = [];
      try { worldBookIds = this.resourceWorldBooks().worlds.map((world) => world.id); } catch (_) { worldBookIds = []; }
      const presetIds = typeof this.presetStore?.list === "function" ? this.presetStore.list().map((preset) => preset.id) : ["preset-default"];
      return { availableWorldBookIds: worldBookIds, availablePresetIds: presetIds };
    }
    importConversationFromJson(rawText) {
      if (!this.conversationTransfer) return null;
      try {
        const stage = this.conversationTransfer.inspect(rawText);
        const result = this.conversationTransfer.commit(stage, {
          contactId: this.activeContactId(),
          experience: this.experience,
          ...this.availableConversationTransferResources(),
        });
        this.cancelRequest({ silent: true });
        this.experience = result.experience;
        this.ui.selectedTimelineId = result.timelineId;
        this.ui.selectedMessageId = null;
        this.ui.draft = "";
        this.ui.conversationTransferError = null;
        this.ui.messageViewportIntent = { kind: "latest" };
        this.conversation = result.conversation;
        this.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(result.conversation));
        this.context.state.mercuryChatMessages = this.messages;
        this.resetHistoryWindow(result.contactId, result.timelineId);
        this.recordConversationTransfer(result);
        this.ui.route = "conversation";
        this.paint();
        return result;
      } catch (error) {
        this.ui.conversationTransferError = this.conversationTransferError(error);
        this.paint();
        return null;
      }
    }
    openConversationTransferPicker() {
      if (!this.conversationTransfer || typeof document === "undefined") return false;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,.mercury.json,application/json";
      input.hidden = true;
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.value = "";
        if (!file) { input.remove?.(); return; }
        try {
          if (Number.isFinite(file.size) && file.size > global.MercuryConversationTransferContracts.MAX_TRANSFER_BYTES) {
            const error = Object.assign(new Error("too-large"), { code: "CONVERSATION_TRANSFER_TOO_LARGE" });
            throw error;
          }
          const rawText = typeof file.text === "function" ? await file.text() : await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => resolve(String(reader.result || "")));
            reader.addEventListener("error", () => reject(Object.assign(new Error("read-failed"), { code: "CONVERSATION_TRANSFER_READ_FAILED" })));
            reader.readAsText(file);
          });
          this.importConversationFromJson(rawText);
        } catch (error) {
          this.ui.conversationTransferError = this.conversationTransferError(error);
          this.paint();
        } finally { input.remove?.(); }
      });
      (document.body || document.documentElement)?.append?.(input);
      input.click?.();
      return true;
    }
    #importFlash(reason) { this.importAlert = reason; this.paint(); }
    icon(name, className = "mercury-chat-icon") {
      const image = document.createElement("img");
      image.className = className;
      image.src = `${ICON_ROOT}${MERCURY_ICON[name] || name}.svg`;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      return image;
    }
    button(label, className, iconName) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.setAttribute("aria-label", label);
      if (iconName) button.append(this.icon(iconName));
      return button;
    }
    paint() {
      const views = { chats: () => this.chatListView(), newConversation: () => this.newConversationView(), conversation: () => this.conversationView(), settings: () => this.conversationSettingsViewV12(), conversationResources: () => this.conversationResourcesView(), semanticMemory: () => this.semanticMemoryView(), eventMemory: () => this.eventMemoryView(), eventMemoryDetail: () => this.eventMemoryDetailView(), sceneLibrary: () => this.sceneLibraryView(), historySearch: () => this.historySearchView(), contacts: () => this.contactsViewReference(), contact: () => this.contactView(), persona: () => this.personaView(), me: () => this.meView(), profileAppearance: () => this.profileAppearanceView(), background: () => this.chatBeautifyView(), appearance: () => this.chatBeautifyView(), chatBeautify: () => this.chatBeautifyView(), presetList: () => this.presetListView(), presetEditor: () => this.presetEditorView() };
      if (this.ui.route !== "conversation") {
        this.cancelMessageLongPress();
        this.ui.messageActionSheetId = null;
      }
      if (this.root?.style && typeof this.root.style.setProperty === "function") {
        const backdrop = this.experience?.user?.profileBackground || "assets/wallpapers/rain-window-leaves-v1.webp";
        const cssBackdrop = String(backdrop).startsWith("data:") ? backdrop : `/${String(backdrop).replace(/^\/+/, "")}`;
        this.root.style.setProperty("--chat-home-background", `url("${cssBackdrop}")`);
      }
      const presentationView = this.presentationAdapter?.renderRoute?.(this.ui.route, {
        navigate: (route) => { this.ui.route = route; this.paint(); },
        repaint: () => this.paint(),
      });
      const canQuery = typeof this.root.querySelector === "function";
      const prev = canQuery ? this.root.querySelector(".mercury-chat-messages") : null;
      const wasAtBottom = prev && (prev.scrollTop + prev.clientHeight >= prev.scrollHeight - 40);
      const prevTop = prev ? prev.scrollTop : 0;
      const viewportIntent = this.ui.messageViewportIntent || null;
      this.root.replaceChildren(presentationView || (views[this.ui.route] || views.chats)());
      if (!canQuery) { this.ui.messageViewportIntent = null; return; }
      const next = this.root.querySelector(".mercury-chat-messages");
      if (!next) return;
      if (viewportIntent?.kind === "anchor") {
        const anchor = Array.from(next.querySelectorAll?.("[data-message-id]") || []).find((node) => node.dataset.messageId === viewportIntent.messageId);
        if (anchor && typeof anchor.scrollIntoView === "function") anchor.scrollIntoView({ block: "start" });
        else next.scrollTop = prevTop;
      } else if (viewportIntent?.kind === "latest" || !prev || wasAtBottom || this.ui.pending) next.scrollTop = next.scrollHeight;
      else next.scrollTop = prevTop;
      this.ui.messageViewportIntent = null;
    }
    chatListView() {
      const view = document.createElement("section");
      view.className = "mercury-chat-list";
      const heading = document.createElement("header");
      heading.className = "mercury-chat-list__heading";
      const title = document.createElement("h1");
      title.textContent = this.t("chat.chatsTitle");
      const headingActions = document.createElement("div");
      headingActions.className = "mercury-chat-list__heading-actions";
      const searchButton = this.button("搜索会话", "mercury-chat-list__search-button", "search");
      searchButton.addEventListener("click", () => { this.ui.listSearchOpen = !this.ui.listSearchOpen; this.paint(); });
      const allItems = this.conversationItems();
      const hiddenCount = allItems.filter((item) => item.state.hidden).length;
      const hiddenButton = hiddenCount ? this.button(
        this.t(this.ui.showHidden ? "chat.hideHidden" : "chat.showHidden"),
        "mercury-chat-list__hidden-button",
        this.ui.showHidden ? "eye" : "eye-closed",
      ) : null;
      hiddenButton?.setAttribute("aria-pressed", this.ui.showHidden ? "true" : "false");
      hiddenButton?.addEventListener("click", () => { this.ui.showHidden = !this.ui.showHidden; this.ui.threadMenuKey = null; this.paint(); });
      const addConversation = this.button(this.t("chat.newConversation"), "mercury-chat-list__add", "plus");
      addConversation.addEventListener("click", () => { this.ui.panelOpen = false; this.ui.route = "newConversation"; this.paint(); });
      headingActions.append(searchButton);
      if (hiddenButton) headingActions.append(hiddenButton);
      headingActions.append(addConversation);
      heading.append(title, headingActions);
      let search = null;
      if (this.ui.listSearchOpen) {
        search = document.createElement("input");
        search.className = "mercury-chat-search mercury-chat-list__search";
        search.placeholder = "搜索会话";
        search.setAttribute("aria-label", "搜索会话");
        search.value = this.ui.listQuery || "";
        search.addEventListener("input", () => { this.ui.listQuery = search.value; this.paint(); });
      }
      const threadList = document.createElement("div");
      threadList.className = "mercury-chat-list__threads";
      const query = String(this.ui.listQuery || "").trim().toLowerCase();
      const items = allItems.filter((item) => {
        const matchesFilter = this.ui.showHidden || !item.state.hidden;
        const matchesQuery = !query || `${item.contact.name} ${item.contact.identity || ""} ${item.preview || ""}`.toLowerCase().includes(query);
        return matchesFilter && matchesQuery;
      });
      items.sort((a, b) => {
        if (Boolean(a.state.pinned) !== Boolean(b.state.pinned)) return a.state.pinned ? -1 : 1;
        const aTime = a.previewTime ? Date.parse(a.previewTime) : 0;
        const bTime = b.previewTime ? Date.parse(b.previewTime) : 0;
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      });
      items.forEach(({ contact, timelineId, state, preview, previewTime }) => {
        const threadKey = `${contact.id}:${timelineId}`;
        const conversation = document.createElement("article");
        const menuOpen = this.ui.threadMenuKey === threadKey;
        conversation.className = `mercury-chat-thread${state.pinned ? " mercury-chat-thread--pinned" : ""}${state.unread ? " mercury-chat-thread--unread" : ""}${state.muted ? " mercury-chat-thread--muted" : ""}${state.hidden ? " mercury-chat-thread--hidden" : ""}${menuOpen ? " mercury-chat-thread--menu-open" : ""}`;
        conversation.dataset.contactId = contact.id;
        conversation.dataset.timelineId = timelineId;
        conversation.dataset.threadKey = threadKey;
        conversation.setAttribute("role", "group");
        const open = this.button(`${this.t("chat.openContactA")} ${contact.name}`, "mercury-chat-thread__open");
        const threadAvatar = this.avatar("mercury-chat-thread__avatar");
        threadAvatar.src = contact.avatar;
        const copy = document.createElement("span");
        copy.className = "mercury-chat-thread__copy";
        const name = document.createElement("strong"); name.textContent = contact.name;
        const previewNode = document.createElement("small"); previewNode.textContent = preview || this.t("chat.listPreview");
        copy.append(name, previewNode);
        const flags = document.createElement("span");
        flags.className = "mercury-chat-thread__flags";
        const addFlag = (label, iconName, className) => {
          const flag = document.createElement("span");
          flag.className = `mercury-chat-thread__flag mercury-chat-thread__flag--${className}`;
          flag.setAttribute("aria-label", label);
          flag.append(this.icon(iconName));
          const flagText = document.createElement("span");
          flagText.textContent = label;
          flag.append(flagText);
          flags.append(flag);
        };
        if (state.pinned) addFlag(this.t("chat.pinned"), "check-circle", "pinned");
        if (state.muted) addFlag(this.t("chat.muted"), "bell-notification", "muted");
        if (state.unread) addFlag(this.t("chat.unread"), "bell-notification", "unread");
        if (state.hidden) addFlag(this.t("chat.hidden"), "eye-closed", "hidden");
        if (flags.children.length) copy.append(flags);
        const threadTime = document.createElement("time");
        threadTime.textContent = previewTime ? this.formatMessageTime(previewTime) : "";
        open.append(threadAvatar, copy, threadTime);
        open.addEventListener("click", (event) => { event?.stopPropagation?.(); this.openConversation(contact.id, timelineId); });

        const more = this.button(this.t("chat.threadMore"), "mercury-chat-thread__more", "more-horiz");
        more.setAttribute("aria-expanded", this.ui.threadMenuKey === threadKey ? "true" : "false");
        more.addEventListener("click", (event) => {
          event?.stopPropagation?.();
          this.ui.threadMenuKey = this.ui.threadMenuKey === threadKey ? null : threadKey;
          this.paint();
        });
        conversation.addEventListener("click", (event) => {
          const target = event?.target;
          if (target?.closest?.(".mercury-chat-thread__more") || target?.closest?.(".mercury-chat-thread__menu") || target?.closest?.(".mercury-chat-thread__open")) return;
          this.openConversation(contact.id, timelineId);
        });
        conversation.append(open, more);

        if (menuOpen) {
          const menu = document.createElement("div");
          menu.className = "mercury-chat-thread__menu";
          const menuAction = (label, iconName, callback) => {
            const action = this.button(label, "mercury-chat-thread__menu-item", iconName);
            const actionLabel = document.createElement("span"); actionLabel.textContent = label; action.append(actionLabel);
            action.addEventListener("click", (event) => { event?.stopPropagation?.(); callback(); this.ui.threadMenuKey = null; this.paint(); });
            menu.append(action);
          };
          menuAction(this.t(state.pinned ? "chat.unpinConversation" : "chat.pinConversation"), "check-circle", () => this.setConversationListState(contact.id, timelineId, "pinned", !state.pinned));
          menuAction(this.t(state.muted ? "chat.unmuteConversation" : "chat.muteConversation"), "bell-notification", () => this.setConversationListState(contact.id, timelineId, "muted", !state.muted));
          menuAction(this.t(state.hidden ? "chat.unhideConversation" : "chat.hideConversation"), state.hidden ? "eye" : "eye-closed", () => this.setConversationListState(contact.id, timelineId, "hidden", !state.hidden));
          menuAction("查看联系人", "nav-arrow-right", () => { this.ui.selectedContactId = contact.id; this.ui.route = "contact"; });
          if (this.roleSceneCandidates(contact.id).length) {
            menuAction("选择场景", "spark", () => { this.ui.selectedContactId = contact.id; this.ui.sceneCandidateId = null; this.ui.route = "sceneLibrary"; });
          }
          conversation.append(menu);
        }
        threadList.append(conversation);
      });
      if (!items.length) {
        const emptyThread = document.createElement("p"); emptyThread.className = "mercury-chat-list__empty"; emptyThread.textContent = this.t("contacts.empty");
        threadList.append(emptyThread);
      }
      view.append(heading);
      if (search) view.append(search);
      view.append(threadList, this.primaryNavigation());
      return view;
    }
    contactCard(contact, mode = "newConversation") {
      const className = mode === "newConversation" ? "mercury-chat-contact-card mercury-chat-new-conversation__contact" : "mercury-chat-contact-card mercury-chat-contact-row";
      const opensContact = mode === "contacts";
      const card = this.button(opensContact ? `打开${contact.name}的联系人主页` : `${this.t("chat.startConversation")} ${contact.name}`, className);
      card.className = className;
      const recentlyImported = this.ui.importReceipt?.contactId === contact.id;
      if (recentlyImported) card.className += " is-recently-imported";
      card.dataset.contactId = contact.id;
      const avatar = this.avatar(`${mode === "newConversation" ? "mercury-chat-new-conversation__avatar" : "mercury-chat-contact-row__avatar"} mercury-chat-contact-card__avatar`);
      avatar.src = contact.avatar;
      const copy = document.createElement("span");
      copy.className = "mercury-chat-contact-card__copy";
      const name = document.createElement("strong"); name.textContent = contact.name;
      const identity = document.createElement("small"); identity.textContent = contact.identity || contact.relationship || this.t("chat.emptyConversation");
      copy.append(name, identity);
      if (this.sameNameContactCount(contact) > 1 || recentlyImported) {
        const source = document.createElement("small");
        source.className = "mercury-chat-contact-card__source";
        source.textContent = this.contactSourceLabel(contact);
        copy.append(source);
      }
      if (recentlyImported) {
        const recent = document.createElement("span");
        recent.className = "mercury-chat-contact-card__recent";
        recent.textContent = "刚导入";
        copy.append(recent);
      }
      const start = document.createElement("span");
      start.className = "mercury-chat-contact-card__start";
      start.textContent = opensContact ? "查看联系人" : this.t("chat.startConversation");
      card.append(avatar, copy, start);
      card.addEventListener("click", () => {
        if (!opensContact) { this.startNewConversation(contact.id); return; }
        this.ui.selectedContactId = contact.id;
        this.ui.route = "contact";
        this.paint();
      });
      return card;
    }
    newConversationView() {
      const page = this.simplePage(this.t("chat.newConversationTitle"), "chats", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-new-conversation";
        const search = document.createElement("input");
        search.className = "mercury-chat-search mercury-chat-new-conversation__search";
        search.placeholder = this.t("contacts.searchPlaceholder");
        search.setAttribute("aria-label", this.t("contacts.searchPlaceholder"));
        search.value = this.ui.newConversationQuery || "";
        const list = document.createElement("div");
        list.className = "mercury-chat-new-conversation__list";
        const query = search.value.trim().toLowerCase();
        const contacts = Object.values(this.experience.contacts).filter((contact) => !query || `${contact.name} ${contact.identity || ""}`.toLowerCase().includes(query));
        const recentContactId = this.ui.importReceipt?.contactId || null;
        contacts.sort((left, right) => Number(right.id === recentContactId) - Number(left.id === recentContactId));
        contacts.forEach((contact) => list.append(this.contactCard(contact)));
        if (!contacts.length) {
          const empty = document.createElement("p");
          empty.className = "mercury-chat-list__empty";
          empty.textContent = this.t("contacts.empty");
          list.append(empty);
        }
        search.addEventListener("input", () => { this.ui.newConversationQuery = search.value; this.paint(); });
        const receipt = this.importReceiptView();
        if (receipt) body.append(receipt);
        body.append(search, list);
        return body;
      }, { pageClass: "mercury-chat-new-conversation-page" });
      const back = page.children[0]?.children?.[0];
      if (back) {
        back.className = "mercury-chat-page__cancel";
        back.setAttribute("aria-label", this.t("chat.cancelShort"));
        back.replaceChildren();
        const label = document.createElement("span");
        label.textContent = this.t("chat.cancelShort");
        back.append(label);
      }
      return page;
    }
    sceneLibraryView() {
      const contact = this.activeContact();
      const sceneState = this.roleSceneState(contact.id);
      const candidates = sceneState.candidates;
      const selectedId = this.ui.sceneCandidateId || candidates[0]?.id || null;
      const selected = candidates.find((item) => item.id === selectedId) || null;
      return this.simplePage("场景", "contact", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-scene-library";
        const intro = document.createElement("p");
        intro.className = "mercury-chat-scene-library__intro";
        intro.textContent = "选择后会创建一段独立对话；原文作为这段对话的背景，不会显示成聊天气泡。";
        body.append(intro);
        if (!candidates.length) {
          const empty = document.createElement("section");
          empty.className = "mercury-chat-scene-library__empty";
          const emptyTitle = document.createElement("h2");
          emptyTitle.className = "mercury-chat-scene-library__empty-title";
          emptyTitle.textContent = "未找到可用开场";
          const emptyDetail = document.createElement("p");
          emptyDetail.textContent = sceneState.rejected.some((item) => item.reason === "source-metadata")
            ? "角色卡中的首条内容更像来源说明，Mercury 没有把它自动当作剧情。你仍然可以直接开始聊天。"
            : "这张角色卡没有提供可用开场。你仍然可以直接开始聊天。";
          const blank = this.button("开始空白聊天", "mercury-chat-scene-library__blank", "chat-bubble");
          const blankLabel = document.createElement("span");
          blankLabel.textContent = "开始空白聊天";
          blank.append(blankLabel);
          blank.addEventListener("click", () => this.startNewConversation(contact.id));
          empty.append(emptyTitle, emptyDetail, blank);
          body.append(empty);
          return body;
        }
        const list = document.createElement("section");
        list.className = "mercury-chat-scene-library__list";
        candidates.forEach((candidate, index) => {
          const row = this.button(`查看${candidate.title}`, "mercury-chat-scene-library__item", "spark");
          row.setAttribute("aria-pressed", String(candidate.id === selected?.id));
          const copy = document.createElement("span");
          const title = document.createElement("strong"); title.textContent = candidate.title;
          const detail = document.createElement("small"); detail.textContent = `${candidate.source} · ${candidate.content.length} 字`;
          copy.append(title, detail);
          const number = document.createElement("em"); number.textContent = String(index + 1).padStart(2, "0");
          row.append(copy, number);
          row.addEventListener("click", () => { this.ui.sceneCandidateId = candidate.id; this.paint(); });
          list.append(row);
        });
        body.append(list);
        if (selected) {
          const preview = document.createElement("section");
          preview.className = "mercury-chat-scene-library__preview";
          const heading = document.createElement("div");
          const label = document.createElement("small"); label.textContent = "场景原文";
          const title = document.createElement("h2"); title.textContent = selected.title;
          heading.append(label, title);
          const content = document.createElement("p"); content.textContent = selected.content;
          preview.append(heading, content);
          if (selected.requirementHint) {
            const requirement = document.createElement("p");
            requirement.className = "mercury-chat-scene-library__requirement";
            requirement.textContent = `资源提示：${selected.requirementHint}。不会自动更改当前会话的世界书绑定。`;
            preview.append(requirement);
          }
          const start = this.button("以此开始场景", "mercury-chat-scene-library__start", "chat-bubble");
          const startCopy = document.createElement("span"); startCopy.textContent = "以此开始场景";
          start.append(startCopy);
          start.addEventListener("click", () => this.startSceneConversation(contact.id, selected));
          preview.append(start);
          body.append(preview);
        }
        const blank = this.button("不使用开场，直接聊天", "mercury-chat-scene-library__blank mercury-chat-scene-library__blank--secondary");
        const blankLabel = document.createElement("span");
        blankLabel.textContent = "不使用开场，直接聊天";
        blank.append(blankLabel);
        blank.addEventListener("click", () => this.startNewConversation(contact.id));
        body.append(blank);
        return body;
      }, { pageClass: "mercury-chat-scene-library-page", onBack: () => { this.ui.sceneCandidateId = null; } });
    }
    primaryNavigation() {
      const navigation = document.createElement("nav");
      navigation.className = "mercury-chat-primary-nav";
      navigation.setAttribute("aria-label", this.t("chat.primaryNavigation"));
      const items = [
        { key: "chats", icon: "chat-bubble" }, { key: "contacts", icon: "view-grid" }, { key: "me", icon: "settings" },
      ];
      items.forEach((item) => {
        const button = this.button(this.t(`chat.tabs.${item.key}`), "mercury-chat-primary-nav__item", item.icon);
        button.dataset.tab = item.key;
        button.setAttribute("aria-current", this.ui.route === item.key ? "page" : "false");
        button.addEventListener("click", () => { this.ui.route = item.key; this.ui.panelOpen = false; this.ui.contactsMenuOpen = false; this.paint(); });
        const label = document.createElement("span"); label.textContent = this.t(`chat.tabs.${item.key}`); button.append(label);
        navigation.append(button);
      });
      return navigation;
    }
    conversationView() {
      const view = document.createElement("section");
      view.className = "mercury-chat-conversation";
      const appearance = this.experienceFor(this.activeContactId(), this.activeTimelineId()).appearance || {};
      view.dataset.bubbleStyle = appearance.bubbleStyle || "default";
      view.dataset.chatFont = appearance.chatFont || "system";
      view.dataset.chatFontSize = appearance.chatFontSize || "medium";
      view.dataset.showAvatar = String(appearance.showAvatar !== false);
      view.dataset.showTime = String(appearance.showTime !== false);
      view.dataset.showDate = String(appearance.showDate !== false);
      view.dataset.messageSpacing = appearance.messageSpacing || "comfortable";
      if (appearance.background) {
        view.style.backgroundImage = `linear-gradient(180deg, rgb(237 248 250 / 54%), rgb(195 220 225 / 50%)), url(\"${appearance.background}\")`;
        view.style.backgroundPosition = appearance.cropPosition || "50% 50%";
      }
      view.append(this.conversationHeader());
      const messages = document.createElement("div");
      messages.className = "mercury-chat-messages";
      messages.setAttribute("aria-label", this.t("chat.conversationLabel"));
      messages.setAttribute("role", "log");
      messages.tabIndex = 0;
      messages.addEventListener("scroll", () => this.cancelMessageLongPress());
      const transferReceipt = this.conversationTransferReceiptView();
      if (transferReceipt) messages.append(transferReceipt);
      const sceneContext = this.activeSceneContext();
      if (sceneContext) {
        const scene = this.button(`查看已选场景：${sceneContext.title}`, "mercury-chat-scene-status", "spark");
        const copy = document.createElement("span");
        const label = document.createElement("small"); label.textContent = "已选场景";
        const title = document.createElement("strong"); title.textContent = sceneContext.title;
        copy.append(label, title);
        scene.append(copy, this.icon("nav-arrow-right"));
        scene.addEventListener("click", () => { this.ui.sceneCandidateId = sceneContext.id; this.ui.route = "sceneLibrary"; this.paint(); });
        messages.append(scene);
      }
      const hiddenHistoryCount = this.hiddenHistoryEntryCount();
      if (hiddenHistoryCount) {
        const loadEarlier = this.button(this.t("chat.loadEarlier"), "mercury-chat-history-load", "nav-arrow-left");
        const label = document.createElement("span");
        label.textContent = `${this.t("chat.loadEarlier")}（${hiddenHistoryCount}）`;
        loadEarlier.append(label);
        loadEarlier.addEventListener("click", () => this.loadEarlierHistory());
        messages.append(loadEarlier);
      }
      if (appearance.showDate !== false) {
        const date = document.createElement("p"); date.className = "mercury-chat-date"; date.textContent = this.t("chat.today");
        messages.append(date);
      }
      const entries = this.visibleMessages();
      const byId = new Map(entries.map((message) => [message.id, message]));
      if (!entries.length) { const emptyHint = document.createElement("p"); emptyHint.className = "mercury-chat-empty"; emptyHint.textContent = this.t("chat.noMessagesYet"); messages.append(emptyHint); }
      entries.forEach((message, idx) => {
        const prev = idx > 0 ? entries[idx - 1] : null;
        const isFirstInGroup = message.role === "assistant" && (!prev || prev.role !== "assistant");
        const showAvatar = appearance.showAvatar !== false;
        messages.append(this.messageView(
          message,
          byId.get(message.replyToId) || message.quote || null,
          isFirstInGroup && showAvatar,
          showAvatar,
          appearance.showTime !== false,
        ));
      });
      if (this.ui.generationError) messages.append(this.generationErrorView());
      if (this.ui.pending) messages.append(this.typingBubble());
      view.append(messages, this.composer());
      const actionSheet = this.messageActionSheet();
      if (actionSheet) {
        view.append(actionSheet);
        actionSheet.focus?.({ preventScroll: true });
      }
      return view;
    }

    generationErrorView() {
      const error = this.ui.generationError || {};
      const presentation = this.generationErrorPresentation(error);
      const panel = document.createElement("section");
      panel.className = `mercury-chat-generation-error mercury-chat-generation-error--${presentation.tone}`;
      panel.setAttribute("role", "alert");
      panel.setAttribute("aria-live", "assertive");
      const copy = document.createElement("div");
      copy.className = "mercury-chat-generation-error__copy";
      const title = document.createElement("strong");
      title.textContent = presentation.title;
      const message = document.createElement("p");
      message.textContent = presentation.message;
      copy.append(title, message);
      const actions = document.createElement("div");
      actions.className = "mercury-chat-generation-error__actions";
      if (error.recovery === "ai-connection") {
        const settings = this.button("前往 AI 连接", "mercury-chat-generation-error__action mercury-chat-generation-error__action--primary", "settings");
        const settingsLabel = document.createElement("span");
        settingsLabel.textContent = "前往 AI 连接";
        settings.append(settingsLabel);
        settings.addEventListener("click", () => this.openApp("settings", "ai-connection"));
        actions.append(settings);
      }
      const retryLabelText = presentation.retryLabel;
      const retry = this.button(retryLabelText, "mercury-chat-generation-error__action", "regenerate");
      const retryLabel = document.createElement("span");
      retryLabel.textContent = retryLabelText;
      retry.append(retryLabel);
      retry.addEventListener("click", () => this.retryGenerationError());
      actions.append(retry);
      panel.append(copy, actions);
      return panel;
    }
    generationErrorPresentation(error = {}) {
      if (error.recovery === "ai-connection") return { title: "需要检查 AI 连接", message: String(error.message || "请检查当前标签页的 AI 连接设置。"), retryLabel: error.operation === "send" ? "重新发送" : "重试", tone: "connection" };
      if (error.kind === "cancelled") return { title: "已取消", message: "这次角色回复已停止。需要时可从原消息重试。", retryLabel: "重试", tone: "cancelled" };
      if (error.kind === "storage") return { title: "消息未保存", message: String(error.message || "本地保存失败，请检查存储后重试。"), retryLabel: error.operation === "send" ? "重新发送" : "重试", tone: "storage" };
      if (error.operation === "regenerate") return { title: "重新回复失败", message: String(error.message || "角色回复没有完成，请稍后重试。"), retryLabel: "重试", tone: "failed" };
      return { title: "角色回复失败", message: String(error.message || "角色回复没有完成，请稍后重试。"), retryLabel: "重试", tone: "failed" };
    }

    retryGenerationError() {
      const error = this.ui.generationError;
      if (!error) return false;
      if (error.kind === "preflight" && error.operation === "send") return this.submitDraft();
      if (error.operation === "regenerate") {
        const message = this.messages.find((item) => item.id === error.messageId || item.turnId === error.messageId);
        return message ? this.regenerateMessage(message) : false;
      }
      const message = this.messages.find((item) => item.id === error.messageId && item.role === "user");
      return message ? this.retryMessage(message) : this.submitDraft();
    }
    conversationHeader() {
      const header = document.createElement("header");
      header.className = "mercury-chat-header";
      const back = this.button(this.t("chat.backToChats"), "mercury-chat-header__back", "back");
      back.addEventListener("click", () => { this.ui.route = "chats"; this.ui.selectedMessageId = null; this.paint(); });
      const contact = this.button(`打开${this.activeContact().name}的联系人主页`, "mercury-chat-header__contact");
      const activeContact = this.activeContact();
      const headAvatar = this.avatar("mercury-chat-header__avatar"); headAvatar.src = activeContact.avatar;
      contact.append(headAvatar);
      const copy = document.createElement("span");
      const name = document.createElement("strong"); name.textContent = activeContact.name;
      const presence = document.createElement("small"); presence.textContent = this.t("chat.presence.quiet");
      copy.append(name, presence); contact.append(copy);
      contact.addEventListener("click", () => {
        this.ui.selectedContactId = activeContact.id;
        this.ui.route = "contact";
        this.paint();
      });
      const actions = document.createElement("div");
      actions.className = "mercury-chat-header__actions";
      const search = this.button(this.t("chat.searchHistory"), "mercury-chat-header__utility mercury-chat-header__search", "search");
      search.addEventListener("click", () => { this.ui.route = "historySearch"; this.paint(); });
      const more = this.button(this.t("chat.conversationSettingsTitle"), "mercury-chat-header__more mercury-chat-header__settings", "more");
      more.addEventListener("click", () => { this.ui.route = "settings"; this.paint(); });
      actions.append(search, more);
      header.append(back, contact, actions);
      return header;
    }
    formatMessageTime(iso) {
      if (!iso) return "";
      try {
        return new this.dateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
      } catch { return ""; }
    }
    messagePreview(message) {
      const text = String(message?.content || "").trim();
      if (text) return text;
      const parts = Array.isArray(message?.parts) ? message.parts : [];
      const emoji = parts.filter((part) => part.type === "emoji").map((part) => part.value).join("");
      if (emoji) return emoji;
      return parts.some((part) => part.type === "image") ? this.t("chat.imageMessage") : "";
    }
    avatar(className) {
      const image = document.createElement("img");
      image.className = className;
      image.src = AVATAR_FALLBACK;
      image.alt = "";
      image.addEventListener("error", () => {
        if (image.src !== AVATAR_FALLBACK) image.src = AVATAR_FALLBACK;
      }, { once: true });
      return image;
    }
    splitSpokenAside(text) {
      let body = String(text || "");
      let aside = "";
      // Safety net for the structural three-part format: if the model's reply ever
      // reaches the bubble still carrying <thinking>/<inner-voice> tags, drop the chain-
      // of-thought and fold the inner voice into the aside so none of it shows in a
      // spoken bubble. Normally the server already strips this, this is belt-and-braces.
      const tagRe = /<(\/)?(thinking|inner-voice)\b[^>]*>/gi;
      if (tagRe.test(body)) {
        tagRe.lastIndex = 0;
        const asideFragments = [];
        const bodyFragments = [];
        let mode = "body";
        let cursor = 0;
        let m;
        while ((m = tagRe.exec(body))) {
          const closing = !!m[1];
          const kind = m[2].toLowerCase();
          const before = body.slice(cursor, m.index);
          if (mode === "body") { if (before.trim()) bodyFragments.push(before); }
          else if (mode === "aside") { if (before.trim()) asideFragments.push(before); }
          if (!closing) mode = kind === "inner-voice" ? "aside" : "drop";
          else mode = "body";
          cursor = tagRe.lastIndex;
        }
        const tail = body.slice(cursor);
        if (mode === "body") { if (tail.trim()) bodyFragments.push(tail); }
        else if (mode === "aside") { if (tail.trim()) asideFragments.push(tail); }
        body = bodyFragments.join("\n").replace(/\r?\n+/g, "\n").trim();
        aside = asideFragments.join("\n").trim();
      }
      const opening = body.lastIndexOf("〔心声〕");
      const closing = body.indexOf("〔/心声〕", opening >= 0 ? opening : 0);
      if (opening >= 0 && closing > opening) {
        const inner = body.slice(opening + "〔心声〕".length, closing).trim();
        const spoken = (body.slice(0, opening) + body.slice(closing + "〔/心声〕".length)).trim();
        body = spoken;
        if (inner) aside = aside ? aside + "\n" + inner : inner;
      }
      // Render-layer guarantee: a bubble must be pure spoken words. Drop any bracketed
      // action the model stitched on (（笑了笑）…), same guarantee the server provides.
      body = body.replace(/[（(][^（）()]*[）)]/g, " ").replace(/[ \t]+/g, " ").trim();
      return { body, aside };
    }
    messageView(message, replyTo = null, showAvatar = false, reserveAvatarSpace = true, showTime = true) {
      const row = document.createElement("article");
      const isUser = message.role === "user";
      row.className = `mercury-chat-message mercury-chat-message--${message.role}`;
      row.dataset.messageId = message.id;
      if (!isUser && reserveAvatarSpace) {
        if (showAvatar) row.append(this.avatar("mercury-chat-message__avatar"));
        else {
          const avatarPlaceholder = document.createElement("span");
          avatarPlaceholder.className = "mercury-chat-message__avatar mercury-chat-message__avatar--placeholder";
          avatarPlaceholder.setAttribute("aria-hidden", "true");
          row.append(avatarPlaceholder);
        }
      }
      const stack = document.createElement("div");
      stack.className = "mercury-chat-message__stack";
      if (!isUser && showAvatar) {
        const sender = document.createElement("small");
        sender.className = "mercury-chat-message__sender";
        sender.textContent = this.activeContact().name;
        stack.append(sender);
      }
      const bubble = document.createElement("button");
      bubble.type = "button";
      bubble.className = "mercury-chat-bubble";
      bubble.setAttribute("aria-label", this.t(isUser ? "chat.messageUser" : "chat.messageAssistant"));
      if (replyTo) {
        const quote = document.createElement("span"); quote.className = "mercury-chat-bubble__quote";
        const quoteLabel = document.createElement("span"); quoteLabel.className = "mercury-chat-bubble__quote-label"; quoteLabel.textContent = this.t("chat.quoteLabel");
        const quotePreview = document.createElement("span"); quotePreview.className = "mercury-chat-bubble__quote-preview"; quotePreview.textContent = replyTo.content || replyTo.text || "";
        quote.append(quoteLabel, quotePreview); bubble.append(quote);
      }
      const splitAside = this.splitSpokenAside(message.content);
      this.appendMessageParts(bubble, message, splitAside.body);
      const meta = document.createElement("span"); meta.className = "mercury-chat-bubble__meta";
      if (showTime) {
        const time = document.createElement("time"); time.textContent = this.formatMessageTime(message.createdAt);
        meta.append(time);
      }
      if (isUser) {
        const delivery = this.messageDeliveryPresentation(message);
        if (delivery.visible) {
          const label = document.createElement("span");
          label.className = `mercury-chat-delivery-label mercury-chat-delivery-label--${delivery.tone}`;
          label.textContent = delivery.label;
          meta.append(label);
        }
        if (delivery.showMark) {
          const status = document.createElement("i");
          status.className = `mercury-chat-status mercury-chat-status--${message.delivery}`;
          status.setAttribute("aria-label", delivery.label);
          meta.append(status);
        }
      }
      if (meta.children.length) bubble.append(meta);
      this.bindMessagePress(bubble, message);
      stack.append(bubble);
      const asideText = message.unspokenAside || splitAside.aside;
      if (!isUser && asideText) {
        const aside = document.createElement("div");
        aside.className = "mercury-chat-aside";
        aside.setAttribute("aria-label", this.t("chat.aside"));
        const ink = document.createElement("span"); ink.className = "mercury-chat-aside__ink"; ink.textContent = asideText;
        aside.append(ink);
        stack.append(aside);
      }
      if (!isUser && (message.versionCount || 1) > 1) stack.append(this.messageVersionControl(message));
      if (this.ui.selectedMessageId === message.id || (!isUser ? false : ["failed", "cancelled"].includes(message.delivery))) stack.append(this.messageAction(message));
      row.append(stack);
      return row;
    }
    appendMessageParts(bubble, message, fallbackText) {
      const parts = Array.isArray(message?.parts) && message.parts.length ? message.parts : null;
      if (!parts) {
        const content = document.createElement("span");
        content.className = "mercury-chat-bubble__content";
        content.textContent = fallbackText;
        bubble.append(content);
        return;
      }
      parts.forEach((part) => {
        if (part.type === "image") {
          const image = document.createElement("img");
          image.className = "mercury-chat-bubble__image";
          image.src = part.src;
          image.alt = part.alt || this.t("chat.imageMessage");
          bubble.append(image);
        } else if (part.type === "emoji") {
          const emoji = document.createElement("span");
          emoji.className = "mercury-chat-bubble__emoji";
          emoji.textContent = part.value;
          emoji.setAttribute("aria-label", this.t("chat.emojiMessage"));
          bubble.append(emoji);
        } else if (part.type === "text") {
          const content = document.createElement("span");
          content.className = "mercury-chat-bubble__content";
          content.textContent = part.text;
          bubble.append(content);
        }
      });
    }
    messageDeliveryPresentation(message) {
      const delivery = String(message?.delivery || "complete");
      if (["sending", "queued", "processing"].includes(delivery)) {
        return { label: this.t(`chat.delivery.${delivery}`), tone: "pending", visible: this.ui?.pending !== true, showMark: true };
      }
      if (delivery === "failed") return { label: this.t("chat.delivery.failed"), tone: "failed", visible: true, showMark: false };
      if (delivery === "cancelled") return { label: this.t("chat.delivery.cancelled"), tone: "cancelled", visible: true, showMark: false };
      return { label: this.t("chat.delivery.complete"), tone: "complete", visible: false, showMark: true };
    }
    messageActionsFor(message) {
      const isUser = message.role === "user";
      const retryable = isUser && ["failed", "cancelled"].includes(message.delivery);
      const hasText = Boolean(String(message.content || "").trim());
      return [
        hasText ? { key: "copy", label: this.t(this.ui.copiedMessageId === message.id ? "chat.copiedMessage" : "chat.copyMessage"), iconName: "copy", run: () => this.copyMessage(message) } : null,
        hasText ? { key: "quote", label: this.t("chat.quoteMessage"), iconName: "quote", run: () => this.quoteMessage(message) } : null,
        retryable ? { key: "retry", label: this.t("chat.retryMessage"), iconName: "regenerate", run: () => this.retryMessage(message) } : null,
        !isUser ? { key: "regenerate", label: this.t("chat.regenerateMessage"), iconName: "regenerate", run: () => this.regenerateMessage(message) } : null,
        { key: "delete", label: this.t("chat.deleteMessage"), iconName: "delete", danger: true, run: () => this.deleteMessage(message) },
      ].filter(Boolean);
    }
    messageAction(message) {
      const actions = document.createElement("div");
      actions.className = "mercury-chat-message__actions";
      actions.setAttribute("role", "toolbar");
      actions.setAttribute("aria-label", this.t("chat.messageActions"));
      this.messageActionsFor(message).forEach((descriptor) => {
        const button = this.button(descriptor.label, `mercury-chat-message__action mercury-chat-message__action--${descriptor.key}`, descriptor.iconName);
        button.title = descriptor.label;
        button.addEventListener("click", (event) => { event.stopPropagation(); descriptor.run(); });
        actions.append(button);
      });
      return actions;
    }
    bindMessagePress(bubble, message) {
      const start = (event = {}) => {
        if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
        this.cancelMessageLongPress();
        const press = {
          messageId: message.id,
          pointerId: event.pointerId,
          startX: Number(event.clientX) || 0,
          startY: Number(event.clientY) || 0,
          bubble,
          timerId: null,
        };
        bubble.dataset.longPress = "pending";
        press.timerId = this.scheduleTimeout(() => {
          if (this.messagePress !== press) return;
          press.timerId = null;
          this.messagePress = null;
          delete bubble.dataset.longPress;
          this.suppressedMessageClick = { messageId: message.id, until: this.clock() + this.messageLongPressClickBlockMs };
          this.openMessageActionSheet(message);
        }, this.messageLongPressDelayMs);
        this.messagePress = press;
      };
      const move = (event = {}) => {
        const press = this.messagePress;
        if (!press || press.messageId !== message.id || (press.pointerId !== undefined && event.pointerId !== undefined && press.pointerId !== event.pointerId)) return;
        const dx = (Number(event.clientX) || 0) - press.startX;
        const dy = (Number(event.clientY) || 0) - press.startY;
        if (Math.hypot(dx, dy) > this.messageLongPressMovePx) this.cancelMessageLongPress();
      };
      const end = (event = {}) => {
        const press = this.messagePress;
        if (!press || (press.pointerId !== undefined && event.pointerId !== undefined && press.pointerId !== event.pointerId)) return;
        this.cancelMessageLongPress();
      };
      bubble.addEventListener("pointerdown", start, { passive: true });
      bubble.addEventListener("pointermove", move, { passive: true });
      bubble.addEventListener("pointerup", end);
      bubble.addEventListener("pointercancel", end);
      bubble.addEventListener("contextmenu", (event) => {
        const suppression = this.suppressedMessageClick;
        if (!suppression || suppression.messageId !== message.id) return;
        if (suppression.until < this.clock()) {
          this.suppressedMessageClick = null;
          return;
        }
        event.preventDefault?.();
      });
      bubble.addEventListener("click", (event = {}) => {
        if (this.consumeSuppressedMessageClick(message.id)) {
          event.preventDefault?.();
          event.stopPropagation?.();
          return;
        }
        this.ui.selectedMessageId = this.ui.selectedMessageId === message.id ? null : message.id;
        this.paint();
      });
    }
    cancelMessageLongPress() {
      const press = this.messagePress;
      if (!press) return false;
      if (press.timerId !== null) this.cancelTimeout(press.timerId);
      if (press.bubble?.dataset) delete press.bubble.dataset.longPress;
      this.messagePress = null;
      return true;
    }
    consumeSuppressedMessageClick(messageId) {
      const suppression = this.suppressedMessageClick;
      if (!suppression || suppression.messageId !== messageId) return false;
      this.suppressedMessageClick = null;
      return suppression.until >= this.clock();
    }
    openMessageActionSheet(message) {
      if (!message?.id || !this.messages.some((item) => item.id === message.id)) return false;
      this.cancelMessageLongPress();
      this.ui.selectedMessageId = null;
      this.ui.messageActionSheetId = message.id;
      this.paint();
      return true;
    }
    closeMessageActionSheet() {
      if (!this.ui.messageActionSheetId) return false;
      this.ui.messageActionSheetId = null;
      this.paint();
      return true;
    }
    messageActionSheet() {
      const messageId = this.ui.messageActionSheetId;
      if (!messageId) return null;
      const message = this.messages.find((item) => item.id === messageId);
      if (!message) { this.ui.messageActionSheetId = null; return null; }
      const overlay = document.createElement("div");
      overlay.className = "mercury-chat-action-sheet-overlay";
      overlay.tabIndex = -1;
      const backdrop = this.button(this.t("chat.closeMessageActions"), "mercury-chat-action-sheet__backdrop");
      backdrop.addEventListener("click", () => this.closeMessageActionSheet());
      const sheet = document.createElement("section");
      sheet.className = "mercury-chat-action-sheet";
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-modal", "true");
      sheet.setAttribute("aria-label", this.t("chat.messageActions"));
      const handle = document.createElement("span");
      handle.className = "mercury-chat-action-sheet__handle";
      handle.setAttribute("aria-hidden", "true");
      const heading = document.createElement("div");
      heading.className = "mercury-chat-action-sheet__heading";
      const title = document.createElement("strong");
      title.textContent = this.t("chat.messageActions");
      const preview = document.createElement("small");
      preview.textContent = this.messagePreview(message);
      heading.append(title, preview);
      const actions = document.createElement("div");
      actions.className = "mercury-chat-action-sheet__actions";
      this.messageActionsFor(message).forEach((descriptor) => {
        const action = this.button(descriptor.label, `mercury-chat-action-sheet__action mercury-chat-action-sheet__action--${descriptor.key}${descriptor.danger ? " mercury-chat-action-sheet__action--danger" : ""}`, descriptor.iconName);
        const label = document.createElement("span");
        label.textContent = descriptor.label;
        action.append(label);
        action.addEventListener("click", () => {
          this.ui.messageActionSheetId = null;
          this.paint();
          descriptor.run();
        });
        actions.append(action);
      });
      sheet.append(handle, heading, actions);
      overlay.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault?.();
        this.closeMessageActionSheet();
      });
      overlay.append(backdrop, sheet);
      return overlay;
    }
    deleteMessage(message) {
      const entries = this.conversation.entries;
      const targetId = message.id;
      const next = entries.filter((entry) => {
        if (entry.role === "user") return entry.id !== targetId;
        const inTurn = entry.legacyMessageId === targetId || (Array.isArray(entry.parts) && entry.parts.some((part) => part.id === targetId));
        return !inTurn;
      });
      if (next.length === entries.length) return false;
      if (this.generationWorkflow?.snapshot().messageId === targetId) this.cancelRequest({ silent: true });
      this.conversation = { ...this.conversation, entries: next };
      this.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(this.conversation));
      if (this.ui.replyingTo?.messageId === targetId) this.ui.replyingTo = null;
      this.ui.selectedMessageId = null;
      this.persistMessages();
      this.paint();
      return true;
    }
    async copyMessage(message) {
      const content = String(message?.content || "").trim();
      if (!content) return false;
      try {
        const clipboard = this.context?.services?.clipboard || global.navigator?.clipboard;
        if (typeof clipboard?.writeText === "function") await clipboard.writeText(content);
        else if (typeof document?.execCommand === "function") {
          const input = document.createElement("textarea");
          input.value = content;
          input.setAttribute("readonly", "");
          input.style.position = "fixed";
          input.style.opacity = "0";
          (document.body || document.documentElement).append(input);
          input.select();
          const copied = document.execCommand("copy");
          input.remove();
          if (!copied) return false;
        } else return false;
        this.ui.copiedMessageId = message.id;
        this.paint();
        return true;
      } catch (_) { return false; }
    }
    quoteMessage(message) {
      const content = String(message?.content || "").trim();
      if (!message?.id || !content) return false;
      this.ui.replyingTo = { messageId: message.id, author: message.role === "assistant" ? "assistant" : "user", content };
      this.ui.selectedMessageId = null;
      this.paint();
      return true;
    }
    clearQuote() {
      if (!this.ui.replyingTo) return false;
      this.ui.replyingTo = null;
      this.paint();
      return true;
    }
    assistantEntryIndexForMessage(message) {
      const turnId = message?.turnId;
      return (this.conversation?.entries || []).findIndex((entry) => entry.role === "assistant" && (entry.id === turnId || entry.id === message?.id || entry.legacyMessageId === message?.id || entry.parts?.some((part) => part.id === message?.id)));
    }
    selectAssistantVersion(message, versionId) {
      const index = this.assistantEntryIndexForMessage(message);
      if (index < 0) return false;
      const entry = this.conversation.entries[index];
      const versions = Array.isArray(entry.versions) ? entry.versions : [];
      const version = versions.find((item) => item.id === versionId);
      if (!version || entry.activeVersionId === version.id) return false;
      const updated = { ...entry, parts: version.parts.map((part) => ({ ...part })), status: version.status, createdAt: version.createdAt, usage: version.usage ?? null, unspokenAside: version.unspokenAside ?? null, legacyMessageId: version.legacyMessageId || version.id, activeVersionId: version.id };
      const entries = this.conversation.entries.map((item, entryIndex) => entryIndex === index ? updated : item);
      this.conversation = { ...this.conversation, entries };
      global.MercuryChatContracts.validateConversationV2(this.conversation);
      this.messages = Object.freeze(global.MercuryChatContracts.entriesToLegacyMessages(this.conversation));
      this.ui.selectedMessageId = updated.legacyMessageId;
      this.ui.messageViewportIntent = { kind: "anchor", messageId: updated.legacyMessageId };
      this.persistMessages();
      this.paint();
      return true;
    }
    messageVersionControl(message) {
      const entry = this.conversation?.entries?.[this.assistantEntryIndexForMessage(message)];
      const versions = Array.isArray(entry?.versions) ? entry.versions : [];
      const activeIndex = Math.max(0, versions.findIndex((version) => version.id === entry?.activeVersionId));
      const control = document.createElement("div");
      control.className = "mercury-chat-message__versions";
      const previous = this.button(this.t("chat.previousVersion"), "mercury-chat-message__version-button");
      previous.disabled = activeIndex <= 0;
      previous.append(this.icon("nav-arrow-left"));
      previous.addEventListener("click", (event) => { event.stopPropagation(); this.selectAssistantVersion(message, versions[activeIndex - 1]?.id); });
      const label = document.createElement("span");
      label.textContent = `${this.t("chat.messageVersion")} ${activeIndex + 1}/${versions.length}`;
      const next = this.button(this.t("chat.nextVersion"), "mercury-chat-message__version-button");
      next.disabled = activeIndex >= versions.length - 1;
      next.append(this.icon("nav-arrow-right"));
      next.addEventListener("click", (event) => { event.stopPropagation(); this.selectAssistantVersion(message, versions[activeIndex + 1]?.id); });
      control.append(previous, label, next);
      return control;
    }
    typingView() {
      const typing = document.createElement("div"); typing.className = "mercury-chat-typing"; typing.setAttribute("aria-label", this.t("chat.typing"));
      for (let i = 0; i < 3; i += 1) typing.append(document.createElement("i"));
      return typing;
    }
    typingBubble() {
      const bubble = document.createElement("div"); bubble.className = "mercury-chat-message mercury-chat-message--assistant";
      const avatarPlaceholder = document.createElement("span");
      avatarPlaceholder.className = "mercury-chat-message__avatar mercury-chat-message__avatar--placeholder";
      avatarPlaceholder.setAttribute("aria-hidden", "true");
      const content = document.createElement("span"); content.className = "mercury-chat-bubble mercury-chat-bubble--typing";
      const labelText = `${this.activeContact().name}正在回复`;
      content.setAttribute("aria-label", labelText);
      const label = document.createElement("span");
      label.className = "mercury-chat-typing__label";
      label.textContent = labelText;
      content.append(label, this.typingView());
      bubble.append(avatarPlaceholder, content);
      return bubble;
    }
    composer() {
      const composer = document.createElement("form"); composer.className = "mercury-chat-composer";
      composer.addEventListener("submit", (event) => { event.preventDefault(); this.submitDraft(); });
      const pending = this.ui.pending === true;
      if (this.ui.replyingTo) {
        const reply = document.createElement("div");
        reply.className = "mercury-chat-composer__quote";
        const copy = document.createElement("span");
        const title = document.createElement("strong"); title.textContent = `${this.t("chat.quoteMessage")} · ${this.ui.replyingTo.author === "user" ? this.t("chat.messageUser") : this.activeContact().name}`;
        const preview = document.createElement("small"); preview.textContent = this.ui.replyingTo.content;
        copy.append(title, preview);
        const cancel = this.button(this.t("chat.cancelQuote"), "mercury-chat-composer__quote-cancel", "cancel");
        cancel.addEventListener("click", () => this.clearQuote());
        reply.append(copy, cancel);
        composer.append(reply);
      }
      if (this.composerParts().length) composer.append(this.composerPartsPreview());
      const attachment = this.button("添加图片或表情", "mercury-chat-composer__attachments-trigger", "attachment");
      attachment.disabled = pending;
      attachment.addEventListener("click", () => { this.ui.emojiPickerOpen = false; this.ui.panelOpen = !this.ui.panelOpen; this.paint(); });
      const input = document.createElement("textarea"); input.rows = 1; input.value = this.ui.draft || ""; input.placeholder = this.t("chat.messagePlaceholder"); input.setAttribute("aria-label", this.t("chat.messagePlaceholder")); input.disabled = pending;
      const send = this.button(this.t(pending ? "chat.cancelRequest" : "chat.send"), "mercury-chat-composer__send", pending ? "cancel" : "send");
      send.type = pending ? "button" : "submit";
      send.disabled = !pending && !input.value.trim() && !this.composerParts().length;
      const resizeInput = () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight || 37, 96)}px`; };
      input.addEventListener("input", () => {
        this.saveDraft(input.value);
        resizeInput();
        send.disabled = this.ui.pending === true || (!this.ui.draft.trim() && !this.composerParts().length);
        const icon = send.children?.[0];
        if (icon && !this.ui.pending) icon.src = `${ICON_ROOT}send.svg`;
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); this.submitDraft(); }
      });
      resizeInput();
      if (pending) send.addEventListener("click", () => this.cancelRequest());
      composer.append(attachment, input, send);
      if (this.ui.panelOpen) composer.append(this.plusPanel());
      return composer;
    }
    composerParts() { return Array.isArray(this.ui.composerParts) ? this.ui.composerParts : []; }
    composerPartsPreview() {
      const preview = document.createElement("div");
      preview.className = "mercury-chat-composer__attachments";
      this.composerParts().forEach((part) => {
        const item = document.createElement("div");
        item.className = `mercury-chat-composer__attachment mercury-chat-composer__attachment--${part.type}`;
        if (part.type === "image") {
          const image = document.createElement("img"); image.src = part.src; image.alt = part.alt || this.t("chat.imageMessage"); item.append(image);
        } else {
          const value = document.createElement("span"); value.textContent = part.value; value.setAttribute("aria-label", this.t("chat.emojiMessage")); item.append(value);
        }
        const remove = this.button(this.t("chat.removeAttachment"), "mercury-chat-composer__attachment-remove", "cancel");
        remove.addEventListener("click", () => this.removeComposerPart(part.id));
        item.append(remove);
        preview.append(item);
      });
      return preview;
    }
    removeComposerPart(partId) {
      const next = this.composerParts().filter((part) => part.id !== partId);
      if (next.length === this.composerParts().length) return false;
      this.ui.composerParts = next;
      this.paint();
      return true;
    }
    addEmojiPart(value) {
      const part = { id: `emoji-${Date.now()}-${++this.messageSequence}`, type: "emoji", value: String(value || "").trim() };
      return this.stageComposerPart(part);
    }
    stageComposerPart(part) {
      if (this.ui.pending === true || this.composerParts().length >= 8) return false;
      try { global.MercuryChatContracts.validateUserPart(part); } catch (_) { return false; }
      this.ui.composerParts = [...this.composerParts(), { ...part }];
      this.ui.composerMediaError = null;
      this.ui.emojiPickerOpen = false;
      this.ui.panelOpen = false;
      this.paint();
      return true;
    }
    chooseMessageImage() {
      if (this.ui.pending === true || this.composerParts().length >= 8) return false;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = global.MercuryChatContracts.IMAGE_MIME_TYPES.join(",");
      input.hidden = true;
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        if (!global.MercuryChatContracts.IMAGE_MIME_TYPES.includes(file.type)) { this.ui.composerMediaError = this.t("chat.imageUnsupported"); input.remove?.(); this.paint(); return; }
        if (!Number.isFinite(file.size) || file.size < 1 || file.size > global.MercuryChatContracts.MAX_IMAGE_BYTES) { this.ui.composerMediaError = this.t("chat.imageTooLarge"); input.remove?.(); this.paint(); return; }
        if (typeof FileReader === "undefined") return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          this.stageComposerPart({ id: `image-${Date.now()}-${++this.messageSequence}`, type: "image", src: String(reader.result || ""), mimeType: file.type, size: file.size, alt: file.name || this.t("chat.imageMessage") });
          input.remove?.();
        });
        reader.readAsDataURL(file);
      });
      (document.body || document.documentElement).append?.(input);
      input.click();
      return true;
    }
    plusPanel() {
      const panel = document.createElement("section"); panel.className = "mercury-chat-plus-panel";
      const group = (title, actions) => { const section = document.createElement("section"); const heading = document.createElement("h2"); heading.textContent = title; const grid = document.createElement("div"); grid.className = "mercury-chat-plus-panel__grid"; actions.forEach(([label, icon, route, callback]) => { const action = this.button(label, "mercury-chat-plus-panel__action", icon); const text = document.createElement("span"); text.textContent = label; action.append(text); action.addEventListener("click", () => { if (callback) callback(); else if (route) { this.ui.route = route; this.ui.panelOpen = false; this.paint(); } else { action.dataset.state = "coming"; action.title = "Coming soon"; } }); grid.append(action); }); section.append(heading, grid); return section; };
      panel.append(group("添加内容", [["图片", "gallery", null, () => this.chooseMessageImage()], ["表情", "emoji", null, () => { this.ui.emojiPickerOpen = !this.ui.emojiPickerOpen; this.paint(); }]]));
      if (this.ui.emojiPickerOpen) {
        const emojiTray = document.createElement("div");
        emojiTray.className = "mercury-chat-emoji-tray";
        ["🙂", "✨", "❤️", "😭", "👍", "🌙", "☕", "🌧️"].forEach((emoji) => { const action = this.button(emoji, "mercury-chat-emoji-tray__item"); action.textContent = emoji; action.addEventListener("click", () => this.addEmojiPart(emoji)); emojiTray.append(action); });
        panel.append(emojiTray);
      }
      if (this.ui.composerMediaError) {
        const error = document.createElement("p");
        error.className = "mercury-chat-plus-panel__error";
        error.textContent = this.ui.composerMediaError;
        panel.append(error);
      }
      return panel;
    }
    simplePage(title, backRoute, build, options = {}) {
      const page = document.createElement("section");
      page.className = `mercury-chat-page${options.pageClass ? ` ${options.pageClass}` : ""}`;
      const header = document.createElement("header");
      header.className = "mercury-chat-page__header";
      const back = this.button("返回", "mercury-chat-header__back", "nav-arrow-left");
      back.addEventListener("click", () => {
        options.onBack?.();
        this.ui.route = backRoute;
        this.ui.contactsMenuOpen = false;
        this.paint();
      });
      const h1 = document.createElement("h1");
      h1.textContent = title;
      header.append(back, h1);
      if (options.headerAction) header.append(options.headerAction);
      const content = build();
      content.setAttribute("data-gesture-exclusion", "true");
      page.append(header, content);
      return page;
    }
    chooseImage(apply, options = {}) { const persist = options.persist !== false; const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.hidden = true; input.addEventListener("change", () => { const file = input.files?.[0]; if (!file || typeof FileReader === "undefined") return; const reader = new FileReader(); reader.addEventListener("load", () => { apply(String(reader.result || "")); if (persist) this.saveExperience(); this.paint(); }); reader.readAsDataURL(file); }); input.click(); }
    settingsRow(label, value, choices, onChange, displayValue = value) { const row = document.createElement("button"); row.type = "button"; row.className = "mercury-chat-settings-row"; const copy = document.createElement("span"); copy.textContent = label; const selected = document.createElement("small"); selected.textContent = displayValue; row.append(copy, selected, this.icon("nav-arrow-right")); row.addEventListener("click", () => { const next = choices[(choices.indexOf(value) + 1) % choices.length]; onChange(next); this.paint(); }); return row; }
    settingsToggleRow(label, active, onChange) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "mercury-chat-settings-row mercury-chat-settings-toggle-row";
      row.setAttribute("aria-pressed", active ? "true" : "false");
      const copy = document.createElement("span");
      copy.textContent = label;
      const toggle = document.createElement("span");
      toggle.className = `mercury-chat-toggle${active ? " mercury-chat-toggle--on" : ""}`;
      toggle.setAttribute("aria-hidden", "true");
      const thumb = document.createElement("i");
      toggle.append(thumb);
      row.append(copy, toggle);
      row.addEventListener("click", () => { onChange(!active); });
      return row;
    }
    conversationSettingsViewV12() {
      const item = this.experienceFor(this.activeContactId(), this.activeTimelineId());
      return this.simplePage(this.t("chat.conversationSettingsTitle"), "conversation", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-settings mercury-chat-settings--reference";
        const group = (rows, className = "") => {
          const section = document.createElement("section");
          section.className = `mercury-chat-settings__group${className ? ` ${className}` : ""}`;
          section.append(...rows);
          return section;
        };
        const contact = this.activeContact();
        const contactCard = this.button(`${this.t("chat.viewContact")} ${contact.name}`, "mercury-chat-settings__contact-card");
        const avatar = this.avatar("mercury-chat-settings__contact-avatar");
        avatar.src = contact.avatar;
        const copy = document.createElement("span");
        const name = document.createElement("strong"); name.textContent = contact.name;
        const presence = document.createElement("small"); presence.textContent = this.t("chat.contactOnline");
        copy.append(name, presence);
        contactCard.append(avatar, copy, this.icon("nav-arrow-right"));
        contactCard.addEventListener("click", () => { this.ui.route = "contact"; this.paint(); });
        const setState = (key, value) => {
          this.setConversationListState(this.activeContactId(), this.activeTimelineId(), key, value);
          if (key === "hidden" && value) this.ui.route = "chats";
          this.paint();
        };
        const { worlds, inheritedIds } = this.resourceWorldBooks();
        const selectedIds = item.resourceBindings.worldBookMode === "inherit" ? inheritedIds : item.resourceBindings.worldBookIds;
        const resourceRow = this.settingsRow("资源与上下文", `世界书 ${selectedIds.length} 份`, [""], () => { this.ui.route = "conversationResources"; this.paint(); });
        const memoryMode = this.vectorMemoryState.semanticEnabled ? "本地语义" : "关键词检索";
        const memoryRow = this.settingsRow("语义记忆", memoryMode, [""], () => { this.ui.route = "semanticMemory"; this.paint(); });
        const timeFlowLabels = { realtime: "现实时间", narrative: "叙事时间" };
        const timeFlowRow = this.settingsRow("时间流动", item.settings.timeFlow, ["realtime", "narrative"], (value) => { item.settings.timeFlow = value; this.saveExperience(); }, timeFlowLabels[item.settings.timeFlow] || "现实时间");
        const beautifyRow = this.settingsRow("聊天美化", "背景、气泡、字体", [""], () => { this.ui.route = "chatBeautify"; this.paint(); });
        const historyRow = this.settingsRow(this.t("chat.searchHistory"), "", [""], () => { this.ui.route = "historySearch"; this.paint(); });
        const portableExportRow = this.settingsRow("导出聊天文件", "可再次导入", [""], () => this.downloadConversation(global.MercuryConversationTransferContracts.FORMATS.PORTABLE));
        const textExportRow = this.settingsRow("导出可读文本", "仅供阅读", [""], () => this.downloadConversation(global.MercuryConversationTransferContracts.FORMATS.TEXT));
        const importRow = this.settingsRow("导入聊天文件", "新建会话", [""], () => this.openConversationTransferPicker());
        const clearRow = this.settingsRow("\u6e05\u7a7a\u804a\u5929\u8bb0\u5f55", "", [""], () => this.clearActiveConversation());
        const deleteRow = this.settingsRow("\u5220\u9664\u4f1a\u8bdd", "", [""], () => this.deleteActiveConversation());
        deleteRow.classList.add("mercury-chat-settings-row--danger");
        if (this.ui.conversationTransferError) {
          const transferError = document.createElement("p");
          transferError.className = "mercury-chat-settings__note mercury-chat-settings__note--error";
          transferError.textContent = this.ui.conversationTransferError;
          body.append(transferError);
        }
        body.append(
          contactCard,
          group([resourceRow, memoryRow, timeFlowRow, beautifyRow], "mercury-chat-settings__group--single"),
          group([historyRow, portableExportRow, textExportRow, importRow, this.settingsToggleRow(this.t("chat.pinConversation"), Boolean(item.pinned), (value) => setState("pinned", value))], "mercury-chat-settings__group--single"),
          group([clearRow, deleteRow], "mercury-chat-settings__group--single"),
        );
        return body;
      }, { pageClass: "mercury-chat-conversation-settings-page" });
    }
    conversationResourcesView() {
      const item = this.experienceFor(this.activeContactId(), this.activeTimelineId());
      const bindings = item.resourceBindings;
      const contact = this.activeContact();
      const { worlds, inheritedIds } = this.resourceWorldBooks();
      const selectedIds = bindings.worldBookMode === "inherit" ? inheritedIds : bindings.worldBookIds;
      const preset = this.presetRuntimeState(item);
      return this.simplePage("资源与上下文", "settings", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-settings mercury-chat-settings--reference mercury-chat-resource-settings";
        const note = document.createElement("p");
        note.className = "mercury-chat-resource-settings__note";
        note.textContent = "这里只影响当前会话，不会修改联系人或档案馆中的原始资源。";
        const profile = this.button("查看角色资料", "mercury-chat-resource-summary");
        const profileCopy = document.createElement("span");
        const profileLabel = document.createElement("small"); profileLabel.textContent = "角色资料";
        const profileName = document.createElement("strong"); profileName.textContent = contact?.name || "未绑定角色";
        const profileState = document.createElement("em"); profileState.textContent = bindings.runtimeProfileId ? "已绑定" : "未绑定";
        profileCopy.append(profileLabel, profileName);
        profile.append(profileCopy, profileState, this.icon("nav-arrow-right"));
        profile.addEventListener("click", () => { this.ui.route = "contact"; this.paint(); });
        const presetRow = this.settingsRow("玩法预设", `${preset.name} · ${preset.label}`, [""], () => { if (this.presetLayerReady()) { this.ui.route = "presetList"; this.paint(); } });
        const resourceGroup = document.createElement("section");
        resourceGroup.className = "mercury-chat-resource-worlds";
        const heading = document.createElement("div");
        heading.className = "mercury-chat-resource-worlds__heading";
        const title = document.createElement("strong"); title.textContent = "世界书";
        const count = document.createElement("small"); count.textContent = `已选择 ${selectedIds.length} 份`;
        heading.append(title, count);
        const modes = document.createElement("div");
        modes.className = "mercury-chat-resource-worlds__modes";
        [["inherit", "随角色卡"], ["explicit", "仅本会话"]].forEach(([mode, label]) => {
          const button = this.button(label, "mercury-chat-resource-worlds__mode");
          button.textContent = label;
          button.setAttribute("aria-pressed", String(bindings.worldBookMode === mode));
          button.addEventListener("click", () => { this.setSessionWorldBookMode(mode); this.paint(); });
          modes.append(button);
        });
        resourceGroup.append(heading, modes);
        if (!worlds.length) {
          const empty = document.createElement("p");
          empty.className = "mercury-chat-resource-worlds__empty";
          empty.textContent = "档案馆中还没有可用世界书。";
          resourceGroup.append(empty);
        } else {
          worlds.forEach((world) => {
            const active = selectedIds.includes(world.id);
            const row = this.button(`切换世界书 ${world.name}`, "mercury-chat-resource-world");
            row.setAttribute("aria-pressed", String(active));
            const copy = document.createElement("span");
            const name = document.createElement("strong"); name.textContent = world.name || "未命名世界书";
            const meta = document.createElement("small"); meta.textContent = `${Array.isArray(world.entries) ? world.entries.length : 0} 条目${inheritedIds.includes(world.id) ? " · 关联角色" : ""}`;
            copy.append(name, meta);
            const toggle = document.createElement("span");
            toggle.className = `mercury-chat-toggle${active ? " mercury-chat-toggle--on" : ""}`;
            toggle.setAttribute("aria-hidden", "true");
            toggle.append(document.createElement("i"));
            row.append(copy, toggle);
            row.addEventListener("click", () => {
              const next = new Set(selectedIds);
              if (active) next.delete(world.id); else next.add(world.id);
              this.setSessionWorldBookBindings(Array.from(next));
              this.paint();
            });
            resourceGroup.append(row);
          });
        }
        const archiveRow = this.settingsRow("在档案馆管理世界书", "打开档案馆", [""], () => this.openApp("archive", "worlds"));
        const diagnostic = document.createElement("section");
        diagnostic.className = "mercury-chat-settings__group mercury-chat-resource-diagnostics";
        const diagnosticTitle = document.createElement("h2");
        diagnosticTitle.textContent = "\u672c\u6b21\u8fd0\u884c";
        diagnostic.append(diagnosticTitle);
        const diagnosticRow = (label, value) => {
          const row = document.createElement("div");
          row.className = "mercury-chat-settings-row mercury-chat-settings-row--readonly";
          const rowLabel = document.createElement("span");
          rowLabel.textContent = label;
          const rowValue = document.createElement("small");
          rowValue.textContent = value;
          row.append(rowLabel, rowValue);
          return row;
        };
        const trace = this.currentResourceRuntimeTrace();
        if (!trace) {
          diagnostic.append(diagnosticRow("\u4e16\u754c\u4e66\u547d\u4e2d", "\u5c1a\u672a\u53d1\u9001\u6d88\u606f"));
          const help = document.createElement("p");
          help.className = "mercury-chat-resource-diagnostics__note";
          help.textContent = "\u53d1\u9001\u540e\u663e\u793a\u672c\u4f1a\u8bdd\u5b9e\u9645\u8fdb\u5165\u8fd0\u884c\u65f6\u7684\u6761\u76ee\uff0c\u4e0d\u663e\u793a\u6761\u76ee\u6b63\u6587\u3002";
          diagnostic.append(help);
        } else {
          const selected = Array.isArray(trace.selectedEntries) ? trace.selectedEntries : [];
          diagnostic.append(diagnosticRow("\u4e16\u754c\u4e66\u547d\u4e2d", selected.length ? `${selected.length} \u6761\u5df2\u8fdb\u5165\u8fd0\u884c\u65f6` : "\u672c\u6b21\u672a\u547d\u4e2d"));
          if (selected.length) diagnostic.append(diagnosticRow("\u547d\u4e2d\u6761\u76ee", selected.slice(0, 3).map((entry) => `${entry.worldName || "\u4e16\u754c\u4e66"} \u00b7 ${entry.title || "\u672a\u547d\u540d\u6761\u76ee"}`).join("\uff1b")));
          const warnings = Array.isArray(trace.warnings) ? trace.warnings : [];
          if (warnings.length) diagnostic.append(diagnosticRow("\u8fd0\u884c\u63d0\u793a", `${warnings.length} \u6761\u9884\u7b97\u6216\u517c\u5bb9\u63d0\u793a`));
        }
        const systemGroup = document.createElement("section");
        systemGroup.className = "mercury-chat-settings__group mercury-chat-settings__group--single";
        systemGroup.append(presetRow, archiveRow);
        body.append(note, profile, resourceGroup, diagnostic, systemGroup);
        return body;
      }, { pageClass: "mercury-chat-conversation-resources-page" });
    }
    async refreshVectorMemorySummary() {
      if (!this.vectorMemoryStore?.isAvailable?.()) return null;
      try {
        const entries = await this.vectorMemoryStore.list(this.vectorMemoryScope());
        this.vectorMemoryState.entryCount = entries.length;
        this.vectorMemoryState.summaryError = null;
        return entries.length;
      } catch (_) {
        this.vectorMemoryState.summaryError = "local-memory-unavailable";
        return null;
      }
    }
    async clearVectorMemoryScope() {
      if (!this.vectorMemoryStore?.isAvailable?.()) throw new Error("当前浏览器不支持本地索引。");
      const count = await this.vectorMemoryStore.clear(this.vectorMemoryScope());
      this.vectorMemoryState.entryCount = 0;
      this.vectorMemoryState.lastAction = count ? "已清理本地索引。" : "当前没有可清理的本地索引。";
      return count;
    }
    async exportVectorMemoryScope() {
      if (!this.vectorMemoryStore?.isAvailable?.()) throw new Error("当前浏览器不支持本地索引。");
      const data = await this.vectorMemoryStore.exportScope(this.vectorMemoryScope());
      if (typeof Blob === "undefined" || !global.URL?.createObjectURL || typeof document === "undefined") return data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = global.URL.createObjectURL(blob);
      link.download = `mercury-memory-${this.activeContactId()}-${this.activeTimelineId()}.json`;
      link.click();
      global.setTimeout?.(() => global.URL.revokeObjectURL(link.href), 0);
      this.vectorMemoryState.lastAction = "已导出本地索引。";
      return data;
    }
    exportEventMemoryBackup() {
      const store = global.MercuryRelationshipRecords;
      const storage = this.experienceStorage || this.context?.services?.storage;
      if (!store || !storage) throw new Error("当前没有可导出的长期事件。");
      const data = store.exportDurableEvents(storage, this.vectorMemoryScope());
      if (typeof Blob === "undefined" || !global.URL?.createObjectURL || typeof document === "undefined") return data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = global.URL.createObjectURL(blob);
      link.download = `mercury-events-${this.activeContactId()}-${this.activeWorldVariantId()}-${this.activeTimelineId()}.json`;
      link.click();
      global.setTimeout?.(() => global.URL.revokeObjectURL(link.href), 0);
      this.vectorMemoryState.lastAction = "已导出当前范围的长期事件备份。";
      return data;
    }
    async importEventMemoryBackupFile(file) {
      const store = global.MercuryRelationshipRecords;
      const storage = this.experienceStorage || this.context?.services?.storage;
      if (!store || !storage || !file || typeof file.text !== "function") throw new Error("事件备份文件不可用。");
      const backup = JSON.parse(await file.text());
      const imported = store.importDurableEvents(storage, backup, this.vectorMemoryScope());
      await this.syncConfirmedRecordsToVectorMemory();
      this.vectorMemoryState.lastAction = imported ? `已导入 ${imported} 条长期事件，并重建当前索引。` : "没有可导入的新长期事件。";
      return imported;
    }
    chooseEventMemoryBackup() {
      if (typeof document === "undefined") return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.hidden = true;
      input.addEventListener("change", async () => {
        try { await this.importEventMemoryBackupFile(input.files?.[0]); }
        catch (_) { this.vectorMemoryState.lastAction = "事件备份无法导入；请确认它来自当前联系人、世界与时间线。"; }
        this.paint();
      });
      input.click();
    }
    longTermEventsForActiveScope() {
      return this.confirmedRecordsForActiveScope().filter((record) => record.memory?.retention === "durable");
    }
    eventMemoryStateLabel(state) {
      return ({ active: "生效中", superseded: "已被替代", expired: "已过期", archived: "已归档" })[state] || "生效中";
    }
    eventMemoryTypeLabel(type) {
      return ({ "shared-event": "共同事件", commitment: "约定", preference: "偏好", "relationship-shift": "关系变化", "open-thread": "待续事项", note: "备注" })[type] || "共同事件";
    }
    async updateLongTermEvent(recordId, changes) {
      const store = global.MercuryRelationshipRecords;
      const storage = this.experienceStorage || this.context?.services?.storage;
      if (!store || !storage) return null;
      const record = store.updateMemory(storage, recordId, changes);
      if (!record) return null;
      try { await this.syncConfirmedRecordsToVectorMemory(); await this.refreshVectorMemorySummary(); } catch (_) {}
      return record;
    }
    eventMemoryView() {
      return this.simplePage("长期事件", "semanticMemory", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-settings mercury-chat-settings--reference mercury-chat-semantic-memory";
        const note = document.createElement("p");
        note.className = "mercury-chat-semantic-memory__note";
        note.textContent = "只有标记为长期的事件会出现在这里。已被替代、过期和归档事件会保留证据，但不会自动进入聊天。";
        body.append(note);
        const events = this.longTermEventsForActiveScope();
        if (!events.length) {
          const empty = document.createElement("p");
          empty.className = "mercury-chat-semantic-memory__help";
          empty.textContent = "当前范围还没有长期事件。确认关系记录时选择“保留为事件”即可添加。";
          body.append(empty);
          return body;
        }
        const list = document.createElement("section");
        list.className = "mercury-chat-settings__group mercury-chat-settings__group--single";
        events.forEach((record) => {
          const label = String(record.content || "长期事件").slice(0, 48);
          const memory = record.memory || {};
          const detail = `${this.eventMemoryTypeLabel(memory.eventType)} · ${this.eventMemoryStateLabel(memory.state)} · 重要度 ${memory.importance || 2}`;
          const row = this.settingsRow(label, detail, [""], () => { this.ui.eventMemoryRecordId = record.id; this.ui.route = "eventMemoryDetail"; this.paint(); });
          list.append(row);
        });
        body.append(list);
        return body;
      });
    }
    eventMemoryDetailView() {
      const record = this.longTermEventsForActiveScope().find((item) => item.id === this.ui.eventMemoryRecordId);
      if (!record) { this.ui.route = "eventMemory"; return this.eventMemoryView(); }
      return this.simplePage("事件详情", "eventMemory", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-settings mercury-chat-settings--reference mercury-chat-semantic-memory";
        const content = document.createElement("p");
        content.className = "mercury-chat-semantic-memory__note";
        content.textContent = record.content;
        const group = (rows) => { const section = document.createElement("section"); section.className = "mercury-chat-settings__group mercury-chat-settings__group--single"; section.append(...rows); return section; };
        const memory = record.memory || {};
        const change = async (patch) => { await this.updateLongTermEvent(record.id, patch); this.paint(); };
        const stateChoices = ["active", "archived", "expired"];
        const state = this.settingsRow("事件状态", memory.state === "superseded" ? "active" : memory.state || "active", stateChoices, (value) => change({ state: value, supersededBy: value === "active" ? null : undefined }), this.eventMemoryStateLabel(memory.state));
        const importance = this.settingsRow("重要度", Number.isInteger(memory.importance) ? memory.importance : 2, [1, 2, 3, 4, 5], (value) => change({ importance: value }), `重要度 ${memory.importance || 2}`);
        const types = global.MercuryRelationshipRecords?.MEMORY_EVENT_TYPES || ["shared-event"];
        const type = this.settingsRow("事件类型", memory.eventType || "shared-event", types, (value) => change({ eventType: value }), this.eventMemoryTypeLabel(memory.eventType));
        body.append(content, group([state, importance, type]));
        const peers = this.longTermEventsForActiveScope().filter((item) => item.id !== record.id && item.memory?.state === "active");
        if (peers.length) {
          const replacement = document.createElement("section");
          replacement.className = "mercury-chat-settings__group";
          const heading = document.createElement("h2"); heading.textContent = "用新事件替代";
          replacement.append(heading);
          peers.forEach((peer) => {
            const row = this.settingsRow(String(peer.content || "长期事件").slice(0, 48), "设为替代项", [""], () => change({ state: "superseded", supersededBy: peer.id }));
            replacement.append(row);
          });
          body.append(replacement);
        }
        return body;
      });
    }
    semanticMemoryView() {
      return this.simplePage("语义记忆", "settings", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-settings mercury-chat-settings--reference mercury-chat-semantic-memory";
        const support = Boolean(this.vectorMemoryStore?.isAvailable?.() && this.localEmbeddingRuntime);
        const description = document.createElement("p");
        description.className = "mercury-chat-semantic-memory__note";
        description.textContent = "只检索你明确保留的长期事件，且严格限于当前联系人、世界变体与时间线。普通确认记录、聊天原文、角色资料、世界书和预设不会进入本地索引。";
        const group = (rows) => { const section = document.createElement("section"); section.className = "mercury-chat-settings__group mercury-chat-settings__group--single"; section.append(...rows); return section; };
        const mode = this.vectorMemoryState.mode === "loading" ? "准备中" : this.vectorMemoryState.semanticEnabled ? "本地语义" : "关键词检索";
        const modeRow = this.settingsRow("当前模式", mode, [""], () => {});
        modeRow.disabled = true;
        modeRow.classList.add("mercury-chat-settings-row--readonly");
        const scopeRow = this.settingsRow("检索范围", "本联系人 · 当前世界 · 当前时间线", [""], () => {});
        scopeRow.disabled = true;
        scopeRow.classList.add("mercury-chat-settings-row--readonly");
        const countLabel = Number.isInteger(this.vectorMemoryState.entryCount) ? `${this.vectorMemoryState.entryCount} 条本地索引` : "读取本地索引";
        const countRow = this.settingsRow("本地索引", countLabel, [""], () => {});
        countRow.disabled = true;
        countRow.classList.add("mercury-chat-settings-row--readonly");
        const isPreparing = this.vectorMemoryState.mode === "loading";
        const toggle = this.settingsToggleRow(isPreparing ? "停止准备本地语义检索" : "使用本地语义检索", Boolean(this.vectorMemoryState.semanticEnabled), async (enabled) => {
          if (isPreparing) { this.disableLocalSemanticMemory(); this.vectorMemoryState.lastAction = "已停止启用本地语义检索，聊天保持关键词检索。"; this.paint(); return; }
          if (!enabled) { this.disableLocalSemanticMemory(); this.vectorMemoryState.lastAction = "已切回关键词检索。"; this.paint(); return; }
          this.vectorMemoryState.mode = "loading";
          this.vectorMemoryState.lastAction = null;
          this.paint();
          try {
            const prepared = await this.enableLocalSemanticMemory();
            if (prepared?.cancelled) return;
            await this.refreshVectorMemorySummary();
            this.vectorMemoryState.lastAction = "本地语义检索已准备完成。";
          } catch (_) {
            this.vectorMemoryState.lastAction = "本地模型未能准备完成，已保持关键词检索。";
          }
          this.paint();
        });
        toggle.disabled = !support;
        const clear = this.settingsRow("清理本地索引", "不删除确认记录", [""], async () => {
          try { await this.clearVectorMemoryScope(); } catch (_) { this.vectorMemoryState.lastAction = "无法清理本地索引。"; }
          this.paint();
        });
        clear.disabled = !support;
        const manageEvents = this.settingsRow("管理长期事件", `${this.longTermEventsForActiveScope().length} 条`, [""], () => { this.ui.route = "eventMemory"; this.paint(); });
        const exportRow = this.settingsRow("导出索引诊断", "不含模型向量", [""], async () => {
          try { await this.exportVectorMemoryScope(); } catch (_) { this.vectorMemoryState.lastAction = "无法导出本地索引。"; }
          this.paint();
        });
        exportRow.disabled = !support;
        const exportEvents = this.settingsRow("导出长期事件备份", "可用于重建当前索引", [""], () => {
          try { this.exportEventMemoryBackup(); } catch (_) { this.vectorMemoryState.lastAction = "无法导出长期事件备份。"; }
          this.paint();
        });
        const importEvents = this.settingsRow("导入长期事件备份", "严格匹配当前范围", [""], () => this.chooseEventMemoryBackup());
        const help = document.createElement("p");
        help.className = "mercury-chat-semantic-memory__help";
        help.textContent = support ? "开启后会在此设备下载本地模型，可能需要较长时间和数百 MB 存储。模型下载失败时，聊天会继续使用关键词检索。" : "当前浏览器无法提供本地语义模型，聊天会继续使用关键词检索。";
        const statusText = isPreparing ? this.vectorMemoryState.prepareProgress || "正在准备本地模型" : this.vectorMemoryState.lastAction;
        if (statusText) {
          const action = document.createElement("p");
          action.className = "mercury-chat-semantic-memory__action";
          action.textContent = statusText;
          body.append(description, group([modeRow, scopeRow, countRow]), group([toggle]), help, group([manageEvents, clear, exportRow, exportEvents, importEvents]), action);
        } else body.append(description, group([modeRow, scopeRow, countRow]), group([toggle]), help, group([manageEvents, clear, exportRow, exportEvents, importEvents]));
        if (support && !Number.isInteger(this.vectorMemoryState.entryCount)) this.refreshVectorMemorySummary().then(() => { if (this.ui?.route === "semanticMemory") this.paint(); });
        return body;
      }, { pageClass: "mercury-chat-semantic-memory-page" });
    }
    historySearchView() {
      return this.simplePage(this.t("chat.historySearchTitle"), "settings", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-history-search";
        const search = document.createElement("input");
        search.className = "mercury-chat-search mercury-chat-history-search__input";
        search.placeholder = this.t("chat.historySearchPlaceholder");
        search.setAttribute("aria-label", this.t("chat.historySearchPlaceholder"));
        search.value = this.ui.historySearchQuery || "";
        const results = document.createElement("div");
        results.className = "mercury-chat-history-search__results";
        const query = String(search.value || "").trim().toLowerCase();
        if (query) {
          const matches = this.messages.filter((message) => String(message.content || "").toLowerCase().includes(query));
          matches.forEach((message) => {
            const item = this.button(`定位消息 ${message.content}`, "mercury-chat-history-search__result");
            const copy = document.createElement("span");
            const author = document.createElement("strong"); author.textContent = message.role === "user" ? "我" : this.activeContact().name;
            const preview = document.createElement("small"); preview.textContent = message.content;
            copy.append(author, preview);
            const time = document.createElement("time"); time.textContent = this.formatMessageTime(message.createdAt);
            item.append(copy, time);
            item.addEventListener("click", () => this.jumpToHistoryMessage(message.id));
            results.append(item);
          });
          if (!matches.length) {
            const empty = document.createElement("p");
            empty.className = "mercury-chat-history-search__empty";
            empty.textContent = this.t("chat.historyNoResults");
            results.append(empty);
          }
        }
        search.addEventListener("input", () => { this.ui.historySearchQuery = search.value; this.paint(); });
        body.append(search, results);
        return body;
      }, { pageClass: "mercury-chat-history-search-page" });
    }
    presetEntryRow() {
      const current = this.presetDisplayNameById(this.experienceFor(this.activeContactId(), this.activeTimelineId()).settings.userPresetId);
      const row = this.settingsRow("玩法预设", current, [""], () => { if (this.presetLayerReady()) this.ui.route = "presetList"; });
      if (!this.presetLayerReady()) { row.dataset.state = "coming"; row.title = "当前环境未装配预设层（只读）"; }
      return row;
    }
    // ---- 玩法预设 ----
    presetLayerReady() { return Boolean(global.MercuryPresetContent && this.presetStore && this.presetAssemble); }
    presetContent() { return global.MercuryPresetContent || null; }
    presetDisplayNameById(id) {
      if (!this.presetLayerReady()) return "-";
      if (id === "preset-default") return "默认预设";
      const found = this.presetStore.get(id);
      return found && found.id !== "preset-default" ? (found.name || found.id) : "-";
    }
    presetRuntimeDiagnostic(preset) {
      if (!preset) return { status: "empty", hasRuntimeText: false, runtimeActiveCount: 0, preservedCount: 0, preservedSettingsCount: 0, resolvedVariableCount: 0, unresolvedVariableCount: 0, unresolvedTemplateCount: 0, unresolvedMacroCount: 0, unresolvedMacros: [], warnings: [] };
      try {
        if (typeof this.presetAssemble?.inspect === "function") return this.presetAssemble.inspect(preset, { templateValues: this.presetTemplateValues() });
        const instructions = this.presetAssemble?.assemble?.(preset, { templateValues: this.presetTemplateValues() }) || "";
        return { status: instructions ? "ready" : "empty", hasRuntimeText: Boolean(instructions), runtimeActiveCount: instructions ? 1 : 0, preservedCount: 0, preservedSettingsCount: 0, resolvedVariableCount: 0, unresolvedVariableCount: 0, unresolvedTemplateCount: 0, unresolvedMacroCount: 0, unresolvedMacros: [], warnings: [] };
      } catch {
        return { status: "empty", hasRuntimeText: false, runtimeActiveCount: 0, preservedCount: 0, preservedSettingsCount: 0, resolvedVariableCount: 0, unresolvedVariableCount: 0, unresolvedTemplateCount: 0, unresolvedMacroCount: 0, unresolvedMacros: [], warnings: [] };
      }
    }
    presetOriginLabel(preset) {
      if (preset?.origin === "mercury") return "Mercury 内置";
      if (preset?.origin === "imported") return "外部导入";
      return "我的生成档案";
    }
    presetTemplateValues() {
      const contact = this.experience?.contacts?.[this.activeContactId?.()] || null;
      return {
        user: String(this.experience?.user?.name || "Me"),
        char: String(contact?.name || contact?.persona?.displayName || "角色"),
      };
    }
    presetRuntimeCopy(preset, diagnostic = this.presetRuntimeDiagnostic(preset)) {
      const details = [];
      if (diagnostic.runtimeActiveCount > 0 && preset?.compatibility?.runtime) details.push(`${diagnostic.runtimeActiveCount} 项运行`);
      if (diagnostic.resolvedVariableCount > 0) details.push(`已适配 ${diagnostic.resolvedVariableCount} 个变量`);
      if (diagnostic.unresolvedMacroCount > 0) details.push(`剩余 ${diagnostic.unresolvedMacroCount} 个模板项`);
      if (diagnostic.preservedCount > 0) details.push(`${diagnostic.preservedCount} 项保留`);
      if (diagnostic.preservedSettingsCount > 0) details.push(`${diagnostic.preservedSettingsCount} 个参数保留`);
      if (diagnostic.status === "partial") return { label: "部分接入", detail: details.join("，") || "部分内容仍需适配" };
      if (diagnostic.status === "preserved") return { label: "仅保留", detail: details.join("，") || "尚未进入当前运行链路" };
      if (diagnostic.status === "empty") return { label: "暂无指令", detail: "当前档案没有可用的生成指令" };
      if (preset?.origin === "mercury") return { label: "已生效", detail: "Mercury 内置生成规则" };
      return { label: "已生效", detail: this.presetCompactSummary(preset) };
    }
    presetCompactSummary(preset) {
      const P = this.presetContent();
      const groups = [
        ["group.rel", "关系"],
        ["group.int", "节奏"],
        ["group.pro", "主动性"],
      ].filter(([groupId]) => (P?.EXCLUSIVE_GROUPS?.[groupId] || []).some((moduleId) => preset?.modules?.enabled?.[moduleId] === true)).map(([, label]) => label);
      if (groups.length) return `${groups.join("、")}已配置`;
      const activeBlocks = (Array.isArray(preset?.instructionBlocks) ? preset.instructionBlocks : []).filter((block) => block?.enabled === true && block.runtimeEligible !== false && typeof block.content === "string" && block.content.trim());
      if (activeBlocks.length) return `${activeBlocks.length} 个指令块可用`;
      return "可用于当前会话";
    }
    presetListView() {
      const ready = this.presetLayerReady();
      return this.simplePage("玩法预设", "settings", () => {
        const body = document.createElement("div"); body.className = "mercury-chat-settings mercury-chat-preset-list";
        if (!ready) { const p = document.createElement("p"); p.className = "mercury-chat-settings__note"; p.textContent = "当前环境未装配生成档案层，暂时无法切换。"; body.append(p); return body; }
        const boundId = this.experienceFor(this.activeContactId(), this.activeTimelineId()).settings.userPresetId;
        const current = this.presetDisplayNameById(boundId);
        const currentPreset = this.presetStore.get(boundId) || this.presetStore.get("preset-default");
        const currentDiagnostic = this.presetRuntimeDiagnostic(currentPreset);
        const currentRuntime = this.presetRuntimeCopy(currentPreset, currentDiagnostic);
        const summary = document.createElement("section"); summary.className = "mercury-chat-preset-current";
        const summaryLabel = document.createElement("small"); summaryLabel.className = "mercury-chat-preset-current__eyebrow"; summaryLabel.textContent = "当前会话";
        const summaryHeading = document.createElement("div"); summaryHeading.className = "mercury-chat-preset-current__heading";
        const summaryName = document.createElement("strong"); summaryName.textContent = current;
        const summaryState = document.createElement("span"); summaryState.className = `mercury-chat-preset-current__state mercury-chat-preset-current__state--${currentDiagnostic.status}`; summaryState.textContent = currentRuntime.label;
        summaryHeading.append(summaryName, summaryState);
        const summaryMeta = document.createElement("p"); summaryMeta.className = "mercury-chat-preset-current__meta"; summaryMeta.textContent = `${this.presetOriginLabel(currentPreset)}，${currentRuntime.detail}`;
        summary.append(summaryLabel, summaryHeading, summaryMeta);
        const picks = document.createElement("section"); picks.className = "mercury-chat-preset-picks";
        const picksHeading = document.createElement("header"); picksHeading.className = "mercury-chat-preset-picks__heading";
        const pTitle = document.createElement("h2"); pTitle.textContent = "为当前会话选择";
        const pHint = document.createElement("p"); pHint.textContent = "切换后，从下一次回复开始使用。";
        picksHeading.append(pTitle, pHint); picks.append(picksHeading);
        this.presetStore.list().forEach((preset) => {
          const row = document.createElement("button"); row.type = "button"; row.className = "mercury-chat-preset-pick"; row.dataset.presetId = preset.id;
          const diagnostic = this.presetRuntimeDiagnostic(preset);
          const runtimeCopy = this.presetRuntimeCopy(preset, diagnostic);
          const copy = document.createElement("span"); copy.className = "mercury-chat-preset-pick__copy";
          const source = document.createElement("small"); source.className = "mercury-chat-preset-pick__source"; source.textContent = this.presetOriginLabel(preset);
          const name = document.createElement("strong"); name.textContent = this.presetDisplayNameById(preset.id);
          const detail = document.createElement("small"); detail.className = "mercury-chat-preset-pick__detail"; detail.textContent = runtimeCopy.detail;
          copy.append(source, name, detail);
          const state = document.createElement("span"); state.className = `mercury-chat-preset-pick__state mercury-chat-preset-pick__state--${diagnostic.status}`;
          state.append(this.icon(preset.id === boundId ? "check-circle" : "nav-arrow-right"));
          const stateText = document.createElement("span"); stateText.textContent = preset.id === boundId ? "当前" : runtimeCopy.label; state.append(stateText);
          row.append(copy, state);
          row.setAttribute("aria-current", preset.id === boundId ? "page" : "false");
          row.setAttribute("aria-label", `${preset.id === boundId ? "当前使用" : "切换到"}${this.presetDisplayNameById(preset.id)}，${runtimeCopy.label}`);
          row.addEventListener("click", () => this.bindPresetToConversation(preset.id));
          picks.append(row);
        });
        const manage = this.button("在档案馆管理生成档案", "mercury-chat-preset-manage", "database");
        const manageCopy = document.createElement("span"); manageCopy.className = "mercury-chat-preset-manage__copy";
        const manageTitle = document.createElement("strong"); manageTitle.textContent = "在档案馆管理";
        const manageDetail = document.createElement("small"); manageDetail.textContent = "新建、导入、编辑与更换封面";
        manageCopy.append(manageTitle, manageDetail);
        manage.append(manageCopy, this.icon("nav-arrow-right"));
        manage.addEventListener("click", () => this.openApp("archive", "presets"));
        body.append(summary, picks, manage);
        return body;
      }, { pageClass: "mercury-chat-preset-page" });
    }
    moduleLabel(id, draft) {
      const P = this.presetContent();
      const texts = draft && draft.modules && draft.modules.texts;
      const t = (texts && texts[id]) || (P && P.MODULE_TEXTS && P.MODULE_TEXTS[id]);
      if (typeof t === "string") { const first = t.split(/[。；\s（(]/)[0]; return first.length <= 14 ? first : first.slice(0, 14) + "…"; }
      return "";
    }
    openPresetEditor(id) {
      if (!this.presetLayerReady()) return;
      const preset = this.presetStore.get(id);
      this.presetDraft = preset ? JSON.parse(JSON.stringify({ ...preset, id: preset.id === "preset-default" ? "preset-default" : preset.id })) : null;
      if (this.presetDraft) { this.presetDraft.isNew = false; this.presetDraft.dirty = false; }
      this.ui.presetEditorError = null;
      this.ui.route = "presetEditor"; this.paint();
    }
    presetEditorView() {
      const ready = this.presetLayerReady();
      const draft = ready ? this.presetDraft : null;
      const title = "玩法预设编辑";
      const save = this.button("保存预设", "mercury-chat-page__text-action");
      const saveLabel = document.createElement("span"); saveLabel.textContent = "保存"; save.append(saveLabel);
      save.addEventListener("click", () => { if (draft?.isNew) this.savePresetDraftAsNew(); else this.savePresetDraft(); });
      save.disabled = !draft;
      return this.simplePage(title, "presetList", () => {
        const body = document.createElement("div"); body.className = "mercury-chat-settings mercury-chat-preset-editor";
        if (!ready || !draft) { const p = document.createElement("p"); p.className = "mercury-chat-settings__note"; p.textContent = "当前环境未装配预设层，无法编辑玩法预设。"; body.append(p); return body; }
        const summary = document.createElement("section"); summary.className = "mercury-chat-preset-editor__summary";
        const art = document.createElement("span"); art.className = "mercury-chat-preset-current__art"; art.style.backgroundImage = `url("${VISUAL_CHAT_BACKGROUND}")`;
        const summaryCopy = document.createElement("span"); summaryCopy.className = "mercury-chat-preset-editor__summary-copy";
        const nameInput = document.createElement("input"); nameInput.className = "mercury-chat-preset-input mercury-chat-preset-name"; nameInput.value = draft.name || ""; nameInput.placeholder = "预设名称"; nameInput.setAttribute("aria-label", "预设名称");
        nameInput.addEventListener("input", () => { draft.name = nameInput.value; draft.dirty = true; });
        const summaryState = document.createElement("small"); summaryState.textContent = draft.compatibility?.runtime
          ? `已生效 ${draft.compatibility.runtime.activeCount} 项，保留 ${draft.compatibility.runtime.preservedCount} 项`
          : "模块开关会直接影响当前预设的运行时输出";
        summaryCopy.append(nameInput, summaryState); summary.append(art, summaryCopy);
        const moduleHeading = document.createElement("div"); moduleHeading.className = "mercury-chat-preset-editor__heading";
        const moduleTitle = document.createElement("h2"); moduleTitle.textContent = "模块列表";
        const closeAll = this.button("关闭可选模块", "mercury-chat-preset-editor__close-all");
        const closeAllLabel = document.createElement("span"); closeAllLabel.textContent = "全部关闭"; closeAll.append(closeAllLabel);
        closeAll.addEventListener("click", () => {
          const required = new Set(this.presetContent().SKELETON_MODULES || []);
          Object.keys(draft.modules.enabled || {}).forEach((id) => { if (!required.has(id)) draft.modules.enabled[id] = false; });
          draft.dirty = true; this.paint();
        });
        moduleHeading.append(moduleTitle, closeAll);
        body.append(summary, moduleHeading);
        body.append(...this.buildPresetCards(draft));
        body.append(this.renderCustomCard(draft), this.renderPreviewCard(draft));
        if (this.ui.presetEditorError) { const e = document.createElement("p"); e.className = "mercury-chat-contacts__alert"; e.textContent = this.ui.presetEditorError; body.append(e); }
        const actions = document.createElement("div"); actions.className = "mercury-chat-preset-actions";
        const saveNew = this.button("保存为新预设", "mercury-chat-preset-save", "check");
        const saveNewLabel = document.createElement("span"); saveNewLabel.textContent = "保存为新预设"; saveNew.append(saveNewLabel);
        saveNew.addEventListener("click", () => this.savePresetDraftAsNew());
        if (!draft.isNew) { actions.append(saveNew); body.append(actions); }
        return body;
      }, { pageClass: "mercury-chat-preset-editor-page", headerAction: save });
    }
    buildPresetCards(draft) {
      const P = this.presetContent();
      const cards = [];
      const prefIds = Object.keys(P.PREF_PLACEHOLDERS);
      const groupOf = (moduleId) => { for (const g of Object.keys(P.EXCLUSIVE_GROUPS)) if (P.EXCLUSIVE_GROUPS[g].indexOf(moduleId) >= 0) return g; return null; };
      const seenGroups = {};
      const order = Array.isArray(draft.modules.order) ? draft.modules.order : [];
      order.forEach((id) => {
        if (P.SKELETON_MODULES.indexOf(id) >= 0) { cards.push(this.renderSkeletonCard(id)); return; }
        const sg = groupOf(id);
        if (sg) { if (!seenGroups[sg]) { seenGroups[sg] = true; cards.push(this.renderGroupCard(draft, sg)); } return; }
        if (prefIds.indexOf(id) >= 0) { cards.push(this.renderFreeTextCard(draft, id)); return; }
        cards.push(this.renderUnknownCard(draft, id));
      });
      return cards;
    }
    renderCard(title, bodyEl, options = {}) {
      const card = document.createElement("section"); card.className = "mercury-chat-preset-card";
      card.dataset.presetTitle = title;
      const header = document.createElement("div"); header.className = "mercury-chat-preset-card__header";
      const disclosure = this.button(`展开${title}`, "mercury-chat-preset-card__disclosure");
      disclosure.append(this.icon(options.icon || "spark"));
      const copy = document.createElement("span"); copy.className = "mercury-chat-preset-card__copy";
      const h = document.createElement("h3"); h.className = "mercury-chat-preset-card__title"; h.textContent = title;
      const subtitle = document.createElement("small"); subtitle.textContent = options.subtitle || options.status || "查看模块设置";
      copy.append(h, subtitle); disclosure.append(copy);
      this.ui.presetExpandedCards ||= {};
      const expanded = this.ui.presetExpandedCards[title] === true;
      card.dataset.expanded = String(expanded);
      disclosure.setAttribute("aria-expanded", String(expanded));
      bodyEl.hidden = !expanded;
      const toggle = () => { this.ui.presetExpandedCards[title] = !expanded; this.paint(); };
      disclosure.addEventListener("click", toggle);
      header.append(disclosure);
      if (typeof options.enabled === "boolean") {
        const switchButton = this.button(options.enabled ? `关闭${title}` : `开启${title}`, `mercury-chat-switch${options.enabled ? " mercury-chat-switch--on" : ""}`);
        switchButton.setAttribute("aria-pressed", String(options.enabled));
        switchButton.disabled = options.locked === true || typeof options.onToggle !== "function";
        const thumb = document.createElement("i"); switchButton.append(thumb);
        switchButton.addEventListener("click", (event) => { event?.stopPropagation?.(); options.onToggle?.(!options.enabled); });
        header.append(switchButton);
      }
      const chevron = this.icon("nav-arrow-down", "mercury-chat-preset-card__chevron"); header.append(chevron);
      card.append(header, bodyEl);
      return card;
    }
    renderGroupCard(draft, groupId) {
      const P = this.presetContent();
      const meta = {
        "group.rel": { label: "关系与连续性", subtitle: "关系起点、发展与重要事件", icon: "check-circle" },
        "group.int": { label: "情节强度", subtitle: "控制对话中的戏剧推进幅度", icon: "spark" },
        "group.pro": { label: "主动性与事件推进", subtitle: "控制角色主动发起行动的程度", icon: "timer" },
      }[groupId] || { label: groupId, subtitle: "玩法模块", icon: "settings" };
      const body = document.createElement("div"); body.className = "mercury-chat-preset-group";
      const opts = (P.EXCLUSIVE_GROUPS[groupId] || []).slice();
      const enabled = opts.some((id) => draft.modules.enabled[id] === true);
      const setEnabled = (next) => {
        if (next) { const selected = opts.find((id) => draft.modules.enabled[id] === true) || opts[0]; opts.forEach((id) => { draft.modules.enabled[id] = id === selected; }); }
        else opts.forEach((id) => { draft.modules.enabled[id] = false; });
        draft.dirty = true; this.paint();
      };
      opts.forEach((id) => {
        const wrap = document.createElement("label"); wrap.className = "mercury-chat-preset-opt";
        const radio = document.createElement("input"); radio.type = "radio"; radio.name = groupId; radio.checked = draft.modules.enabled[id] === true;
        radio.addEventListener("change", () => {
          if (!radio.checked) return;
          const prev = opts.filter((o) => o !== id && draft.modules.enabled[o] === true);
          draft.modules.enabled[id] = true;
          opts.forEach((other) => { if (other !== id) draft.modules.enabled[other] = false; });
          // 让 order 跟随组内新选中的候选（在旧选中项原位替换），保证装配输出反映当前选择。
          if (draft.modules.order) {
            const idx = draft.modules.order.findIndex((m) => m === id || prev.indexOf(m) >= 0);
            const old = prev[0];
            if (idx >= 0 && old) draft.modules.order[idx] = id;
            else if (draft.modules.order.indexOf(id) < 0) draft.modules.order.push(id);
          }
          draft.dirty = true; this.paint();
        });
        const text = document.createElement("span"); text.textContent = this.moduleLabel(id, draft) || id;
        const full = document.createElement("small"); full.textContent = (P.MODULE_TEXTS && (P.MODULE_TEXTS[id] || "")) || "";
        wrap.append(radio, text, full); body.append(wrap);
      });
      return this.renderCard(meta.label, body, { status: enabled ? "已生效" : "未启用", subtitle: meta.subtitle, icon: meta.icon, enabled, onToggle: setEnabled });
    }
    renderSkeletonCard(id) {
      const P = this.presetContent();
      const labels = { "skeleton.preserve-role": "尊重角色本质", "skeleton.mode": "玩法层声明" };
      const body = document.createElement("div");
      const text = document.createElement("p"); text.className = "mercury-chat-preset-skeleton-text"; text.textContent = (P.MODULE_TEXTS && P.MODULE_TEXTS[id]) || "";
      const tag = document.createElement("span"); tag.className = "mercury-chat-preset-required"; tag.textContent = "必开";
      body.append(tag, text);
      return this.renderCard(labels[id] || id, body, { status: "必开", subtitle: "维持角色与玩法的基础边界", icon: "shield-check", enabled: true, locked: true });
    }
    renderFreeTextCard(draft, id) {
      const P = this.presetContent();
      const ph = (P.PREF_PLACEHOLDERS && P.PREF_PLACEHOLDERS[id]) || null;
      const labels = { "pref.focus": "话题聚焦", "pref.address": "称呼", "pref.hard-off": "想避开的边界" };
      const label = labels[id] || id;
      const body = document.createElement("div");
      const input = document.createElement("textarea"); input.rows = 2; input.className = "mercury-chat-preset-input";
      input.placeholder = (P.MODULE_TEXTS && P.MODULE_TEXTS[id]) || "";
      input.value = ph && draft.preferences ? (draft.preferences[ph] || "") : "";
      const enabled = draft.modules.enabled[id] === true;
      input.disabled = !enabled;
      input.setAttribute("aria-label", `填写${label}`);
      input.addEventListener("input", () => { if (ph) { draft.preferences ||= {}; draft.preferences[ph] = input.value; } draft.dirty = true; this.paint(); });
      body.append(input);
      return this.renderCard(label, body, { status: enabled ? "已生效" : "未启用", subtitle: "补充当前玩法偏好", icon: "settings", enabled, onToggle: (next) => { draft.modules.enabled[id] = next; draft.dirty = true; this.paint(); } });
    }
    renderUnknownCard(draft, id) {
      const compatible = draft.compatibility?.blocks?.find((block) => `compat.block.${String(block.id || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-+|-+$/g, "")}` === id);
      const body = document.createElement("div");
      const state = document.createElement("p"); state.className = "mercury-chat-preset-skeleton-text"; state.textContent = compatible
        ? (compatible.runtimeActive ? "该提示块已映射到当前运行时。" : "该提示块会原样保留，但当前运行时不会注入。")
        : "该模块沿用 Mercury 预设契约。";
      body.append(state);
      const extra = (draft.modules.texts && draft.modules.texts[id]) || "";
      if (extra) { const p = document.createElement("p"); p.className = "mercury-chat-preset-skeleton-text"; p.textContent = extra; body.append(p); }
      const active = draft.modules.enabled[id] === true;
      const runtimeSupported = !compatible || compatible.runtimeActive;
      return this.renderCard(compatible ? `导入提示块 ${draft.compatibility.blocks.indexOf(compatible) + 1}` : id, body, {
        status: compatible ? (compatible.runtimeActive ? "已生效" : "已保留，暂未生效") : (active ? "已生效" : "未启用"),
        subtitle: compatible && !compatible.runtimeActive ? "字段已完整保留，当前运行时暂不注入" : "导入并映射的提示模块",
        icon: runtimeSupported ? "spark" : "database",
        enabled: active,
        locked: !runtimeSupported,
        onToggle: runtimeSupported ? (next) => { draft.modules.enabled[id] = next; draft.dirty = true; this.paint(); } : null,
      });
    }
    renderCustomCard(draft) {
      const body = document.createElement("div");
      const input = document.createElement("textarea"); input.rows = 3; input.className = "mercury-chat-preset-input";
      draft.custom ||= { instructions: "" };
      input.value = draft.custom.instructions || "";
      input.placeholder = "自定义指令（不改角色本质）";
      input.addEventListener("input", () => { draft.custom.instructions = input.value; draft.dirty = true; this.paint(); });
      body.append(input);
      return this.renderCard("自定义指令", body, { status: draft.custom?.instructions?.trim() ? "已生效" : "未启用", subtitle: "追加当前预设专属规则", icon: "settings" });
    }
    renderPreviewCard(draft) {
      const body = document.createElement("div");
      const pre = document.createElement("pre"); pre.className = "mercury-chat-preset-preview"; pre.textContent = String(this.presetLivePreviewText(draft) || "");
      body.append(pre);
      return this.renderCard("输出检查", body, { status: "查看", subtitle: "查看最终进入运行时的预设文本", icon: "eye" });
    }
    presetLivePreviewText(draft) {
      if (!this.presetAssemble || !draft) return "";
      try { return this.presetAssemble.assemble(draft); } catch { return ""; }
    }
    bindPresetToConversation(id) {
      if (!this.presetLayerReady()) return;
      const conversation = this.experienceFor(this.activeContactId(), this.activeTimelineId());
      conversation.settings.userPresetId = id;
      conversation.resourceBindings ||= {};
      conversation.resourceBindings.presetId = id;
      this.saveExperience();
      this.ui.route = "presetList"; this.paint();
    }
    savePresetDraftAsNew() { return this.#commitPresetDraft(true); }
    savePresetDraft() { return this.#commitPresetDraft(false); }
    #commitPresetDraft(asNew) {
      const draft = this.presetDraft;
      if (!draft || !draft.name || !String(draft.name).trim()) { this.ui.presetEditorError = "请先填写预设名称。"; this.paint(); return; }
      const name = String(draft.name).trim();
      const next = {
        id: asNew ? `preset-${name.replace(/[^\w一-龥-]/g, "").slice(0, 12) || "custom"}-${Date.now().toString(36)}` : (draft.id || "preset-default"),
        name,
        version: draft.version || 1,
        modules: { order: draft.modules.order.slice(), enabled: { ...draft.modules.enabled }, texts: draft.modules.texts ? { ...draft.modules.texts } : undefined },
        preferences: { ...(draft.preferences || {}) },
        custom: { instructions: (draft.custom && draft.custom.instructions) ? String(draft.custom.instructions) : null },
        instructionBlocks: Array.isArray(draft.instructionBlocks) ? JSON.parse(JSON.stringify(draft.instructionBlocks)) : [],
        origin: draft.origin === "imported" ? "imported" : "user",
        creationMode: draft.creationMode || (asNew ? "remix" : "blank"),
        remixOf: asNew ? (draft.id || null) : (draft.remixOf || null),
        cover: draft.cover && typeof draft.cover === "object" ? JSON.parse(JSON.stringify(draft.cover)) : undefined,
        description: draft.description || "",
        acceptedConflicts: Array.isArray(draft.acceptedConflicts) ? draft.acceptedConflicts.slice() : [],
        compatibility: draft.compatibility && typeof draft.compatibility === "object" ? JSON.parse(JSON.stringify(draft.compatibility)) : undefined,
      };
      try { this.presetStore.add(next); } catch (error) { this.ui.presetEditorError = "保存失败：" + (error && error.message ? error.message : String(error)); this.paint(); return; }
      draft.dirty = false;
      this.ui.presetEditorError = null;
      this.openPresetEditor(next.id);
      return next;
    }
    contactsViewReference() {
      const menuToggle = this.button("联系人选项", "mercury-chat-page__more");
      const dots = document.createElement("span");
      dots.className = "mercury-chat-page__more-dots";
      dots.textContent = "···";
      menuToggle.append(dots);
      menuToggle.addEventListener("click", () => {
        this.ui.contactsMenuOpen = !this.ui.contactsMenuOpen;
        this.paint();
      });
      return this.simplePage(this.t("contacts.title"), "chats", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-settings mercury-chat-settings--with-nav mercury-chat-contacts mercury-chat-contacts--reference";
        if (this.ui.contactsMenuOpen) {
          const menu = document.createElement("div");
          menu.className = "mercury-chat-contacts__menu";
          const importButton = this.button(this.t("chat.importRoleCard"), "mercury-chat-contacts__menu-item", "plus");
          const importLabel = document.createElement("span");
          importLabel.textContent = this.t("chat.importRoleCard");
          importButton.append(importLabel);
          importButton.addEventListener("click", () => {
            this.ui.contactsMenuOpen = false;
            this.openCharacterPicker();
          });
          menu.append(importButton);
          body.append(menu);
        }
        const receipt = this.importReceiptView();
        if (receipt) body.append(receipt);
        const search = document.createElement("input");
        search.className = "mercury-chat-search";
        search.placeholder = this.t("contacts.searchPlaceholder");
        search.setAttribute("aria-label", this.t("contacts.searchPlaceholder"));
        search.value = this.ui.contactsQuery || "";
        const grid = document.createElement("div");
        grid.className = "mercury-chat-contacts__grid";
        const query = search.value.trim().toLowerCase();
        const contacts = Object.values(this.experience.contacts).filter((contact) => !query || `${contact.name} ${contact.identity || ""}`.toLowerCase().includes(query));
        contacts.forEach((contact) => grid.append(this.contactCard(contact, "contacts")));
        if (!contacts.length) {
          const empty = document.createElement("p");
          empty.className = "mercury-chat-list__empty";
          empty.textContent = this.t("contacts.empty");
          grid.append(empty);
        }
        search.addEventListener("input", () => { this.ui.contactsQuery = search.value; this.paint(); });
        if (this.importAlert) {
          const alert = document.createElement("p");
          alert.className = "mercury-chat-contacts__alert";
          alert.textContent = this.t(this.importAlert === "invalid-json" ? "contacts.importInvalid" : this.importAlert === "storage-failed" ? "contacts.importStorageError" : "contacts.importReadError");
          body.append(alert);
        }
        body.append(search, grid, this.primaryNavigation());
        return body;
      }, { pageClass: "mercury-chat-contacts-page", headerAction: menuToggle });
    }
    profileActions(subject, isUser) { const actions = document.createElement("div"); actions.className = "mercury-chat-profile-actions"; [["更换头像", "media-image", "avatar"], ["更换主页背景", "media-image", "profileBackground"], ...(isUser ? [["编辑名称", "settings", "name"], ["编辑状态", "chat-bubble", "status"]] : [])].forEach(([label, icon, field]) => { const button = this.button(label, "mercury-chat-profile-actions__item", icon); const text = document.createElement("span"); text.textContent = label; button.append(text); button.addEventListener("click", () => { if (field === "avatar" || field === "profileBackground") this.chooseImage((value) => { subject[field] = value; }); else { const value = global.prompt?.(label, subject[field] || ""); if (typeof value === "string" && value.trim()) { subject[field] = value.trim(); this.saveExperience(); this.paint(); } } }); actions.append(button); }); return actions; }
    personaView() {
      const contact = this.experience.contacts[this.ui.selectedContactId] || this.experience.contacts["contact-a"];
      const persona = contact.persona || {};
      const group = (title, entries) => { const section = document.createElement("section"); section.className = "mercury-chat-settings__group"; const h = document.createElement("h2"); h.textContent = title; const shown = entries.filter(([key]) => persona[key] !== undefined && persona[key] !== null && persona[key] !== "" && (!Array.isArray(persona[key]) || persona[key].length)); if (!shown.length) { const empty = document.createElement("p"); empty.className = "mercury-chat-settings__note"; empty.textContent = this.t("contacts.personaEmpty"); section.append(h, empty); return section; } shown.forEach(([key, label]) => { const row = document.createElement("div"); row.className = "mercury-chat-settings-row mercury-chat-settings-row--readonly"; const copy = document.createElement("span"); copy.textContent = label; const value = document.createElement("small"); value.textContent = Array.isArray(persona[key]) ? persona[key].join(", ") : String(persona[key]); row.append(copy, value); section.append(row); }); return section; };
      const loreSection = () => { const section = document.createElement("section"); section.className = "mercury-chat-settings__group"; const h = document.createElement("h2"); h.textContent = this.t("contacts.personaLore"); section.append(h); const lore = persona.lore && typeof persona.lore === "object" && !Array.isArray(persona.lore) ? persona.lore : {}; const domains = Object.entries(lore).filter(([, domain]) => domain !== null && domain !== undefined && domain !== ""); domains.forEach(([domainName, domain]) => { const item = typeof domain === "object" && !Array.isArray(domain) ? domain : { core: domain }; const card = document.createElement("div"); card.className = "mercury-chat-settings__lore-card"; const title = document.createElement("strong"); title.textContent = domainName; card.append(title); const coreText = item.core || item.重心 || item.description || item.summary || ""; if (coreText) { const core = document.createElement("p"); core.textContent = String(coreText); card.append(core); } const anchors = Array.isArray(item.anchors) ? item.anchors : (Array.isArray(item.锚点) ? item.锚点 : []); if (anchors.length) { const list = document.createElement("ul"); anchors.forEach((anchor) => { const li = document.createElement("li"); li.textContent = String(anchor); list.append(li); }); card.append(list); } const limits = Array.isArray(item.limits) ? item.limits : (Array.isArray(item.边界) ? item.边界 : []); if (limits.length) { const bound = document.createElement("small"); bound.textContent = "边界: " + limits.map(String).join("；"); card.append(bound); } section.append(card); }); if (!domains.length) { const empty = document.createElement("p"); empty.className = "mercury-chat-settings__note"; empty.textContent = this.t("contacts.personaEmpty"); section.append(empty); } return section; };
      const backRoute = this.ui.personaBackRoute || "contact";
      return this.simplePage(this.t("contacts.persona"), backRoute, () => { const body = document.createElement("div"); body.className = "mercury-chat-settings"; body.append(group(this.t("contacts.personaIdentityGroup"), [["identity", this.t("contacts.personaIdentity")], ["summary", this.t("contacts.personaSummary")]]), group(this.t("contacts.personaPersonalityGroup"), [["stableTraits", this.t("contacts.personaTraits")], ["motivations", this.t("contacts.personaMotivations")], ["fears", this.t("contacts.personaFears")], ["values", this.t("contacts.personaValues")], ["boundaries", this.t("contacts.personaBoundaries")]]), group(this.t("contacts.personaVoiceGroup"), [["careStyle", this.t("contacts.personaCare")], ["conflictStyle", this.t("contacts.personaConflict")], ["defenseStyle", this.t("contacts.personaDefense")], ["voiceStyle", this.t("contacts.personaVoice")]]), group(this.t("contacts.personaBackgroundGroup"), [["cognitionLimits", this.t("contacts.personaCognition")], ["changeThresholds", this.t("contacts.personaChange")], ["worldBindings", this.t("contacts.personaWorld")]]), group(this.t("contacts.personaCoreGroup"), [["background", this.t("contacts.personaBackground")], ["inner_conflict", this.t("contacts.personaInnerConflict")], ["politics", this.t("contacts.personaPolitics")], ["signature_details", this.t("contacts.personaSignature")]]), loreSection()); return body; }, { onBack: () => { this.ui.personaBackRoute = null; } }); }
    meView() {
      const page = document.createElement("section");
      page.className = "mercury-chat-me";
      const user = this.experience.user;
      const content = document.createElement("div");
      content.className = "mercury-chat-me__content";
      const hero = document.createElement("section");
      hero.className = "mercury-chat-me__hero";
      hero.style.backgroundImage = `linear-gradient(180deg, rgb(242 250 252 / 88%) 0 22%, rgb(202 225 236 / 18%) 45%, rgb(31 73 100 / 48%) 100%), url('${user.profileBackground}')`;
      hero.style.backgroundPosition = user.cropPosition || "54% 55%";
      const title = document.createElement("h1"); title.textContent = "Me";
      const more = this.button("个人资料选项", "mercury-chat-me__more");
      more.disabled = true; more.title = "后续开放";
      const moreDots = document.createElement("span"); moreDots.className = "mercury-chat-me__more-dots"; moreDots.textContent = "···"; more.append(moreDots);
      const avatar = this.avatar("mercury-chat-me__avatar"); avatar.src = user.avatar;
      avatar.addEventListener("error", () => { avatar.src = AVATAR_FALLBACK; }, { once: true });
      const identity = document.createElement("div"); identity.className = "mercury-chat-me__identity";
      const name = document.createElement("h2"); name.textContent = user.name;
      const status = document.createElement("p"); status.textContent = user.status;
      identity.append(name, status);
      const presence = document.createElement("span"); presence.className = "mercury-chat-me__presence";
      const presenceDot = document.createElement("i"); presence.append(presenceDot, "在线");
      hero.append(title, more, avatar, identity, presence);
      const features = document.createElement("section"); features.className = "mercury-chat-me__features";
      const addFeature = (container, label, subtitle, icon, onClick, options = {}) => {
        const row = this.button(label, "mercury-chat-me__feature", icon);
        const copy = document.createElement("span");
        const heading = document.createElement("strong"); heading.textContent = label;
        const detail = document.createElement("small"); detail.textContent = subtitle;
        copy.append(heading, detail); row.append(copy, this.icon("nav-arrow-right"));
        row.disabled = options.disabled === true;
        if (options.disabled) row.dataset.state = "unavailable";
        else row.addEventListener("click", onClick);
        container.append(row);
      };
      const group = (label) => { const section = document.createElement("section"); section.className = "mercury-chat-me__feature-group"; const title = document.createElement("h2"); title.textContent = label; section.append(title); features.append(section); return section; };
      const selfGroup = group("我的页面");
      addFeature(selfGroup, "我的身份", "名称、头像、状态与主页资料", "spark", () => { this.ui.route = "profileAppearance"; this.paint(); });
      addFeature(selfGroup, "美化", "调整头像与主页背景", "palette", () => { this.ui.profileAppearancePanel = "background"; this.ui.route = "profileAppearance"; this.paint(); });
      const socialGroup = group("互动与服务");
      const momentsEntry = (this.presentationAdapter?.meEntries || []).find((entry) => entry.slot === "moments");
      if (momentsEntry) addFeature(socialGroup, "朋友圈", "我的动态、相册与互动记录", "camera", () => { this.ui.route = momentsEntry.route; this.paint(); });
      else addFeature(socialGroup, "朋友圈", "尚未开放", "camera", () => {}, { disabled: true });
      addFeature(socialGroup, "钱包", "尚未开放", "database", () => {}, { disabled: true });
      const dataGroup = group("数据");
      addFeature(dataGroup, "数据管理", "聊天记录、备份与隐私设置", "shield-check", () => this.openApp("settings", "home"));
      content.append(hero, features); page.append(content, this.primaryNavigation()); return page;
    }
    profileAppearanceDraft() {
      if (this.ui.profileAppearanceDraft) return this.ui.profileAppearanceDraft;
      const user = this.experience.user;
      this.ui.profileAppearanceDraft = { avatar: user.avatar, profileBackground: user.profileBackground, name: user.name, status: user.status, cropPosition: user.cropPosition || "54% 55%", dirty: false };
      return this.ui.profileAppearanceDraft;
    }
    clearProfileAppearanceDraft() { delete this.ui.profileAppearanceDraft; delete this.ui.profileAppearancePanel; delete this.ui.profileAppearanceEditing; }
    profileBackgroundOptions() { return [{ label: "冷雨城市", src: VISUAL_CHAT_BACKGROUND }, { label: "雨窗叶影", src: "assets/wallpapers/rain-window-leaves-v1.webp" }, { label: "水面星光", src: "assets/archive/archive-water-starlight-v1.png" }, { label: "风铃与光", src: "assets/archive/archive-wind-chimes-v1.webp" }, { label: "冷雾玻璃", src: "assets/archive/archive-glass-water-v1.webp" }]; }
    profileBackgroundLabel(src) { return this.profileBackgroundOptions().find((option) => option.src === src)?.label || (String(src || "").startsWith("data:") ? "已上传素材" : "自定义背景"); }
    markProfileAppearanceDirty() {
      const draft = this.profileAppearanceDraft(); draft.dirty = true;
      const state = this.root?.querySelector?.("[data-profile-preview-state]"); if (state) state.textContent = "有未保存修改";
      const save = this.root?.querySelector?.("[data-profile-action='save']"); if (save) save.disabled = false;
    }
    commitProfileAppearance() {
      const draft = this.profileAppearanceDraft(); const defaults = global.MercuryChatExperienceContracts.DEFAULT_USER;
      this.experience.user = { ...this.experience.user, avatar: draft.avatar || defaults.avatar, profileBackground: draft.profileBackground || defaults.profileBackground, name: String(draft.name || "").trim() || defaults.name, status: String(draft.status || "").trim() || defaults.status, cropPosition: draft.cropPosition || defaults.cropPosition };
      this.saveExperience(); this.clearProfileAppearanceDraft(); this.paint();
    }
    profileAppearancePreview(draft, mode = "overview") {
      const preview = document.createElement("section"); preview.className = `mercury-chat-profile-editor__preview mercury-chat-profile-editor__preview--${mode}`;
      const hero = document.createElement("div"); hero.className = "mercury-chat-profile-editor__preview-surface";
      hero.style.backgroundImage = `linear-gradient(180deg, rgb(242 250 252 / 22%) 0%, rgb(19 50 58 / 10%) 42%, rgb(19 50 58 / 60%) 100%), url("${draft.profileBackground || "assets/archive/archive-water-starlight-v1.png"}")`;
      hero.style.backgroundPosition = draft.cropPosition || "54% 55%";
      hero.dataset.profilePreviewHero = "true";
      const copy = document.createElement("div"); copy.className = "mercury-chat-profile-editor__preview-copy";
      const avatar = this.avatar("mercury-chat-profile-editor__preview-avatar"); avatar.src = draft.avatar || AVATAR_FALLBACK; avatar.alt = ""; avatar.addEventListener("error", () => { avatar.src = AVATAR_FALLBACK; }, { once: true });
      const identity = document.createElement("div"); identity.className = "mercury-chat-profile-editor__preview-identity";
      const name = document.createElement("strong"); name.dataset.profilePreview = "name"; name.textContent = draft.name || "Me";
      const status = document.createElement("small"); status.dataset.profilePreview = "status"; status.textContent = draft.status || "";
      identity.append(name, status);
      const state = document.createElement("span"); state.className = "mercury-chat-profile-editor__preview-state"; state.dataset.profilePreviewState = "true"; state.textContent = draft.dirty ? "有未保存修改" : "已保存";
      if (mode === "background") { copy.append(identity, state); } else { copy.append(avatar, identity, state); }
      hero.append(copy); preview.append(hero); preview.profilePreviewHero = hero; return preview;
    }
    profileAppearanceRow(label, subtitle, value, iconName, onClick) {
      const row = this.button(label, "mercury-chat-profile-editor__row", iconName); const copy = document.createElement("span"); copy.className = "mercury-chat-profile-editor__row-copy";
      const title = document.createElement("strong"); title.textContent = label; const detail = document.createElement("small"); detail.textContent = subtitle; copy.append(title, detail);
      const current = document.createElement("span"); current.className = "mercury-chat-profile-editor__row-value"; current.textContent = value;
      row.append(copy, current, this.icon("nav-arrow-right")); row.addEventListener("click", onClick); return row;
    }
    profileAppearanceTextEditorRow(draft, field, label, iconName) {
      const row = document.createElement("div"); row.className = "mercury-chat-profile-editor__row mercury-chat-profile-editor__row--editing"; row.dataset.profileEditorField = field; row.append(this.icon(iconName));
      const input = document.createElement("input"); input.type = "text"; input.value = draft[field] || ""; input.maxLength = field === "status" ? 80 : 32; input.setAttribute("aria-label", label); input.className = "mercury-chat-profile-editor__inline-input";
      const done = this.button("完成", "mercury-chat-profile-editor__inline-done", "check-circle"); const finish = () => { this.ui.profileAppearanceEditing = null; this.paint(); };
      input.addEventListener("input", () => { draft[field] = input.value; this.markProfileAppearanceDirty(); const preview = this.root?.querySelector?.(`[data-profile-preview='${field}']`); if (preview) preview.textContent = input.value || (field === "name" ? "Me" : ""); }); input.addEventListener("keydown", (event) => { if (event.key === "Enter") finish(); }); done.addEventListener("click", finish); row.append(input, done); return row;
    }
    profileAppearanceOverview(draft) {
      const body = document.createElement("div"); body.className = "mercury-chat-profile-editor"; const preview = this.profileAppearancePreview(draft); body.append(preview);
      const section = (title, rows, meta) => { const group = document.createElement("section"); group.className = "mercury-chat-profile-editor__group"; const heading = document.createElement("div"); heading.className = "mercury-chat-profile-editor__group-heading"; const name = document.createElement("h2"); name.textContent = title; const hint = document.createElement("span"); hint.textContent = meta || ""; heading.append(name, hint); group.append(heading, ...rows); return group; };
      const materialRows = [this.profileAppearanceRow("头像", "圆形裁切 · 当前头像", draft.avatar ? "已设置" : "默认素材", "media-image", () => this.chooseImage((value) => { draft.avatar = value; this.markProfileAppearanceDirty(); }, { persist: false }))];
      materialRows.push(this.profileAppearanceRow("主页背景", `${this.profileBackgroundLabel(draft.profileBackground)} · 可调整位置`, this.profileBackgroundLabel(draft.profileBackground), "palette", () => { this.ui.profileAppearancePanel = "background"; this.paint(); }));
      const profileRows = [];
      profileRows.push(this.ui.profileAppearanceEditing === "name" ? this.profileAppearanceTextEditorRow(draft, "name", "名称", "settings") : this.profileAppearanceRow("名称", "在个人资料与聊天中显示", draft.name || "Me", "settings", () => { this.ui.profileAppearanceEditing = "name"; this.paint(); }));
      profileRows.push(this.ui.profileAppearanceEditing === "status" ? this.profileAppearanceTextEditorRow(draft, "status", "状态", "chat-bubble") : this.profileAppearanceRow("状态", "一句话表达现在的心情", draft.status || "", "chat-bubble", () => { this.ui.profileAppearanceEditing = "status"; this.paint(); }));
      body.append(section("素材", materialRows, "2 项可编辑"), section("资料", profileRows, "即时预览"));
      const footer = document.createElement("div"); footer.className = "mercury-chat-profile-editor__savebar"; const note = document.createElement("span"); note.textContent = draft.dirty ? "修改尚未保存" : "所有修改只在保存后生效"; const save = this.button("保存修改", "mercury-chat-profile-editor__save", "check-circle"); save.dataset.profileAction = "save"; save.disabled = !draft.dirty; const saveText = document.createElement("span"); saveText.textContent = "保存修改"; save.append(saveText); save.addEventListener("click", () => this.commitProfileAppearance()); footer.append(note, save); body.append(footer); return body;
    }
    profileAppearanceBackgroundEditor(draft) {
      const body = document.createElement("div"); body.className = "mercury-chat-profile-editor mercury-chat-profile-editor--background"; const preview = this.profileAppearancePreview(draft, "background"); body.append(preview);
      const heading = document.createElement("div"); heading.className = "mercury-chat-profile-editor__subheading"; const title = document.createElement("h2"); title.textContent = "选择素材"; const note = document.createElement("span"); note.textContent = "我的素材池"; heading.append(title, note); body.append(heading);
      const thumbs = document.createElement("div"); thumbs.className = "mercury-chat-profile-editor__thumbnails";
      this.profileBackgroundOptions().forEach((option) => { const item = this.button(option.label, "mercury-chat-profile-editor__thumbnail"); item.setAttribute("aria-pressed", String(draft.profileBackground === option.src)); item.style.backgroundImage = `linear-gradient(145deg, rgb(19 50 58 / 4%), rgb(19 50 58 / 12%)), url("${option.src}")`; item.addEventListener("click", () => { draft.profileBackground = option.src; this.markProfileAppearanceDirty(); preview.profilePreviewHero.style.backgroundImage = `linear-gradient(180deg, rgb(242 250 252 / 22%) 0%, rgb(19 50 58 / 10%) 42%, rgb(19 50 58 / 60%) 100%), url("${option.src}")`; thumbs.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button === item))); }); thumbs.append(item); });
      const upload = this.button("上传新背景", "mercury-chat-profile-editor__upload", "media-image"); const uploadText = document.createElement("span"); uploadText.textContent = "上传新背景"; upload.append(uploadText); upload.addEventListener("click", () => this.chooseImage((value) => { draft.profileBackground = value; this.markProfileAppearanceDirty(); }, { persist: false })); thumbs.append(upload); body.append(thumbs);
      const positionHeading = document.createElement("div"); positionHeading.className = "mercury-chat-profile-editor__subheading mercury-chat-profile-editor__subheading--position"; const positionTitle = document.createElement("h2"); positionTitle.textContent = "调整位置"; const positionValue = document.createElement("span"); positionValue.textContent = draft.cropPosition || "54% 55%"; positionHeading.append(positionTitle, positionValue); body.append(positionHeading);
      const crop = String(draft.cropPosition || "54% 55%").match(/(\d+)\D+(\d+)/) || ["", "54", "55"]; const x = document.createElement("input"); x.type = "range"; x.min = "0"; x.max = "100"; x.value = crop[1]; x.setAttribute("aria-label", "水平位置"); const y = document.createElement("input"); y.type = "range"; y.min = "0"; y.max = "100"; y.value = crop[2]; y.setAttribute("aria-label", "垂直位置"); const ranges = document.createElement("div"); ranges.className = "mercury-chat-profile-editor__ranges"; const rangeRow = (before, input, after) => { const row = document.createElement("label"); row.className = "mercury-chat-profile-editor__range"; const left = document.createElement("span"); left.textContent = before; const right = document.createElement("span"); right.textContent = after; row.append(left, input, right); return row; }; ranges.append(rangeRow("左", x, "右"), rangeRow("上", y, "下")); const syncCrop = () => { draft.cropPosition = `${x.value}% ${y.value}%`; positionValue.textContent = draft.cropPosition; preview.profilePreviewHero.style.backgroundPosition = draft.cropPosition; this.markProfileAppearanceDirty(); }; x.addEventListener("input", syncCrop); y.addEventListener("input", syncCrop); body.append(ranges);
      const scope = document.createElement("div"); scope.className = "mercury-chat-profile-editor__scope"; const scopeTitle = document.createElement("span"); scopeTitle.textContent = "应用范围"; const scopeValue = document.createElement("strong"); scopeValue.textContent = "个人主页"; scope.append(scopeTitle, scopeValue); body.append(scope);
      const actions = document.createElement("div"); actions.className = "mercury-chat-profile-editor__actions"; const reset = this.button("恢复默认", "mercury-chat-profile-editor__reset", "refresh-double"); const resetText = document.createElement("span"); resetText.textContent = "恢复默认"; reset.append(resetText); reset.addEventListener("click", () => { const defaults = global.MercuryChatExperienceContracts.DEFAULT_USER; draft.profileBackground = defaults.profileBackground; draft.cropPosition = defaults.cropPosition; this.markProfileAppearanceDirty(); this.paint(); }); const apply = this.button("应用", "mercury-chat-profile-editor__apply", "check-circle"); const applyText = document.createElement("span"); applyText.textContent = "应用"; apply.append(applyText); apply.addEventListener("click", () => { this.ui.profileAppearancePanel = null; this.paint(); }); actions.append(reset, apply); body.append(actions); return body;
    }
    profileAppearanceView() {
      const draft = this.profileAppearanceDraft(); const backgroundMode = this.ui.profileAppearancePanel === "background"; const page = document.createElement("section"); page.className = "mercury-chat-page mercury-chat-profile-editor-page";
      const header = document.createElement("header"); header.className = "mercury-chat-page__header"; const back = this.button("返回", "mercury-chat-header__back", "nav-arrow-left"); back.addEventListener("click", () => { if (backgroundMode) { this.ui.profileAppearancePanel = null; this.paint(); return; } this.clearProfileAppearanceDraft(); this.ui.route = "me"; this.paint(); }); const title = document.createElement("h1"); title.textContent = backgroundMode ? "主页背景" : "个人资料与外观"; const headerState = document.createElement("span"); headerState.className = "mercury-chat-profile-editor__header-state"; headerState.textContent = draft.dirty ? "未保存" : ""; header.append(back, title, headerState); page.append(header, backgroundMode ? this.profileAppearanceBackgroundEditor(draft) : this.profileAppearanceOverview(draft)); return page;
    }
    chatBeautifyView() {
      const item = this.experienceFor(this.activeContactId(), this.activeTimelineId());
      const appearance = item.appearance;
      const update = (key, value) => { appearance[key] = value; this.saveExperience(); this.paint(); };
      const reset = this.button("重置聊天美化", "mercury-chat-page__text-action");
      const resetLabel = document.createElement("span"); resetLabel.textContent = "重置"; reset.append(resetLabel);
      reset.addEventListener("click", () => {
        item.appearance = { ...global.MercuryChatExperienceContracts.DEFAULT_APPEARANCE };
        this.saveExperience(); this.paint();
      });
      return this.simplePage("聊天美化", "settings", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-settings mercury-chat-beautify";
        const previewLabel = document.createElement("h2"); previewLabel.className = "mercury-chat-beautify__section-title"; previewLabel.textContent = "预览效果";
        const preview = document.createElement("section");
        preview.className = "mercury-chat-beautify__preview";
        if (appearance.background) {
          preview.style.backgroundImage = `linear-gradient(180deg, rgb(239 249 251 / 36%), rgb(74 112 120 / 32%)), url(\"${appearance.background}\")`;
          preview.style.backgroundPosition = appearance.cropPosition || "50% 50%";
        }
        const incomingRow = document.createElement("div"); incomingRow.className = "mercury-chat-beautify__message mercury-chat-beautify__message--incoming";
        const previewAvatar = this.avatar("mercury-chat-beautify__avatar"); previewAvatar.src = this.activeContact().avatar;
        const incoming = document.createElement("span"); incoming.className = "mercury-chat-beautify__bubble mercury-chat-beautify__bubble--incoming"; incoming.textContent = "今天书店的光很好看。";
        incomingRow.append(previewAvatar, incoming);
        const outgoingRow = document.createElement("div"); outgoingRow.className = "mercury-chat-beautify__message mercury-chat-beautify__message--outgoing";
        const outgoing = document.createElement("span"); outgoing.className = "mercury-chat-beautify__bubble mercury-chat-beautify__bubble--outgoing"; outgoing.textContent = "好美，像是从梦里透出来的。";
        outgoingRow.append(outgoing);
        preview.dataset.bubbleStyle = appearance.bubbleStyle || "default";
        preview.dataset.chatFont = appearance.chatFont || "system";
        preview.dataset.chatFontSize = appearance.chatFontSize || "medium";
        preview.dataset.showAvatar = String(appearance.showAvatar !== false);
        preview.append(incomingRow, outgoingRow);
        const section = (title, content) => { const group = document.createElement("section"); group.className = "mercury-chat-beautify__group"; const heading = document.createElement("h2"); heading.textContent = title; group.append(heading, content); return group; };
        const backgrounds = document.createElement("div"); backgrounds.className = "mercury-chat-beautify__swatches";
        const inheritedBackground = this.button("跟随主题背景", "mercury-chat-beautify__swatch mercury-chat-beautify__swatch--inherited");
        inheritedBackground.dataset.label = "跟随主题";
        inheritedBackground.setAttribute("aria-pressed", String(!appearance.background));
        inheritedBackground.addEventListener("click", () => update("background", null));
        backgrounds.append(inheritedBackground);
        this.profileBackgroundOptions().forEach((option) => {
          const button = this.button(option.label, "mercury-chat-beautify__swatch");
          button.dataset.label = option.label;
          button.style.backgroundImage = `url(\"${option.src}\")`;
          button.setAttribute("aria-pressed", String(appearance.background === option.src));
          button.addEventListener("click", () => update("background", option.src));
          backgrounds.append(button);
        });
        const upload = this.button("上传聊天背景", "mercury-chat-beautify__swatch mercury-chat-beautify__swatch--upload", "plus"); const uploadText = document.createElement("span"); uploadText.textContent = "自定义"; upload.append(uploadText); upload.addEventListener("click", () => this.chooseImage((value) => { appearance.background = value; }, { persist: true })); backgrounds.append(upload);
        const bubbleLabels = { default: "自然", "light-glass": "轻透", solid: "实体", minimal: "极简" };
        const fontLabels = { system: "清晰", rounded: "柔和", handwritten: "书卷", compact: "紧凑" };
        const sizeLabels = { small: "小", medium: "中", large: "大" };
        const bubbles = document.createElement("div"); bubbles.className = "mercury-chat-beautify__bubble-options";
        Object.entries(bubbleLabels).forEach(([value, label]) => {
          const option = this.button(label, "mercury-chat-beautify__bubble-option"); option.dataset.style = value; option.setAttribute("aria-pressed", String((appearance.bubbleStyle || "default") === value));
          const sample = document.createElement("i"); const text = document.createElement("span"); text.textContent = label; option.append(sample, text); option.addEventListener("click", () => update("bubbleStyle", value)); bubbles.append(option);
        });
        const typography = document.createElement("div"); typography.className = "mercury-chat-beautify__typography";
        const choiceRow = (label, values, current, onChange) => {
          const row = document.createElement("div"); row.className = "mercury-chat-beautify__choice-row";
          const title = document.createElement("span"); title.textContent = label;
          const choices = document.createElement("div"); choices.className = "mercury-chat-segmented";
          Object.entries(values).forEach(([value, text]) => { const button = this.button(text, "mercury-chat-segmented__item"); button.textContent = text; button.setAttribute("aria-pressed", String(current === value)); button.addEventListener("click", () => onChange(value)); choices.append(button); });
          row.append(title, choices); return row;
        };
        typography.append(
          choiceRow("字体", fontLabels, appearance.chatFont || "system", (value) => update("chatFont", value)),
          choiceRow("字号", sizeLabels, appearance.chatFontSize || "medium", (value) => update("chatFontSize", value)),
          choiceRow("间距", { compact: "紧凑", comfortable: "舒适" }, appearance.messageSpacing || "comfortable", (value) => update("messageSpacing", value)),
        );
        const more = document.createElement("div"); more.className = "mercury-chat-beautify__more";
        more.append(
          this.settingsToggleRow("显示头像", appearance.showAvatar !== false, (value) => update("showAvatar", value)),
          this.settingsToggleRow("显示时间", appearance.showTime !== false, (value) => update("showTime", value)),
          this.settingsToggleRow("显示日期分隔", appearance.showDate !== false, (value) => update("showDate", value)),
        );
        const scope = document.createElement("p"); scope.className = "mercury-chat-beautify__scope"; scope.textContent = "这些设置只应用于当前对话。";
        body.append(previewLabel, preview, section("背景", backgrounds), section("气泡样式", bubbles), section("字体与字号", typography), section("更多选项", more), scope);
        return body;
      }, { pageClass: "mercury-chat-beautify-page", headerAction: reset });
    }
    submitDraft() {
      const content = String(this.ui.draft || "").trim();
      const stagedParts = this.composerParts().map((part) => ({ ...part }));
      if ((!content && !stagedParts.length) || this.generationWorkflow?.snapshot().phase === "running") return false;
      const now = new Date();
      const id = `local-${now.getTime()}-${++this.messageSequence}`;
      const quote = this.ui.replyingTo ? { ...this.ui.replyingTo } : null;
      const textParts = content ? [{ id: `${id}:text`, type: "text", text: content }] : [];
      const parts = [...textParts, ...stagedParts];
      const transportText = content || stagedParts.filter((part) => part.type === "emoji").map((part) => part.value).join("");
      const message = global.MercuryChatData.createUserMessage({ id, turnId: `turn-${id}`, content: transportText, createdAt: now.toISOString(), delivery: "queued", replyToId: quote?.messageId || null, quote, parts });
      this.conversation ||= global.MercuryChatContracts.loadConversation(null).conversation;
      const result = this.generationWorkflow.start({ kind: "send", userEntry: { id: message.id, role: "user", text: message.content, createdAt: message.createdAt, delivery: "queued", replyToId: message.replyToId || null, quote: message.quote || null, parts: message.parts.map((part) => ({ ...part })) } });
      if (!result.accepted) return false;
      this.clearDraft();
      this.ui.replyingTo = null;
      this.ui.composerParts = [];
      this.ui.composerMediaError = null;
      this.ui.emojiPickerOpen = false;
      this.ui.selectedMessageId = null;
      this.ui.lastError = null;
      this.ui.messageViewportIntent = { kind: "latest" };
      this.paint();
      return true;
    }

    // 预设层：装配用户预设 → compileRuntime.userPreset 槽。缺模块或存储时 fail-soft（null）。
    initPresetLayer() {
      const PC = global.MercuryPresetContent;
      const PA = global.MercuryPresetAssemble;
      const PS = global.MercuryGenerationProfileStore;
      const storage = this.context?.services?.sharedStorage || this.context?.services?.storage;
      if (!(PC && PA && PS && storage)) return;
      try {
        this.presetStore = new PS({ storage });
        this.presetAssemble = { assemble: PA.assemblePresetInstructions, inspect: PA.inspectPresetInstructions };
        this.applyGenerationProfileIdRemaps();
      } catch (error) {
        this.presetStore = null;
        this.presetAssemble = null;
      }
    }

    applyGenerationProfileIdRemaps() {
      const remapped = this.presetStore?.migration?.remappedIds;
      if (!remapped || typeof remapped !== "object" || !Object.keys(remapped).length) return false;
      let changed = false;
      Object.values(this.experience?.conversations || {}).forEach((conversation) => {
        const settings = conversation?.settings;
        const bindings = conversation?.resourceBindings;
        if (settings && remapped[settings.userPresetId]) { settings.userPresetId = remapped[settings.userPresetId]; changed = true; }
        if (bindings && remapped[bindings.presetId]) { bindings.presetId = remapped[bindings.presetId]; changed = true; }
      });
      if (changed) this.saveExperience();
      return changed;
    }

    // 取当前对话绑定的预设并装配出生成文本；违约/缺件时回退 null（保持旧行为）。
    resolveUserPreset() {
      if (!this.presetStore || !this.presetAssemble) return null;
      const conversation = this.experienceFor(this.activeContactId(), this.activeTimelineId());
      const presetId = conversation.resourceBindings?.presetId ?? conversation.settings.userPresetId ?? "preset-default";
      try {
        const preset = this.presetStore.get(presetId) || this.presetStore.get("preset-default");
        if (!preset) return null;
        const assembled = this.presetAssemble.assemble(preset, { withWarnings: true, templateValues: this.presetTemplateValues() });
        return { id: preset.id, instructions: assembled.text, warnings: Array.isArray(assembled.warnings) ? assembled.warnings : [] };
      } catch (error) {
        if (typeof console !== "undefined" && console.error) console.error("[preset] resolve failed", error);
        return null;
      }
    }

    buildRuntimeInput(input = {}) {
      const contact = this.experience.contacts[this.activeContactId()];
      const persona = (contact && contact.persona) || {};
      const core = global.MercuryRuntimeCore || null;
      const baseSettings = (this.conversation && this.conversation.settings) || global.MercuryChatContracts.DEFAULT_SETTINGS;
      const tone = baseSettings.presentation || global.MercuryChatContracts.DEFAULT_SETTINGS.presentation;
      const experienceSettings = global.MercuryChatContracts.normalizeExperienceSettings(this.experienceFor(this.activeContactId(), this.activeTimelineId()).settings);
      const asideSetting = experienceSettings.unspokenAside;
      const presentation = { ...tone, unspokenAside: asideSetting };
      const userPreset = this.resolveUserPreset();
      const bindings = this.experienceFor(this.activeContactId(), this.activeTimelineId()).resourceBindings;
      const archiveState = this.resolveArchiveRuntime(input, bindings);
      const recalledEvents = Array.isArray(input.recalledEvents) ? input.recalledEvents : [];
      const runtimeContext = { ...(archiveState.context || {}) };
      if (recalledEvents.length) runtimeContext.memoryEvents = recalledEvents;
      const sceneContext = this.activeSceneContext();
      if (sceneContext) runtimeContext.sceneContext = { ...sceneContext };
      return global.MercuryChatContracts.compileRuntime({
        runtimeCore: core ? { id: core.id, rules: core.rules } : { id: "core-default", rules: [] },
        runtimeModules: archiveState.modules,
        userPreset,
        presentation: { presentation },
        experienceSettings,
        runtimeProfile: { ...(archiveState.profile || persona), displayName: archiveState.profile?.displayName || persona.displayName || (contact && contact.name) || "该角色" },
        runtimeContext: Object.keys(runtimeContext).length ? runtimeContext : null,
        resourceTrace: archiveState.resourceTrace ? { ...archiveState.resourceTrace, binding: { contactId: this.activeContactId(), worldVariantId: this.activeWorldVariantId(), timelineId: this.activeTimelineId(), runtimeProfileId: bindings?.runtimeProfileId || null, worldBookMode: bindings?.worldBookMode || "inherit", worldBookIds: [...(bindings?.worldBookIds || [])], presetId: userPreset?.id || bindings?.presetId || null, sceneContext: sceneContext ? { id: sceneContext.id, title: sceneContext.title, source: sceneContext.source, contentLength: sceneContext.content.length } : null }, memory: input.memoryTrace || { mode: "none", selectedIds: [], fallback: false } } : null,
        warnings: [...(archiveState.warnings || []), ...(userPreset?.warnings || [])],
      });
    }

    buildAssistantRequest(message, previousEntries, requestId, memoryResolution = null) {
      const runtime = this.buildRuntimeInput({ currentMessage: message.content || message.text, recentMessages: previousEntries, recalledEvents: memoryResolution?.events || [], memoryTrace: memoryResolution?.trace || null });
      this.lastRuntimeAssembly = runtime.resourceTrace || null;
      return {
        requestId,
        conversationId: this.conversation.id,
        userMessage: { id: message.id, text: message.content || message.text },
        settings: this.conversation.settings,
        experienceSettings: runtime.experienceSettings,
        recentMessages: global.MercuryChatContracts.selectRecentMessages(previousEntries, runtime.experienceSettings),
        systemPrompt: runtime.compiledSystemText,
      };
    }

    currentResourceRuntimeTrace() {
      const trace = this.lastRuntimeAssembly;
      const binding = trace?.binding;
      if (!binding || binding.contactId !== this.activeContactId() || binding.worldVariantId !== this.activeWorldVariantId() || binding.timelineId !== this.activeTimelineId()) return null;
      return trace;
    }

    resolveArchiveRuntime(input = {}, sessionBindings = null) {
      const archive = global.MercuryArchiveContracts;
      const storage = this.context?.services?.sharedStorage || this.context?.services?.storage;
      if (!archive || typeof storage?.get !== "function") return { modules: [], context: null, resourceTrace: null, warnings: [], profile: null };
      const state = archive.normalizeArchiveState(storage.get(archive.STORAGE_KEY, null));
      const contact = this.activeContact() || {};
      const profileId = sessionBindings?.runtimeProfileId || contact.runtimeProfileId || contact.persona?.runtimeProfileId;
      const profile = state.runtimeProfiles.find((item) => item.id === profileId) || null;
      const hasExplicitWorldBindings = sessionBindings?.worldBookMode === "explicit";
      const bindings = hasExplicitWorldBindings
        ? (Array.isArray(sessionBindings.worldBookIds) ? sessionBindings.worldBookIds : []).map((value) => String(value))
        : Array.isArray(profile?.worldBindings) ? profile.worldBindings.map((value) => String(value)) : [];
      const worlds = state.worlds
        .filter((world) => world.status !== "archived")
        .filter((world) => hasExplicitWorldBindings
          ? bindings.includes(world.id) || bindings.includes(world.name)
          : bindings.includes(world.id) || bindings.includes(world.name));
      // Legacy archive.promptModules are migrated into Generation Profile
      // Instruction Blocks. They are deliberately no longer a second global
      // preset lane beside the selected Profile.
      const modules = [];
      const contactInstance = profile && (state.contactInstances.find((item) => item.runtimeProfileId === profile.id && item.chatContactId === this.activeContactId() && item.active !== false)
        || state.contactInstances.find((item) => item.runtimeProfileId === profile.id && item.active !== false));
      const scope = {
        contactId: this.activeContactId(),
        runtimeProfileId: profile?.id || sessionBindings?.runtimeProfileId || contact.persona?.runtimeProfileId || "",
        worldVariantId: sessionBindings?.worldVariantId || "default",
        timelineId: this.activeTimelineId(),
        profileWorldBindings: Array.isArray(profile?.worldBindings) ? profile.worldBindings : [],
      };
      const resolver = global.MercuryWorldBookRuntime;
      if (!resolver || typeof resolver.resolve !== "function") {
        return {
          modules: modules.map((module) => ({ id: module.id, rules: [module.content] })),
          context: { relationshipState: contactInstance?.relationshipState || "new", worlds: [] },
          resourceTrace: { version: 1, sourceWorldCount: worlds.length, selectedCount: 0, selectedEntries: [], scope, warnings: [{ code: "world_runtime_unavailable" }] },
          warnings: [{ code: "world_runtime_unavailable" }], profile,
        };
      }
      const resolved = resolver.resolve(worlds, { ...input, scope });
      return {
        modules: modules.map((module) => ({ id: module.id, rules: [module.content] })),
        context: { relationshipState: contactInstance?.relationshipState || "new", worlds: resolved.worlds },
        resourceTrace: resolved.trace,
        warnings: resolved.warnings, profile,
      };
    }

    contactView() {
      const menuToggle = this.button("联系人更多", "mercury-chat-page__more");
      const dots = document.createElement("span");
      dots.className = "mercury-chat-page__more-dots";
      dots.textContent = "···";
      menuToggle.append(dots);
      menuToggle.addEventListener("click", () => {
        this.ui.contactMenuOpen = !this.ui.contactMenuOpen;
        this.paint();
      });
      return this.simplePage("联系人", "contacts", () => {
        const body = document.createElement("div");
        body.className = "mercury-chat-contact-profile mercury-chat-contact-profile--space";
        const contact = this.experience.contacts[this.ui.selectedContactId] || this.experience.contacts["contact-a"];
        const summary = Array.isArray(contact.summary) ? contact.summary[0] : contact.summary;
        const recentTime = this.previewTime(contact.id);
        // The relationship space is intentionally abstract. Imported contact
        // artwork must never become a person/face hero by accident.
        const background = contact.profileBackground || VISUAL_CONTACT_BACKGROUND;

        if (this.ui.contactMenuOpen) {
          const menu = document.createElement("div");
          menu.className = "mercury-chat-contact-profile__menu";
          const menuItems = [["查看完整人设", "前往档案馆查看原始资源", "database", "archive"]];
          menuItems.forEach(([label, subtitle, icon, route]) => {
            const item = this.button(label, "mercury-chat-contact-profile__menu-item", icon);
            const copy = document.createElement("span");
            const title = document.createElement("strong");
            title.textContent = label;
            const detail = document.createElement("small");
            detail.textContent = subtitle;
            copy.append(title, detail);
            item.append(copy);
            item.addEventListener("click", () => {
              this.ui.contactMenuOpen = false;
              if (route === "archive") { this.openApp("archive", this.archiveRouteForContact(contact)); return; }
              this.ui.route = route; this.paint();
            });
            menu.append(item);
          });
          body.append(menu);
        }
        if (this.ui.memoryError) {
          const notice = document.createElement("p");
          notice.className = "mercury-chat-contact-profile__memory-error";
          notice.textContent = this.ui.memoryError;
          body.append(notice);
        }

        const hero = document.createElement("section");
        hero.className = "mercury-chat-contact-profile__hero mercury-chat-contact-profile__hero--atmosphere";
        hero.style.backgroundImage = `url("${background}")`;
        const ambient = document.createElement("span");
        ambient.className = "mercury-chat-contact-profile__ambient";
        ambient.setAttribute("aria-hidden", "true");
        const kicker = document.createElement("span");
        kicker.className = "mercury-chat-contact-profile__kicker";
        kicker.textContent = "关系空间";
        const name = document.createElement("h2");
        name.textContent = contact.name;
        const identity = document.createElement("p");
        identity.className = "mercury-chat-contact-profile__identity";
        identity.textContent = contact.identity || "一段安静的连接";
        const presence = document.createElement("span");
        presence.className = "mercury-chat-contact-profile__presence";
        const dot = document.createElement("i");
        presence.append(dot, contact.relationship || "可联系");
        hero.append(ambient, kicker, name, identity, presence);

        const actions = document.createElement("section");
        actions.className = "mercury-chat-contact-profile__actions mercury-chat-contact-profile__actions--light";
        const hasConversation = this.hasConversationContent(contact.id);
        const chatLabel = hasConversation ? "继续聊天" : "开始聊天";
        const chat = this.button("聊天", "mercury-chat-contact-profile__action mercury-chat-contact-profile__action--chat", "chat-bubble");
        chat.setAttribute("aria-label", chatLabel);
        const chatCopy = document.createElement("span");
        const chatTitle = document.createElement("strong");
        chatTitle.textContent = "聊天";
        chatTitle.textContent = chatLabel;
        const chatDetail = document.createElement("small");
        chatDetail.textContent = "继续这段对话";
        chatDetail.textContent = hasConversation ? "继续这段对话" : "从这里开始聊天";
        chatCopy.append(chatTitle, chatDetail);
        chat.append(chatCopy);
        chat.addEventListener("click", () => this.openConversation(contact.id));
        const favorite = this.button(contact.favorite ? "取消关系标记" : "标记关系", "mercury-chat-contact-profile__favorite");
        favorite.textContent = contact.favorite ? "♥" : "♡";
        favorite.setAttribute("aria-pressed", String(Boolean(contact.favorite)));
        favorite.addEventListener("click", () => {
          contact.favorite = !contact.favorite;
          this.saveExperience();
          this.paint();
        });
        actions.append(chat, favorite);

        const relation = document.createElement("section");
        relation.className = "mercury-chat-contact-profile__section mercury-chat-contact-profile__relation";
        const relationHeading = document.createElement("div");
        relationHeading.className = "mercury-chat-contact-profile__section-heading";
        const relationTitle = document.createElement("h3");
        relationTitle.textContent = "我们之间";
        const relationHint = document.createElement("span");
        relationHint.textContent = "关系摘要";
        relationHeading.append(relationTitle, relationHint);
        const relationCopy = document.createElement("p");
        relationCopy.textContent = contact.relationship || "一段正在形成的连接";
        const relationMeta = document.createElement("div");
        relationMeta.className = "mercury-chat-contact-profile__relation-meta";
        const relationState = document.createElement("span");
        relationState.textContent = "状态由你手动维护";
        const relationTime = document.createElement("strong");
        relationTime.textContent = recentTime ? `最近聊天 ${this.formatMessageTime(recentTime)}` : "还没有聊天记录";
        relationMeta.append(relationState, relationTime);
        relation.append(relationHeading, relationCopy, relationMeta);

        const recent = document.createElement("section");
        recent.className = "mercury-chat-contact-profile__section mercury-chat-contact-profile__recent";
        const recentHeading = document.createElement("div");
        recentHeading.className = "mercury-chat-contact-profile__section-heading";
        const recentTitle = document.createElement("h3");
        recentTitle.textContent = "最近记录";
        const recentHint = document.createElement("span");
        recentHint.textContent = "氛围片段";
        recentHeading.append(recentTitle, recentHint);
        const rail = document.createElement("div");
        rail.className = "mercury-chat-contact-profile__record-rail";
        [
          ["assets/archive/archive-wind-chimes-v1.webp", "风铃"],
          ["assets/archive/archive-glass-water-v1.webp", "水面"],
          ["assets/wallpapers/rain-window-leaves-v1.webp", "叶影"],
          ["assets/archive/archive-water-starlight-v1.png", "微光"],
        ].forEach(([src, label]) => {
          const tile = document.createElement("figure");
          tile.className = "mercury-chat-contact-profile__record";
          const image = document.createElement("img");
          image.src = src;
          image.alt = "";
          image.loading = "lazy";
          const caption = document.createElement("figcaption");
          caption.textContent = label;
          tile.append(image, caption);
          rail.append(tile);
        });
        recent.append(recentHeading, rail);

        const pendingRecords = this.relationshipRecords(contact.id, "pending");
        const confirmedRecords = this.relationshipRecords(contact.id, "confirmed");
        let pending = null;
        if (pendingRecords.length) {
          pending = document.createElement("section");
          pending.className = "mercury-chat-contact-profile__section mercury-chat-contact-profile__pending";
          const pendingHeading = document.createElement("div");
          pendingHeading.className = "mercury-chat-contact-profile__section-heading";
          const pendingTitle = document.createElement("h3");
          pendingTitle.textContent = "待确认记录";
          const pendingHint = document.createElement("span");
          pendingHint.textContent = "确认后才会保存";
          pendingHeading.append(pendingTitle, pendingHint);
          pending.append(pendingHeading);
          pendingRecords.forEach((record) => {
            const row = document.createElement("article");
            row.className = "mercury-chat-contact-profile__pending-row";
            const copy = document.createElement("input");
            copy.type = "text";
            copy.value = record.content;
            copy.maxLength = 180;
            copy.setAttribute("aria-label", "编辑待确认记录");
            copy.className = "mercury-chat-contact-profile__pending-input";
            const actions = document.createElement("div");
            actions.className = "mercury-chat-contact-profile__pending-actions";
            const confirm = this.button("确认记录", "mercury-chat-contact-profile__record-action mercury-chat-contact-profile__record-action--confirm", "check-circle");
            const retain = this.button("确认并保留为事件", "mercury-chat-contact-profile__record-action mercury-chat-contact-profile__record-action--retain", "spark");
            const dismiss = this.button("暂不记录", "mercury-chat-contact-profile__record-action", "cancel");
            const confirmLabel = document.createElement("span");
            confirmLabel.textContent = "确认";
            const retainLabel = document.createElement("span");
            retainLabel.textContent = "保留事件";
            const dismissLabel = document.createElement("span");
            dismissLabel.textContent = "暂不记录";
            confirm.append(confirmLabel);
            retain.append(retainLabel);
            dismiss.append(dismissLabel);
            confirm.disabled = !copy.value.trim();
            retain.disabled = !copy.value.trim();
            copy.addEventListener("input", () => { confirm.disabled = !copy.value.trim(); retain.disabled = !copy.value.trim(); });
            confirm.addEventListener("click", () => this.confirmRelationshipRecord(record.id, copy.value));
            retain.addEventListener("click", () => this.confirmRelationshipRecord(record.id, copy.value, { retention: "durable", eventType: record.kind === "open_thread" ? "open-thread" : "shared-event" }));
            dismiss.addEventListener("click", () => this.updateRelationshipRecord(record.id, "dismissed"));
            actions.append(confirm, retain, dismiss);
            row.append(copy, actions);
            pending.append(row);
          });
        }

        const timeline = document.createElement("section");
        timeline.className = "mercury-chat-contact-profile__section mercury-chat-contact-profile__timeline";
        const timelineHeading = document.createElement("div");
        timelineHeading.className = "mercury-chat-contact-profile__section-heading";
        const timelineTitle = document.createElement("h3");
        timelineTitle.textContent = "重要时刻";
        const timelineHint = document.createElement("span");
        timelineHint.textContent = "时间与片段";
        timelineHeading.append(timelineTitle, timelineHint);
        const timelineRow = document.createElement("div");
        timelineRow.className = "mercury-chat-contact-profile__timeline-row";
        const timelineDate = document.createElement("time");
        const latestRecord = confirmedRecords.at(-1);
        timelineDate.textContent = latestRecord ? this.formatMessageTime(latestRecord.createdAt) : (recentTime ? this.formatMessageTime(recentTime) : "-");
        const timelineText = document.createElement("span");
        timelineText.textContent = latestRecord?.content || (recentTime ? (this.conversationPreview(contact.id) || "最近的一次对话") : "重要时刻会从确认后的记录中出现");
        timelineRow.append(timelineDate, timelineText);
        timeline.append(timelineHeading, timelineRow);

        const about = document.createElement("section");
        about.className = "mercury-chat-contact-profile__section mercury-chat-contact-profile__about";
        const aboutHeading = document.createElement("div");
        aboutHeading.className = "mercury-chat-contact-profile__section-heading";
        const aboutTitle = document.createElement("h3");
        aboutTitle.textContent = "资料摘要";
        const aboutHint = document.createElement("span");
        aboutHint.textContent = "从更多进入完整资料";
        aboutHeading.append(aboutTitle, aboutHint);
        const aboutText = document.createElement("p");
        aboutText.textContent = summary || contact.identity || "还没有留下简介。";
        about.append(aboutHeading, aboutText);
        const archiveLink = this.button("查看完整人设", "mercury-chat-contact-profile__archive-link", "database");
        const archiveLinkText = document.createElement("span");
        archiveLinkText.textContent = "查看完整人设";
        archiveLink.append(archiveLinkText);
        archiveLink.addEventListener("click", () => this.openApp("archive", this.archiveRouteForContact(contact)));
        about.append(archiveLink);

        const space = document.createElement("section");
        space.className = "mercury-chat-contact-profile__section mercury-chat-contact-profile__shared";
        const spaceHeading = document.createElement("div");
        spaceHeading.className = "mercury-chat-contact-profile__section-heading";
        const spaceTitle = document.createElement("h3");
        spaceTitle.textContent = "共同空间";
        const spaceHint = document.createElement("span");
        spaceHint.textContent = "慢慢展开";
        spaceHeading.append(spaceTitle, spaceHint);
        const spaceLinks = document.createElement("div");
        spaceLinks.className = "mercury-chat-contact-profile__space-links";
        const links = [
          ["聊天", "继续对话", "chat-bubble", () => this.openConversation(contact.id)],
          ["场景", "选择一段独立情境", "spark", () => { this.ui.selectedContactId = contact.id; this.ui.route = "sceneLibrary"; this.paint(); }],
          ["美化", "背景与气泡", "palette", () => { this.ui.route = "appearance"; this.paint(); }],
          ["记忆", "待确认内容", "spark", () => { this.ui.route = "settings"; this.paint(); }],
        ];
        links.forEach(([label, subtitle, icon, onClick]) => {
          const item = this.button(label, "mercury-chat-contact-profile__space-link", icon);
          const copy = document.createElement("span");
          const itemTitle = document.createElement("strong");
          itemTitle.textContent = label;
          const itemSubtitle = document.createElement("small");
          itemSubtitle.textContent = subtitle;
          copy.append(itemTitle, itemSubtitle);
          item.append(copy);
          item.addEventListener("click", onClick);
          spaceLinks.append(item);
        });
        space.append(spaceHeading, spaceLinks);

        body.append(hero, actions, relation, recent);
        if (pending) body.append(pending);
        body.append(timeline, about, space);
        return body;
      }, { headerAction: menuToggle });
    }

    cancelRequest(options = {}) {
      const cancelled = this.generationWorkflow?.cancel() || false;
      if (cancelled && !options.silent) this.paint();
      return cancelled;
    }

    retryMessage(message) {
      if (!message || message.role !== "user") return false;
      const result = this.generationWorkflow?.start({ kind: "retry", messageId: message.id });
      if (!result?.accepted) return false;
      this.ui.lastError = null;
      this.ui.selectedMessageId = null;
      this.paint();
      return result.completion;
    }

    async regenerateMessage(message) {
      const result = this.generationWorkflow?.start({ kind: "regenerate", message });
      if (!result?.accepted) return false;
      this.ui.selectedMessageId = null;
      this.paint();
      const completed = await result.completion;
      if (completed) {
        const entry = this.conversation?.entries?.[this.assistantEntryIndexForMessage(message)];
        this.ui.messageViewportIntent = { kind: "anchor", messageId: entry?.legacyMessageId || message.id };
        this.paint();
      }
      return completed;
    }
  }

  function createMercuryChatDefinition() {
    return Object.freeze({ id: "mercury-chat", nameKey: "apps.mercuryChat", icon: "chat-bubble", version: 1, capabilities: Object.freeze(["storage", "notifications"]), widgets: Object.freeze([]), create: (options) => new MercuryChatAppController(options) });
  }
  global.MercuryCreateChatDefinition = createMercuryChatDefinition;
})(window);
