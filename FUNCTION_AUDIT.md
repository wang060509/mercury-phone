# Mercury 功能与架构全面审计

日期：2026-08-02
范围：`mercury-phone/`（app / core / system / server / design-prototypes / dist / docs），不含 `archive/`（已归档旧版）与根目录补充脚本。
性质：产品与架构审计。**未修改任何代码，未新增功能，未修复 Bug。**

---

## 0. 什么是 Mercury，现在长什么样

Mercury 是一个「无构建步骤、可直接打开 `index.html` 运行」的 iOS 风格 Phone 壳体与本地 AI 代理原型。

实际可运行的正式面只有三套东西：

1. **系统壳**（`system/` + `index.html` + `core/`）：状态机（boot → locked → unlocking → home）、动态岛、控制中心/通知中心、App Engine、应用切换器、锁屏/PIN、桌面与 Dock、小组件注册表、手势、i18n。
2. **三个已注册 App**：`settings`、`mercury-chat`、`archive`（在 `main.js:19-21` 注册）。
3. **本地代理服务器**（`server/`）：静态服务 + `/api/chat` + `/api/provider/test`，转发到 OpenAI-compatible provider。

其余一切（朋友圈 Demo、桌面上未注册的 App 图标、Me 里大量空回调行、独立 design-prototypes 页面）要么是**演示适配器**，要么是**尚未连接的入口**。

> 关键结论先行：**Mercury 当前的产品完成度集中在「系统壳 + 三个 App + 一条真实 AI 链路」，但有大量「看起来可点、实际无动作」的入口**。这是用户（作者）最早上手就能感受到的割裂。下一阶段的核心不是新增页面，而是**连接与收口**。

---

## 1. 全部已有页面与组件清单

### 1.1 系统壳（始终存在）

| 区域 | 文件 | 状态 |
|---|---|---|
| 设备框 / 状态栏 / 壁纸 / Home 指示条 | `index.html`、`system-shell.js` | ✅ 完成、冻结 |
| 锁屏（时间 + 通知预览） | `lock-controller.js`、`index.html #lockScreen` | ✅ 完成 |
| PIN 密码屏 + 数字键盘 | `lock-controller.js` | ✅ 完成（可选沉浸） |
| 动态岛（idle / compact / expanded） | `island-controller.js` | ✅ 完成 |
| 控制中心（亮度真实生效；网络/蓝牙/音频占位） | `overlay-controller.js` | ✅ 完成（亮度真，其余占位） |
| 通知中心（可存笔记 + 消息占位） | `overlay-controller.js`、`notification-store.js` | ✅ 完成 |
| 桌面（页面 / 小组件 / App 行 / Dock / 页点） | `home-controller.js` | ✅ 完成、冻结 |
| 小组件注册表 | `widget-registry.js` | ✅ 完成（但无拖拽编辑器） |
| 应用切换器 + 快照服务 | `app-switcher-*.js`、`app-snapshot-service.js` | ✅ 完成 |
| Home Bar / 手势 | `home-bar-controller.js`、`gesture-manager.js` | ✅ 完成 |
| i18n | `core/i18n.js`、`locales/en-US.js`、`zh-CN.js` | ✅ 完成 |

### 1.2 三个注册 App 的页面

**Settings（`apps/settings-app.js`）**
- Home 列表（2 个分组 3 行分组，7 个设置行）
- AI Connection 详情页（配 Base URL / API Key / Model / 记住密钥 / 流式 / 测试连接）— **完整**
- Usage & Costs 详情页 — **只有空状态，无真实用量**
- 其余 5 个设置行（Appearance / Home & Widgets / Lock Screen / Notifications / Sound / Data & Privacy / General）→ **仅弹 Coming soon toast**

**Mercury Chat（`apps/mercury-chat-app.js`）**
- Chats 列表（仅联系 A 一个会话）
- Conversation（消息流、气泡、选中后出现操作、发送器、+ 面板）
- Conversation Settings（互动/表现/上下文记忆/会话操作）
- Contacts（搜索框无过滤 + 联系 A 一行）
- Contact Profile（头像/背景/4 个资料动作 + 5 个空行）
- Me（个人资料 + 8 个特性行）
- Profile & Appearance（4 个裸按钮：换头像/换背景/改名/改状态）
- Background / Appearance（气泡样式 + 聊天字体循环取值）
- ⚠️ 存在**两份 Me 视图**：`meView()` 与 `legacyMeView()`。`legacyMeView()` 仍保留但 `paint()` 的 route map 只调用 `meView()`。死代码风险。

**Archive（`apps/archive-app.js`）**
- Home（搜索 + 最近使用 + Characters/Worlds/Imports 分段）
- Character Profile（hero + Running profile 检查 + 6 个分区入口）
- Profile Section 编辑（Overview/Personality/Background/Voice/World 五类字段；Runtime Check 单独）
- Runtime Check（创建 Contact placeholder）
- Imports / Import Review（解析 + 分块分类 + 确认）
- Prompt Modules（只读，明确「已保存但未进入 Chat」）
- Worlds / World Detail / World Entry 编辑

### 1.3 演示适配器（`.local-demo/`，仅在 `?demo=1` 加载）

| 页面 | 文件 | 状态 |
|---|---|---|
| 朋友圈 Demo（hero + 动态流 + 九宫格 + 点赞/评论/发布 + 半屏封面） | `moments/moments-view.js`、`fixtures.js`、`presentation-adapter.js` | ✅ 完成（内存态，隔离验证通过） |
| Me 里「朋友圈」入口 | `presentation-adapter.js meEntries` | ✅ 完成，仅 demo 出现 |

### 1.4 独立设计原型（`design-prototypes/social-shell/`）

- `me.html` — 完整静态参考（已被正式 `meView` 吸收，视觉对齐）
- `moments.html` + `moments/` 截图/overlay — 朋友圈静态参考 → 已被正式 demo-view 实现取代为**视觉基线**
- `contacts.html` / `contact-profile.html` / `conversation-settings.html` / `chat-background.html` / `chat-appearance.html` / `chat-function-panel.html` — **全部是「Reserved」占位，未实现**（除 `contacts`/`contact-profile` 已由 Chat App 内的同名视图覆盖）

---

## 2. 已完成 UI 的页面

按「可看、可交互、无水破坏」判定，**完成度最高**：

1. **动态岛 / 锁屏 / PIN / 控制中心 / 通知中心 / 桌面 / 应用切换器**（系统壳）— 视觉与交互均拍板冻结。
2. **Settings · AI Connection** — 完整表单 + 真实测试连接。
3. **Chat · 会话页 / Me / Profile & Appearance / 气泡样式 / 聊天字体** — 视觉可用，交互为循环/内存态。
4. **Archive 全流程**（Home → Profile → 分区编辑 → Runtime Check → Imports/Review → Worlds）— 数据持久化完整，是唯一真正「存得下来」的功能。
5. **朋友圈 Demo** — 视觉与互动齐整，隔离干净，适合展示。

**半完成 / 未完成 UI**：
- Settings · Usage & Costs：只有空状态页。
- Settings 其余 5 行：只弹 toast，无页面。
- Chat · Contacts：搜索框无过滤，只有一行。
- Chat · Contact Profile 的 5 个子能力（Profile notes / World context / Key moments / Proactive messages）：**空回调**。
- Me 里 6 个特性行：**空回调**（见 §4）。
- 桌面未注册 App（photos/calculator/timer/market/camera/music）：点击被启动器拒绝（`onLaunch` 返回 false），**可视化上是灰态但无反馈**。

---

## 3. 已连接的入口

| 入口 | 目标 | 接线方式 |
|---|---|---|
| 桌面 Dock「mercury-chat」 | Chat App | `onLaunch → appEngine.launch` ✅ |
| 桌面 App 行「settings」「archive」 | Settings / Archive | ✅ |
| 锁屏上滑 / 侧键锁定 | 解锁 / 睡眠 | ✅ |
| 控制中心 / 通知中心下拉 | 打开 overlay | ✅ |
| 动态岛点击 | 展开 | ✅ |
| Me · 朋友圈（demo） | 朋友圈 Demo | `presentationAdapter.meEntries` ✅（仅 demo） |
| Me · Profile & Appearance | `profileAppearanceView` | ✅ |
| Chat 会话 → 设置（`nav-arrow-down`） | `conversationSettingsView` | ✅ |
| Chat + 面板 → 美化（背景/气泡/字体） | `backgroundView` / `appearanceView` | ✅ |
| Contacts → Contact Profile | `contactView` | ✅ |
| Settings · AI Connection / Usage & Costs | 两个详情页 | ✅ |

**已连接但只是「跳转」、内容仍是占位的**：Settings 的 Usage & Costs（空）、Chat 的 Profile notes 等（空回调）。**架构上要特别注意**：跨 App 跳转目前**没有**统一路由——Chat 内的 Archive/通知/AI Connection 行全都写死为无动作，而不是复用已存在的 Archive App / Settings App（对照 §4）。

---

## 4. 空回调 / Coming Soon / 禁用按钮清单

这是用户能直接摸到的「假入口」，按位置归类：

| 位置 | 控件 | 现状 |
|---|---|---|
| **Me（Chat）** | Wallet | 空回调 `() => {}` — 暂缓（等基础聊天后） |
| | Archive | ✅ 已接线：跨 App 打开 Archive（`openApp("archive","home")`） |
| | Appearance | 空回调 — 暂缓 |
| | Notifications | 空回调 — 暂缓（系统通知中心存在但等 API 成型） |
| | Data & Privacy | 空回调 — 暂缓 |
| | AI Connection | ✅ 已接线：跨 App 打开 Settings 并落 AI Connection 页（`openApp("settings","ai-connection")`） |
| | Profile options (`•••`) | `more.disabled = true`（L331-332） |
| **Chat 会话** | + 面板「图片」「表情包」「转账」「红包」 | `action.dataset.state = "coming"`，title="Coming soon" |
| | 气泡/字体 循环值 | 无预览，直接改 text |
| | 删除消息 / 重新生成 | `action.disabled = true`，title="actionsLater"（L198-203） |
| **Contact Profile** | Profile notes / World context / Key moments | `settingsRow(..., () => {})` 空 |
| | Proactive messages | 空 `settingsRow(..., () => {})` |
| **Settings** | Appearance/Home&Widgets/Lock Screen/Notifications/Sound & Feedback/Data & Privacy/General | `showToast(comingSoon)`（L148） |
| | Provider 选择（AI Connection 内） | `showToast(providerOnly)`（L170） |
| **桌面** | photos/calculator/timer/market/camera/music | 未注册 → `onLaunch` 返回 false，**无 Toast 无反馈** |
| | Lumi/Moments/Memory/Customize 小组件 | 按钮**完全没有 onClick**（`#renderWidget` L120-145） |
| **Control Center** | 网络/蓝牙/音频 | 无交互，标注「device bridge reserved」 |
| **Archive** | Contact placeholder | 已实现，但仅是占位（见 §6） |
| **Chat** | 新建会话（`addConversation`） | 只切换 `panelOpen`，无面板 |

---

## 5. 已具备接 API 条件的页面

以「已有真实数据模型 + 前端已有请求形态 + 端点/传输已存在」为判据，评分：

| 页面/功能 | 数据模型 | 请求能力 | 后端端点 | 接 API 条件 |
|---|---|---|---|---|
| **Chat · 会话发送** | `ConversationV2`（chat-contracts）| `MercuryAITransport.chat()` 完整 | `/api/chat` + provider | ✅ **唯一已接通**（前置需配置连接） |
| **Settings · AI Connection 测试** | `connection`（settings-app） | `/api/provider/test` | 端点 | ✅ **已接通** |
| **Settings · Usage & Costs** | 无用量模型 | 无 | 无（provider 不回报 usage） | ❌ 缺模型与端点 |
| **Archive · Runtime Check + Chat** | RuntimeProfile/PromptModule/ContactInstance | **未接线** | 无 | ⚠️ 数据齐，传输未接（正中「Runtime 垂直切片」） |
| **朋友圈 Demo** | 内存态，无数据模型 | — | — | ❌ 明确为演示，不进 API |
| **Contact Profile / World context** | archive `worldBindings`、`contactInstances` | **未接线** | 无 | ⚠️ 数据在 Archive，读即可用 |

> 说明：`chat-contracts.js` 里已定义 `compileRuntime()`（L180-189，产出 `compiledSystemText` + precedence + appliedModuleIds + presetId + warnings），**但 Chat App 的 `requestAssistant()`（L391-415）根本没有调用它**，`aiTransport.chat()` 的请求里也不带 `compiledSystemText`。这是一块**已经写好的 Runtime 拼图，只差接线**——它是下一阶段最高价值的切入点的直接证据。

---

## 6. Demo Adapter 与正式 Runtime 的边界

### 现状边界（代码层面已经是清晰的）

| 层 | 存放 | 生命周期 / 隔离 |
|---|---|---|
| **正式 Runtime** | `core/` + `apps/*.js`（非 `.local-demo`） | 写入 namespaced storage：`mercury.app.<appId>.<key>`；Chat 走真实 `/api/chat`；Archive 落 `archive.v1` |
| **Demo Adapter** | `.local-demo/`（fixtures / moments-view / presentation-adapter） | 仅 `?demo=1` 才加载；**内存态**，不写 chat storage / ConversationV2 / localStorage / API（`design-qa.md` 已验证，`build-production.cjs` + `audit-production.cjs` 将其从 dist 剔除并扫描残留 token） |
| **独立设计原型** | `design-prototypes/social-shell/` | 静态参考基线，不进正式壳、不进 dist |

### 已正确归类（建议维持）为 Demo 的
- 朋友圈发布 / 点赞 / 评论 / 九宫格 / 半屏封面 → **留在 Demo Presentation Adapter**，绝不进正式存储。
- Me 里「朋友圈」入口、演示 fixtures → Demo。

### 应该进入正式 Runtime、但目前仍是「占位/空」的部分（对照 §4）
- **Chat 会话里已设计但 disabled 的真能力**：删除消息、重新生成、图片/表情/转账/红包 → 这些不能靠 Demo 假实现，应接入正式 Chat 数据与（未来）媒体/钱包。
- **Archive 与 Chat 的打通**：`contactInstances` 目前只是 Archive 的占位，**不会在 Chats 列表出现、不会绑 RuntimeProfile 到对话**（`development-handoff` §「3. 联系人是下一道产品闸门」明确这是刻意的边界，不是遗漏——但要标记为必须未来接）。
- **`compileRuntime()` 未接线**：见 §5。

### 原则性结论
Demo 适配器是**产品展示层**，正式 Runtime 是**可运行闭环**。两者已通过 `data-local-demo` 标记、独立 fixtures、生产构建剔除、生产审计 token 扫描四重隔离——边界健康。下一阶段应**优先把「正式可跑但没接」的部分接起来，而不是把 Demo 搬进正式层**。

---

## 7. 重复设计，可以合并

| 重复点 | 涉及 | 建议 |
|---|---|---|
| **Me 视图两份** | `mercuryChatApp.meView()` vs `legacyMeView()`（L320/236） | 删除 `legacyMeView` 死代码 |
| **设置行骨架在 3 处重复** | Chat 的 `settingsRow()`、Settings 的 `#homeRow`、Archive 无此概念 | 抽象一个共享「设置行/分组页骨架」，一处改动三处生效（呼应 `function-landing-audit` 的「统一设置页骨架」） |
| **Appearance / 美化控件重复** | Chat 内 `appearanceContent()`（气泡+字体）、`backgroundView()` 与未来「统一美化中心」 | 合并成一个「美化编辑器」，美化范围（背景/气泡/字体/头像/封面）用参数化画布，不复制套 UI |
| **Profile & Appearance 裸按钮** | `profileActions()`（换头像/背景/改名/改状态）与 `legacyMeView` 里同四件套 | 收敛到统一美化中心，加预览/当前值/恢复默认 |
| **「Archive」存在两个入口文案但一个可用** | Me 行（空） vs 桌面 App 行（成功） | 合到一处，Me 行改为跨 App 打开 Archive |
| **朋友圈实现双轨** | `design-prototypes/social-shell/moments.html`（静态基线）vs `.local-demo/moments/`（真 demo） | 设计基线已达成使命，正式壳内验收；避免再把静态站点当第二实现 |
| **Contacts 双轨** | `design-prototypes/.../contacts.html`（Reserved 占位）vs Chat `contactsView()` | 删掉 Reserved 占位页，以正式 App 内视图为准 |

---

## 8. 未来会冲突的数据结构

storage key 已按 `mercury.app.<appId>.<key>` 隔离，**当前三 App 互不覆盖**，但有四类结构性风险：

### 8a. 联系人身份分裂（最严重）
同一「联系 A / 角色」目前在**三套互不相通**的存储里存在三份不同写法：

| 存储 | key | 谁写 | 形态 |
|---|---|---|---|
| Chat 会话 | `mercury.chat…`? 实为 `conversation.v1` 经 `mercury-chat` app 命名空间 | Chat 静态 fixtures `Contact A` | 旧消息格式 V1 → migrate V2 |
| Chat 体验 | `chat-experience.v1`（`mercury-chat` 命名空间） | `DEFAULT_CONTACT` = `contact-a` + `DEFAULT_USER` | 含 contacts.user 外观（avatar/profileBackground/name/status/cropPosition） |
| Archive | `archive.v1`（`archive` 命名空间） | `contactInstances[].runtimeProfileId` + `displayName` | 角色运行时档案占位 |

**冲突**：Archive 生成的 `ContactInstance` 永远不会出现在 Chat 的 `chats`/`contacts` 里；Archive 的 `displayName` 与 Chat 的 `contact-a` 名字/头像各管各的；Archive 角色「美化后的封面」与 Chat 联系人资料、以及未来的朋友圈封面，没有任何统一 owner。**一旦要「ContactInstance 创建后出现在 Chats 列表」，就必须先决定一个 canonical 联系人模型**（对照 `development-handoff` §P0 的三个待产品决定）。

### 8b. 外观/美化状态分裂
- Chat `chat-experience.v1`: `[conversation].appearance.{background,bubbleStyle,chatFont,cropPosition}`
- Chat `user/contact`: `{avatar, profileBackground, cropPosition}`
- Archive `RuntimeProfile`: `{imageAssetId, avatarAssetId, coverAssetId}`（用 assetId 字符串）
- 未来朋友圈封面：`Presentation Profile user.momentsCover / contacts[].momentsCover`（`function-landing-audit` 已设计）

同一「一张角色的头像/封面/背景」，四套字段名（`avatar` vs `avatarAssetId` vs `profileBackground` vs `coverAssetId`），asset 引用方式不一（相对 URL vs `archive:<id>`）。**合并美化中心时必须统一为单一 Presentation Asset Store + 引用模型**，否则改一张图要同步四个地方。

### 8c. Prompt Module 状态语义未定
`archive.v1.promptModules[].enabled` 默认 `false`，UI 明确「Saved only, not active in Chat」；`compileRuntime()` 的 precedence 是 `core_first` 且**已写死**，`enabled`/`scope`/`priority` 尚未真正参与编译。**未来把 module.enabled=true 接进 Chat 时，必须定义 enabled/scope/priority 与 `compileRuntime` 的映射**，否则会出现「模块显示了但没生效」或「优先级错乱」。

### 8d. Usage / 会话身份
- Chat `conversation.v1`（V2）固定 `id: "conversation-default"` / `contact-a:direct`，**没有真正的多会话/多联系人 key 体系**。会话设置 `experienceFor(contactId, timelineId)` 已预留 `keyFor()` 但前端 `experience.conversations` 只有一个 `contact-a:default`。未来加群聊/多角色时，会话索引模型要与 Archive timelineId（`uniqueId("timeline")` 随机生成）对齐，否则连不上。

---

## 9. 可直接用于作品集展示的页面

按「视觉自洽 + 开箱即跑 + 无半成品观感」：

1. **朋友圈 Demo**（`?demo=1&start=moments`）— 最高展示价值：hero 半屏封面、九宫格、点赞/评论、沉浸式 overscan 都在正式壳里跑，且 console 无报错、发布按钮不踩 Home Indicator。**但它是 Demo，文案应说明「演示态」**。
2. **Mercury 系统壳**（锁屏 → 动态岛 → 控制中心 → 通知中心 → 桌面 → 应用切换器）— 系统交互最完整，最能体现「OS 而不是页面」。
3. **Archive**（导入 JSON → 识别分块 → 角色/世界/Prompt Module → Runtime Check）— 唯一数据能存下来、最能体现「产品纵深」的功能，工程完整度高（错误处理、重试横幅全有）。
4. **Chat · 会话页 + Me + Profile & Appearance** — 视觉完成度高，适合展示「聊天壳 + 个人资料」的质感；但**进入前建议配好一张 provider 连接**或说明「演示用静态消息」。
5. **Settings · AI Connection** — 真实可测试连接，适合技术面试展示「本地代理 + 凭证隔离 + provider 测试」的工程考量。

**不建议直接拿出去**：Usage & Costs 空状态、Settings 5 个 coming soon 行、Contact Profile 的 4 个空回调、桌面未注册图标 —— 这些暴露半成品。

---

## 10. 下一阶段开发路线图

基于「停止新增功能、全面审计」后最能提升产品价值与一致性的路径。**原则：连接 > 新建；先消假入口，再开新功能。**

### P0 — 收口：消灭「看起来可点但无反应」的入口（1-2 个迭代）
1. **统一跨 App 跳转**（**✅ 2026-08-02 已完成首批**）：新增系统级 `launchApp` 桥（`system-services` facade → `main.js` 注入的 `launchBridge`，遵守「App 不驱动系统导航」约束）；Me 里 Archive 与 AI Connection 已接（后者为 Settings 深链，Settings 支持 `render/onResume` 的 `payload.route`）。其余（Wallet / Appearance / Notifications / Data & Privacy）按用户决策暂缓，等基础聊天成熟。
2. **小组件 onClick**：给 Lumi/Moments/Memory/Customize 四个小组件接上点击（demo 开朋友圈，其余开对应页）；无适配器时隐藏/降级（未做，留待）。
3. **桌面未注册图标**：显示「即将推出」Toast 或直接不渲染，避免静默无反应（未做）。
4. **删死代码**：**✅ `legacyMeView()` 已删除**。

### P1 — Runtime 垂直切片（最高产品价值，对应 `development-handoff` P2）
把已经写好的 `compileRuntime()` **真正接进 Chat 的 `requestAssistant()` → `aiTransport.chat()`**，让「Archive 的 RuntimeProfile / 用户 Preset → compiledSystemText → `/api/chat` → AssistantTurn」成为可审计闭环。这条线穿过 Chat、本地代理、真实 provider 与 Archive，是核心价值的唯一证明。暂不做群聊/世界书触发。

### P2 — 统一美化中心 + 联系人建模（前瞻性基建）
1. **单一 Presentation Asset 模型**：把 Chat experience、Archive、未来朋友圈封面的所有外观字段收敛到一个 Asset/Presentation store（解决 §8b）。
2. **Canonical 联系人模型**：决定 `ContactInstance` 何时、如何进入 Chats；统一 Archive `displayName` 与 Chat 联系人（解决 §8a、§8c、§8d 中与联系相关的部分）。先冻结三条规则再做 UI（`development-handoff` §P0 三问）。

### P3 — 用共享骨架补完占位页（在 §7 合并基础上）
- 用统一「设置页骨架」补 Settings 5 行 + Contact Profile 4 项 + Proactive messages。
- Wallet / 消息媒体等，作为独立任务页，**不要复制设置页布局**。

### P4 — 独立工具与金融玩法（最后、可视内容而定）
Camera / Music / Calculator / Timer / Market。需要 App Engine 注册 + 桌面图标接线。

### 每阶段质量门（延续 `development-handoff` 不变）
- 只认正式壳内截图，不认 `design-prototypes` 静态页。
- `npm test`、`npm run build:production`、`npm run audit:production` 需留记录。
- Git 元数据判定为不可用是一项**环境门禁**，在恢复有效 `.git` 前不做发布声明。

---

## 附：审计核对记录

- 注册 App：`settings`、`mercury-chat`、`archive`（`main.js:19-21`）。
- Server 端点：`/api/chat`、`/api/provider/test`（`server.js:50`），仅此两 POST；其余为静态文件。
- Demo 隔离：`build-production.cjs` 排除 `tests`,` .local-demo`；`audit-production.cjs` 扫描 `.local-demo`/demo token。
- 测试：`app/tests/` 22 文件，settings 单测 74 个断言调用点（静态计数，非运行时总数）。
- 未修改任何文件。
