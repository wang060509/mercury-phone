(function exposeMercuryArchiveApp(global) {
  "use strict";

  const contracts = () => global.MercuryArchiveContracts;
  const profileContracts = () => global.MercuryGenerationProfileContracts;
  const ICON_ROOT = "assets/icons/iconoir/";
  const ARCHIVE_IMAGE_ROOT = "assets/archive/";
  const IMPORT_DIAGNOSTIC_COPY = Object.freeze({
    empty_input: "文件为空，无法导入。",
    invalid_json: "文件不是有效的 JSON。",
    unsupported_binary: "仅支持 JSON 资源或带角色卡数据的 PNG。",
    invalid_png: "PNG 文件结构无效，无法读取其中的数据。",
    png_character_metadata_missing: "PNG 中没有可识别的角色卡数据。",
    png_metadata_not_role_card: "PNG 中的数据不是受支持的角色卡。",
    unsupported_resource: "没有识别到受支持的角色、世界书或生成档案。",
    missing_display_name: "角色卡缺少名称。",
    missing_world_name: "世界书缺少名称。",
    missing_preset_name: "生成档案缺少名称。",
    missing_preset_order: "生成档案缺少有效的内容顺序。",
    missing_preset_enabled: "生成档案缺少内容启用状态。",
    preset_no_recognizable_content: "生成档案中没有可识别的指令或设置。",
    role_description_preserved_as_background: "较长的角色描述已完整保留为背景，导入后可继续整理。",
    world_entries_empty: "世界书目前没有条目，仍可导入后补充。",
    world_entry_skipped_empty_content: "已跳过没有正文的世界书条目。",
    preset_no_usable_prompt_blocks: "没有找到可直接用于生成的指令块，原始内容仍会保留。",
    preset_prompt_items_skipped: "部分无法识别的指令项已跳过，原始内容仍会保留。",
    preset_blocks_preserved_inactive: "部分指令因位置或角色不兼容而仅保留，不会进入运行时。",
    preset_generation_settings_preserved: "生成参数已保留，但当前不会改变运行时设置。",
    role_card_migrated: "兼容角色卡将转换为 Mercury 角色档案。",
    world_book_migrated: "兼容世界书将转换为 Mercury 世界书。",
    world_entries_object_migrated: "对象形式的世界书条目将整理为标准列表。",
    external_prompt_preset_migrated: "外部预设将转换为 Mercury 生成档案。",
    preset_migrated: "兼容预设将转换为 Mercury 生成档案。",
  });

  class MercuryArchiveAppController {
    constructor() {
      this.route = "home";
      this.section = "characters";
      this.selectedId = null;
      this.selectedWorldId = null;
      this.selectedSection = null;
      this.editing = false;
      this.candidate = null;
      this.entryEditing = null;
      this.searchQuery = "";
      this.errorText = "";
      this.menuOpen = false;
      this.selectedModuleId = null;
      this.worldSearchQuery = "";
      this.worldFilter = "all";
      this.worldSort = "updated";
      this.worldDraft = null;
      this.worldEditorDraft = null;
      this.worldEntryDraft = null;
      this.worldMenuId = null;
      this.worldIndexQuery = "";
      this.worldIndexFilter = "all";
      this.worldOverviewMenuOpen = false;
      this.worldCoverMenuOpen = false;
      this.analysisPendingId = null;
      this.analysisProgress = null;
      this.cabinetSection = "mercury";
      this.profileMenuId = null;
      this.coverDraft = null;
      this.profileOpenTimer = null;
      this.profileFlow = null;
      this.resourceIntake = null;
      this.importStage = null;
    }

    safeStore(fn) {
      try {
        const result = fn();
        if (this.errorText) this.errorText = "";
        return result;
      } catch (err) {
        const errorCodes = new Set();
        const seenErrors = new Set();
        let current = err;
        while (current && !seenErrors.has(current)) {
          seenErrors.add(current);
          if (current.code) errorCodes.add(current.code);
          current = current.cause;
        }
        if (errorCodes.has("RESOURCE_INTAKE_ROLLBACK_FAILED")) {
          this.errorText = "导入失败，存储可能不可用，且本地数据恢复不完整。请先导出备份再重试。";
        } else if (["RESOURCE_INTAKE_COMMIT_FAILED", "ARCHIVE_STORAGE_WRITE_FAILED", "GENERATION_PROFILE_STORAGE_WRITE_FAILED"].some((code) => errorCodes.has(code))) {
          this.errorText = "保存失败，存储可能不可用。";
        } else {
          this.errorText = "出了点问题，请重试。";
        }
        this.paint();
        return null;
      }
    }

    storeWrite(writeFn, thenReload) {
      const result = this.safeStore(writeFn);
      if (result === null) return null;
      if (thenReload !== false) this.state = this.store.load();
      return result;
    }

    render(root, context, launchPayload = null) {
      this.root = root;
      this.context = context;
      this.applyLaunchRoute(launchPayload);
      this.sharedStorage = context.services.sharedStorage || context.services.storage;
      this.store = contracts().createArchiveStore(this.sharedStorage);
      this.profileStore = global.MercuryGenerationProfileStore ? new global.MercuryGenerationProfileStore({ storage: this.sharedStorage }) : null;
      const ResourceIntake = global.MercuryResourceIntakeWorkflow;
      this.resourceIntake = ResourceIntake ? new ResourceIntake({ storage: this.sharedStorage, archiveStore: this.store, profileStore: this.profileStore }) : null;
      const ProfileFlow = global.MercuryGenerationProfileFlow?.MercuryGenerationProfileFlow;
      this.profileFlow = ProfileFlow && this.profileStore ? new ProfileFlow({ store: this.profileStore }) : null;
      if (this.route === "modules") this.syncGenerationProfileFlow(this.profileFlow?.openCabinet?.(), false);
      this.state = this.safeStore(() => this.store.load()) || contracts().createArchiveState();
      this.root.classList.add("mercury-archive-app");
      this.root.setAttribute("aria-label", "档案馆");
      this.paint();
    }

    onResume(_, launchPayload = null) {
      this.applyLaunchRoute(launchPayload);
      this.state = this.store.load();
      const snapshot = this.profileFlow?.reload?.();
      if (this.route === "modules") this.syncGenerationProfileFlow(this.profileFlow?.openCabinet?.(), false);
      else if (["profile-detail", "module-editor"].includes(this.route) && this.selectedModuleId) {
        try { this.syncGenerationProfileFlow(this.profileFlow?.openDetail?.(this.selectedModuleId), false); }
        catch (_) { this.syncGenerationProfileFlow(snapshot, true); }
      }
      this.paint();
    }

    applyLaunchRoute(launchPayload) {
      const route = launchPayload?.route;
      if (typeof route === "string" && route.startsWith("character:")) {
        this.route = "profile";
        this.section = "characters";
        this.selectedId = decodeURIComponent(route.slice("character:".length));
      }
      else if (route === "home" || route === "characters") { this.route = "home"; this.section = "characters"; }
      else if (route === "worlds") { this.route = "worlds"; this.section = "worlds"; }
      else if (route === "presets") {
        this.route = "modules";
        this.section = "presets";
        this.syncGenerationProfileFlow?.(this.profileFlow?.openCabinet?.(), false);
      }
    }

    onUnmount() {
      if (this.profileOpenTimer) global.clearTimeout?.(this.profileOpenTimer);
      this.root = null;
      this.context = null;
      this.store = null;
      this.profileStore = null;
      this.profileFlow = null;
      this.resourceIntake = null;
      this.importStage = null;
      this.sharedStorage = null;
    }

    syncGenerationProfileFlow(snapshot, syncRoute = true) {
      if (!snapshot) return null;
      this.selectedModuleId = snapshot.selectedProfileId;
      this.profileMenuId = snapshot.overlay === "actions" ? snapshot.overlayProfileId : null;
      this.coverDraft = snapshot.overlay === "cover-preview" ? snapshot.coverDraft : null;
      if (syncRoute) {
        this.route = snapshot.view === "detail" ? "profile-detail" : "modules";
        this.section = "presets";
      }
      return snapshot;
    }

    returnToGenerationProfileCabinet() {
      this.syncGenerationProfileFlow(this.profileFlow?.openCabinet?.());
      this.paint();
    }

    generationProfiles() { return this.profileStore?.list?.() || []; }

    generationProfileGroups() {
      const groups = { mercury: [], mine: [], imported: [] };
      this.generationProfiles().forEach((profile) => {
        if (profile.origin === "mercury") groups.mercury.push(profile);
        else if (profile.origin === "imported") groups.imported.push(profile);
        else groups.mine.push(profile);
      });
      return groups;
    }

    generationProfileCover(profile, index = 0) {
      if (profile?.cover?.kind === "data-url" && /^data:image\//i.test(profile.cover.value || "")) return profile.cover.value;
      const covers = {
        "archive:glass-water-v1": "archive-glass-water-v1.webp",
        "archive:mercury-orb-v1": "archive-mercury-orb-v1.png",
        "archive:water-starlight-v1": "archive-water-starlight-v1.png",
        "archive:wind-chimes-v1": "archive-wind-chimes-v1.webp",
      };
      const fallback = ["archive-glass-water-v1.webp", "archive-water-starlight-v1.png", "archive-wind-chimes-v1.webp", "archive-mercury-orb-v1.png"];
      return `${ARCHIVE_IMAGE_ROOT}${covers[profile?.cover?.value] || fallback[index % fallback.length]}`;
    }

    generationProfileUsage(profileId) {
      const experienceContracts = global.MercuryChatExperienceContracts;
      const storage = this.sharedStorage;
      if (!experienceContracts || typeof storage?.get !== "function") return 0;
      const experience = experienceContracts.normalize(storage.get(experienceContracts.STORAGE_KEY, null));
      return Object.values(experience.conversations || {}).filter((conversation) => {
        const selectedId = conversation?.resourceBindings?.presetId || conversation?.settings?.userPresetId;
        return selectedId === profileId;
      }).length;
    }

    generationProfileOrder(profile) {
      const index = this.generationProfiles().findIndex((item) => item.id === profile?.id);
      return String(Math.max(index, 0) + 1).padStart(2, "0");
    }

    generationProfileSourceMeta(profile) {
      if (profile?.origin === "mercury") return { english: "MERCURY ORIGINAL", chinese: "Mercury 内置原件" };
      if (profile?.origin === "imported") return { english: "IMPORTED", chinese: "外部导入" };
      return { english: "MY PRESSING", chinese: "我的创作" };
    }

    generationProfileCreationLabel(profile) {
      const labels = {
        builtin: "Mercury 内置",
        blank: "空白创建",
        remix: "Remix 副本",
        import: "外部导入",
        "legacy-user-preset": "旧预设迁移",
        "legacy-archive-module": "旧资源迁移",
      };
      return labels[profile?.creationMode] || "本地创建";
    }

    generationProfileUpdatedLabel(profile) {
      if (profile?.readOnly && !Number(profile?.updatedAt)) return "随 Mercury 发布";
      const value = Number(profile?.updatedAt || profile?.createdAt);
      const date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return "时间未知";
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return "今天更新";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}.${month}.${day}`;
    }

    generationProfileInspection(profile) {
      const inspect = global.MercuryPresetAssemble?.inspectPresetInstructions;
      if (typeof inspect === "function") return inspect(profile);
      const enabledModules = Object.values(profile?.modules?.enabled || {}).filter((value) => value === true).length;
      const blocks = Array.isArray(profile?.instructionBlocks) ? profile.instructionBlocks : [];
      const activeBlocks = blocks.filter((block) => block?.enabled === true && block.runtimeEligible !== false && typeof block.content === "string" && block.content.trim()).length;
      const preservedCount = blocks.filter((block) => block?.enabled === true && block.runtimeEligible === false).length;
      const runtimeActiveCount = enabledModules + activeBlocks;
      return {
        status: runtimeActiveCount ? (preservedCount ? "partial" : "ready") : (preservedCount ? "preserved" : "empty"),
        runtimeActiveCount,
        preservedCount,
        preservedSettingsCount: 0,
      };
    }

    generationProfileRuntimeMeta(inspection) {
      const meta = {
        ready: { label: "运行就绪", detail: "选择后可进入现有运行时" },
        partial: { label: "部分接入", detail: "可运行内容与兼容保留并存" },
        preserved: { label: "安全保留", detail: "当前没有可运行指令" },
        empty: { label: "待配置", detail: "暂无运行内容" },
      };
      return meta[inspection?.status] || meta.empty;
    }

    generationProfileTrackItems(profile) {
      const labels = {
        "skeleton.preserve-role": "角色连续性",
        "skeleton.mode": "玩法边界",
        "group.rel.respect-card": "尊重角色档案",
        "group.rel.stranger": "陌生人起点",
        "group.rel.familiar": "熟识关系起点",
        "group.rel.lovers": "亲密关系起点",
        "group.int.balanced": "平衡戏剧强度",
        "group.int.slow": "舒缓戏剧强度",
        "group.int.high": "高戏剧强度",
        "group.pro.standard": "常规主动性",
        "group.pro.initiative": "偏主动推进",
        "group.pro.reactive": "偏回应推进",
        "pref.focus": "初始话题焦点",
        "pref.address": "称呼偏好",
        "pref.hard-off": "回避内容",
      };
      const detailForModule = (id) => id.startsWith("skeleton.") ? "CORE" : id.startsWith("group.rel.") ? "RELATION" : id.startsWith("group.int.") ? "DRAMA" : id.startsWith("group.pro.") ? "INITIATIVE" : id.startsWith("pref.") ? "PREFERENCE" : "MODULE";
      const enabled = profile?.modules?.enabled || {};
      const modules = (Array.isArray(profile?.modules?.order) ? profile.modules.order : [])
        .filter((id) => enabled[id] === true)
        .map((id, index) => ({ title: labels[id] || `生成模块 ${index + 1}`, detail: detailForModule(String(id)) }));
      const blocks = (Array.isArray(profile?.instructionBlocks) ? profile.instructionBlocks : [])
        .filter((block) => block?.enabled === true && block.runtimeEligible !== false && typeof block.content === "string" && block.content.trim())
        .slice()
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
        .map((block, index) => ({ title: String(block.title || `指令区块 ${index + 1}`), detail: block.category === "compatibility" ? "COMPATIBILITY" : "INSTRUCTION" }));
      const hasCustomBlock = blocks.some((item) => item.title === "自定义指令");
      const legacyCustom = !hasCustomBlock && typeof profile?.custom?.instructions === "string" && profile.custom.instructions.trim()
        ? [{ title: "自定义指令", detail: "INSTRUCTION" }]
        : [];
      return [...modules, ...blocks, ...legacyCustom];
    }

    openGenerationProfileActions(profileId) {
      try {
        this.syncGenerationProfileFlow(this.profileFlow?.openActions?.(profileId), false);
      } catch (_) {
        this.errorText = "找不到这张生成档案，请刷新后重试。";
      }
      this.paint();
    }

    openGenerationProfile(profileId) {
      try {
        this.syncGenerationProfileFlow(this.profileFlow?.openDetail?.(profileId));
      } catch (_) {
        this.errorText = "找不到这张生成档案，请刷新后重试。";
      }
      this.paint();
    }

    openGenerationProfileWithMotion(profileId, record) {
      if (this.profileOpenTimer) return;
      const reduceMotion = Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      if (reduceMotion || !record?.classList?.add) {
        this.openGenerationProfile(profileId);
        return;
      }
      record.classList.add("is-opening");
      this.profileOpenTimer = global.setTimeout?.(() => {
        this.profileOpenTimer = null;
        this.openGenerationProfile(profileId);
      }, 280) || null;
    }

    bindGenerationRecordGestures(surface, record, profile) {
      let holdTimer = null;
      let didLongPress = false;
      const clearHold = () => {
        if (holdTimer) global.clearTimeout?.(holdTimer);
        holdTimer = null;
      };
      const openMenu = () => {
        clearHold();
        didLongPress = true;
        try { this.syncGenerationProfileFlow(this.profileFlow?.openActions?.(profile.id), false); }
        catch (_) { this.errorText = "找不到这张生成档案，请刷新后重试。"; }
        this.paint();
      };
      surface.addEventListener("pointerdown", () => {
        clearHold();
        didLongPress = false;
        holdTimer = global.setTimeout?.(openMenu, 520) || null;
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => surface.addEventListener(eventName, clearHold));
      surface.addEventListener("contextmenu", (event) => {
        event.preventDefault?.();
        openMenu();
      });
      surface.addEventListener("keydown", (event) => {
        if (event.key === "F10" && event.shiftKey) {
          event.preventDefault?.();
          openMenu();
        }
      });
      surface.addEventListener("click", (event) => {
        clearHold();
        if (didLongPress) {
          didLongPress = false;
          event.preventDefault?.();
          return;
        }
        this.openGenerationProfileWithMotion(profile.id, record);
      });
    }

    createBlankFromCabinet() {
      const profile = this.safeStore(() => this.createBlankGenerationProfile());
      if (!profile) return null;
      this.openGenerationProfile(profile.id);
      return profile;
    }

    updateGenerationProfileCover(profileId, cover) {
      const profile = this.profileStore?.get?.(profileId);
      if (!profile) {
        this.errorText = "找不到这张生成档案，请刷新后重试。";
        this.paint();
        return null;
      }
      if (profile.readOnly) {
        this.errorText = "Mercury 内置档案永久只读，请先创建 Remix。";
        this.paint();
        return null;
      }
      return this.safeStore(() => {
        const snapshot = this.profileFlow?.updateCover?.(profileId, cover);
        this.syncGenerationProfileFlow(snapshot, false);
        return this.profileStore.get(profileId);
      });
    }

    cancelGenerationProfileOverlay() {
      this.syncGenerationProfileFlow(this.profileFlow?.closeOverlay?.(), false);
      this.paint();
    }

    previewGenerationProfileCover(profileId, dataUrl) {
      try {
        this.syncGenerationProfileFlow(this.profileFlow?.previewCover?.(profileId, dataUrl), false);
      } catch (_) {
        this.errorText = "无法预览这张封面，请重新选择。";
      }
      this.paint();
    }

    cancelGenerationProfileCoverPreview() {
      this.syncGenerationProfileFlow(this.profileFlow?.cancelCover?.(), false);
      this.paint();
    }

    saveGenerationProfileCoverPreview() {
      const profileId = this.coverDraft?.profileId;
      return this.safeStore(() => {
        const snapshot = this.profileFlow?.saveCover?.();
        this.syncGenerationProfileFlow(snapshot, false);
        return this.profileStore?.get?.(profileId) || null;
      });
    }

    normalizeGenerationProfileCover(dataUrl) {
      return new Promise((resolve) => {
        const ImageCtor = global.Image;
        const canvas = global.document?.createElement?.("canvas");
        if (!ImageCtor || !canvas?.getContext) {
          resolve(dataUrl);
          return;
        }
        const image = new ImageCtor();
        image.addEventListener("load", () => {
          try {
            const maxEdge = 768;
            const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
            canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
            canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
            const context = canvas.getContext("2d");
            if (!context) {
              resolve(dataUrl);
              return;
            }
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const normalized = canvas.toDataURL("image/webp", 0.84);
            resolve(/^data:image\//i.test(normalized) && normalized.length < dataUrl.length ? normalized : dataUrl);
          } catch (_err) {
            resolve(dataUrl);
          }
        }, { once: true });
        image.addEventListener("error", () => resolve(dataUrl), { once: true });
        image.src = dataUrl;
      });
    }

    chooseGenerationProfileCover(profileId) {
      const profile = this.profileStore?.get?.(profileId);
      if (!profile || profile.readOnly) return;
      const input = this.element("input");
      input.type = "file";
      input.className = "generation-cover-input";
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
      input.accept = "image/png,image/jpeg,image/webp,image/gif";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          input.remove?.();
          return;
        }
        if (!/^image\/(?:png|jpeg|webp|gif)$/i.test(file.type || "") || file.size > 4 * 1024 * 1024) {
          this.errorText = file.size > 4 * 1024 * 1024 ? "封面图片不能超过 4 MB。" : "请选择 PNG、JPEG、WebP 或 GIF 图片。";
          input.remove?.();
          this.paint();
          return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", async () => {
          if (typeof reader.result !== "string" || !/^data:image\//i.test(reader.result)) return;
          const dataUrl = await this.normalizeGenerationProfileCover(reader.result);
          input.remove?.();
          this.previewGenerationProfileCover(profileId, dataUrl);
        });
        reader.addEventListener("error", () => { input.remove?.(); this.errorText = "无法读取这张封面图片。"; this.paint(); });
        reader.readAsDataURL(file);
      });
      this.root?.append?.(input);
      input.click();
    }

    createBlankGenerationProfile() {
      const base = this.profileStore?.get?.(profileContracts()?.DEFAULT_PROFILE_ID || "preset-default");
      if (!base || !this.profileStore) return null;
      const stamp = Date.now();
      return this.profileStore.add({
        ...base,
        id: `profile-blank-${stamp.toString(36)}`,
        name: "Untitled Profile",
        description: "",
        origin: "user",
        creationMode: "blank",
        remixOf: null,
        readOnly: false,
        cover: profileContracts()?.DEFAULT_COVER,
        instructionBlocks: [],
        custom: { instructions: null },
        createdAt: stamp,
        updatedAt: stamp,
      });
    }

    bridgeProfileToChat(profile) {
      const contracts = global.MercuryChatExperienceContracts;
      const storage = this.context?.services?.sharedStorage || this.context?.services?.storage;
      if (!contracts || !profile || typeof storage?.get !== "function" || typeof storage?.set !== "function") return false;
      const experience = contracts.normalize(storage.get(contracts.STORAGE_KEY, null));
      const contact = contracts.contactFromProfile(profile);
      const existingIds = Object.values(experience.contacts).filter((item) => item?.runtimeProfileId === profile.id).map((item) => item.id);
      if (!existingIds.length && experience.contacts[contact.id]) existingIds.push(contact.id);
      if (!existingIds.length) experience.contacts[contact.id] = contact;
      else existingIds.forEach((id) => {
        const current = experience.contacts[id] || {};
        experience.contacts[id] = { ...current, name: profile.displayName, identity: contact.identity, runtimeProfileId: profile.id, persona: { ...(current.persona || {}), ...contact.persona } };
      });
      const chatContactId = existingIds[0] || contact.id;
      const instance = this.store?.linkContactInstance?.(profile.id, chatContactId);
      if (!instance && this.store?.createContactInstance) this.store.createContactInstance(profile.id, { chatContactId });
      storage.set(contracts.STORAGE_KEY, experience);
      return true;
    }

    async analyzeProfile(profile) {
      const analysisContracts = global.MercuryRoleAnalysisContracts;
      const transport = this.context?.services?.aiTransport;
      if (!analysisContracts || !profile?.sourceAssetId || this.analysisPendingId) return;
      const localResponse = analysisContracts.extractLocalAnalysis?.(profile);
      if (localResponse?.filledFields?.length) {
        const merged = analysisContracts.mergeIntoProfile(profile, localResponse);
        const updated = this.storeWrite(() => this.store.updateRuntimeProfile(merged));
        if (updated) this.bridgeProfileToChat(updated);
        this.state = this.store.load();
        this.paint();
        return;
      }
      if (!transport?.analyzeRole) { this.errorText = "此角色卡没有可本地提取的结构化内容，且未配置 AI 分析服务。"; this.paint(); return; }
      const input = analysisContracts.createInput(profile);
      if (!input.sourceText) { this.errorText = "此角色没有可分析的文本内容。"; this.paint(); return; }
      this.analysisPendingId = profile.id;
      this.analysisProgress = { profileId: profile.id, message: "正在读取原始角色卡并提取可编辑字段。完成前不会覆盖已有内容。" };
      this.errorText = "";
      this.paint();
      try {
        const response = await transport.analyzeRole(input, { timeoutMs: 120000 });
        const merged = analysisContracts.mergeIntoProfile(profile, response);
        const updated = this.storeWrite(() => this.store.updateRuntimeProfile(merged));
        if (updated) this.bridgeProfileToChat(updated);
      } catch (error) {
        const messages = Object.freeze({
          UPSTREAM_TIMEOUT: "分析超时，未写入档案。请稍后重试。",
          UPSTREAM_AUTH: "分析服务的连接授权失败，未写入档案。",
          UPSTREAM_HTTP_ERROR: "分析服务未接受此请求，未写入档案。",
          UPSTREAM_INVALID_ANALYSIS: "分析结果格式无效，未写入档案。",
          UPSTREAM_INVALID_CONTENT: "分析服务未返回可用内容，未写入档案。",
          UPSTREAM_UNAVAILABLE: "分析服务暂时不可用，未写入档案。",
          INVALID_REQUEST: "分析请求未通过本地校验，未写入档案。",
          REQUEST_TOO_LARGE: "角色卡内容过长，未写入档案。",
          LOCAL_INVALID_JSON: "本地分析服务返回异常，未写入档案。",
          LOCAL_INVALID_RESPONSE: "本地分析服务返回异常，未写入档案。",
        });
        this.errorText = error?.name === "AbortError"
          ? messages.UPSTREAM_TIMEOUT
          : messages[error?.code] || (error?.retryable ? "分析暂时不可用，请稍后重试。" : "分析失败，未写入档案。");
      } finally {
        this.analysisPendingId = null;
        this.analysisProgress = null;
        this.state = this.store.load();
        this.paint();
      }
    }

    exportJSON() {
      const profile = this.state.runtimeProfiles.find((item) => item.id === this.selectedId) || this.state.runtimeProfiles[0];
      if (!profile) return null;
      const card = contracts().serializeForExport(profile);
      return this.downloadJSON(card, this.exportFilename(profile.displayName, "character"));
    }

    exportFilename(value, fallback) {
      const cleaned = String(value || "").trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-").replace(/[.\s-]+$/g, "");
      return `${cleaned || fallback}.json`;
    }

    downloadJSON(value, filename) {
      const json = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      if (typeof URL !== "undefined" && typeof Blob !== "undefined") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }
      return Object.freeze({ filename, json });
    }

    worldBookExportResource(world) {
      return {
        kind: global.MercuryResourceContracts.WORLD_KIND,
        schemaVersion: global.MercuryResourceContracts.SCHEMA_VERSION,
        data: {
          id: world.id,
          name: world.name,
          summary: world.summary,
          entries: (world.entries || []).map((entry) => ({
            id: entry.id,
            title: entry.title,
            summary: entry.summary,
            content: entry.content,
            enabled: entry.enabled !== false,
            alwaysActive: Boolean(entry.alwaysActive),
            priority: Number(entry.priority) || 0,
            keys: [...(entry.aliases || [])],
            tags: [...(entry.tags || [])],
            activationMode: entry.activationMode,
            visibility: entry.visibility,
            relatedEntryIds: [...(entry.relatedEntryIds || [])],
            worldVariantId: entry.worldVariantId,
            worldVariantIds: [...(entry.worldVariantIds || [])],
            timelineId: entry.timelineId,
            timelineIds: [...(entry.timelineIds || [])],
            runtimeProfileId: entry.runtimeProfileId,
            runtimeProfileIds: [...(entry.runtimeProfileIds || [])],
            relatedProfileIds: [...(entry.relatedProfileIds || [])],
            scope: entry.scope,
          })),
          tags: [...(world.tags || [])],
          relatedProfileIds: [...(world.relatedProfileIds || [])],
          worldVariantId: world.worldVariantId,
          worldVariantIds: [...(world.worldVariantIds || [])],
          timelineId: world.timelineId,
          timelineIds: [...(world.timelineIds || [])],
          scope: world.scope,
          createdAt: world.createdAt,
          updatedAt: world.updatedAt,
        },
      };
    }

    exportWorldBook(worldId = this.selectedWorldId) {
      const world = this.state.worlds.find((item) => item.id === worldId);
      if (!world || !global.MercuryResourceContracts) return null;
      const json = global.MercuryResourceContracts.exportMercuryResource(this.worldBookExportResource(world));
      return this.downloadJSON(json, this.exportFilename(world.name, "worldbook"));
    }

    generationProfileExportResource(profile) {
      const { kind, schemaVersion, readOnly, ...data } = profile;
      return {
        kind: profileContracts().RESOURCE_KIND,
        schemaVersion: profileContracts().SCHEMA_VERSION,
        data: { ...data, readOnly: undefined },
      };
    }

    exportGenerationProfile(profileId = this.selectedModuleId) {
      const profile = this.profileStore?.get?.(profileId);
      if (!profile || !global.MercuryResourceContracts || !profileContracts()) return null;
      const json = global.MercuryResourceContracts.exportMercuryResource(this.generationProfileExportResource(profile));
      return this.downloadJSON(json, this.exportFilename(profile.name, "generation-profile"));
    }

    element(tag, className = "", text = "") {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== "") node.textContent = String(text);
      return node;
    }

    icon(name) {
      const image = this.element("img", "archive-icon");
      image.src = `${ICON_ROOT}${name}.svg`;
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      return image;
    }

    button(label, className = "", iconName = "", onClick = null) {
      const button = this.element("button", className);
      button.type = "button";
      button.setAttribute("aria-label", label);
      if (iconName) button.append(this.icon(iconName));
      if (onClick) button.addEventListener("click", onClick);
      return button;
    }

    paint() {
      if (!this.root) return;
      const errorBanner = this.errorText ? this.errorBanner() : null;
      const view = this.route === "profile" ? this.renderProfileV2() : this.route === "profile-section" ? this.renderProfileSection() : this.route === "import-review" ? this.renderImportReview() : this.route === "imports" ? this.renderImports() : this.route === "modules" ? this.renderModules() : ["profile-detail", "module-editor"].includes(this.route) ? this.renderGenerationProfileDetail() : this.route === "worlds" ? this.renderWorldBookshelf() : this.route === "world-index" ? this.renderWorldBookIndex() : this.route === "world-settings" ? this.renderWorldBookSettings() : ["world-editor", "world-detail", "world-entry"].includes(this.route) ? this.renderWorldBookEditor() : this.renderArchiveHome();
      if (errorBanner && view.firstChild) {
        view.insertBefore(errorBanner, view.firstChild);
      }
      this.root.replaceChildren(...[
        view,
        this.menuOpen ? this.renderCreateMenu() : null,
        this.profileMenuId ? this.renderGenerationProfileMenu() : null,
        this.coverDraft ? this.renderGenerationCoverPreview() : null,
      ].filter(Boolean));
    }

    errorBanner() {
      const banner = document.createElement("div");
      banner.className = "archive-error-banner";
      banner.setAttribute("role", "alert");
      banner.textContent = this.errorText;
      const dismiss = this.button("关闭提示", "archive-inline-link", "", () => { this.errorText = ""; this.paint(); });
      dismiss.style.marginLeft = "auto";
      banner.append(dismiss);
      return banner;
    }

    scrollPage(className = "") {
      const page = this.element("div", `archive-scroll page ${className}`.trim());
      page.setAttribute("data-gesture-exclusion", "true");
      return page;
    }

    header(title, subtitle, back = null, action = null) {
      const header = this.element("header", `archive-header ${back ? "archive-header--detail detail-top" : "archive-header--home page-header"}`);
      const left = this.element("div", "archive-header__left");
      if (back) left.append(this.button("返回", "archive-icon-button", "nav-arrow-left", back));
      const heading = this.element("div", "archive-header__copy");
      heading.append(this.element("h1", "archive-header__title", title));
      if (subtitle) heading.append(this.element("p", "archive-header__subtitle", subtitle));
      left.append(heading);
      header.append(left);
      if (action) header.append(action);
      return header;
    }

    sectionHeading(title, detail = "", action = null) {
      const heading = this.element("div", "archive-section-heading section-head");
      heading.append(this.element("h2", "", title));
      if (detail) heading.append(this.element("small", "", detail));
      if (action) heading.append(action);
      return heading;
    }

    statusLabel(status) {
      const labels = { draft: "草稿", "needs-review": "待整理", ready: "可直接运行" };
      const node = this.element("span", `archive-status archive-status--${status}`, labels[status] || status);
      return node;
    }

    segment(active) {
      const nav = this.element("nav", "archive-segments segment");
      nav.setAttribute("aria-label", "档案馆分区");
      [["characters", "角色"], ["worlds", "世界书"], ["imports", "导入"]].forEach(([id, label]) => {
        const button = this.element("button", "archive-segment", label);
        button.type = "button";
        button.setAttribute("aria-selected", String(id === active));
        button.addEventListener("click", () => { this.section = id; this.route = id === "characters" ? "home" : id; this.paint(); });
        nav.append(button);
      });
      return nav;
    }

    assetImageFor(kind, index = 0) {
      const assets = {
        character: ["archive-wind-chimes-v1.webp", "archive-glass-water-v1.webp", "archive-water-starlight-v1.png"],
        world: ["worldbook-quill-v1.png", "worldbook-knowledge-v1.png", "worldbook-dialogue-v1.png", "archive-glass-water-v1.webp", "archive-wind-chimes-v1.webp", "archive-water-starlight-v1.png"],
        preset: ["archive-mercury-orb-v1.png", "archive-glass-water-v1.webp"],
      };
      const choices = assets[kind] || assets.character;
      return `${ARCHIVE_IMAGE_ROOT}${choices[index % choices.length]}`;
    }

    openArchiveSection(section) {
      this.section = section;
      this.route = section === "worlds" ? "worlds" : section === "presets" ? "modules" : "home";
      if (section === "presets") this.syncGenerationProfileFlow(this.profileFlow?.openCabinet?.(), false);
      this.paint();
    }

    archiveSegment(active = "characters") {
      const nav = this.element("nav", "archive-segments archive-home-segments");
      nav.setAttribute("aria-label", "档案馆分类");
      [["characters", "角色"], ["worlds", "世界书"], ["presets", "预设"]].forEach(([id, label]) => {
        const button = this.element("button", "archive-segment", label);
        button.type = "button";
        button.setAttribute("aria-selected", String(id === active));
        button.addEventListener("click", () => this.openArchiveSection(id));
        nav.append(button);
      });
      return nav;
    }

    archiveMetric(label, value, detail, iconName, onClick) {
      const button = this.element("button", "archive-metric-card");
      button.type = "button";
      button.setAttribute("aria-label", `查看${label}`);
      button.append(this.element("span", "archive-metric-card__label", label), this.element("strong", "archive-metric-card__value", String(value)), this.icon(iconName), this.element("small", "archive-metric-card__detail", detail));
      button.addEventListener("click", onClick);
      return button;
    }

    recentAssetCard(asset, index) {
      const card = this.element("button", `archive-recent-card archive-recent-card--${asset.kind}`);
      card.type = "button";
      card.style.backgroundImage = `linear-gradient(180deg, rgb(14 35 43 / 3%), rgb(13 39 48 / 67%)), url("${this.assetImageFor(asset.kind, index)}")`;
      const label = this.element("small", "archive-recent-card__type", asset.label);
      card.append(label, this.element("strong", "", asset.name), this.element("small", "archive-recent-card__meta", asset.detail));
      card.addEventListener("click", () => {
        if (asset.kind === "character") { this.selectedId = asset.id; this.route = "profile"; }
        if (asset.kind === "world") { this.openWorldBookEditor(asset.id); return; }
        if (asset.kind === "preset") { this.openGenerationProfile(asset.id); return; }
        this.paint();
      });
      return card;
    }

    profileStatus(profile, id) {
      const fields = this.profileFields(profile, id);
      const populated = fields.filter(([key]) => Array.isArray(profile[key]) ? profile[key].length : String(profile[key] || "").trim()).length;
      if (!fields.length || !populated) return { className: "empty", label: "待填写" };
      if (populated === fields.length) return { className: "complete", label: "已完成" };
      return { className: "editing", label: "待完善" };
    }

    renderArchiveHome() {
      const page = this.scrollPage("archive-home archive-home-v2");
      const generationProfiles = this.generationProfiles();
      const hero = this.element("section", "archive-home-hero");
      hero.style.backgroundImage = `linear-gradient(90deg, rgb(245 250 251 / 97%) 0%, rgb(245 250 251 / 80%) 54%, rgb(245 250 251 / 18%) 100%), url("${ARCHIVE_IMAGE_ROOT}archive-mercury-orb-v1.png")`;
      const copy = this.element("div", "archive-home-hero__copy");
      copy.append(this.element("p", "archive-home-hero__eyebrow", "MERCURY ARCHIVE"), this.element("h1", "", "档案馆"), this.element("p", "archive-home-hero__subtitle", "角色、世界书与可运行资源"));
      const menu = this.button("创建或导入资源", "archive-home-hero__add", "plus", () => { this.menuOpen = true; this.paint(); });
      hero.append(copy, menu);
      page.append(hero);

      const search = this.element("label", "archive-search archive-home-search");
      search.append(this.icon("search"));
      const input = this.element("input");
      input.type = "search";
      input.placeholder = "搜索档案馆";
      input.setAttribute("aria-label", "搜索档案馆");
      input.value = this.searchQuery;
      input.addEventListener("input", () => { this.searchQuery = input.value; this.paint(); });
      search.append(input);
      page.append(search, this.archiveSegment("characters"));

      const overview = this.element("section", "archive-overview");
      const metrics = this.element("div", "archive-metric-grid");
      metrics.append(
        this.archiveMetric("角色", this.state.runtimeProfiles.length, this.state.runtimeProfiles.length ? "已保存角色" : "从零开始创建", "spark", () => this.openArchiveSection("characters")),
        this.archiveMetric("世界书", this.state.worlds.length, this.state.worlds.length ? "已保存世界" : "新建世界书", "planet", () => this.openArchiveSection("worlds")),
        this.archiveMetric("预设", generationProfiles.length, "生成档案", "database", () => this.openArchiveSection("presets")),
      );
      overview.append(metrics);
      page.append(overview);

      const recentAssets = [
        ...this.state.runtimeProfiles.slice(-2).map((profile) => ({ kind: "character", label: "角色卡", id: profile.id, name: profile.displayName, detail: profile.status === "ready" ? "可运行" : "最近编辑" })),
        ...this.state.worlds.slice(-1).map((world) => ({ kind: "world", label: "世界书", id: world.id, name: world.name, detail: `${world.entries.length} 个条目` })),
        ...generationProfiles.filter((profile) => profile.origin !== "mercury").slice(-1).map((profile) => ({ kind: "preset", label: "生成档案", id: profile.id, name: profile.name, detail: profile.origin === "imported" ? "外部导入" : "我的创作" })),
      ].reverse().slice(0, 4);
      const recentSection = this.element("section", "archive-home-section");
      recentSection.append(this.sectionHeading("最近使用"));
      const recent = this.element("div", "archive-recent-row archive-recent-row-v2");
      if (recentAssets.length) recentAssets.forEach((asset, index) => recent.append(this.recentAssetCard(asset, index)));
      else {
        const starter = this.element("button", "archive-recent-create");
        starter.type = "button";
        starter.append(this.icon("plus"), this.element("span", "", "新建资源"));
        starter.addEventListener("click", () => { this.menuOpen = true; this.paint(); });
        recent.append(starter);
      }
      recentSection.append(recent);
      page.append(recentSection);

      const all = this.state.runtimeProfiles.filter((profile) => profile.displayName.toLowerCase().includes(this.searchQuery.trim().toLowerCase()));
      const library = this.element("section", "archive-home-library");
      library.append(this.sectionHeading("我的角色", `${all.length} 个已保存`));
      if (!all.length) {
        const empty = this.element("div", "archive-library-empty");
        empty.append(this.icon("spark"), this.element("p", "", this.searchQuery ? "没有匹配的角色" : "用右上角的加号创建或导入第一张角色卡"));
        library.append(empty);
      } else {
        const grid = this.element("div", "archive-card-grid archive-card-grid-v2");
        all.forEach((profile) => grid.append(this.characterCard(profile)));
        library.append(grid);
      }
      page.append(library);
      return page;
    }

    createMenuAction(title, detail, iconName, onClick) {
      const action = this.element("button", "archive-create-menu__action");
      action.type = "button";
      action.setAttribute("aria-label", title);
      const copy = this.element("span", "archive-create-menu__copy");
      copy.append(this.element("strong", "", title), this.element("small", "", detail));
      action.append(this.icon(iconName), copy);
      action.addEventListener("click", onClick);
      return action;
    }

    renderCreateMenu() {
      const overlay = this.element("section", "archive-create-menu");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "创建或导入资源");
      const backdrop = this.element("button", "archive-create-menu__backdrop");
      backdrop.type = "button";
      backdrop.setAttribute("aria-label", "关闭创建菜单");
      backdrop.addEventListener("click", () => { this.menuOpen = false; this.paint(); });
      const sheet = this.element("div", "archive-create-menu__sheet");
      sheet.setAttribute("data-gesture-exclusion", "true");
      const heading = this.element("div", "archive-create-menu__heading");
      const close = this.button("关闭创建菜单", "archive-icon-button", "cancel", () => { this.menuOpen = false; this.paint(); });
      heading.append(this.element("h2", "", "创建 / 导入"), close);
      const characterGroup = this.element("section", "archive-create-menu__group");
      characterGroup.append(this.element("h3", "", "角色卡"), this.createMenuAction("从零创建", "创建一份新的角色资源", "spark", () => { const profile = this.storeWrite(() => this.store.createManualCharacter()); if (!profile) return; this.menuOpen = false; this.selectedId = profile.id; this.route = "profile"; this.paint(); }), this.createMenuAction("导入角色卡", "支持 JSON 资源卡", "database", () => { this.menuOpen = false; this.openFilePicker(); }));
      const worldGroup = this.element("section", "archive-create-menu__group");
      worldGroup.append(this.element("h3", "", "世界书"), this.createMenuAction("新建世界书", "创建可检索的知识与补充条目", "planet", () => { this.menuOpen = false; this.startWorldBookCreate(); }), this.createMenuAction("导入世界书", "先审阅，再进入统一编辑器", "database", () => { this.menuOpen = false; this.openFilePicker(); }));
      const presetGroup = this.element("section", "archive-create-menu__group");
      presetGroup.append(this.element("h3", "", "生成档案"), this.createMenuAction("新建生成档案", "创建共享的生成体验档案", "spark", () => { const profile = this.safeStore(() => this.createBlankGenerationProfile()); if (!profile) return; this.menuOpen = false; this.openGenerationProfile(profile.id); }), this.createMenuAction("导入生成档案", "支持 JSON 规则资源", "database", () => { this.menuOpen = false; this.openFilePicker(); }));
      sheet.append(heading, characterGroup, worldGroup, presetGroup);
      overlay.append(backdrop, sheet);
      return overlay;
    }

    renderHome() {
      const page = this.scrollPage("archive-home");
      const newButton = this.button("新建角色", "archive-icon-button", "plus", () => { const p = this.storeWrite(() => this.store.createManualCharacter()); if (!p) return; this.selectedId = p.id; this.route = "profile"; this.paint(); });
      page.append(this.header("档案馆", "角色、世界与可运行档案", null, newButton));
      const search = this.element("label", "archive-search search");
      search.append(this.icon("eye"));
      const input = this.element("input");
      input.type = "search";
      input.placeholder = "搜索档案馆";
      input.setAttribute("aria-label", "搜索档案馆");
      input.value = this.searchQuery;
      input.addEventListener("input", () => { this.searchQuery = input.value; this.paint(); });
      search.append(input);
      page.append(search);
      const actions = this.element("div", "archive-action-row quick-actions");
      const create = this.element("button", "archive-primary quick-action");
      create.append(this.icon("plus"), this.element("span", "", "新建角色"));
      create.addEventListener("click", () => { const p = this.storeWrite(() => this.store.createManualCharacter()); if (!p) return; this.selectedId = p.id; this.route = "profile"; this.paint(); });
      const importButton = this.element("button", "archive-secondary quick-action secondary");
      importButton.append(this.icon("database"), this.element("span", "", "导入 JSON"));
      importButton.addEventListener("click", () => this.openFilePicker());
      actions.append(create, importButton);
      page.append(actions);
      page.append(this.sectionHeading("最近使用", ""));
      const recent = this.element("div", "archive-recent-row recent-row");
      const recentProfiles = this.state.runtimeProfiles.slice(-3).reverse();
      recentProfiles.forEach((profile) => {
        const card = this.element("button", "archive-recent-card recent-card");
        card.type = "button";
        card.append(this.element("strong", "", profile.displayName), this.element("small", "", profile.status === "ready" ? "可直接运行" : "待整理"));
        card.addEventListener("click", () => { this.selectedId = profile.id; this.route = "profile"; this.paint(); });
        recent.append(card);
      });
      if (!recentProfiles.length) recent.append(this.element("p", "archive-muted archive-recent-empty", "你的最近角色会显示在这里。"));
      page.append(recent, this.segment(this.section));
      const all = this.state.runtimeProfiles.filter((profile) => profile.displayName.toLowerCase().includes(this.searchQuery.trim().toLowerCase()));
      const listHeading = this.sectionHeading("全部角色", `${all.length} 个档案`);
      page.append(listHeading);
      if (!all.length) {
        const empty = this.element("section", "archive-empty");
        empty.append(this.icon("database"), this.element("h2", "", this.searchQuery ? "没有匹配的角色" : "档案馆暂时空着"), this.element("p", "", this.searchQuery ? "换个关键词试试。" : "新建一个角色，或导入一张源卡片开始。"));
        page.append(empty);
      } else {
        const grid = this.element("div", "archive-card-grid character-grid");
        all.forEach((profile) => grid.append(this.characterCard(profile)));
        page.append(grid);
      }
      return page;
    }

    characterCard(profile) {
      const card = this.element("button", "archive-character-card character-card");
      card.type = "button";
      card.setAttribute("aria-label", `打开 ${profile.displayName}`);
      const image = this.element("div", "archive-character-card__image portrait");
      const imageIndex = this.state.runtimeProfiles.findIndex((item) => item.id === profile.id);
      image.style.backgroundImage = `linear-gradient(180deg, rgb(12 38 47 / 4%), rgb(12 39 47 / 53%)), url("${this.assetImageFor("character", Math.max(imageIndex, 0))}")`;
      const copy = this.element("div", "archive-character-card__copy card-copy");
      copy.append(this.element("small", "archive-character-card__type", "角色卡"), this.element("strong", "", profile.displayName), this.element("small", "", profile.summary || profile.identity || "尚未填写简介"), this.statusLabel(profile.status));
      card.append(image, copy);
      card.addEventListener("click", () => { this.selectedId = profile.id; this.route = "profile"; this.paint(); });
      return card;
    }

    openFilePicker() {
      const input = this.element("input");
      input.type = "file";
      input.accept = ".json,.png,application/json,image/png,text/plain";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const isPng = file.type === "image/png" || /\.png$/i.test(file.name || "");
          if (isPng) {
            const bytes = typeof file.arrayBuffer === "function" ? new Uint8Array(await file.arrayBuffer()) : null;
            this.prepareImport({ filename: file.name, mimeType: file.type || "image/png", fileSize: file.size, bytes });
            return;
          }
          const rawText = await file.text();
          this.prepareImport({ filename: file.name, mimeType: file.type || "application/json", fileSize: file.size, rawText });
        } catch (_) {
          this.errorText = "无法读取所选文件。";
          this.paint();
        }
      });
      input.click();
    }

    prepareImport(input) {
      this.importStage = this.resourceIntake?.inspect?.(input) || {
        sourceAsset: contracts().createSourceAsset(input),
        report: global.MercuryResourceContracts?.preflightMercuryResourceImport?.(input.rawText, { filename: input.filename }),
      };
      this.candidate = this.importStage.sourceAsset;
      this.route = "import-review";
      this.section = "imports";
      this.paint();
    }

    cancelImport() {
      this.candidate = null;
      this.importStage = null;
      this.route = "home";
      this.section = "characters";
      this.paint();
    }

    confirmImport() {
      if (!this.candidate) return false;
      const stage = this.importStage || this.resourceIntake?.inspect?.({
        filename: this.candidate.filename,
        mimeType: this.candidate.mimeType,
        fileSize: this.candidate.fileSize,
        rawText: this.candidate.rawText,
      });
      if (stage) stage.sourceAsset = this.candidate;
      if (!stage?.report?.ok) {
        this.errorText = "此文件未通过导入检查，未保存任何内容。";
        this.paint();
        return false;
      }
      const result = this.safeStore(() => this.resourceIntake?.commit?.(stage, { destination: "library" }));
      if (!result) return false;
      if (result.resourceKind === "preset") {
        const importedProfile = result.profile;
        this.candidate = null;
        this.importStage = null;
        this.section = "presets";
        this.openGenerationProfile(importedProfile.id);
        return true;
      }
      this.state = this.store.load();
      this.candidate = null;
      this.importStage = null;
      if (result.worlds.length === 1 && result.runtimeProfiles.length === 0 && !(result.profiles || []).length) {
        this.selectedWorldId = result.worlds[0].id;
        this.worldDraft = null;
        this.worldEditorDraft = null;
        this.worldEntryDraft = null;
        this.route = "world-editor";
        this.section = "worlds";
      } else {
        this.route = "imports";
        this.section = "imports";
      }
      this.paint();
      return true;
    }

    renderImportReview() {
      const page = this.scrollPage("archive-detail-page detail-page archive-import-review");
      const candidate = this.candidate;
      page.append(this.header("审核导入", candidate?.filename || "本地资源", () => this.cancelImport()));
      if (!candidate) return page;
      const safety = this.element("section", "archive-safety-note");
      safety.append(this.icon("shield-check"), this.element("span", "", "原始内容以纯文本保存，不会自动执行，也不会自动进入聊天。"));
      page.append(safety);
      const report = this.importStage?.report || null;
      const fileMeta = this.element("div", "archive-file-meta");
      const parseLabel = report?.ok ? "检查通过" : "检查未通过";
      fileMeta.append(this.element("strong", "", candidate.filename), this.element("small", "", `${candidate.mimeType} · ${candidate.fileSize ?? "大小未知"}${candidate.fileSize !== null ? " 字节" : ""} · ${parseLabel}`));
      page.append(fileMeta, this.renderImportDiagnostics(report), this.sectionHeading("检测到的内容", `${candidate.detectedBlocks.length} 个区块`));
      const blocks = this.element("div", "archive-block-list");
      candidate.detectedBlocks.forEach((block) => {
        const item = this.element("section", "archive-block-card");
        const top = this.element("div", "archive-block-card__top");
        top.append(this.element("strong", "", block.label));
        const select = this.element("select");
        select.setAttribute("aria-label", `归类 ${block.label}`);
        contracts().BLOCK_TYPES.forEach((type) => { const option = this.element("option"); option.value = type; option.textContent = type; option.selected = type === block.blockType; select.append(option); });
        select.addEventListener("change", () => { block.blockType = select.value; candidate.assetType = this.inferAssetType(candidate.detectedBlocks); });
        top.append(select);
        item.append(top, this.element("small", "archive-block-card__meta", `${block.sourcePath} · 可信度 ${block.confidence}`));
        const preview = this.element("p", "archive-block-card__preview", block.preview || "暂无预览。");
        item.append(preview);
        blocks.append(item);
      });
      page.append(blocks);
      const raw = this.element("details", "archive-raw-details");
      raw.append(this.element("summary", "", "查看保留的源文本"));
      const rawText = this.element("textarea");
      rawText.readOnly = true;
      rawText.value = candidate.rawText;
      rawText.setAttribute("aria-label", "保留的源文本");
      raw.append(rawText);
      page.append(raw);
      const actions = this.element("div", "archive-form-actions");
      const cancel = this.element("button", "archive-button archive-button--secondary", "取消");
      cancel.addEventListener("click", () => this.cancelImport());
      const confirm = this.element("button", "archive-button archive-button--primary", "确认导入");
      confirm.disabled = !report?.ok;
      confirm.setAttribute("aria-disabled", String(confirm.disabled));
      if (confirm.disabled) confirm.textContent = "无法导入";
      confirm.addEventListener("click", () => this.confirmImport());
      actions.append(cancel, confirm);
      page.append(actions);
      return page;
    }

    importDiagnosticText(item, type) {
      return IMPORT_DIAGNOSTIC_COPY[item?.code] || (type === "error" ? "此文件未通过导入检查。" : type === "warning" ? "导入后建议检查这项内容。" : "导入时会进行兼容整理。");
    }

    renderImportDiagnostics(report) {
      const valid = Boolean(report?.ok);
      const diagnostics = this.element("section", `archive-import-diagnostics archive-import-diagnostics--${valid ? "ready" : "invalid"}`);
      const heading = this.element("header", "archive-import-diagnostics__heading");
      heading.append(this.icon(valid ? "shield-check" : "cancel"), this.element("strong", "", valid ? "可以导入" : "无法导入"), this.element("small", "", valid ? "已完成格式与内容检查" : "请修正文件后重新选择"));
      diagnostics.append(heading);
      const groups = [
        ["error", "需要修正", report?.errors || []],
        ["warning", "导入提醒", report?.warnings || []],
        ["migration", "兼容整理", report?.migrations || []],
      ];
      groups.forEach(([type, label, items]) => {
        if (!items.length) return;
        const group = this.element("div", `archive-import-diagnostics__group archive-import-diagnostics__group--${type}`);
        group.append(this.element("h3", "", label));
        const list = this.element("ul");
        items.forEach((item) => list.append(this.element("li", "", this.importDiagnosticText(item, type))));
        group.append(list);
        diagnostics.append(group);
      });
      return diagnostics;
    }

    inferAssetType(blocks) {
      const types = new Set(blocks.map((block) => block.blockType));
      return types.has("character") && types.size === 1 ? "character-source" : types.has("world") && types.size === 1 ? "world-source" : types.has("prompt-module") && types.size === 1 ? "prompt-source" : types.size > 1 ? "mixed-source" : "unknown-source";
    }

    renderProfile() {
      const profile = this.state.runtimeProfiles.find((item) => item.id === this.selectedId) || this.state.runtimeProfiles[0];
      const page = this.scrollPage("archive-detail-page detail-page archive-profile-page");
      if (!profile) { this.route = "home"; return this.renderHome(); }
      const more = this.element("button", "archive-icon-button round-button", "•••");
      more.type = "button";
      more.setAttribute("aria-label", "更多选项");
      const exportButton = this.element("button", "archive-icon-button round-button", "↓");
      exportButton.type = "button";
      exportButton.setAttribute("aria-label", "导出 JSON");
      exportButton.addEventListener("click", () => this.exportJSON());
      const actions = this.element("div", "archive-profile-actions");
      actions.append(exportButton, more);
      page.append(this.header("角色档案", "", () => { this.route = "home"; this.section = "characters"; this.paint(); }, actions));
      const hero = this.element("section", "archive-profile-hero hero-card");
      hero.style.backgroundImage = `linear-gradient(180deg, rgb(239 249 250 / 9%), rgb(31 67 76 / 62%)), url("${ARCHIVE_IMAGE_ROOT}archive-glass-water-v1.webp")`;
      const avatar = this.element("div", "archive-profile-hero__avatar avatar");
      avatar.style.backgroundImage = `url("${ARCHIVE_IMAGE_ROOT}archive-wind-chimes-v1.webp")`;
      hero.append(avatar, this.element("h2", "", profile.displayName), this.element("p", "", profile.identity || "源卡片已保留"));
      const meta = this.element("div", "archive-profile-hero__meta hero-meta");
      meta.append(this.statusLabel(profile.status), this.element("span", "", profile.sourceAssetId ? "已关联源" : "手动创建"));
      hero.append(meta);
      page.append(hero);
      const running = this.element("section", "archive-detail-section detail-section archive-profile-check");
      running.append(this.sectionHeading("运行档案", "运行时状态"));
      const checkCard = this.element("div", "archive-profile-check-card check-card");
      [["源卡片", profile.sourceAssetId ? "已保留" : "未关联"], ["运行档案", profile.status === "ready" ? "就绪" : "待整理"], ["联系人实例", this.state.contactInstances.some((item) => item.runtimeProfileId === profile.id) ? "已创建" : "未创建"]].forEach(([label, value]) => { const row = this.element("div", "archive-check-row check-line"); row.append(this.element("span", "", label), this.element("strong", "", value)); checkCard.append(row); });
      running.append(checkCard);
      page.append(running);
      const sectionList = this.element("section", "archive-detail-section detail-section archive-profile-sections");
      sectionList.append(this.sectionHeading("档案分区", "点击打开"));
      const definitions = [["overview", "概览", "身份、来源与版本", "eye"], ["personality", "性格与行为", "气质、底线与反应", "spark"], ["background", "背景与认知", "经历、信念与内在逻辑", "database"], ["voice", "声音与表达", "节奏、词汇与行动风格", "sound-high"], ["world", "世界与关系", "地点、群体与联结", "planet"], ["runtime", "运行检查", "创建联系人前先审一遍", "check-circle"]];
      const list = this.element("div", "archive-profile-list detail-list");
      definitions.forEach(([id, title, detail, iconName]) => {
        const row = this.button(title, "archive-profile-row detail-entry", iconName, () => { this.selectedSection = id; this.editing = false; this.route = "profile-section"; this.paint(); });
        const copy = this.element("span", "archive-profile-row__copy");
        copy.append(this.element("strong", "", title), this.element("small", "", detail));
        row.append(copy, this.icon("nav-arrow-right"));
        list.append(row);
      });
      sectionList.append(list);
      page.append(sectionList);
      return page;
    }

    renderProfileV2() {
      const profile = this.state.runtimeProfiles.find((item) => item.id === this.selectedId) || this.state.runtimeProfiles[0];
      if (!profile) { this.route = "home"; return this.renderArchiveHome(); }
      const page = this.scrollPage("archive-detail-page detail-page archive-profile-page archive-profile-page-v2");
      const profileIndex = Math.max(this.state.runtimeProfiles.findIndex((item) => item.id === profile.id), 0);
      const bar = this.element("header", "archive-editor-topbar");
      const back = this.button("返回档案馆", "archive-icon-button", "nav-arrow-left", () => { this.route = "home"; this.section = "characters"; this.paint(); });
      const title = this.element("div", "archive-editor-topbar__title");
      title.append(this.element("h1", "", "编辑角色卡"), this.element("small", "", "更改会自动保存在本地档案"));
      const actions = this.element("div", "archive-editor-topbar__actions");
      const canAnalyze = Boolean(profile.sourceAssetId && this.context?.services?.aiTransport?.analyzeRole);
      const analyzeButton = this.button(this.analysisPendingId === profile.id ? "正在分析角色档案" : "分析并填充档案", "archive-editor-topbar__analyze", "spark", () => this.analyzeProfile(profile));
      analyzeButton.append(this.element("span", "", this.analysisPendingId === profile.id ? "正在分析" : "分析档案"));
      analyzeButton.disabled = !canAnalyze || this.analysisPendingId === profile.id;
      const exportButton = this.button("导出角色卡 JSON", "archive-editor-topbar__export", "database", () => this.exportJSON());
      actions.append(analyzeButton, exportButton);
      bar.append(back, title, actions);
      page.append(bar);

      const identity = this.element("section", "archive-profile-identity");
      const portrait = this.element("div", "archive-profile-identity__portrait");
      portrait.style.backgroundImage = `url("${this.assetImageFor("character", profileIndex)}")`;
      const identityCopy = this.element("div", "archive-profile-identity__copy");
      const nameButton = this.element("button", "archive-profile-identity__name", profile.displayName);
      nameButton.type = "button";
      nameButton.addEventListener("click", () => { this.selectedSection = "identity"; this.editing = true; this.route = "profile-section"; this.paint(); });
      identityCopy.append(nameButton, this.element("p", "", profile.identity || "请从人物设定开始补全角色身份。"));
      const tags = this.element("div", "archive-profile-tags");
      const tagValues = profile.tags?.length ? profile.tags.slice(0, 4) : ["待补充"];
      tagValues.forEach((tag) => tags.append(this.element("span", "", tag)));
      identityCopy.append(tags);
      identity.append(portrait, identityCopy);
      page.append(identity);

      if (profile.analysis?.reviewRequired) {
        const review = this.element("section", "archive-analysis-review");
        review.append(this.icon("shield-check"), this.element("span", "", `已填充 ${profile.analysis.filledFields?.length || 0} 个字段，仍需逐项复核。`));
        page.append(review);
      }

      const facts = this.element("section", "archive-profile-facts");
      facts.append(
        this.element("span", "", profile.sourceAssetId ? "本地角色资源" : "未关联来源"),
        this.element("span", "", profile.worldBindings?.length ? `关联 ${profile.worldBindings.length} 个世界` : "尚未关联世界"),
        this.element("span", "", profile.status === "ready" ? "可运行" : "待完善"),
      );
      page.append(facts);

      const analysisGuide = this.element("section", "archive-analysis-guide");
      const guideCopy = this.element("div", "archive-analysis-guide__copy");
      guideCopy.append(
        this.icon("spark"),
        this.element("strong", "", this.analysisPendingId === profile.id ? "正在分析角色卡" : "从原卡补全档案"),
        this.element("p", "", this.analysisPendingId === profile.id
          ? this.analysisProgress?.message || "正在准备分析。"
          : profile.analysis?.reviewRequired
            ? `已填充 ${profile.analysis.filledFields?.length || 0} 个空白字段，请逐项复核。`
            : "提取身份、背景、特质、关系与表达方式；只补空白字段，原卡会保留。"),
      );
      const guideAction = this.button(this.analysisPendingId === profile.id ? "正在分析角色档案" : "分析并填充档案", "archive-analysis-guide__action", "spark", () => this.analyzeProfile(profile));
      guideAction.append(this.element("span", "", this.analysisPendingId === profile.id ? "正在分析" : "开始分析"));
      guideAction.disabled = !canAnalyze || this.analysisPendingId === profile.id;
      if (!canAnalyze) guideCopy.append(this.element("small", "", "需要先在设置中配置可用的 AI 连接。"));
      analysisGuide.append(guideCopy, guideAction);
      page.append(analysisGuide);

      const definitions = [
        ["identity", "人物设定", "身份、外貌、基础信息", "spark"],
        ["personality", "性格与行为", "特质、价值观、习惯与边界", "flash"],
        ["background", "背景与经历", "成长经历、重要事件与人生阶段", "database"],
        ["voice", "表达方式", "说话风格、语言习惯与互动方式", "sound-high"],
        ["relationship", "关系设定", "与玩家的关系、亲密度与倾向", "chat-bubble"],
        ["world", "世界与认知", "所属世界、角色认知与身份边界", "planet"],
        ["opening", "开场与示例", "初次见面、开场消息与示例对话", "spark"],
        ["presentation", "场景呈现", "状态、信息与时间线等视觉组件", "view-grid"],
        ["advanced", "高级与兼容字段", "创作者备注、标签与扩展字段", "settings"],
      ];
      const filled = definitions.filter(([id]) => this.profileStatus(profile, id).className === "complete").length;
      const overview = this.element("section", "archive-profile-overview");
      const heading = this.sectionHeading("章节总览", `${filled}/${definitions.length}`);
      overview.append(heading);
      const list = this.element("div", "archive-profile-list archive-profile-list-v2");
      definitions.forEach(([id, name, detail, iconName]) => {
        const state = this.profileStatus(profile, id);
        const row = this.button(name, "archive-profile-row archive-profile-row-v2", iconName, () => { this.selectedSection = id; this.editing = false; this.route = "profile-section"; this.paint(); });
        const copy = this.element("span", "archive-profile-row__copy");
        const status = this.element("span", `archive-profile-row__status archive-profile-row__status--${state.className}`, state.label);
        copy.append(this.element("strong", "", name), this.element("small", "", detail));
        row.append(copy, status, this.icon("nav-arrow-right"));
        list.append(row);
      });
      overview.append(list);
      page.append(overview);

      const linked = this.state.contactInstances.some((item) => item.runtimeProfileId === profile.id && item.active !== false);
      const runtime = this.element("section", "archive-profile-runtime");
      runtime.append(this.element("p", "", linked ? "此角色已添加到聊天联系人。角色字段会作为后续运行时接入的资源来源。" : "角色卡完成后，可将它加入聊天联系人。"));
      const runtimeAction = this.element("button", "archive-profile-runtime__action", linked ? "已加入聊天" : "加入聊天");
      runtimeAction.type = "button";
      runtimeAction.disabled = linked;
      runtimeAction.addEventListener("click", () => {
        if (this.storeWrite(() => this.store.createContactInstance(profile.id)) === null) return;
        this.bridgeProfileToChat(profile);
        this.paint();
      });
      runtime.append(runtimeAction);
      page.append(runtime);
      return page;
    }

    profileFields(profile, section) {
      const common = {
        overview: [["identity", "身份"], ["summary", "简介"]],
        identity: [["displayName", "角色名称"], ["identity", "身份设定"], ["summary", "角色简介"]],
        personality: [["stableTraits", "稳定特质"], ["motivations", "动机"], ["fears", "恐惧"], ["values", "价值观"], ["boundaries", "底线"]],
        background: [["background", "背景与经历"], ["cognitionLimits", "认知限制"], ["changeThresholds", "变化阈值"]],
        voice: [["careStyle", "关怀方式"], ["conflictStyle", "冲突应对"], ["defenseStyle", "防御习惯"], ["voiceStyle", "说话风格"]],
        relationship: [["relationshipSummary", "关系设定"], ["boundaries", "关系边界"]],
        world: [["worldBindings", "世界绑定"]],
        opening: [["openingMessage", "开场消息"], ["alternateGreetings", "替换开场白"], ["exampleDialogues", "示例对话"]],
        presentation: [["scenePresentation", "场景呈现说明"]],
        advanced: [["tags", "标签"], ["creatorNotes", "创作者备注"]],
      };
      return common[section] || [];
    }

    renderProfileSection() {
      const profile = this.state.runtimeProfiles.find((item) => item.id === this.selectedId);
      const page = this.scrollPage("archive-detail-page detail-page archive-profile-section-page");
      if (!profile) { this.route = "home"; return this.renderHome(); }
      const titles = { overview: "概览", identity: "人物设定", personality: "性格与行为", background: "背景与经历", voice: "表达方式", relationship: "关系设定", world: "世界与认知", opening: "开场与示例", presentation: "场景呈现", advanced: "高级与兼容字段", runtime: "运行检查" };
      page.append(this.header(titles[this.selectedSection] || "档案分区", profile.displayName, () => { this.route = "profile"; this.paint(); }));
      if (this.selectedSection === "runtime") return this.renderRuntimeCheck(page, profile);
      const fields = this.profileFields(profile, this.selectedSection);
      const form = this.element("div", "archive-field-list archive-editor-card");
      fields.forEach(([key, label]) => {
        const field = this.element("label", "archive-field");
        field.append(this.element("span", "", label));
        const input = this.element("textarea");
        input.value = Array.isArray(profile[key]) ? profile[key].join("\n") : profile[key] || "";
        input.readOnly = !this.editing;
        input.dataset.fieldKey = key;
        field.append(input);
        form.append(field);
      });
      page.append(form);
      const actions = this.element("div", "archive-form-actions");
      if (!this.editing) {
        const edit = this.element("button", "archive-button archive-button--primary", "编辑");
        edit.addEventListener("click", () => { this.editing = true; this.paint(); });
        actions.append(edit);
      } else {
        const cancel = this.element("button", "archive-button archive-button--secondary", "取消");
        cancel.addEventListener("click", () => { this.editing = false; this.paint(); });
        const save = this.element("button", "archive-button archive-button--primary", "保存");
        save.addEventListener("click", () => { const updated = { ...profile }; form.querySelectorAll("[data-field-key]").forEach((input) => { updated[input.dataset.fieldKey] = ["stableTraits", "motivations", "fears", "values", "boundaries", "cognitionLimits", "changeThresholds", "worldBindings", "alternateGreetings", "exampleDialogues", "tags"].includes(input.dataset.fieldKey) ? input.value.split(/\n+/).map((value) => value.trim()).filter(Boolean) : input.value.trim(); }); updated.status = "needs-review"; if (this.storeWrite(() => this.store.updateRuntimeProfile(updated)) === null) return; this.editing = false; this.paint(); });
        actions.append(cancel, save);
      }
      page.append(actions);
      return page;
    }

    renderRuntimeCheck(page, profile) {
      const source = this.state.sourceAssets.find((asset) => asset.id === profile.sourceAssetId);
      const linked = this.state.contactInstances.some((item) => item.runtimeProfileId === profile.id && item.active !== false);
      const card = this.element("section", "archive-runtime-card");
      card.append(this.element("p", "", linked ? "此档案已接入聊天运行上下文，编辑后的内容会在下一次生成时使用。" : "此档案已准备就绪，添加到聊天后会接入运行上下文。"));
      [["来源", source?.filename || "手动"], ["状态", profile.status], ["联系人", this.state.contactInstances.some((item) => item.runtimeProfileId === profile.id) ? "占位已创建" : "未创建"]].forEach(([label, value]) => { const row = this.element("div", "archive-check-row"); row.append(this.element("span", "", label), this.element("strong", "", value)); card.append(row); });
      page.append(card);
      if (!this.state.contactInstances.some((item) => item.runtimeProfileId === profile.id)) {
        const create = this.element("button", "archive-button archive-button--primary", "添加到聊天");
        create.addEventListener("click", () => {
          if (this.storeWrite(() => this.store.createContactInstance(profile.id)) === null) return;
          this.bridgeProfileToChat(profile);
          this.paint();
        });
        page.append(create);
      }
      const modules = this.element("button", "archive-link-button", "查看已保存的 Prompt 模块");
      modules.addEventListener("click", () => this.returnToGenerationProfileCabinet());
      page.append(modules);
      return page;
    }

    renderImports() {
      const page = this.scrollPage("archive-detail-page detail-page archive-imports-page");
      const importButton = this.button("导入 JSON", "archive-icon-button", "plus", () => this.openFilePicker());
      page.append(this.header("导入", "原始文件与检测到的区块", () => { this.route = "home"; this.section = "characters"; this.paint(); }, importButton));
      const list = this.element("div", "archive-import-list archive-list");
      if (!this.state.sourceAssets.length) {
        const empty = this.element("section", "archive-empty");
        empty.append(this.icon("database"), this.element("h2", "", "还没有导入"), this.element("p", "", "导入一份 JSON 文件，在创建任何资源前先审核一下。"));
        list.append(empty);
      } else this.state.sourceAssets.forEach((asset) => {
        const row = this.element("article", "archive-import-row archive-list-row file-card");
        const copy = this.element("span", "archive-list-row__copy");
        copy.append(this.element("strong", "", asset.filename), this.element("small", "", `${asset.assetType} · ${asset.detectedBlocks.length} 个区块`));
        row.append(this.icon("media-image"), copy);
        list.append(row);
      });
      page.append(list);
      const modules = this.element("button", "archive-button archive-button--secondary", "已保存的 Prompt 模块");
      modules.addEventListener("click", () => this.returnToGenerationProfileCabinet());
      page.append(modules);
      return page;
    }

    renderModules() {
      const page = this.scrollPage("record-cabinet-page");
      const groups = this.generationProfileGroups();

      const top = this.element("header", "record-cabinet-top");
      const back = this.element("button", "record-cabinet-back");
      back.type = "button";
      back.setAttribute("aria-label", "返回档案馆");
      back.append(this.icon("nav-arrow-left"), this.element("span", "", "MERCURY ARCHIVE"));
      back.addEventListener("click", () => { this.route = "home"; this.section = "characters"; this.paint(); });
      const createWrap = this.element("div", "record-cabinet-create");
      const create = this.button("制作新唱片", "record-cabinet-create__button", "plus", () => this.createBlankFromCabinet());
      createWrap.append(create, this.element("small", "", "新建"));
      top.append(back, createWrap);
      page.append(top);

      const heading = this.element("section", "record-cabinet-heading");
      heading.append(
        this.element("h1", "", "生成档案"),
        this.element("p", "", "你的 Generation Profile 收藏空间"),
      );
      page.append(heading, this.renderRecordCabinetIndex());

      page.append(
        this.renderRecordCabinetShelf("mercury", "01", "MERCURY COLLECTION", "内置档案 · 只读", groups.mercury),
        this.renderRecordCabinetShelf("mine", "02", "MY PRESSINGS", "我的创作", groups.mine),
        this.renderRecordCabinetShelf("imported", "03", "IMPORTED", "外部导入", groups.imported),
      );

      const note = this.element("section", "record-cabinet-note");
      const noteCopy = this.element("span", "record-cabinet-note__copy");
      noteCopy.append(
        this.element("strong", "", "Archive is alive."),
        this.element("small", "", "轻触查看档案，长按管理你的收藏。"),
      );
      note.append(this.icon("spark"), noteCopy);
      page.append(note);
      return page;
    }

    renderRecordCabinetIndex() {
      const nav = this.element("nav", "record-cabinet-index");
      nav.setAttribute("aria-label", "生成档案来源索引");
      [["mercury", "MERCURY"], ["mine", "MINE"], ["imported", "IMPORTED"]].forEach(([id, label]) => {
        const button = this.element("button", "", label);
        button.type = "button";
        button.setAttribute("aria-selected", String(this.cabinetSection === id));
        button.setAttribute("aria-controls", `record-cabinet-${id}`);
        button.addEventListener("click", () => {
          this.cabinetSection = id;
          this.root?.querySelectorAll?.(".record-cabinet-index button").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
          this.root?.querySelector?.(`[data-cabinet-section="${id}"]`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        });
        nav.append(button);
      });
      return nav;
    }

    renderRecordCabinetShelf(id, number, english, subtitle, profiles) {
      const section = this.element("section", `record-cabinet-shelf record-cabinet-shelf--${id}`);
      section.id = `record-cabinet-${id}`;
      section.dataset.cabinetSection = id;
      const heading = this.element("header", "record-cabinet-shelf__heading");
      const copy = this.element("div", "record-cabinet-shelf__copy");
      copy.append(this.element("h2", "", english), this.element("p", "", subtitle));
      heading.append(this.element("strong", "record-cabinet-shelf__number", number), copy, this.element("small", "record-cabinet-shelf__count", `共 ${profiles.length} 张`));
      const collection = this.element("div", "record-cabinet-collection");
      collection.setAttribute("aria-label", `${subtitle}，${profiles.length} 张生成档案`);
      profiles.forEach((profile, index) => collection.append(this.renderGenerationRecord(profile, index)));
      if (id === "mine" || id === "imported") collection.append(this.renderGenerationRecordAction(id));
      else if (!profiles.length) collection.append(this.renderGenerationRecordEmpty(id));
      section.append(heading, collection, this.element("div", "record-cabinet-shelf__rail"));
      return section;
    }

    renderGenerationRecord(profile, index) {
      const object = this.element("article", `generation-record generation-record--${profile.origin}`);
      const surface = this.element("button", "generation-record__surface");
      surface.type = "button";
      surface.setAttribute("aria-label", `查看生成档案 ${profile.name}`);
      surface.setAttribute("aria-description", "轻触查看，长按管理");
      const disc = this.element("img", "generation-record__disc");
      disc.src = `${ARCHIVE_IMAGE_ROOT}archive-vinyl-disc-v1.png`;
      disc.alt = "";
      disc.setAttribute("aria-hidden", "true");
      const sleeve = this.element("span", "generation-record__sleeve");
      const image = this.element("img", "generation-record__image");
      image.src = this.generationProfileCover(profile, index);
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      const copy = this.element("span", "generation-record__copy");
      const order = this.generationProfiles().findIndex((item) => item.id === profile.id) + 1;
      copy.append(
        this.element("span", "generation-record__number", String(Math.max(order, 1)).padStart(2, "0")),
        this.element("strong", "", profile.name),
      );
      sleeve.append(image, copy);
      const usage = this.generationProfileUsage(profile.id);
      if (usage) sleeve.append(this.element("span", "generation-record__usage", "使用中"));
      surface.append(disc, sleeve);
      this.bindGenerationRecordGestures(surface, object, profile);
      object.append(surface);
      return object;
    }

    renderGenerationRecordAction(id) {
      const imported = id === "imported";
      const action = this.element("button", `generation-record-action generation-record-action--${id}`);
      action.type = "button";
      action.setAttribute("aria-label", imported ? "导入生成档案" : "制作新唱片");
      action.append(
        this.icon(imported ? "database" : "plus"),
        this.element("strong", "", imported ? "导入档案" : "制作新唱片"),
        this.element("small", "", imported ? "自动识别资源类型" : "从空白档案开始"),
      );
      action.addEventListener("click", () => imported ? this.openFilePicker() : this.createBlankFromCabinet());
      return action;
    }

    renderGenerationRecordEmpty(id) {
      if (id === "mine") {
        const create = this.element("button", "generation-record-empty generation-record-empty--action");
        create.type = "button";
        create.setAttribute("aria-label", "制作第一张生成档案");
        create.append(this.icon("plus"), this.element("strong", "", "制作新唱片"), this.element("small", "", "从空白档案开始"));
        create.addEventListener("click", () => this.createBlankFromCabinet());
        return create;
      }
      const empty = this.element("div", "generation-record-empty");
      empty.append(this.icon("database"), this.element("strong", "", id === "imported" ? "暂无外部导入" : "暂无档案"), this.element("small", "", id === "imported" ? "导入入口将在制作页提供" : "这里会显示收藏"));
      return empty;
    }

    renderGenerationProfileMenu() {
      const profile = this.profileStore?.get?.(this.profileMenuId);
      if (!profile) { this.syncGenerationProfileFlow(this.profileFlow?.closeOverlay?.(), false); return null; }
      const overlay = this.element("section", "record-profile-menu");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", `管理 ${profile.name}`);
      overlay.setAttribute("data-gesture-exclusion", "true");
      const backdrop = this.element("button", "record-profile-menu__backdrop");
      backdrop.type = "button";
      backdrop.setAttribute("aria-label", "关闭生成档案菜单");
      backdrop.addEventListener("click", () => this.cancelGenerationProfileOverlay());
      const sheet = this.element("div", "record-profile-menu__sheet");
      const heading = this.element("div", "record-profile-menu__heading");
      heading.append(this.element("strong", "", profile.name), this.element("small", "", profile.readOnly ? "MERCURY ORIGINAL · 只读" : profile.origin === "imported" ? "IMPORTED · 可管理" : "MY PRESSING · 可管理"));
      sheet.append(heading);
      const action = (label, iconName, callback, danger = false) => {
        const button = this.button(label, `record-profile-menu__action${danger ? " record-profile-menu__action--danger" : ""}`, iconName, callback);
        button.append(this.element("span", "", label));
        return button;
      };
      sheet.append(
        action("查看档案", "eye", () => this.openGenerationProfile(profile.id)),
        action("导出生成档案", "nav-arrow-down", () => this.exportGenerationProfile(profile.id)),
        action("创建 Remix", "copy", () => { const remix = this.safeStore(() => this.profileStore.remix(profile.id)); if (!remix) return; this.openGenerationProfile(remix.id); }),
      );
      if (!profile.readOnly) {
        sheet.append(action("更换封面", "media-image", () => this.chooseGenerationProfileCover(profile.id)));
        if (profile.cover?.kind === "data-url") sheet.append(action("恢复默认封面", "refresh-double", () => { if (this.updateGenerationProfileCover(profile.id, profileContracts()?.DEFAULT_COVER)) this.paint(); }));
        sheet.append(action("重命名", "settings", () => {
          const nextName = typeof global.prompt === "function" ? global.prompt("输入新的生成档案名称", profile.name) : "";
          if (!nextName?.trim()) return;
          if (this.safeStore(() => this.profileStore.add({ ...profile, name: nextName.trim() }))) this.cancelGenerationProfileOverlay();
        }));
        sheet.append(action("删除", "trash", () => {
          const confirmed = typeof global.confirm !== "function" || global.confirm(`删除“${profile.name}”？此操作只删除这张生成档案。`);
          if (!confirmed) return;
          if (this.safeStore(() => this.profileStore.remove(profile.id))) this.cancelGenerationProfileOverlay();
        }, true));
      }
      overlay.append(backdrop, sheet);
      return overlay;
    }

    renderGenerationCoverPreview() {
      const profile = this.profileStore?.get?.(this.coverDraft?.profileId);
      if (!profile || profile.readOnly) { this.syncGenerationProfileFlow(this.profileFlow?.cancelCover?.(), false); return null; }
      const overlay = this.element("section", "record-cover-preview");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", `预览 ${profile.name} 的新封面`);
      overlay.setAttribute("data-gesture-exclusion", "true");
      const backdrop = this.element("button", "record-cover-preview__backdrop");
      backdrop.type = "button";
      backdrop.setAttribute("aria-label", "取消更换封面");
      backdrop.addEventListener("click", () => this.cancelGenerationProfileCoverPreview());
      const sheet = this.element("div", "record-cover-preview__sheet");
      const preview = this.element("img", "record-cover-preview__image");
      preview.src = this.coverDraft.dataUrl;
      preview.alt = `${profile.name} 新封面预览`;
      const copy = this.element("div", "record-cover-preview__copy");
      copy.append(this.element("small", "", "COVER PREVIEW"), this.element("h2", "", "保存这张封面？"), this.element("p", "", "封面只保存在本地并用于展示，不会进入生成指令。"));
      const actions = this.element("div", "record-cover-preview__actions");
      const cancel = this.element("button", "", "取消");
      cancel.type = "button";
      cancel.addEventListener("click", () => this.cancelGenerationProfileCoverPreview());
      const save = this.element("button", "record-cover-preview__save", "保存封面");
      save.type = "button";
      save.addEventListener("click", () => {
        if (!this.saveGenerationProfileCoverPreview()) return;
        this.paint();
      });
      actions.append(cancel, save);
      sheet.append(preview, copy, actions);
      overlay.append(backdrop, sheet);
      return overlay;
    }

    renderGenerationProfileDetail() {
      const profile = this.profileStore?.get?.(this.selectedModuleId) || null;
      if (!profile) {
        this.syncGenerationProfileFlow(this.profileFlow?.openCabinet?.());
        return this.renderModules();
      }

      const page = this.scrollPage("archive-generation-profile-detail");
      const source = this.generationProfileSourceMeta(profile);
      const inspection = this.generationProfileInspection(profile);
      const runtime = this.generationProfileRuntimeMeta(inspection);
      const usage = this.generationProfileUsage(profile.id);
      const preserved = Number(inspection.preservedCount || 0) + Number(inspection.preservedSettingsCount || 0);
      const tracks = this.generationProfileTrackItems(profile);

      const topbar = this.element("header", "generation-profile-detail-topbar");
      const back = this.button("返回唱片柜", "archive-icon-button", "nav-arrow-left", () => this.returnToGenerationProfileCabinet());
      const title = this.element("div", "generation-profile-detail-topbar__title");
      title.append(this.element("strong", "", "GENERATION PROFILE"), this.element("small", "", "生成档案"));
      const manage = this.button("管理生成档案", "generation-profile-detail-topbar__action", "settings", () => this.openGenerationProfileActions(profile.id));
      topbar.append(back, title, manage);
      page.append(topbar);

      const hero = this.element("section", "generation-profile-detail-hero");
      const stage = this.element("div", "generation-profile-detail-hero__stage");
      const disc = this.element("img", "generation-profile-detail-hero__disc");
      disc.src = `${ARCHIVE_IMAGE_ROOT}archive-vinyl-disc-v1.png`;
      disc.alt = "";
      disc.setAttribute("aria-hidden", "true");
      const sleeve = this.element("div", "generation-profile-detail-hero__sleeve");
      const cover = this.element("img", "generation-profile-detail-hero__cover");
      cover.src = this.generationProfileCover(profile, 0);
      cover.alt = `${profile.name} 封面`;
      sleeve.append(cover);
      stage.append(disc, sleeve);

      const heroCopy = this.element("div", "generation-profile-detail-hero__copy");
      const eyebrow = this.element("div", "generation-profile-detail-hero__eyebrow");
      eyebrow.append(this.element("strong", "", this.generationProfileOrder(profile)), this.element("span", "", source.english));
      const status = this.element("div", "generation-profile-detail-status");
      status.dataset.state = inspection.status || "empty";
      status.append(this.element("strong", "", runtime.label), this.element("small", "", runtime.detail));
      heroCopy.append(
        eyebrow,
        this.element("h1", "", profile.name || "Untitled Profile"),
        this.element("p", "", profile.description || "尚未添加档案说明。"),
        status,
      );
      hero.append(stage, heroCopy);
      page.append(hero);

      const stats = this.element("section", "generation-profile-detail-stats");
      [
        [String(inspection.runtimeActiveCount || 0), "ACTIVE", "运行内容"],
        [String(preserved), "PRESERVED", "兼容保留"],
        [String(usage), "CHATS", "使用会话"],
      ].forEach(([value, english, chinese]) => {
        const stat = this.element("div", "generation-profile-detail-stat");
        stat.append(this.element("strong", "", value), this.element("span", "", english), this.element("small", "", chinese));
        stats.append(stat);
      });
      page.append(stats);

      const core = this.element("section", "generation-profile-detail-section generation-profile-detail-core");
      const coreHeading = this.element("header", "generation-profile-detail-section__heading");
      coreHeading.append(this.element("div", "", "CORE PROFILE"), this.element("small", "", "档案摘要"));
      const coreText = inspection.status === "ready"
        ? "这张档案已包含可进入运行时的生成内容。只有被会话明确选择后才会生效。"
        : inspection.status === "partial"
          ? `${inspection.runtimeActiveCount || 0} 项内容可运行，${preserved} 项兼容内容仍安全保留。`
          : inspection.status === "preserved"
            ? "内容已安全保留，但当前没有可进入运行时的生成指令。"
            : "这张档案目前没有可进入运行时的生成内容。";
      core.append(coreHeading, this.element("p", "", coreText));
      page.append(core);

      const tracklist = this.element("section", "generation-profile-detail-section generation-profile-detail-tracklist");
      const trackHeading = this.element("header", "generation-profile-detail-section__heading generation-profile-detail-section__heading--split");
      const trackTitle = this.element("div", "");
      trackTitle.append(this.element("div", "", "TRACKLIST"), this.element("small", "", "运行内容预览"));
      trackHeading.append(trackTitle, this.element("span", "", `共 ${tracks.length} 项`));
      tracklist.append(trackHeading);
      const trackRows = this.element("div", "generation-profile-detail-tracks");
      if (!tracks.length) {
        trackRows.append(this.element("p", "generation-profile-detail-empty", "暂无可运行内容。"));
      } else {
        tracks.slice(0, 6).forEach((track, index) => {
          const row = this.element("article", "generation-profile-detail-track");
          const copy = this.element("div", "generation-profile-detail-track__copy");
          copy.append(this.element("strong", "", track.title), this.element("small", "", track.detail));
          row.append(this.element("span", "generation-profile-detail-track__number", String(index + 1).padStart(2, "0")), copy);
          trackRows.append(row);
        });
        if (tracks.length > 6) trackRows.append(this.element("p", "generation-profile-detail-more", `另有 ${tracks.length - 6} 项运行内容`));
      }
      tracklist.append(trackRows);
      page.append(tracklist);

      const usedBy = this.element("section", "generation-profile-detail-section generation-profile-detail-used-by");
      const usedHeading = this.element("header", "generation-profile-detail-section__heading");
      usedHeading.append(this.element("div", "", "USED BY"), this.element("small", "", "引用位置"));
      const chatRow = this.element("div", "generation-profile-detail-app");
      const chatIcon = this.element("span", "generation-profile-detail-app__icon");
      chatIcon.append(this.icon("chat-bubble"));
      const chatCopy = this.element("div", "generation-profile-detail-app__copy");
      chatCopy.append(this.element("strong", "", "Chat"), this.element("small", "", usage ? `${usage} 个会话正在使用` : "尚未用于任何会话"));
      chatRow.append(chatIcon, chatCopy, this.element("span", "generation-profile-detail-app__count", String(usage)));
      usedBy.append(usedHeading, chatRow);
      page.append(usedBy);

      const base = this.element("section", "generation-profile-detail-section generation-profile-detail-base");
      const baseHeading = this.element("header", "generation-profile-detail-section__heading");
      baseHeading.append(this.element("div", "", "BASE INFORMATION"), this.element("small", "", "基础信息"));
      const facts = this.element("dl", "generation-profile-detail-facts");
      [
        ["SOURCE", source.chinese],
        ["CREATED", this.generationProfileCreationLabel(profile)],
        ["UPDATED", this.generationProfileUpdatedLabel(profile)],
        ["RUNTIME", runtime.label],
      ].forEach(([label, value]) => {
        const fact = this.element("div", "");
        fact.append(this.element("dt", "", label), this.element("dd", "", value));
        facts.append(fact);
      });
      base.append(baseHeading, facts);
      page.append(base);

      const actions = this.element("section", "generation-profile-detail-actions");
      const actionHeading = this.element("header", "generation-profile-detail-section__heading");
      actionHeading.append(this.element("div", "", "ACTIONS"), this.element("small", "", profile.readOnly ? "只读原件" : "本地档案"));
      const action = this.element("button", "generation-profile-detail-action");
      action.type = "button";
      if (profile.readOnly) {
        action.setAttribute("aria-label", `创建 ${profile.name} 的 Remix`);
        action.append(this.icon("copy"), this.element("strong", "", "创建 Remix"), this.element("small", "", "生成一张可编辑副本"));
        action.addEventListener("click", () => {
          const remixed = this.safeStore(() => this.profileStore.remix(profile.id));
          if (remixed) this.openGenerationProfile(remixed.id);
        });
      } else {
        action.setAttribute("aria-label", `管理 ${profile.name}`);
        action.append(this.icon("settings"), this.element("strong", "", "管理档案"), this.element("small", "", "封面、名称、Remix 与删除"));
        action.addEventListener("click", () => this.openGenerationProfileActions(profile.id));
      }
      actions.append(actionHeading, action);
      page.append(actions);
      return page;
    }

    worldCoverImage(world, index = 0) {
      const covers = {
        "glass-water": "archive-glass-water-v1.webp",
        "water-starlight": "archive-water-starlight-v1.png",
        "wind-chimes": "archive-wind-chimes-v1.webp",
        "mercury-orb": "archive-mercury-orb-v1.png",
        quill: "worldbook-quill-v1.png",
        knowledge: "worldbook-knowledge-v1.png",
        dialogue: "worldbook-dialogue-v1.png",
      };
      const fallback = contracts().WORLD_COVER_KEYS[index % contracts().WORLD_COVER_KEYS.length];
      return `${ARCHIVE_IMAGE_ROOT}${covers[world?.coverKey || fallback] || covers.quill}`;
    }

    worldLinkedProfiles(world) {
      const explicitLinks = new Set(world.relatedProfileIds || []);
      return this.state.runtimeProfiles.filter((profile) => explicitLinks.has(profile.id) || profile.worldBindings?.includes(world.id) || profile.worldBindings?.includes(world.name));
    }

    worldUpdatedLabel(world) {
      const stamp = world.updatedAt || world.createdAt;
      const date = stamp ? new Date(stamp) : null;
      if (!date || Number.isNaN(date.getTime())) return "刚刚更新";
      const days = Math.floor((Date.now() - date.getTime()) / 86400000);
      if (days <= 0) return "今天更新";
      if (days === 1) return "昨天更新";
      return `${date.getMonth() + 1} 月 ${date.getDate()} 日更新`;
    }

    startWorldBookCreate() {
      this.selectedWorldId = null;
      this.worldDraft = { name: "", summary: "", foundations: [], entries: [], tags: [], relatedProfileIds: [], coverKey: "quill", favorite: false };
      this.worldEditorDraft = null;
      this.worldEntryDraft = null;
      this.worldEditorCoverKey = "quill";
      this.worldMenuId = null;
      this.worldOverviewMenuOpen = false;
      this.worldCoverMenuOpen = false;
      this.section = "worlds";
      this.route = "world-settings";
      this.paint();
    }

    openWorldBookEditor(worldId) {
      const world = this.storeWrite(() => this.store.touchWorld(worldId));
      if (!world) return;
      this.selectedWorldId = world.id;
      this.worldDraft = null;
      this.worldEditorDraft = null;
      this.worldEntryDraft = null;
      this.worldEditorCoverKey = null;
      this.worldMenuId = null;
      this.worldOverviewMenuOpen = false;
      this.worldCoverMenuOpen = false;
      this.section = "worlds";
      this.route = "world-editor";
      this.paint();
    }

    worldBookMatches(world) {
      const query = this.worldSearchQuery.trim().toLowerCase();
      if (query) {
        const haystack = [world.name, world.summary, ...(world.foundations || []), ...(world.tags || []), ...(world.entries || []).flatMap((entry) => [entry.title, entry.summary, entry.content, ...(entry.aliases || []), ...(entry.tags || [])])].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      const linked = this.worldLinkedProfiles(world).length;
      if (this.worldFilter === "recent") return Boolean(world.lastOpenedAt);
      if (this.worldFilter === "linked") return linked > 0;
      if (this.worldFilter === "unlinked") return linked === 0;
      if (this.worldFilter === "favorites") return Boolean(world.favorite);
      return true;
    }

    filteredWorldBooks() {
      const worlds = this.state.worlds.filter((world) => this.worldBookMatches(world));
      const updatedValue = (world) => new Date(world.updatedAt || world.createdAt || 0).getTime() || 0;
      return worlds.sort((left, right) => {
        if (this.worldSort === "title") return left.name.localeCompare(right.name, "zh-Hans-CN");
        if (this.worldSort === "entries") return right.entries.length - left.entries.length || updatedValue(right) - updatedValue(left);
        if (this.worldSort === "created") return updatedValue(right) - updatedValue(left);
        if (this.worldSort === "opened") return new Date(right.lastOpenedAt || 0).getTime() - new Date(left.lastOpenedAt || 0).getTime();
        return updatedValue(right) - updatedValue(left);
      });
    }

    worldBookCard(world, index) {
      const card = this.element("article", "worldbook-card");
      card.style.backgroundImage = `linear-gradient(180deg, rgb(245 250 251 / 8%) 0%, rgb(246 251 252 / 33%) 43%, rgb(238 246 249 / 93%) 100%), url("${this.worldCoverImage(world, index)}")`;
      const open = this.element("button", "worldbook-card__surface");
      open.type = "button";
      open.setAttribute("aria-label", `打开世界书 ${world.name}`);
      open.addEventListener("click", () => this.openWorldBookEditor(world.id));
      const linked = this.worldLinkedProfiles(world).length;
      const number = this.element("span", "worldbook-card__number", String(index + 1).padStart(2, "0"));
      const star = this.element("span", "worldbook-card__favorite", world.favorite ? "已收藏" : "");
      const copy = this.element("div", "worldbook-card__copy");
      copy.append(this.element("strong", "", world.name), this.element("p", "", world.summary || "为角色、文风与知识补充保留可检索条目。"));
      const meta = this.element("div", "worldbook-card__meta");
      meta.append(this.element("span", "", `${world.entries.length} 条目`), this.element("span", "", `关联 ${linked} 角色`), this.element("span", "", this.worldUpdatedLabel(world)));
      open.append(number, star, copy, meta);
      const more = this.button(`更多操作：${world.name}`, "worldbook-card__more", "more-horiz", () => { this.worldMenuId = this.worldMenuId === world.id ? null : world.id; this.paint(); });
      card.append(open, more);
      if (this.worldMenuId === world.id) {
        const menu = this.element("div", "worldbook-card__menu");
        const edit = this.element("button", "", "编辑知识书");
        edit.type = "button";
        edit.addEventListener("click", () => this.openWorldBookEditor(world.id));
        const copyWorld = this.element("button", "", "复制并编辑");
        copyWorld.type = "button";
        copyWorld.addEventListener("click", () => { const copied = this.storeWrite(() => this.store.duplicateWorld(world.id)); if (!copied) return; this.selectedWorldId = copied.id; this.worldDraft = null; this.worldEditorDraft = null; this.worldEntryDraft = null; this.route = "world-editor"; this.worldMenuId = null; this.paint(); });
        const favorite = this.element("button", "", world.favorite ? "取消收藏" : "收藏");
        favorite.type = "button";
        favorite.addEventListener("click", () => { if (this.storeWrite(() => this.store.updateWorld({ ...world, favorite: !world.favorite })) === null) return; this.worldMenuId = null; this.paint(); });
        menu.append(edit, copyWorld, favorite);
        card.append(menu);
      }
      return card;
    }

    worldBookCreateCard() {
      const card = this.element("button", "worldbook-card worldbook-card--create");
      card.type = "button";
      card.setAttribute("aria-label", "新建世界书");
      card.append(this.icon("plus"), this.element("strong", "", "新建世界书"), this.element("small", "", "从知识条目开始建立"));
      card.addEventListener("click", () => this.startWorldBookCreate());
      return card;
    }

    worldBookShelfSection(items, index) {
      const section = this.element("section", "worldbook-shelf-section");
      section.setAttribute("aria-label", `世界书架第 ${index + 1} 层`);
      const grid = this.element("div", "worldbook-shelf-grid");
      grid.append(...items);
      section.append(grid, this.element("div", "worldbook-shelf-rail"));
      return section;
    }

    renderWorldBookshelf() {
      const page = this.scrollPage("archive-worldbooks-page");
      const topbar = this.element("header", "worldbook-shelf-topbar");
      const back = this.button("返回档案馆", "archive-icon-button", "nav-arrow-left", () => {
        this.worldMenuId = null;
        this.worldSearchQuery = "";
        this.worldFilter = "all";
        this.section = "characters";
        this.route = "home";
        this.paint();
      });
      const path = this.element("p", "worldbook-shelf-topbar__path", "档案馆 / 世界书");
      topbar.append(back, path);
      page.append(topbar);
      const hero = this.element("header", "worldbook-shelf-hero");
      const copy = this.element("div", "worldbook-shelf-hero__copy");
      copy.append(this.element("p", "", "WORLD BOOKS"), this.element("h1", "", "世界书架"), this.element("small", "", "知识、补充与可检索条目"));
      const create = this.button("新建世界书", "worldbook-shelf-hero__add", "plus", () => this.startWorldBookCreate());
      hero.append(copy, create);
      page.append(hero);

      const search = this.element("form", "worldbook-search");
      const searchInput = this.element("input");
      searchInput.type = "search";
      searchInput.placeholder = "搜索世界书 / 关键词 / 条目内容";
      searchInput.value = this.worldSearchQuery;
      search.append(this.icon("search"), searchInput);
      search.addEventListener("submit", (event) => { event.preventDefault(); this.worldSearchQuery = searchInput.value; this.paint(); });
      page.append(search);

      const allWorlds = this.state.worlds;
      const filterBar = this.element("div", "worldbook-filter-bar");
      const filters = [["all", "全部", allWorlds.length], ["recent", "最近使用", allWorlds.filter((world) => world.lastOpenedAt).length], ["linked", "已关联", allWorlds.filter((world) => this.worldLinkedProfiles(world).length).length], ["unlinked", "未关联", allWorlds.filter((world) => !this.worldLinkedProfiles(world).length).length], ["favorites", "我的收藏", allWorlds.filter((world) => world.favorite).length]];
      const tabs = this.element("nav", "worldbook-filter-tabs");
      tabs.setAttribute("aria-label", "世界书筛选");
      filters.forEach(([id, label, count]) => { const button = this.element("button", "", `${label} ${count}`); button.type = "button"; button.setAttribute("aria-selected", String(this.worldFilter === id)); button.addEventListener("click", () => { this.worldFilter = id; this.paint(); }); tabs.append(button); });
      const sort = this.element("select", "worldbook-sort");
      [["updated", "按更新时间"], ["opened", "按最近使用"], ["entries", "按条目数量"], ["title", "按标题"], ["created", "按创建时间"]].forEach(([value, label]) => { const option = this.element("option", "", label); option.value = value; option.selected = value === this.worldSort; sort.append(option); });
      sort.addEventListener("change", () => { this.worldSort = sort.value; this.paint(); });
      filterBar.append(tabs, sort);
      page.append(filterBar);

      const worlds = this.filteredWorldBooks();
      const cards = worlds.map((world, index) => this.worldBookCard(world, index));
      cards.push(this.worldBookCreateCard());
      for (let index = 0; index < cards.length; index += 2) page.append(this.worldBookShelfSection(cards.slice(index, index + 2), index / 2));
      if (!worlds.length) {
        const emptyText = this.worldSearchQuery.trim() ? "没有匹配的世界书或知识条目。" : this.worldFilter === "all" ? "还没有知识书；从第一条可检索的补充开始。" : "当前筛选条件下没有世界书。";
        page.append(this.element("p", "worldbook-empty", emptyText));
      }

      const recent = allWorlds.filter((world) => world.lastOpenedAt).sort((left, right) => new Date(right.lastOpenedAt) - new Date(left.lastOpenedAt)).slice(0, 4);
      if (recent.length) {
        const recentlyUsed = this.element("section", "worldbook-recently-used");
        recentlyUsed.append(this.sectionHeading("最近使用", "按打开时间"));
        const row = this.element("div", "worldbook-recent-row");
        recent.forEach((world, index) => { const item = this.element("button", "worldbook-recent-link"); item.type = "button"; item.style.backgroundImage = `url("${this.worldCoverImage(world, index)}")`; item.append(this.element("strong", "", world.name), this.element("small", "", this.worldUpdatedLabel(world))); item.addEventListener("click", () => this.openWorldBookEditor(world.id)); row.append(item); });
        recentlyUsed.append(row);
        page.append(recentlyUsed);
      }
      page.append(this.element("p", "worldbook-domain-note", "世界书保存可检索的知识与补充条目；Cinema AU 平行世界剧本属于独立资源域。"));
      return page;
    }

    renderWorldBookEntryComposer(world, isStoredWorld) {
      const values = this.worldEntryDraft;
      if (!values) return null;
      const editor = this.element("section", "worldbook-entry-composer");
      editor.append(this.element("h2", "", values.id ? "编辑知识条目" : "新增知识条目"));
      const title = this.element("input", "worldbook-entry-composer__title");
      title.value = values.title || "";
      title.placeholder = "条目标题";
      const type = this.element("select", "worldbook-entry-composer__select");
      contracts().WORLD_ENTRY_TYPES.forEach((typeValue) => { const option = this.element("option", "", typeValue); option.value = typeValue; option.selected = typeValue === values.type; type.append(option); });
      const summary = this.element("textarea", "worldbook-entry-composer__summary");
      summary.value = values.summary || "";
      summary.placeholder = "用一句话说明这条知识何时有用";
      const content = this.element("textarea", "worldbook-entry-composer__content");
      content.value = values.content || "";
      content.placeholder = "知识内容、表达规则、背景补充或动态触发条件";
      const aliases = this.element("input", "worldbook-entry-composer__aliases");
      aliases.value = (values.aliases || []).join("、");
      aliases.placeholder = "触发关键词（用顿号或逗号分隔，可选）";
      const alwaysLabel = this.element("label", "worldbook-entry-composer__always");
      const alwaysActive = this.element("input");
      alwaysActive.type = "checkbox";
      alwaysActive.checked = Boolean(values.alwaysActive);
      alwaysLabel.append(alwaysActive, this.element("span", "", "常驻条目（始终可用）"));
      const actions = this.element("div", "worldbook-entry-composer__actions");
      const cancel = this.element("button", "archive-button archive-button--secondary", "取消");
      cancel.type = "button";
      cancel.addEventListener("click", () => { this.worldEntryDraft = null; this.paint(); });
      const save = this.element("button", "archive-button archive-button--primary", "保存条目");
      save.type = "button";
      save.addEventListener("click", () => {
        const aliasesValue = aliases.value.split(/[、，,]/).map((item) => item.trim()).filter(Boolean);
        const payload = { ...values, title: title.value.trim() || "未命名条目", type: type.value, summary: summary.value.trim(), content: content.value.trim(), aliases: aliasesValue, alwaysActive: alwaysActive.checked };
        if (isStoredWorld) {
          const savedEntry = this.storeWrite(() => this.store.updateWorldEntry(world.id, payload));
          if (savedEntry === null) return;
          if (this.worldEditorDraft) {
            const entries = (this.worldEditorDraft.entries || []).filter((entry) => entry.id !== savedEntry.id);
            entries.push(savedEntry);
            this.worldEditorDraft = { ...this.worldEditorDraft, entries };
          }
        } else {
          const normalized = contracts().createWorldEntry(payload);
          const entries = (this.worldDraft.entries || []).filter((entry) => entry.id !== normalized.id);
          entries.push(normalized);
          this.worldDraft = { ...this.worldDraft, entries };
        }
        this.worldEntryDraft = null;
        this.paint();
      });
      actions.append(cancel, save);
      editor.append(title, type, summary, content, aliases, alwaysLabel, actions);
      return editor;
    }

    worldBookOrder(world) {
      const position = this.state.worlds.findIndex((item) => item.id === world.id);
      return String(Math.max(0, position) + 1).padStart(2, "0");
    }

    worldBookEntryMatches(entry) {
      const query = this.worldIndexQuery.trim().toLowerCase();
      if (query) {
        const haystack = [entry.title, entry.summary, entry.content, ...(entry.aliases || []), ...(entry.tags || [])].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (this.worldIndexFilter === "always") return Boolean(entry.alwaysActive);
      if (this.worldIndexFilter === "triggered") return !entry.alwaysActive && Boolean((entry.aliases || []).length);
      if (this.worldIndexFilter === "disabled") return entry.enabled === false;
      return true;
    }

    worldBookEntryState(entry) {
      if (entry.enabled === false) return "已停用";
      if (entry.alwaysActive) return "常驻";
      if ((entry.aliases || []).length) return `关键词 · ${(entry.aliases || []).length} 个`;
      return "按需补充";
    }

    renderWorldBookEditor() {
      const world = this.state.worlds.find((item) => item.id === this.selectedWorldId) || null;
      if (!world) { this.route = "worlds"; return this.renderWorldBookshelf(); }
      const page = this.scrollPage("archive-worldbook-overview");
      const topbar = this.element("header", "worldbook-overview-topbar");
      const back = this.button("返回世界书架", "archive-icon-button", "nav-arrow-left", () => { this.worldOverviewMenuOpen = false; this.worldCoverMenuOpen = false; this.route = "worlds"; this.paint(); });
      const more = this.button("世界书更多操作", "worldbook-overview-topbar__more", "more-horiz", () => { this.worldOverviewMenuOpen = !this.worldOverviewMenuOpen; if (!this.worldOverviewMenuOpen) this.worldCoverMenuOpen = false; this.paint(); });
      topbar.append(back, more);
      page.append(topbar);

      const hero = this.element("section", "worldbook-overview-hero");
      const heroCopy = this.element("div", "worldbook-overview-hero__copy");
      const eyebrow = this.element("div", "worldbook-overview-hero__eyebrow");
      eyebrow.append(this.element("strong", "", this.worldBookOrder(world)), this.element("span", "", "WORLD BOOK"));
      heroCopy.append(eyebrow, this.element("h1", "", world.name), this.element("p", "", world.summary || "为角色、表达与知识补充建立一组可检索条目。"));
      const art = this.element("div", "worldbook-overview-hero__art");
      art.style.backgroundImage = `linear-gradient(180deg, rgb(239 247 249 / 7%), rgb(230 241 245 / 42%)), url("${this.worldCoverImage(world, 0)}")`;
      hero.append(heroCopy, art);
      page.append(hero);

      const linkedProfiles = this.worldLinkedProfiles(world);
      const activeCount = world.entries.filter((entry) => entry.enabled !== false).length;
      const stats = this.element("section", "worldbook-overview-stats");
      [[String(world.entries.length), "ENTRIES", "条目数量"], [String(linkedProfiles.length), "CHARACTERS", "关联角色"], [String(activeCount), "ACTIVE", "当前启用"]].forEach(([value, english, chinese]) => { const stat = this.element("div", "worldbook-overview-stat"); stat.append(this.element("strong", "", value), this.element("span", "", english), this.element("small", "", chinese)); stats.append(stat); });
      page.append(stats);

      const openIndex = this.element("button", "worldbook-open-index");
      openIndex.type = "button";
      openIndex.append(this.element("span", "", "OPEN INDEX"), this.element("small", "", "打开目录"), this.icon("nav-arrow-right"));
      openIndex.addEventListener("click", () => { this.worldOverviewMenuOpen = false; this.worldCoverMenuOpen = false; this.worldIndexQuery = ""; this.worldIndexFilter = "all"; this.route = "world-index"; this.paint(); });
      page.append(openIndex);

      const relationships = this.element("section", "worldbook-overview-links");
      relationships.append(this.element("p", "worldbook-overview-label", "LINKED CHARACTERS"));
      const roster = this.element("div", "worldbook-overview-roster");
      if (!linkedProfiles.length) roster.append(this.element("p", "archive-muted", "还没有关联角色。可在更多操作中编辑。"));
      linkedProfiles.slice(0, 4).forEach((profile, index) => { const item = this.element("div", "worldbook-overview-person"); const portrait = this.element("span", "worldbook-overview-person__portrait"); portrait.style.backgroundImage = `url("${this.assetImageFor("character", index)}")`; item.append(portrait, this.element("strong", "", profile.displayName), this.element("small", "", "已关联")); roster.append(item); });
      relationships.append(roster);
      page.append(relationships);

      const footer = this.element("section", "worldbook-overview-footer");
      const runtime = this.element("div", ""); runtime.append(this.element("small", "", "RUNTIME"), this.element("strong", "", "Local resource"), this.element("span", "", "运行资源"));
      const updated = this.element("div", ""); updated.append(this.element("small", "", "UPDATED"), this.element("strong", "", this.worldUpdatedLabel(world)), this.element("span", "", "最近编辑"));
      footer.append(runtime, updated);
      page.append(footer);

      if (this.worldOverviewMenuOpen) {
        const menu = this.element("section", "worldbook-overview-menu");
        const edit = this.element("button", "", "编辑知识书");
        edit.type = "button";
        edit.addEventListener("click", () => { this.worldOverviewMenuOpen = false; this.worldCoverMenuOpen = false; this.worldEditorDraft = null; this.route = "world-settings"; this.paint(); });
        const cover = this.element("button", "", "更换世界书封面");
        cover.type = "button";
        cover.addEventListener("click", () => { this.worldOverviewMenuOpen = false; this.worldCoverMenuOpen = true; this.paint(); });
        const copy = this.element("button", "", "复制并编辑");
        copy.type = "button";
        copy.addEventListener("click", () => { const copied = this.storeWrite(() => this.store.duplicateWorld(world.id)); if (!copied) return; this.selectedWorldId = copied.id; this.worldOverviewMenuOpen = false; this.worldCoverMenuOpen = false; this.route = "world-editor"; this.paint(); });
        const favorite = this.element("button", "", world.favorite ? "取消收藏" : "收藏世界书");
        favorite.type = "button";
        favorite.addEventListener("click", () => { if (this.storeWrite(() => this.store.updateWorld({ ...world, favorite: !world.favorite })) === null) return; this.worldOverviewMenuOpen = false; this.paint(); });
        const exportWorld = this.element("button", "", "导出世界书");
        exportWorld.type = "button";
        exportWorld.addEventListener("click", () => { this.exportWorldBook(world.id); this.worldOverviewMenuOpen = false; this.paint(); });
        menu.append(edit, cover, copy, exportWorld, favorite);
        page.append(menu);
      }
      if (this.worldCoverMenuOpen) {
        const sheet = this.element("section", "worldbook-cover-sheet");
        sheet.append(this.element("h2", "", "更换世界书封面"), this.element("p", "", "选择后立即保存到当前知识书。"));
        const choices = this.element("div", "worldbook-cover-sheet__choices");
        contracts().WORLD_COVER_KEYS.forEach((coverKey, index) => { const option = this.element("button", "", ""); option.type = "button"; option.setAttribute("aria-label", `选择封面 ${index + 1}`); option.setAttribute("aria-pressed", String(world.coverKey === coverKey)); option.style.backgroundImage = `url("${this.worldCoverImage({ coverKey }, index)}")`; option.addEventListener("click", () => { if (this.storeWrite(() => this.store.updateWorld({ ...world, coverKey })) === null) return; this.worldCoverMenuOpen = false; this.worldOverviewMenuOpen = false; this.paint(); }); choices.append(option); });
        const cancel = this.element("button", "worldbook-cover-sheet__cancel", "取消"); cancel.type = "button"; cancel.addEventListener("click", () => { this.worldCoverMenuOpen = false; this.paint(); });
        sheet.append(choices, cancel);
        page.append(sheet);
      }
      return page;
    }

    renderWorldBookIndex() {
      const world = this.state.worlds.find((item) => item.id === this.selectedWorldId) || null;
      if (!world) { this.route = "worlds"; return this.renderWorldBookshelf(); }
      const page = this.scrollPage("archive-worldbook-index");
      const topbar = this.element("header", "worldbook-index-topbar");
      const back = this.button("返回世界书概览", "archive-icon-button", "nav-arrow-left", () => { this.worldEntryDraft = null; this.route = "world-editor"; this.paint(); });
      const heading = this.element("div", "worldbook-index-topbar__title");
      heading.append(this.element("strong", "", world.name), this.element("small", "", "知识书目录"));
      const more = this.button("世界书更多操作", "worldbook-overview-topbar__more", "more-horiz", () => { this.worldOverviewMenuOpen = true; this.route = "world-editor"; this.paint(); });
      topbar.append(back, heading, more);
      page.append(topbar);

      const title = this.element("section", "worldbook-index-heading");
      title.append(this.element("h1", "", "INDEX"), this.element("span", "", `${world.entries.length} ENTRIES`), this.element("p", "", "目录"));
      page.append(title);

      const search = this.element("form", "worldbook-index-search");
      const input = this.element("input"); input.type = "search"; input.value = this.worldIndexQuery; input.placeholder = "搜索条目…";
      search.append(this.icon("search"), input);
      search.addEventListener("submit", (event) => { event.preventDefault(); this.worldIndexQuery = input.value; this.paint(); });
      page.append(search);

      const filters = this.element("nav", "worldbook-index-filters");
      const filterOptions = [["all", "全部", world.entries.length], ["always", "常驻", world.entries.filter((entry) => entry.alwaysActive).length], ["triggered", "触发", world.entries.filter((entry) => !entry.alwaysActive && (entry.aliases || []).length).length], ["disabled", "禁用", world.entries.filter((entry) => entry.enabled === false).length]];
      filterOptions.forEach(([id, label, count]) => { const button = this.element("button", "", `${label} ${count}`); button.type = "button"; button.setAttribute("aria-selected", String(this.worldIndexFilter === id)); button.addEventListener("click", () => { this.worldIndexFilter = id; this.paint(); }); filters.append(button); });
      page.append(filters);

      const entries = world.entries.filter((entry) => this.worldBookEntryMatches(entry));
      const list = this.element("section", "worldbook-index-list");
      if (!entries.length) list.append(this.element("p", "worldbook-index-empty", this.worldIndexQuery.trim() ? "没有匹配的知识条目。" : "这个知识书还没有条目。"));
      entries.forEach((entry, index) => {
        const row = this.element("article", "worldbook-index-row");
        const edit = this.element("button", "worldbook-index-row__copy"); edit.type = "button"; edit.setAttribute("aria-label", `编辑条目 ${entry.title}`);
        const number = this.element("strong", "worldbook-index-row__number", String(index + 1).padStart(2, "0"));
        const copy = this.element("div", ""); copy.append(this.element("strong", "", entry.title), this.element("small", "", entry.summary || entry.content || "尚未填写简介"));
        edit.append(number, copy);
        edit.addEventListener("click", () => { this.worldEntryDraft = { ...entry }; this.paint(); });
        const state = this.element("div", "worldbook-index-row__state"); state.append(this.element("span", "", this.worldBookEntryState(entry)), this.element("small", "", entry.alwaysActive ? "角色定义之前" : "按需调用"));
        const toggle = this.element("label", "worldbook-index-toggle"); const checkbox = this.element("input"); checkbox.type = "checkbox"; checkbox.checked = entry.enabled !== false; checkbox.setAttribute("aria-label", `${entry.enabled === false ? "启用" : "停用"} ${entry.title}`); checkbox.addEventListener("change", () => { this.storeWrite(() => this.store.updateWorldEntry(world.id, { ...entry, enabled: checkbox.checked })); this.paint(); }); toggle.append(checkbox, this.element("span", ""));
        row.append(edit, state, toggle);
        list.append(row);
      });
      page.append(list);

      const add = this.element("button", "worldbook-index-add"); add.type = "button"; add.append(this.icon("plus"), this.element("span", "", "NEW ENTRY"), this.element("small", "", "添加条目")); add.addEventListener("click", () => { this.worldEntryDraft = { type: "other", title: "", summary: "", content: "", alwaysActive: false, enabled: true, visibility: "public" }; this.paint(); });
      page.append(add);
      const composer = this.renderWorldBookEntryComposer(world, true);
      if (composer) page.append(composer);
      return page;
    }

    renderWorldBookSettings() {
      const storedWorld = this.state.worlds.find((item) => item.id === this.selectedWorldId) || null;
      if (!storedWorld && !this.worldDraft) { this.route = "worlds"; return this.renderWorldBookshelf(); }
      const world = this.worldEditorDraft || storedWorld || this.worldDraft;
      const editorValues = { ...world, coverKey: this.worldEditorCoverKey || world.coverKey || "quill" };
      const splitWorldList = (value) => value.split(/[、，,]/).map((item) => item.trim()).filter(Boolean);
      const page = this.scrollPage("archive-worldbook-editor");
      const topbar = this.element("header", "worldbook-editor-topbar");
      const destination = storedWorld ? "world-editor" : "worlds";
      const back = this.button(storedWorld ? "返回世界书概览" : "返回世界书架", "archive-icon-button", "nav-arrow-left", () => { this.worldDraft = null; this.worldEditorDraft = null; this.worldEntryDraft = null; this.worldEditorCoverKey = null; this.route = destination; this.paint(); });
      const heading = this.element("div", "worldbook-editor-topbar__copy");
      heading.append(this.element("h1", "", storedWorld ? "编辑基础资料" : "新建世界书"), this.element("small", "", storedWorld ? "封面请在概览页右上角更多操作中更换" : "保存后作为正式世界书展示在书架中"));
      topbar.append(back, heading);
      if (storedWorld) {
        const duplicate = this.button("复制世界书", "worldbook-editor-topbar__copy", "more-horiz", () => { const copied = this.storeWrite(() => this.store.duplicateWorld(storedWorld.id)); if (!copied) return; this.selectedWorldId = copied.id; this.worldEntryDraft = null; this.worldEditorCoverKey = null; this.paint(); });
        topbar.append(duplicate);
      }
      page.append(topbar);

      const identity = this.element("section", "worldbook-editor-identity");
      const cover = this.element("div", "worldbook-editor-identity__cover");
      cover.style.backgroundImage = `linear-gradient(180deg, rgb(245 250 251 / 12%), rgb(240 247 249 / 68%)), url("${this.worldCoverImage(editorValues, 0)}")`;
      const intro = this.element("div", "worldbook-editor-identity__intro");
      const name = this.element("input", "worldbook-editor-identity__name");
      name.value = editorValues.name || "";
      name.placeholder = "世界书名称";
      const summary = this.element("textarea", "worldbook-editor-identity__summary");
      summary.value = editorValues.summary || "";
      summary.placeholder = "一句话说明这本知识书的用途";
      intro.append(name, summary);
      identity.append(cover, intro);
      page.append(identity);

      const stats = this.element("section", "worldbook-editor-stats");
      stats.append(this.element("div", "", `${editorValues.entries.length}\n知识条目`), this.element("div", "", `${this.worldLinkedProfiles(editorValues).length}\n关联角色`), this.element("div", "", storedWorld ? this.worldUpdatedLabel(editorValues) : "保存后归档"));
      page.append(stats);

      const knowledge = this.element("section", "worldbook-editor-section");
      knowledge.append(this.sectionHeading("知识范围", "用于检索与补充，不限于世界设定"));
      const foundations = this.element("textarea", "worldbook-editor-field");
      foundations.value = (editorValues.foundations || []).join("、");
      foundations.placeholder = "例如：表达风格、人物关系、专业知识、行为补充";
      const tags = this.element("input", "worldbook-editor-field");
      tags.value = (editorValues.tags || []).join("、");
      tags.placeholder = "标签，用顿号或逗号分隔";
      knowledge.append(foundations, tags);
      page.append(knowledge);

      const relationship = this.element("section", "worldbook-editor-section");
      relationship.append(this.sectionHeading("关联角色", "关联状态仅记录资源关系"));
      const choices = this.element("div", "worldbook-link-choices");
      const relationInputs = [];
      if (!this.state.runtimeProfiles.length) choices.append(this.element("p", "archive-muted", "暂无可关联角色；可以稍后再关联。"));
      this.state.runtimeProfiles.forEach((profile) => { const label = this.element("label", "worldbook-link-choice"); const input = this.element("input"); input.type = "checkbox"; input.value = profile.id; input.checked = (editorValues.relatedProfileIds || []).includes(profile.id); relationInputs.push(input); label.append(input, this.element("span", "", profile.displayName)); choices.append(label); });
      relationship.append(choices);
      page.append(relationship);

      const preserveEditorDraft = () => {
        const draft = {
          ...editorValues,
          name: name.value.trim() || editorValues.name,
          summary: summary.value.trim(),
          foundations: splitWorldList(foundations.value),
          tags: splitWorldList(tags.value),
          relatedProfileIds: relationInputs.filter((input) => input.checked).map((input) => input.value),
          coverKey: this.worldEditorCoverKey || editorValues.coverKey,
        };
        if (storedWorld) this.worldEditorDraft = draft;
        else this.worldDraft = draft;
        return draft;
      };

      const actions = this.element("div", "worldbook-editor-actions");
      const cancel = this.element("button", "archive-button archive-button--secondary", "取消");
      cancel.type = "button";
      cancel.addEventListener("click", () => { this.worldDraft = null; this.worldEditorDraft = null; this.worldEntryDraft = null; this.worldEditorCoverKey = null; this.route = destination; this.paint(); });
      const save = this.element("button", "archive-button archive-button--primary", storedWorld ? "保存并返回概览" : "创建并返回书架");
      save.type = "button";
      save.addEventListener("click", () => {
        const payload = { ...preserveEditorDraft(), name: name.value.trim() || "未命名知识书" };
        const result = storedWorld ? this.storeWrite(() => this.store.updateWorld(payload)) : this.storeWrite(() => this.store.createManualWorld(payload));
        if (!result) return;
        this.selectedWorldId = storedWorld ? result.id : null;
        this.worldDraft = null;
        this.worldEditorDraft = null;
        this.worldEntryDraft = null;
        this.worldEditorCoverKey = null;
        this.section = "worlds";
        this.route = storedWorld ? "world-editor" : "worlds";
        this.paint();
      });
      actions.append(cancel, save);
      page.append(actions);
      return page;
    }

    field(form, label, key, value, type = "textarea", options = []) {
      const wrapper = this.element("label", "archive-field"); wrapper.append(this.element("span", "", label));
      const input = this.element(type === "select" ? "select" : "textarea"); input.name = key; input.value = value || "";
      if (type === "select") options.forEach((optionValue) => { const option = this.element("option"); option.value = optionValue; option.textContent = optionValue; option.selected = optionValue === value; input.append(option); });
      wrapper.append(input); form.append(wrapper); return input;
    }
  }

  function createMercuryArchiveDefinition() {
    return Object.freeze({ id: "archive", nameKey: "apps.archive", icon: "database", version: 1, capabilities: Object.freeze(["storage"]), widgets: Object.freeze([]), create: () => new MercuryArchiveAppController() });
  }

  global.MercuryCreateArchiveDefinition = createMercuryArchiveDefinition;
})(window);
