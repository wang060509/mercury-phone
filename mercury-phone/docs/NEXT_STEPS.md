# Mercury Phone 任务地图

更新日期：2026-09-06。当前授权以本节为准；旧候选保留为 deferred context。

## NOW

### Final Safe Cleanup 与 Alpha freeze

- **当前状态**：已完成（2026-09-06）。Cinema Alpha Closure、Batch A、私有 GitHub recovery baseline、clean-clone/rebuild 验证、证据驱动的 Final Safe Cleanup 与清理后 checkpoint 均已闭合。
- **边界**：不继续做机会式删除、目录重排或架构重构。`reference-sources`、大体积 prototype/capture、浏览器状态、缓存、旧 ZIP 和机器本地文件继续排除在远端之外。

### Customization Pattern Audit — no implementation yet

- **当前状态**：下一阶段，只授权模式研究、对比与边界审计；尚未授权 production implementation。
- **研究轨道**：Character authoring、World authoring、Visual customization、Performance-level customization。先对照成熟产品的资产创建、绑定、override、默认值、版本与恢复模型。
- **输出要求**：先明确 domain ownership、用户 authority、默认值、迁移/恢复和 presentation-only media 边界，再决定最小实现切片。
- **后续实施纪律**：获得明确施工批准后，才生成视觉 reference，并以真实 390x844 逐屏 Gate 实现。不得重开 Phase 2D 或 Cinema Closure，不得让 presentation media 成为叙事运行必需输入。

## DEFERRED BACKLOG

### Web/PWA 主交付与生产 API 连接架构

- **状态**：产品方向已由用户确认；API-01 已完成，生产 Stateless Relay 尚未实现。目标为 HTTPS Web/PWA + 浏览器本地数据 + 用户自带 AI Connection + 同源 Stateless Relay，原生包只保留为以后可能的薄包装。
- **审计结论**：Mercury 的 Provider 广度较窄，但 Chat 主链不是玩具实现：统一真实 Test、会话凭据、endpoint 归一化、请求合同、超时/取消、错误分类/脱敏与 Chat Generation Workflow 已闭环。参考项目的复杂度主要来自多 Provider、多用途 API、工具/图片/语音和调试面板，不能整体照搬。当前 P1 是生产安全与 Interface 深度，不是增加设置项。
- **API-01 已完成**：Cinema 只调用 `generateCinema()`；`readCredential/postLocal` 已降为 AITransport 私有 Implementation；能力默认超时与响应验证不再泄漏给 workflow；四个 `/api/*` 高层消费者均覆盖预取消 `AbortError` + 0 fetch，Cinema 另有只依赖高层 Interface 的 workflow 测试。
- **下一实现顺序**：① API-02：建立 Provider Network Policy Module，补 DNS/IPv4/IPv6/重定向/流式响应上限/无敏感日志合同；② API-03：补部署 Adapter 的 rate/concurrency/origin/host policy 与真实 `/api/*` smoke；③ PWA-01：manifest、Service Worker 缓存/更新、安装提示和离线壳；④ 真实手机 HTTPS 验证首次打开、添加主屏、升级、断网壳、连接测试、Chat、取消/重试和本地数据保留。
- **可用性后续**：生产连接稳定后，再根据真实用户证据评估“拉取模型 + 手动模型回退”和少量命名连接预设；自动主备切换、按功能分配 API、原生 Anthropic/Gemini、流式与参数面板不进入当前 P1。
- **边界**：不借上线引入账户、云数据库、同步、原生 Provider、Model Parameters、流式 UI 或第二套 Chat 请求链；relay 不长期保存用户 Key、聊天或资源。
- **完成条件**：`release:check` 继续通过；静态资源与 `/api/*` 缓存边界明确；生产 relay 有请求体/超时/错误脱敏/上游 DNS/IP/重定向/响应体/滥用保护合同；真实手机生产域名完成 Settings Test、Chat 与至少一项非 Chat AI 消费者回归。

### 成熟小手机对照后的架构收紧

- **状态**：用户已确认把近期重心放在代码审核与功能实现，UI 继续作为独立的 taste/视觉迭代；Conversation Store、lifecycle、Release、Chat Generation Workflow（含 Connection Readiness 恢复）、Local Data Vault、Resource Intake Workflow 与 Conversation Transfer 切片已完成。
- **已完成**：成熟参考已按 Repository、消息合同、存储升级、恢复、导入导出、宿主生命周期、请求状态机、关键/延迟启动和运行时资源准入审计。Mercury 已将会话存储恢复、生成生命周期、本地数据治理、单资源跨 Store 导入事务、可携带会话往返和 App 资源准备移入独立 Module；完整纵向聊天矩阵、角色/世界/Profile/事件请求准入矩阵与 API-01 AITransport Interface 均已闭环。Archive 已成为首个 lazy App，完整回归为 64 files / 1974 assertions / 0 failures / 0 skipped。
- **下一实现顺序**：当前让位于 Web/PWA 与生产 API 连接闭环。只有生产请求数再次成为真实瓶颈时才审计第二个安全加载切片，Settings 作为 Chat 恢复入口默认保持 eager；全局恢复和 IndexedDB 媒体仓库继续等待独立证据，当前不启动后台同步。
- **边界**：每一步先补当前行为合同，再替换 controller 内同一条路径；不迁移框架、不引入双核心、不建立全局 DB singleton、不复制参考代码或命名。

### 外部 Generation Profile 剩余兼容边界

- **状态**：通用结构识别、旧 Profile 幂等升级和首个安全适配闭环已完成；当前真实档案为 32 项运行、47 个变量已适配、6 个模板项待处理、33 项保留。
- **目标**：扩大装配后的真实 Profile 已完成 API 输出回归；下一步分类剩余 6 个模板项与 33 个保留项，没有 Mercury 合同承接的内容继续保留。
- **边界**：不执行任意脚本、状态命令或禁用块；不增加平行 prompt lane；不改变 `compileRuntime()` 输出协议、角色、世界书、记忆或 Chat 边界。
- **验收**：每新增一种兼容语义都需要独立合成 fixture、越权/预算断言和 API 对照，不能因“来源项目支持”就直接启用，也不能加入文件名或样例特判。

### Chat Generation Profile 消费入口收口

- **状态**：已完成实现、自动测试与真实手机浏览器 QA；无需新的示意图。
- **实现**：当前会话摘要 + 单一选择列表 + Archive 管理跳转；Chat 不再重复展示导入、导出、编辑和“我的预设”管理区。
- **真实性**：真实导入样例显示 32 项运行、47 个变量已适配、6 个模板项待处理、33 项保留，不再用笼统“已生效”掩盖兼容缺口。

### Generation Profile UI-03 / UI-04

- **状态**：UI-02 已于 2026-08-19 获用户视觉确认；若恢复 UI 主线，下一候选阶段是 UI-03 Pressing Room，但当前按用户要求让位于代码审核与功能架构，且尚未收到 UI-03 的明确开始指令。
- **顺序**：Pressing Room → Tracklist / Profile Workbench。
- **边界**：Pressing Room 承载 Blank / Remix / Import，但不是普通 form；Workbench 是高频大型编辑器，不能用 slider-first 或普通表单替代。

## DONE

### 角色 / 世界 / Generation Profile / 事件的真实请求准入

- **状态**：已完成（2026-08-20）。
- **实现**：`compileRuntime()` 保持单一编译入口和既有优先级，为 Generation Profile 建立 16000 字符、角色运行档案建立 12000 字符的有序准入；角色身份/行为/边界/声音先于自由背景和 lore。世界书沿用 8 条/5000 字符，事件沿用三维 scope 下 Top-3/560 字符。
- **可观察性**：`resourceTrace.assembly` 统一报告四类资源 source/included characters、数量、上限、截断状态与最终 system prompt 字符数，不保存正文。Profile 装配的 inactive/compat warning 不再被 Chat 丢失。
- **验收**：新增 32 条自有 fixture 断言，直接通过 `buildAssistantRequest()` 覆盖正向、禁用/仅保留、未绑定/越 timeline、pending/session/superseded、预算和 memory disabled。该阶段完整门禁记录为 64 files / 1974 assertions / 0 failures / 0 skipped；生产审计记录为 155 files / 20.74 MiB、62 requests / 198.2 KiB Brotli。浏览器确认 Chat、Runtime Verification 会话和资源页正常，0 warnings/errors；未重发真实模型请求。

### Archive 按需启动与统一 AppLoader

- **状态**：已完成首个非首屏 App 切片（2026-08-20）。
- **实现**：新增 `MercuryAppLoader` 与 DOM Asset Adapter。Loader 只负责资源准备、definition 注册和激活请求；AppEngine 继续负责实例/lifecycle，state machine 继续负责前台转换。Archive CSS/JS 不再静态进入 `index.html`，首次启动按 CSS→有序 classic script→definition→register→activate 加载。
- **失败恢复**：同一资源 attempt 去重；失败不注册、不切换前台，并向用户显示可重试通知；失败 Promise 会清除以允许再次点击。全局 launch ticket 锁定 latest intent，慢加载 Archive 不会覆盖后来打开的 Settings。相对路径和 `script.async=false` 保持直接文件运行与脚本顺序。
- **参考结论**：吸收成熟项目的关键/延迟分层、资源分组、顺序、去重和重试；拒绝吞掉 CSS 错误、加载失败仍运行 App，以及启动后立即空闲预取全部资源。没有复制参考代码、命名、UI、资产、文案或私有字段。
- **验收**：59 files / 1872 assertions / 0 failures / 0 skipped。生产为 140 files / 19.65 MiB；eager local 从 63 降为 62 requests，Brotli 从 229.1 降为 196.6 KiB并回到 warning 内。真实浏览器确认首屏无 Archive CSS/JS、首次图标打开、Chat→Runtime Verification→完整人设深链与 0 console warnings/errors。

### 角色 / 世界 / Profile / 会话纵向 round-trip 矩阵

- **状态**：已完成（2026-08-20）。
- **实现**：新增不依赖 `reference-sources/` 的自有 fixture 测试，从角色、世界书和 Generation Profile 导入开始，经显式绑定、实际 request/trace 装配、可控 transport 回复与持久化，再导出 portable JSON、回导为独立 timeline，并在 fresh app reload 后再次装配。禁用世界条目保持排除。
- **修复**：Conversation Transfer 的 timeline 分配现在同时检查 Chat 私有正文和 shared session，避免覆盖只有场景/设置的空会话；Chat 对回导结果显示持久成功回执，明确缺失世界书、缺失 Profile/default fallback 与角色重绑定，并提供“检查资源”动作。
- **验收**：完成时为 58 files / 1828 assertions；后续当时总门禁记录为 64 files / 1974 assertions / 0 failures / 0 skipped。生产审计通过。真实手机浏览器使用私有隔离样例完成角色、世界书和 Profile 的安全审核导入、会话绑定、刷新持久化、portable 导出/回导和本地资源恢复，0 console errors；本轮没有再次调用真实模型。

### 角色导入后的连续可玩路径

- **状态**：已完成（2026-08-20）。
- **实现**：Resource Intake outcome 明确返回提交来源、目标 ID 与提交后同名数量；Chat 使用当前 UI state 保存非瞬时成功回执，联系人选择页将刚导入角色置顶/高亮。重名显示 Archive SourceAsset 文件来源，同文件重复导入追加 Mercury 自有“副本 N”。
- **开场恢复**：元数据/目录型首条保持过滤且记录原因，安全备选继续可选；0 个可用开场时回执和场景页均提供空白聊天动作，创建 0 条消息的独立 timeline，不自动伪造问候。
- **验收**：完成时为 57 files / 1781 assertions；后续当时总门禁记录为 64 files / 1974 assertions / 0 failures / 0 skipped。真实手机浏览器中含多备选卡可选择安全开场并完成同源副本识别；无开场卡会进入 0 消息且输入框可用的空白会话；0 console warnings / 0 errors。

### Chat Connection Readiness 与失败恢复

- **状态**：已完成（2026-08-20）。
- **实现**：AITransport 提供不含 Key 的同步 readiness；Chat Generation Workflow 在需要真实生成的 send/retry/regenerate 写入前预检。配置失败保留草稿或原失败 turn，Chat 显示安全原因、“前往 AI 连接”和可见重试；网络/模型失败沿用原 turn 恢复。
- **边界**：不共享跨标签页 Key，不向 Chat 暴露 credential facade，不在 controller 建第二条发送路径；错误状态切换 Conversation Scope 时清除。
- **验收**：新增 30 条全量断言增量；该阶段总门禁记录为 64 files / 1974 assertions / 0 failures / 0 skipped。真实浏览器确认消息数 4→4、草稿跨 reload、两个文字动作、AI 连接深链路、重复预检不落库与 0 console errors。

### Chat Conversation Transfer

- **状态**：已完成当前单会话可携带切片（2026-08-19）。
- **实现**：`MercuryConversationTransferContracts` 区分版本化 portable JSON 与不可再导入的可读文本，预检 ConversationV2、会话设置、重复消息、文件尺寸和场景上下文，并把运行中 delivery/status 归一化为稳定记录。`MercuryConversationTransferWorkflow` 通过 `export / inspect / commit` 将导入绑定到用户当前选择的本地联系人，始终分配新 timeline，不覆盖来源会话。
- **资源与事务边界**：角色、世界书与 Generation Profile 仍是独立资源；会话导入只恢复本地确实存在的世界书/预设，角色档案与世界变体重新绑定到目标联系人。正文位于 Chat 私有 storage，会话设置位于 shared storage；工作流显式跨两个 Adapter 捕获旧值并补偿回滚。外观、草稿、未读、置顶、设备 secret、API 设置、事件库与派生索引不进入聊天文件。
- **验收**：新增 50 条合同/工作流断言，并扩展 Chat app round-trip。覆盖损坏 JSON、错误 kind/version、重复消息、多段用户富媒体、运行中状态、私有正文/shared session 两侧的冲突 timeline、缺失资源降级、目标联系人重绑定与跨私有/共享 storage 回滚。真实页面已确认三个入口及“可再次导入 / 仅供阅读 / 新建会话”语义；该阶段总门禁记录为 64 files / 1974 assertions / 0 failures / 0 skipped。

### Resource Intake Workflow

- **状态**：已完成当前单资源事务切片（2026-08-19）。
- **实现**：新增无 DOM `MercuryResourceIntakeWorkflow`，以 `inspect / commit` 统一预检交接、重复资源 ID 分配、Archive/Profile/Chat 写入计划和补偿回滚。Archive 的 library 目的地不会自动创建联系人；Chat 目的地只接受有效角色卡，并一次建立来源资产、角色档案、嵌入世界书、联系人实例和 Chat 联系人。
- **不变量**：Resource Contracts 不写数据；controller 不编排跨 Store 顺序；重复导入不覆盖既有角色/世界；失败区分格式、提交和回滚；Chat 生成请求状态仍由 Chat Generation Workflow 独占。
- **验收**：新增 31 条 Interface 断言，并复用 Archive/Chat/Runtime 回归覆盖实际入口。该阶段总门禁记录为 64 files / 1974 assertions / 0 failures / 0 skipped；生产审计通过。

### Local Data Vault 与存储健康

- **状态**：已完成当前导出切片（2026-08-19）。
- **实现**：新增 `MercuryLocalDataVault`，以 `snapshot / createBackup` 统一规范/旧版数据、动态会话键、脱敏连接偏好、设备 secret、session credential、派生索引、模型缓存和未知 Mercury 键。System Services 明确暴露 `persistent / volatile`，Settings 的“数据与隐私”现可显示可写性、浏览器用量和备份范围，并下载版本化本地备份。
- **安全不变量**：API Key 与设备密码不导出；向量索引和模型缓存可重建、不导出；未知 Mercury 键只报警；无法脱敏的连接记录跳过；健康探针不覆盖或删除用户键；易失模式仍允许立即导出当前页内数据。
- **边界**：全局 restore/clear 尚未开放，必须等待独立预检、分域事务、受保护键、失败回滚和 reload 合同。真实浏览器已完成 Settings 路径、实际配额与按钮成功反馈验收。
- **验收**：新增 43 条 Vault Interface 断言，并扩展 System Services 与 Settings 回归；该阶段总门禁记录为 64 files / 1974 assertions / 0 failures / 0 skipped。

### Chat Generation Workflow

- **状态**：已完成（2026-08-19）。
- **实现**：新增无 DOM `MercuryChatGenerationWorkflow`，以 `start / cancel / snapshot` 统一 send、retry、regenerate；controller 只提供持久化 host Adapter、生成 Adapter 和 presentation 更新。删除 controller 内三套重复的 active request、Abort、迟到响应与失败落盘流程。
- **不变量**：需要真实生成的操作先做同步 Connection Readiness，配置失败不落盘；预检通过后用户 turn 先落盘。每个 Chat 实例仅一条 active generation；取消立即 abort；每次异步返回检查 request + conversation + contact/timeline scope；网络阶段失败/取消重用原 turn；重新生成保留后续记录和完整版本；post-commit effect 失败不反转回复。
- **验收**：workflow Interface 为 68 条断言调用，覆盖预检、成功、并发拒绝、失败、重试、取消、迟到响应、scope 变化、存储失败、effect 失败和非破坏式重新生成。该阶段总门禁记录为 64 files / 1974 assertions / 0 failures / 0 skipped。

### Release Module 与体积门禁

- **状态**：已完成（2026-08-19）。
- **实现**：新增 `build:production`、`audit:production`、`release:check` 和版本化 `release-budget.json`；构建排除测试、local demo 与 37.65 MiB 未引用本地字体，但保留 `app/` 原始资产。正式 Chat 不再硬编码 demo route，而通过通用 presentation Adapter slot 消费入口。
- **验收**：该阶段 `dist/` 记录为 155 files / 20.74 MiB，JS 967.1 KiB、CSS 352.3 KiB；eager local entrypoint 为 62 requests / 981.1 KiB raw / 239.7 KiB gzip / 198.2 KiB Brotli。硬预算和当时 64 files / 1974 assertions 全部通过；最新生产基线见本文 NOW 与 `CINEMA_ALPHA_BASELINE.md`。

### UI-01 Generation Profile Record Cabinet

- **状态**：已完成并于 2026-08-18 通过用户视觉确认。
- **实现**：1:1 square sleeve、独立圆形唱片与封套层级、MERCURY / MINE / IMPORTED 同页 shelf/cabinet、currently used 状态、用户/导入入口、长按管理与抽取过渡；已去除 Cover 悬浮省略号与普通 Card Grid 语法。
- **验收**：自动测试、真实手机竖屏截图、参考图对照 QA 与用户视觉确认均通过。

### UI-02 Generation Profile Detail

- **状态**：已完成并于 2026-08-19 通过用户视觉确认。
- **实现**：正式详情页已接入 `MercuryGenerationProfileFlow` 并替换旧 `module-editor` 表单；沿用 World Book Detail 的 Archive design system，提供唱片 Hero、真实 runtime/兼容/会话统计、Core Profile 摘要、最多六项 Tracklist 只读预览、Chat 引用、基础信息和既有管理动作。
- **验收**：自动测试、真实手机顶部与滚动底部截图 QA、只读字段与 Playback 隔离检查及用户视觉确认均通过。

### API Key 当前标签页会话桥接

- **状态**：已完成（2026-08-18）。
- **实现**：Settings 输入同步到 session credential store；AITransport 优先使用当前标签页凭据，长期 storage 仍仅在用户开启“记住 API Key”时保存 Key。
- **验收**：覆盖真实 AITransport 读取、Settings 重建、关闭长期保存后的会话延续、Chat facade 隔离和长期 storage 无 Key。

### Relay 凭据字段结构校验

- **状态**：已完成（2026-08-18）。
- **实现**：凭据防泄漏只检查字段名，不再扫描 Generation Profile、角色、世界书、记忆或消息正文中的关键词。
- **验收**：自由文本包含 `secret/credential/authorization/apiKey` 可正常到达 provider；顶层与嵌套凭据字段仍被拒绝；真实 Chat 最小消息和三条 Profile 质量测试均成功。

### 外部 Generation Profile 安全变量适配

- **状态**：已完成首个闭环（2026-08-18）。
- **实现**：新增独立纯文本宏适配器；只读取启用的赋值块，支持局部/共享文本变量、`user`、`char`、`newline`，未知宏原样保留并进入诊断。
- **验收**：真实样例已安全展开 47 个来源变量，未复制来源内容进代码或测试 fixture；扩大装配后的场景、角色连续性和提示词边界三条真实 API 样例通过。完整测试为 48 files / 1398 assertions / 0 failures / 0 skipped。

### 外部 Generation Profile 通用导入识别

- **状态**：已完成第一版（2026-08-18）。
- **实现**：按结构与能力识别常见 prompt collection、message list、instruction block、简单指令字段和参数型 JSON；角色卡与世界书强类型优先；来源、未知字段、参数和不等价块保留。旧外部 Profile 会按兼容修订号升级，重复导入不会覆盖已有 Profile。
- **验收**：合成 fixtures 覆盖嵌套 wrapper、对象映射、顶层数组、部分损坏、参数型文件、资源类型优先级和无关合法 JSON；私有参考目录只读批量预检中 6 份预设通过，两份无关 JSON 明确拒绝。

### Chat Generation Profile 紧凑选择器与兼容状态

- **状态**：已完成（2026-08-18）。
- **实现**：管理与消费分层；session binding 保持原合同；诊断只读，安全适配只改变 outgoing assembled prompt，不改写来源或 Store。
- **验收**：相关单元/集成测试和完整 `npm test` 通过；真实手机视口导航与控制台检查通过。

### Generation Profile 事实源与 Runtime Checkpoint 1

- **状态**：已完成（2026-08-17）。
- **实现**：新增唯一共享 `generation-profiles.v1`；旧 Chat UserPreset 与 Archive promptModules 只读幂等迁移；按来源判断独立 Profile，混合/歧义模块归并为 Instruction Blocks；`preset-default` 永久只读；Chat Runtime 切换到共享 Store。
- **验收**：迁移分组、保留 ID 重映射、旧键零写入、写失败内存回退、封面不入 prompt、旧全局模块停用与显式 Profile 生效均有自动测试；`compileRuntime()` 输出协议不变。

### 世界书权限与世界变体语义

- **状态**：已完成（2026-08-16）。
- **实现**：导入边界保留 visibility、角色授权、worldVariant 和 timeline；运行时按绑定、scope、可见性、关键词/常驻/历史和预算顺序装配，并将实际结果写入 request trace。
- **验收**：`resource-contracts.test.js`、`worldbook-runtime.test.js`、`runtime-context.test.js` 覆盖正向、禁用/越界、权限隔离、无档案角色显式绑定和 prompt/request trace。

### 世界书自动验收矩阵与参考兼容性审计

- **状态**：已完成（2026-08-16）。
- **实现**：新增 `worldbook-acceptance-matrix.test.js`，覆盖命中/历史、无命中、可见性、variant/timeline、重复条目和预算；参考目录只读批量预检与运行时探针不写入正式代码或存储。
- **验收**：4 个嵌入世界书与 1 个独立世界书完成批量探针；默认预算、命中候选和空关键词旧式条目均有结果记录。

## NEXT

### API provider adapter 与真实连接验证

- **状态**：已完成（2026-08-18）。
- **实现**：Settings → AITransport → relay → provider adapter 成为唯一测试链路；Chat 和角色分析复用同一 adapter。模型发现可失败降级，成功状态由所选模型最小真实生成决定。
- **验收**：49 files / 1429 assertions / 0 failures / 0 skipped；真实浏览器 Settings 显示连接成功，随后 Runtime Verification 会话返回“回归通过”。
- **防复发**：禁止把 `/models` 2xx 当作聊天可用，禁止 Settings 自建 provider 请求，禁止在多个业务模块重复拼接 endpoint 或解析上游错误。

### 公开链接与凭据方案盘点

- **状态**：交付边界已于 2026-08-20 确认；生产构建与 `dist/` 同步已完成，PWA 壳、公开托管和生产 relay 尚未完成。
- **目标**：在已确认的“Web/PWA + 浏览器本地数据 + 用户自带连接 + 同源 Stateless Relay”边界内，完成 API 凭据、上游 relay、CORS、HTTPS、缓存、更新和生产连通性。
- **相关文件**：`package.json`、`deploy.config.json`、`server/`、`app/core/ai-transport.js`、`app/apps/settings-app.js`。
- **依赖**：仍需在具体托管平台落地无状态函数/Worker；不能把 Key 长期写入服务端，也不能把浏览器直连任意上游当作通用可用性保证。
- **风险**：高，涉及凭据与网络安全。
- **完成条件**：保留现有 `release:check` 门禁，补部署说明、凭据风险声明、PWA 安装/更新与静态资源缓存策略、relay 生产安全合同和真实 `/api/*` 最小连通性测试。

### 事件记忆真实设备验收

- **目标**：验证本地模型首次加载、失败回退、缓存、清理、备份/导入、模型版本不匹配和召回精度。
- **相关文件**：`app/core/local-embedding-runtime.js`、`app/system/vector-memory-store.js`、`app/core/vector-memory-contracts.js`、`app/apps/mercury-chat-app.js`。
- **依赖**：真实浏览器、网络、足够存储；需要自有 benchmark 数据。
- **风险**：中到高，下载体积、浏览器配额和角色体验都受影响。
- **完成条件**：关键词和语义两条路径均有可复现实测；失败不会扩大 prompt 或阻断聊天。

## LATER

### 角色与会话实例成熟化

- **目标**：角色版本、回滚、分类搜索，以及同一角色多个会话实例的安全覆盖字段。
- **相关文件**：`app/core/archive-contracts.js`、`app/core/chat-experience-contracts.js`、Archive/Chat UI 与测试。
- **依赖**：先冻结覆盖字段的权威边界。
- **风险**：高，本地既有数据迁移风险。
- **完成条件**：编辑角色不会静默篡改已有会话；版本可追踪、可恢复。

### 正式主题系统

- **目标**：把既有 `theme:requested` 接缝变成可验证的主题变量与独立主题数据格式。
- **相关文件**：`app/styles/tokens.css`、`app/main.js`、`app/system/system-services.js`、设置与相关测试。
- **依赖**：先确定主题包范围与安全的自定义样式边界。
- **风险**：中，容易影响全局可读性和页面布局。
- **完成条件**：主题仅改变呈现；切换、刷新、导入失败和回退都可验证。

## DO NOT START YET

| 工作 | 原因 |
| --- | --- |
| 群聊、语音、钱包、市场或新的大型小程序 | 当前核心资源/运行时/部署验收尚未收口，会分散数据与 UI 边界。 |
| 服务端账户、同步或共享记忆 | 先完成生产凭据和隐私方案。 |
| 大规模替换 UI、框架或存储技术 | 会掩盖当前运行时问题，并增加迁移风险。 |
| 自动从任意聊天提取长期记忆 | 当前决定要求用户确认和明确 retention，不能绕过。 |
| 把导入来源、整段聊天、世界书或预设直接塞进向量索引 | 违反当前记忆证据边界。 |
| Pressing Room、Profile Workbench、Playback | UI-01 与 UI-02 已通过；UI-03 Pressing Room 尚未获得新的明确开始指令，Workbench 与 Playback 仍须等待前序阶段确认。 |
| Global / Contact / Session inheritance 与高级 Model Parameters | 产品边界已确定，但本阶段未实现，不得与 UI 返工混在一起。 |
