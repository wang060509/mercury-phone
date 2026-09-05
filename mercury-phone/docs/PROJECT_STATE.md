# Mercury Phone 当前状态

更新日期：2026-09-06。本文件基于 `app/`、`server/`、`package.json`、测试与当前运行脚本盘点；状态标记为：**已确认**、**部分实现**、**计划**、**未知**。

## 产品方向

**已确认**：Mercury 是一个以手机壳为主要体验的角色聊天原型。它将角色档案、世界书、玩法预设、会话体验、关系事件和消息记录分层，目标是让这些资源在聊天运行时按明确边界组装，而不是把静态资源误称为已影响模型输出。

**已确认**：Generation Profile 是 Archive 拥有的共享生成资产，不是 Chat 私有 preset。Archive 的产品结构是 Characters / World Books / Generation Profiles；Chat、Diary、Moments、Offline、Cinema、Character Phone、Forum 等只消费 Profile，不拥有 Profile。

**已确认现状**：项目当前是浏览器端应用；开发环境聊天请求通过本地 Node 中转转发到兼容的聊天服务。用户数据默认落在浏览器存储中。

**已确认目标**：Web/PWA 是主要交付形态。用户通过 HTTPS 链接打开，并可安装到手机主屏；用户业务数据继续保存在各自浏览器，模型连接由用户自带。生产聊天通过同源 Stateless Relay 转发；它不得长期保存 Key 或业务数据。原生/Android 包只保留为以后可能的薄包装，不是当前并行产品或构建基线。可重复生产构建已完成，PWA 壳、公开托管与生产 relay 仍未完成。

**当前恢复基线**：Chat 与 Archive Alpha 已冻结，Cinema Alpha 生命周期已完整闭合至 Credits、History 和 Programme Archive Index。2026-09-06 Batch A 已完成 production 合包、正式 Playwright 门禁、Store ownership 修正、Draft 写入合并与字体/许可可复现化。最新完整门禁为 `86 files / 3055 assertions / 0 failures / 0 skipped`；`dist/` 为 `169 files / 22.63 MiB`。Cinema Closure 无后续施工项；私有远端恢复基线和安全清理完成后，下一产品阶段是 Customization 的研究、视觉 Gate 与分批实现。

## 应用与页面

**已确认**：`app/index.html` 加载系统壳、三个注册应用和本地演示适配器。

| 区域 | 当前页面或能力 | 状态 |
| --- | --- | --- |
| 系统壳 | 锁屏、密码输入、桌面、状态栏、灵动岛、控制中心、通知中心、应用切换 | 已确认 |
| 聊天 | 会话列表、新建会话、会话、历史搜索、联系人、联系人主页、角色资料、Me、聊天美化、当前会话设置、资源设置、场景库、会话 Generation Profile 紧凑选择器、语义记忆、事件记忆 | 已确认 |
| 档案馆 | 角色、来源导入记录、Generation Profile UI-01 唱片柜、世界书书架/索引/条目编辑、角色资料编辑 | 已确认；UI-01 已于 2026-08-18 通过用户视觉确认 |
| 设置 | AI 连接、用量展示、数据与隐私、设置首页 | 已确认；数据与隐私可诊断本地存储并导出脱敏备份，其余部分条目没有独立页面 |
| 动态 | 本地演示适配器提供的入口与视图 | 部分实现，仅演示数据边界 |

## 已实现且有代码/测试支撑的能力

- **资源契约与导入**：`app/core/resource-contracts.js` 可预检 JSON 与带嵌入元数据的 PNG 角色卡；可识别 Mercury 自有资源、兼容角色卡、世界书，以及常见的 prompt collection、message list、instruction block、简单指令字段和参数型外部预设。识别依据是结构与能力，不依赖文件名或某份样例；无法证明是预设的合法 JSON 会明确拒绝。角色卡导入可提取嵌入世界书；预设会保留暂不进入当前系统指令槽的块、参数、未知字段与原始来源，以便诊断和兼容导出。Resource Intake 提交结果现在返回稳定的 Mercury outcome；Chat 将它呈现为不自动消失的成功回执、刚导入角色置顶/高亮与来源标记，同源重名使用 Mercury 自有副本序号。开场首条和安全备选分开判定；没有可用开场时明确允许进入不伪造角色消息的空白会话。
- **Resource Intake Workflow**：`app/use-cases/resource-intake-workflow.js` 以 `inspect(input) / commit(stage, options)` 统一 Archive 与 Chat 的导入提交。Resource Contracts 只预检，Workflow 负责重复 ID 分配、来源/角色/世界/Profile/Chat 联系人的完整写入计划与补偿回滚；`library` 导入不会创建 Chat 联系人，`chat` 导入只接受有效角色卡。Archive 或 Chat 后续写入失败时恢复已捕获键，恢复本身失败会单独报告，不再把部分写入当成功。
- **档案模型**：`archive.v1` 存来源资产、运行时角色档案、世界书、旧提示模块迁移来源和联系人实例。旧 `promptModules` 保留只读，不再接受产品写入或形成独立运行时通道。
- **联系人与会话**：聊天体验状态将联系人、会话设置、外观、资源绑定、场景上下文、草稿、静音/隐藏/置顶等分开存储。`MercuryConversationStore` 现统一负责 `contactId + timelineId` 的兼容键、V1→V2 迁移写回、损坏回退与存储错误分类；默认联系人与导入联系人不会共用消息存储键。迁移写回失败时规范化结果仍可在当前会话使用，自动恢复不会静默覆盖损坏源。
- **聊天纵向闭环**：自有 fixture 矩阵已贯通角色、独立世界书与 Generation Profile 导入、显式会话绑定、实际 request/trace 装配、生成结果持久化、portable export、独立 timeline 再导入和 fresh app reload 后再次装配。禁用世界条目不会进入请求。Conversation Transfer 的 timeline 冲突检查同时覆盖 Chat 私有正文键与 shared 会话键，避免覆盖只有场景/设置、尚无正文的现有会话；导入结果会在目标会话显示持久回执，并明确列出缺失世界书、缺失 Profile 与角色重绑定等降级结果。
- **聊天与运行时**：`MercuryChatGenerationWorkflow` 现通过 `start(command) / cancel() / snapshot()` 统一发送、连接可用性预检、取消、失败、重试、非破坏式重新生成、消息版本与送达状态；聊天控制器只翻译用户意图、装配生产 Adapter 和渲染状态。需要真实生成的发送/重试/重新生成会在任何会话写入或 delivery 改动前同步检查当前标签页的 Connection Readiness；配置失败保留草稿或原失败 turn。引用、复制、编辑、删除、图片与表情部分、心声分离及非流式回复继续由现有交互层承担。`buildRuntimeInput()` 从核心规则、角色档案、选中世界书、共享 Generation Profile、会话体验、场景上下文和召回事件构建 `compiledSystemText`。`compileRuntime()` 对用户可导入来源执行 Runtime Resource Admission：Generation Profile 16000 字符、角色档案 12000 字符，世界书与事件继续沿用 8/5000 和 Top-3/560；`resourceTrace.assembly` 统一记录实际入场量与截断，不保存正文。
- **本地数据治理**：`MercuryLocalDataVault` 以 `snapshot() / createBackup()` 统一数据源清单、持久/易失模式、写探针、浏览器配额和备份范围。System Services 在 `localStorage` 不可用时明确标记 `volatile`，Settings 可显示真实状态并下载版本化备份。档案、会话、体验、Generation Profile、关系事件和通知进入备份；连接偏好先脱敏；API Key、设备密码、向量索引、模型缓存和未知键不导出。
- **世界书检索**：`app/core/worldbook-runtime.js` 依据启用状态、常驻标记、显式关键词/标题标签回退、最近消息、优先级与字符预算选择条目；兼容旧式空关键词全局条目，并在同一世界书内按稳定 ID 去重。限制最多 8 条、总计 5000 字符，并提供 raw candidate、去重后 candidate、duplicate、命中原因和预算警告 trace。
- **Generation Profile Checkpoint 1**：`generation-profiles.v1` 是跨 Archive/Chat 的唯一共享事实源。旧 Chat UserPreset 与 `archive.v1.promptModules` 只读迁移；同一独立 prompt 来源按来源聚合为一个 Profile，混合/歧义内容归入迁移 Profile 的 Instruction Blocks。`preset-default` 只存在于代码内置注册表，永久只读，只能 Remix。Chat Runtime 仍通过原 `userPreset` 槽装配，`compileRuntime()` 输出协议未改。
- **Generation Profile Workflow 基础**：`app/use-cases/generation-profile-flow.js` 是 Archive UI 与共享 Profile Store 之间的无 DOM use-case seam，已管理 Cabinet / Detail 转换、操作/封面 overlay、只读检查、cover draft 确认/取消、存储失败后的草稿保留与 reload route 修复。现有 Archive 页面已通过该 flow 驱动这些路径。
- **Chat Generation Profile 消费入口**：聊天页只保留当前会话摘要与一份 Profile 选择列表，完整创建、导入、编辑和资源管理统一回到 Archive。选择后仍写入既有 session binding，不新增第二套 Store 或运行时通道。
- **导入预设兼容适配与诊断**：`preset-compatibility.js` 只从启用块解释确定性的纯文本 `set/get var`，并允许 Chat 显式提供 `user`、`char` 与 `newline`；禁用块、状态命令、脚本和未知宏均不执行。`inspectPresetInstructions()` 只读派生真实状态，适配器只改变外部 Profile 的 assembled prompt，不改写来源或共享 Store，`compileRuntime()` 输出协议未改。
- **事件记忆**：确认的关系记录是证据源。长期事件有 `session/durable`、`active/superseded/expired/archived` 生命周期和联系人/世界变体/时间线三维 scope。关键词检索始终可用；IndexedDB 支持派生索引、清理、导出诊断、从长期事件备份重建。可选本地语义模型失败时回退关键词，不阻断聊天。
- **AI 中转**：浏览器把连接信息和请求发往 `/api/chat`、`/api/provider/test`、`/api/role-analysis` 与 `/api/cinema`；四者共用会话连接与服务端 OpenAI-compatible provider adapter。adapter 统一 Base URL/完整 endpoint 归一化、鉴权头、超时、安全错误和响应解析。`/models` 仅是可选发现，连接成功必须由当前模型的最小真实生成确认。角色分析是显式调用，不会自动分析来源资产。API-01 已完成：Chat、Settings Test、角色分析与 Cinema 分别只调用 `chat()`、`testConnection()`、`analyzeRole()`、`generateCinema()`；credential resolution、relay endpoint/payload 和默认超时留在 AITransport Implementation，`readCredential/postLocal` 不再属于公开 Interface，四条高层操作均锁定预取消 0 fetch 合同。
- **系统交互**：应用启动通过应用引擎和状态机，手势、返回/主页、锁屏、通知、应用快照和切换均有独立控制器与测试。App 生命周期合同现明确为 `onX(context, payload)`；Archive 的恢复深链路已按第二参数接收，并由 App Engine/Archive 回归锁定。
- **应用按需启动**：`MercuryAppLoader` 统一 eager 与 lazy App 的启动请求；AppEngine 继续独占注册后实例和生命周期。Archive 的 CSS/脚本已移出 `index.html`，首次启动按 CSS→有序 classic script→definition→register→activate 加载。并发启动共享资源 Promise，失败不会注册且再次点击可重试；全局 launch ticket 保证慢加载 App 不会覆盖用户后来的启动意图。Settings 保持 eager，继续作为 Chat 连接失败的关键恢复入口。

## 部分实现或需要谨慎描述的能力

- **语义记忆模型生命周期**：本地适配器会从网络动态加载模型运行时并下载模型，支持浏览器缓存；代码与降级路径存在，但真实设备上的首次下载、缓存、配额、模型升级和角色扮演质量尚未形成生产验收。
- **世界书可见性/范围**：世界选择按会话显式绑定或角色绑定工作；导入边界保留可见性、角色授权、世界变体和时间线字段。运行时先执行世界/条目 scope，再按 `objective/public/restricted/character-specific` 筛选，最后按关键词、常驻、历史和字符预算检索；trace 会记录实际 scope 与命中条目。未绑定世界、禁用、私有、越界或未获授权条目不会进入请求。
- **Generation Profile UI**：UI-01 Record Cabinet 已按确认方向重做为 1:1 LP sleeve + 独立圆形唱片结构，保留 MERCURY / MINE / IMPORTED 同页书架索引、真实 Store 数量、长按管理、抽取过渡及独立的新建/导入唱片入口；已移除封面悬浮省略号和普通 Card Grid 语法。Cover 仍是本地展示资产且不进入 prompt。UI-01 自动与浏览器 QA 已通过，并于 2026-08-18 获用户视觉确认。UI-02 正式 Profile Detail 已接入现有 flow，替换旧 `module-editor` 表单；自动与手机截图 QA 已通过，并于 2026-08-19 获用户视觉确认。Pressing Room、Tracklist / Workbench 与 Playback 尚未实现。详见 `GENERATION_PROFILE_UI_HANDOFF.md`。
- **外部预设语义兼容**：导入识别已从单一 `prompts + prompt_order` 扩展为按结构和能力规范化；旧浏览器 Profile 会按兼容修订号幂等升级，无需重新导入。当前浏览器内真实档案显示 32 项运行、47 个变量已适配、6 个模板项待处理、33 项保留，因此仍只能描述为“部分接入”。扩大运行块已通过场景、角色连续性和提示词边界三条真实 API 回归，但这不等于剩余模板/保留项已经生效。
- **Generation Profile 继承与高级能力**：最终目标是 Global → Contact → Session，优先级 Session > Contact > Global；当前仅有既有 session-level binding。Provider-agnostic generation parameters、Advanced user instruction blocks 和相关 UI 均未实现。Provider、Model、API URL、API Key 始终属于 Settings。
- **设置**：AI 连接、用量和数据与隐私页存在。API Key 默认通过当前标签页 `sessionStorage` 在 Settings 与 AI 消费者之间共享，关闭标签页后清除；只有用户主动开启“记住 API Key”才进入长期 `localStorage`。AITransport 另提供不返回凭据的 Connection Readiness 状态，供 Chat 在写消息前判断当前标签页是否缺 Base URL、Key 或模型；失败卡可直接进入 Settings → AI 连接并在配置后重试。连接测试与真实消费者共用连接解析和 provider adapter；它会实际调用所选模型，不再把 `/models` 成功误称为可聊天。数据与隐私页通过 Local Data Vault 显示存储健康、配额和备份范围，并可下载脱敏本地备份。设置首页其余部分入口并非都有独立实现；流式传输控件明确禁用。
- **动态演示**：`.local-demo/` 不直接使用聊天 API 或持久化数据；它是展示/交互样例，不能当作正式社交数据功能。
- **资源导出范围**：角色、世界书、预设和事件备份各有导出路径；Local Data Vault 已提供全局脱敏备份导出。Chat 现有版本化 portable JSON 与明确不可再导入的可读文本两条路径；portable import 完整预检后绑定到用户当前选择的联系人并新建 timeline，不覆盖来源记录。可恢复的本地绑定会自动恢复；缺少的世界书/Profile 会在导入回执中明确告知并提供资源检查入口。它不会打包角色/世界/Profile 原件、事件库、API 设置或派生索引；全局恢复、清理与统一迁移事务仍未实现。

## 未实现或仅计划

- 生产可部署的无密钥泄露架构、账户、同步、多设备恢复和服务器端存储。
- 流式模型响应。
- 已验证的本地语义模型下载与端到端角色扮演检索评测。
- 完整世界书权限语义、复杂条目关联和自动关系处理。
- 角色档案版本历史、回滚、搜索/分类和更完整的实例覆盖。
- 主题包格式、正式主题导入/导出与可靠的主题切换。`theme:requested` 接缝存在，但主题系统没有完成验收。
- 群聊、语音、钱包及其他 Me 页面中的未开放功能。

## 数据、存储和边界

**已确认**：默认持久化使用 `localStorage`，由 `MercurySystemServices` 加命名空间和 JSON 序列化；不可用时退回内存存储，并由 Local Data Vault/Settings 明确报告 `volatile`，不会再把当前页可用误称为跨刷新已保存。

| 数据 | 代码键或数据库 | 说明 |
| --- | --- | --- |
| 应用私有数据 | `mercury.app.<appId>.<key>` | 由系统服务隔离 |
| 跨应用共享 | `mercury.app.shared.<key>` | 档案与聊天体验使用 |
| 档案 | `archive.v1` | 来源资产、角色、世界、旧模块迁移来源、实例 |
| 聊天体验 | `chat-experience.v1` | 联系人、会话设置、资源绑定、草稿等 |
| 消息 | `conversation.v1` 或 `conversation.<contactId>[.<timelineId>].v1` | 会话记录 |
| 关系记录 | `relationship-records.v1` | pending/confirmed/dismissed 关系证据 |
| Generation Profile | `generation-profiles.v1` | 共享生成档案、Instruction Blocks、迁移 ledger；唯一长期事实源 |
| 旧用户预设 | `mercury.apps.chats.userPresets` | 只读一次性迁移来源，不再写入 |
| 通知 | `mercury.system.notifications` | 系统通知 |
| 语义索引 | IndexedDB `mercury-vector-memory` v2 | 派生事件索引及 meta，不是事实源 |
| AI 连接 | `mercury.app.settings.connection` | 长期保存地址、模型和用户明确选择记住的 Key；默认会话 Key 另存当前标签页 sessionStorage |
| 数据清单与备份 | `MercuryLocalDataVault` 内部 catalog | 同一清单驱动健康诊断、脱敏、包含/排除与未知键报警；不建立第二份数据 |

**已确认**：角色头像、主页背景和聊天背景可保存为 Data URL；这会占用浏览器配额。导入原始文本也会随档案资产保存。

## 前端、服务端与部署

- **前端架构已确认**：无框架的浏览器 JavaScript，IIFE 向 `window` 暴露模块；`index.html` 明确决定加载顺序。CSS 为原生样式表，聊天刷新样式在基础聊天样式之后加载。
- **服务端架构已确认**：`server/server.js` 是本地静态服务器和 API 中转，默认绑定 `127.0.0.1:5500`。`server/provider-adapter.js` 是当前唯一 OpenAI-compatible 协议边界；中转向兼容服务请求 `chat/completions` 与可选 `models`，默认要求 HTTPS，只有开发环境变量允许不安全本地地址。
- **生产构建已确认**：`npm run build:production` 从 `app/` 重建 `dist/`；`npm run audit:production` 检查内部/demo 隔离、未引用字体、部署目录、产物体积、shell 与 Cinema cold-open；`npm run release:check` 串联单元测试、production smoke、Cinema core E2E 和生产审计。当前 `dist/` 为 169 files / 22.63 MiB，生产 JS 1.24 MiB、CSS 474.0 KiB；shell 为 62 requests / 998.7 KiB raw / 243.3 KiB gzip / 201.1 KiB Brotli，Cinema cold-open 为 64 requests / 1.49 MiB raw / 361.6 KiB gzip / 284.0 KiB Brotli。硬预算全部通过，output-size、shell request-count 与 shell Brotli warning 保留。
- **主交付方案已确认、公开部署仍未实现**：目标是 HTTPS Web/PWA + 浏览器本地数据 + 用户自带 AI Connection + 同源 Stateless Relay。`dist/` 目前只包含静态前端，而真实 AI 能力依赖 `/api/chat`、`/api/provider/test`、`/api/role-analysis` 与 `/api/cinema`；仓库尚无 manifest、Service Worker、安装/更新流程、托管配置和生产 relay 安全验收，不能把 `dist/` 已生成描述成产品已经上线。
- **文件打开限制已确认**：通过 `file:` 打开时，AITransport 明确拒绝聊天并提示使用本地服务器。没有中转时 UI 可以运行，但真实模型聊天不可用。

## 消息保存与 hydration

**已确认**：需要真实生成的文本消息先通过同步 Connection Readiness 预检，预检通过后才把用户 turn 持久化并启动请求；配置缺失时不创建幽灵失败消息，草稿保持原样。已经进入网络阶段的请求仍先持久化用户 turn，随后以 `failed/cancelled/complete` 表达送达状态并复用原 turn 重试。打开会话时由独立 Conversation Store 加载 V2 会话合同；旧 V1/legacy 消息迁移为 V2。存储缺失时才使用内置起始对话，显式保存的空会话不会被起始消息重新填充。损坏会话回退为可用结果而不让页面崩溃，自动恢复不覆盖损坏源；迁移写回失败被分类并保留当前可读结果。Conversation Transfer 在导出/预检边界复用 ConversationV2，并将 sending/queued/processing/delivering 等瞬态归一化；导入跨 Chat 私有正文与 shared 会话状态补偿回滚。全局数据源清单、存储健康/易失模式和脱敏备份导出已实现；完整备份恢复仍未实现。

## 测试与检查

**已确认**：最新门禁实际执行 86 个测试文件、3055 条断言、0 failures、0 skipped，随后运行 production 390x844 Chat/Archive/Cinema smoke、Cinema core closure E2E 与生产审计。Generation Profile Checkpoint 1 的 46 files / 1316 assertions、早期 API/Archive 门禁和后续 Alpha freeze 数字只保留为历史里程碑，不代表当前总量。本轮不发送真实模型请求；网络层仍由确定性 adapter/fixture 回归覆盖。

**2026-09-02 Online Chat Alpha freeze**：现有在线 Chat 已完成 Alpha interaction polish，不再继续增加功能或做机会式重构。最终门禁为 `71 files / 2415 assertions / 0 failures / 0 skipped`；生产构建与审计通过。`390x844` 手机视口已验证长按消息操作面板、滚动取消、短按兼容、Quote 复用既有 composer 流程和 Escape/外部点击关闭，浏览器控制台无 warning/error。浏览器或系统硬件 Back 尚无专门集成，等待真实 Alpha 反馈后再决定是否处理。

**2026-09-03 Archive Alpha Closure Batch A/B**：导入确认页现展示共享 parser 已有的 fatal errors、warnings 与 compatibility migrations；fatal/invalid 资源无法确认或写入，warning-only 资源仍可继续。测试使用的第三方角色卡已替换为 Mercury 自有中性复杂夹具，生产与测试表面增加私有参考标识扫描。WorldBook 与 Generation Profile 在 Archive 现有操作路径中提供 canonical JSON 导出，并通过真实 export → import workflow 往返测试；未改 storage schema、WorldBook 关联语义、Chat/Cinema 运行时或延期项。最终门禁为 `71 files / 2450 assertions / 0 failures / 0 skipped`，生产来源审计通过；`390x844` 隔离端口实页验证 invalid/valid 导入状态和按钮可用性，控制台无 warning/error。

**部分实现**：`npm run snap <page>` 是截图检查工具，仅支持 `moments`、`presets`、`me`，会依赖本机 Chrome 调试端口与本地服务器；它不是全站视觉回归。

## 已确认风险与不可随意改变的边界

1. 不可把导入格式直接作为内部长期 schema；导入边界必须翻译为 Mercury 资源。
2. 角色核心、世界规则、玩法预设、会话呈现与记忆必须保持分层；主题不能改变角色选择、知识或动机。
3. 事件记忆只从用户确认的关系记录派生；不能把完整聊天记录、角色卡、世界书、预设或 API 设置塞进索引。
4. 每个事件索引、读取、删除、导出和重建必须带 `contactId + worldVariantId + timelineId`。
5. 聊天运行时只接收受限事件数据，不能把历史记忆当成指令。
6. 不显示未接入的能力，更不能声称静态资源已影响 API。
7. 隔离参考目录不得进入公开交付；当前工作区未检测到 Git 元数据，发布前还需要独立确认版本控制和清理门禁。
