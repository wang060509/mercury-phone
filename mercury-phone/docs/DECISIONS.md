# Mercury Phone 技术与产品决定

更新日期：2026-08-20。这里只记录能从当前代码或现有正式文档核实的决定。

## 工程工作方式

### 成熟基础设施先参考、再决定是否自研

- **当前状态**：已确认，2026-08-18 起执行。
- **适用范围**：Provider/API、导入兼容、存储与迁移、同步、流式协议、错误恢复、安全边界等已有成熟范式的基础设施问题。
- **必须先做**：阅读 Mercury 当前合同与测试；审计私有参考索引中允许参考的成熟小手机项目、公开实现与官方文档；提取功能分层、数据流、失败模式和验收方法，并先补关键合同测试。
- **借鉴边界**：只借鉴结构原则和交互闭环，不复制代码、命名、UI、资产、文案或私有字段。外部结构必须在 adapter/import 边界翻译为 Mercury 自有合同。
- **允许自主创新的重点**：玩法、产品信息架构、交互体验、视觉系统和美化能力。成熟参考是降低基础工程返工的基线，不是要求 Mercury 变成另一个项目。
- **偏离规则**：若有明确 Mercury 产品收益可以偏离成熟做法，但必须记录收益、风险、验证方式和回退方案；不得无证据地建立第二条平行链路。

### 以窄合同逐步拆 controller，不做框架式重写

- **当前状态**：已确认并持续实施；Conversation Store、App lifecycle、Chat Generation Workflow、Local Data Vault、Resource Intake 与 Conversation Transfer 切片已完成。
- **为什么**：新增参考实现同时展示了两类风险：跨语言/数据库分层在合同不完整时只会增加故障面，超大全局脚本则会让 DOM、存储、同步和恢复继续耦合。Mercury 当前合同与回归资产足够强，应利用它们逐条收紧真实行为，而不是更换框架。
- **实施顺序**：先用当前行为测试锁定输入、输出与失败模式；再新增单一职责的 store/use-case；然后只替换 controller 中对应路径；最后跑完整回归并更新交接。
- **必须保持**：现有存储 key、运行时输出、App 私有/共享边界和直接文件运行能力，除非另有迁移合同和明确用户授权。
- **下一优先级**：Archive/Chat 单资源导入事务、可再导入的 Chat Conversation Transfer、跨资源纵向 round-trip 矩阵与首个 Archive lazy slice 均已完成；下一步优先补剩余运行时验收，第二个加载切片必须重新审计且不得削弱 Settings 恢复路径。UI-03/04、同步、新数据库与全局恢复不随本决定自动启动。

### Chat 生成生命周期只属于一个 Workflow Module

- **当前状态**：已实现（2026-08-19）。
- **Interface**：Chat controller 只调用 `start(command)`、`cancel()` 和 `snapshot()`；发送、重试与重新生成共享同一 Interface，不再各自维护 `activeRequest/ui.pending/requestSequence`。
- **Implementation**：Module 统一管理会话级单飞、request id、Abort、每次异步返回后的当前请求/会话 scope 校验、用户 delivery 转换、助手落盘、失败恢复与非破坏式版本追加。
- **Adapter**：生产 host Adapter 负责读取当前 conversation/scope、经 Conversation Store 提交和接收状态/完成事件；生产 generation Adapter 负责记忆召回、运行时装配与 AITransport。测试使用内存 host 与可控 generation Adapter，因此 Seam 是真实可替换的。
- **必须保持**：用户消息在远程请求前提交；失败/取消只更新原用户 turn，重试不得复制；迟到响应不得写入；重新生成只替换选中 AssistantTurn 的 active version，不截断其后的记录；通知或记忆候选等 post-commit effect 失败不得反转已持久化回复。
- **边界**：Module 不拥有 DOM、文案、Provider 配置、运行时规则、存储 key 或视觉状态；流式协议尚未实现，不得借此决定未来流式 UI。

### 本地数据清单、健康与备份范围只属于 Local Data Vault Module

- **当前状态**：已实现（2026-08-19）。
- **Interface**：Settings 只调用 `snapshot()` 和 `createBackup()`；其他 App 不获得数据治理 facade，也不各自枚举浏览器存储。
- **Implementation**：Module 内部清单统一描述规范/旧版数据、动态会话键、需脱敏的连接偏好、设备密码、session credential、派生向量索引、模型缓存与未知 Mercury 键；同一清单驱动诊断和备份范围。
- **Adapter**：生产使用 System Services 的浏览器 Storage Adapter 和 `navigator.storage` 估算；测试使用内存 Storage Adapter 与可控估算 Adapter，保持真实 Seam。
- **必须保持**：`localStorage` 不可用时明确报告 `volatile`，不可再静默假装已持久化；写探针失败报告 `degraded`，不删除现有数据；API Key、设备密码、派生索引和模型缓存不得进入备份；未知 Mercury 键只报警，不盲目导出；无法安全脱敏的连接数据必须跳过。
- **边界**：当前版本只生成有版本号的本地备份，不实现全局 restore/clear。恢复必须另有格式预检、分域事务、失败回滚、受保护键和 reload 验收，不能把逐键写入伪装成原子恢复。

## 资源与运行时

### 资源导入提交只属于 Resource Intake Workflow

- **当前状态**：已实现（2026-08-19）。
- **Interface**：App 只调用 `inspect(input)` 与 `commit(stage, { destination })`；Resource Contracts 只识别/规范化，Store 只持久化，controller 不再各自编排跨 Store 写入。
- **Implementation**：Module 在写入前构造完整来源资产、角色、世界、Generation Profile 与可选 Chat 联系人计划；重复资源分配新 ID。`library` 目的地只入库，`chat` 目的地必须是有效角色卡并同时建立 Archive 联系人实例与 Chat 联系人绑定。
- **事务边界**：生产 Adapter 是多个版本化浏览器 storage key，因此使用补偿事务：提交前捕获相关键，失败时逆序恢复并 reload Profile Store。恢复失败使用独立错误码，不把半成功伪装成成功。
- **必须保持**：原始文本继续作为惰性来源资产保存；外部 schema 不成为内部长期 schema；导入成功不等于资源已被某个会话选中或进入 runtime；Chat 生成状态机仍由 `MercuryChatGenerationWorkflow` 独占。
- **边界**：当前事务只覆盖单次角色/世界/Generation Profile 导入，不授权全局备份恢复、覆盖式导入、新数据库、同步或 UI-03/04。

### 角色导入完成状态由 Workflow outcome 驱动，Chat 只负责连续呈现

- **当前状态**：已实现（2026-08-20）。
- **Interface**：`Resource Intake commit()` 返回不含外部私有字段的 Mercury outcome，稳定描述提交状态、目的地、来源资产、联系人/角色/世界 ID、显示名和提交后同名数量；Chat 不再从 DOM 或文件名猜测导入是否成功。
- **呈现规则**：成功回执保存在当前 Chat UI state，直到用户进入聊天或主动关闭，不使用自动消失 toast。刚导入联系人在新建对话选择页置顶并高亮；重名使用 Archive SourceAsset 的本地文件来源，不足以区分同一文件重复导入时追加 Mercury 自有“副本 N”。
- **开场规则**：首条与备选开场分别分类。来源说明/目录型首条不能自动成为剧情，但安全备选继续可选；完全没有可用开场时必须显示可行动状态并允许创建 0 条消息的空白会话，禁止伪造通用角色问候。
- **边界**：回执不是新的持久化资源、通知系统或导入 Store；副本标记不改外部角色名；开场分类不执行脚本、不自动更改世界书绑定，也不改变 Chat Generation Workflow。

### 可携带会话只属于 Conversation Transfer Contracts / Workflow

- **当前状态**：已实现当前单会话切片（2026-08-19）。
- **Interface**：Chat 只调用 workflow 的 `export(input, format)`、`inspect(rawText)` 与 `commit(stage, options)`；portable/text 的 schema、预检和稳定化属于纯 Contracts Module，文件选择、下载和文案属于 Chat Adapter。
- **Depth 与 Leverage**：同一 Interface 隐藏 ConversationV2 校验、重复 ID/顺序检查、瞬态 delivery/status 归一化、16 MiB 边界、新 timeline 分配、目标联系人重绑定、可用资源交集和补偿回滚；controller 不理解这些失败模式。
- **事务与 Locality**：消息正文继续位于 Chat 私有 storage，会话设置/资源绑定继续位于 shared storage。Workflow 显式接收两个 Storage Adapter，提交前分别捕获旧值，任一步失败则逆序恢复；不会为了“原子感”合并既有 namespace 或引入全局数据库。
- **必须保持**：portable JSON 与可读文本是两个格式；文本不可再导入。导入默认新建 timeline，绝不隐式覆盖。外来角色/Profile/world variant 不得按 ID 盲绑；目标联系人的角色与世界变体优先，只恢复本地确实存在的显式世界书和预设。外观、草稿、置顶、未读、事件记忆、API 设置、secret 与派生索引不进入聊天文件。
- **边界**：这不是角色/世界/Profile 打包格式，也不是 Local Data Vault 全局 restore。跨设备继续聊天仍要求用户分别携带所需资源，并在目标浏览器中完成绑定。

### 会话导入必须同时防正文键和会话键冲突，并公开降级结果

- **当前状态**：已实现（2026-08-20）。
- **冲突规则**：分配导入 timeline 时，同时查询 Chat 私有 Conversation Store 和 shared `chat-experience` session。任一侧存在都视为占用；不能因为场景/设置会话尚无消息正文就覆盖它。
- **呈现规则**：Conversation Transfer Workflow 返回的 `unresolvedBindings` 必须由 Chat 在新会话中显示。缺失本地世界书、缺失 Generation Profile、回退到默认 Profile 和角色重绑定不能静默发生；用户可以从回执进入既有“资源与上下文”检查页。
- **边界**：回执是当前 Chat 实例的 scoped presentation state，不新增持久化事实源，不把外部资源写入本地，也不改变“只恢复本地确实存在资源”的安全规则。

### 聊天闭环以一条纵向合同矩阵验收

- **当前状态**：已实现（2026-08-20）。
- **验收路径**：角色、世界书、Generation Profile 导入 → 显式会话绑定 → `buildRuntimeInput()` / request trace → 生成结果持久化 → portable export → 新 timeline import → fresh app reload → 再次运行时装配。
- **Fixture 边界**：自动矩阵使用 Mercury 自有 fixtures，不依赖可删除的 `reference-sources/`；真实来源文件只用于隔离浏览器 QA，不写入正式测试和公共合同。
- **必须保持**：每个阶段验证同一 Conversation Scope；禁用/越界资源不得进入请求；再导入不得覆盖旧 timeline；重新加载后正文与本地可用绑定仍可恢复。真实模型输出质量继续由独立 API 回归证明，合同矩阵使用可控 transport，避免把模型随机性当数据一致性证据。

### 资源在导入边界翻译

- **当前状态**：已实现。
- **为什么**：`resource-contracts.js` 预检多种 JSON/PNG 载体，再规范化为 Mercury 角色卡、世界书或预设；档案 store 也保留来源资产供审核。
- **必须保持**：内部 store、运行时、UI 与导出使用 Mercury 自有数据结构；原始来源不自动执行也不自动进入聊天。
- **需要刻意重设计才可改变**：直接以外部 schema 作为内部长期 storage。

### 角色档案、联系人、会话实例分层

- **当前状态**：已实现基础层。
- **为什么**：角色档案定义角色；联系人/体验状态定义用户在某个会话中看到和使用的实例；会话按联系人与时间线保存消息。
- **必须保持**：编辑角色或导入资源不能无意污染不相关会话；运行时角色档案有明确绑定来源。
- **需要刻意重设计才可改变**：把所有会话资料并回一张角色卡或把会话消息存进角色档案。

### 玩法预设与呈现设置分离

- **当前状态**：已实现。
- **为什么**：预设决定关系起点、主动性、情节和偏好等玩法文本；气泡、字体、上下文长度、心声显示等是呈现/体验层。
- **必须保持**：预设在独立 store，`userPresetId` 是会话绑定；预设不应改写角色核心人格。
- **需要刻意重设计才可改变**：将预设字段写入默认聊天外观设置，或让外观改变运行时角色选择。

### Generation Profile 是唯一共享预设事实源

- **当前状态**：Checkpoint 1 已实现。
- **为什么**：旧 Archive `promptModules` 与 Chat-owned UserPreset 是两个互相冲突的顶层来源；Generation Profile 必须由 Archive 管理、由 Chat 和未来玩法引用。
- **必须保持**：长期数据只写 `generation-profiles.v1`；`mercury.apps.chats.userPresets` 与 `archive.v1.promptModules` 只读迁移。独立 prompt 来源按来源聚合为 Profile，混合或歧义模块进入迁移 Profile 的 Instruction Blocks，不机械地一模块一 Profile。
- **内置隔离**：`preset-default` 只在代码内置注册表中存在，持久化 Store 不接受同 ID 的新增、覆盖或删除；修改必须 Remix。
- **运行时边界**：Generation Profile 继续适配为 `compileRuntime().userPreset`，不新建第二条全局模块通道；旧 enabled Archive 模块迁移后需显式选择 Profile 才生效。
- **本阶段未包含**：Global → Contact → Session 继承、Model Parameters、Advanced UI 和新的 Playback 系统。

### 可导入运行时资源必须经过有序准入，而不是无上限拼接

- **当前状态**：已实现（2026-08-20）。
- **决定**：`compileRuntime()` 继续是唯一运行时编译 Interface。核心规则和既有 `core → Generation Profile → role → runtime context → presentation → experience` 顺序不变；用户可导入的 Generation Profile 最多进入 16000 字符，角色运行档案最多进入 12000 字符。角色超限时优先保留身份、稳定特质、动机、价值、边界和行为/声音，低优先级自由背景与 lore 最后消费预算。
- **既有边界**：世界书继续由 resolver 在绑定、visibility、variant/timeline 和激活规则后限制为 8 条、5000 内容字符；事件记忆继续只允许当前联系人 + 世界变体 + 时间线下 durable/active 的 Top-3，总内容最多 560 字符。禁用块、仅保留块、未绑定/越界世界条目和 pending/session/superseded 事件不能借预算规则进入请求。
- **可观察性**：现有 `resourceTrace` 新增 `assembly`，统一记录四类资源的 source/included characters、数量、上限和截断状态，以及最终 system prompt 字符数；不记录资源正文。截断同时进入稳定 warning，不静默发生。
- **为什么**：成熟实现共同证明分层、固定顺序和来源级诊断有价值，但部分项目只显示估算 token、不执行准入，或允许很高历史/记忆上限。酒馆官方实现进一步确认激活不等于入场、预算耗尽后必须停止。Mercury 保留自身更严格的 scope 和预算，不复制参考代码、命名、字段、UI、资产或文案。
- **边界**：这些是 Mercury source lane 的字符准入，不宣称等于任一模型的 token/context window，也不新增 Model Parameters、provider-specific context 配置、Global → Contact → Session、UI-03/04 或第二条 prompt lane。

### Generation Profile Detail 是只读总览，不是编辑器

- **当前状态**：已实现并于 2026-08-19 获用户视觉确认。
- **为什么**：详情页负责让用户理解一张 Profile 的身份、运行状态、兼容度、组成与使用位置；高频编辑属于后续独立 Workbench，不能混入查看路径。
- **必须保持**：沿用已确认的唱片 Hero、真实派生统计、Core Profile 摘要、Tracklist 只读预览、Chat 引用、基础信息与既有管理动作；页面数据只来自 Store 和 runtime inspection。
- **边界**：详情页不得加入普通表单、滑杆、Model Parameters、Advanced UI 或 Playback 控件，也不得拥有迁移、运行时装配、provider 或持久化规则。

### 外部预设按能力探测，不按文件样例特判

- **当前状态**：已实现第一版通用识别与兼容升级。
- **为什么**：文件名、产品来源和单一样例都不能证明资源语义；导入边界应从 prompt collection、message list、instruction block、简单指令字段和参数字段等结构推断可承接能力。
- **必须保持**：角色卡与世界书等强类型资源优先；外部原文、未知字段、暂不运行的块与参数保留；重复导入分配新 ID，不覆盖既有 Profile；旧外部 Profile 按兼容修订号幂等升级，无需用户重新导入。
- **运行时边界**：仅将可映射为现有 system instruction lane 的 Relative/system 文本块接入；In-Chat、非 system role、状态命令、脚本和未知宏继续保留，不执行也不强行压平成 system prompt。
- **拒绝边界**：合法 JSON 不等于有效预设。无法识别任何预设内容或参数的文件应返回不支持，而不是伪装为成功导入。

### 世界书按需、权限与预算进入运行时

- **当前状态**：已实现。
- **为什么**：世界条目不能全量塞进 prompt；运行时必须先遵守会话绑定、世界变体、时间线和 visibility，再使用关键词、常驻、优先级和字符预算检索。
- **必须保持**：未绑定、禁用、越界、未授权条目不进入 prompt；装配保留实际 scope、trace 和 warning，便于审计。
- **需要刻意重设计才可改变**：取消预算、忽略绑定、将世界书当作无条件指令集合。

### 事件是长期记忆单位，向量是检索工具

- **当前状态**：已实现 V1 合同和关键词路径；语义加载待真实验收。
- **为什么**：确认记录不等于永久记忆；事件具有 retention、state、importance、过期与覆盖关系，索引可从证据重建。
- **必须保持**：只有 durable + active 事件可自动召回；Top-K 与字符预算固定受控；失败不得回退为全量确认记录。
- **需要刻意重设计才可改变**：从完整聊天直接建长期索引，或允许记忆文本成为运行时指令。

### 三维 scope 是硬边界

- **当前状态**：事件记忆合同已实现；会话资源绑定带世界变体。
- **为什么**：同一联系人可能处于不同世界和时间线，必须防串记忆。
- **必须保持**：事件的创建、读取、删除、导出、导入和重建都带联系人、世界变体、时间线。
- **需要刻意重设计才可改变**：任何仅按联系人过滤的记忆 API。

### 运行时文本与消息呈现分离

- **当前状态**：已实现。
- **为什么**：运行时负责组装规则和数据；聊天 UI 负责多段气泡、心声隐藏、消息状态和版本。
- **必须保持**：心声不是普通可见文本；输入资源、运行时 trace 和显示气泡各有合同。
- **需要刻意重设计才可改变**：让 UI 自行拼接系统 prompt 或把隐藏内容混入聊天正文。

## 安全与部署

### Web/PWA 是主要交付形态

- **当前状态**：产品方向已确认（2026-08-20），交付实现尚未开始。
- **决定**：Mercury 以 HTTPS Web/PWA 作为用户手机上的主要入口；用户无需 Node。业务数据继续保存在浏览器本地，AI Connection 由用户自带。生产 AI 请求统一经过同源 Stateless Relay，relay 不长期保存 Key、聊天或资源。
- **参考取舍**：成熟浏览器小手机共同证明静态/PWA 壳、本地数据、版本化存储和可安装入口可形成完整产品；带服务端路由的 Web 项目证明 `/api/*` 可以与前端同源部署；跨端原生项目只证明以后可增加薄包装，没有证明 Mercury 现在需要迁移框架或维护双核心。
- **明确不选**：不把压缩包或 `file:` 直开作为面向普通用户的主要交付；不把浏览器直连任意 Provider 当作唯一生产路径；不为上线引入账户、云数据库、同步或服务端业务数据；不同时开发原生版。
- **当前缺口**：PWA manifest、Service Worker 缓存/更新合同、主屏安装路径、HTTPS 托管、生产 Stateless Relay、安全与滥用边界、真实手机生产连通性均未实现。Android 包如以后需要，只包装同一 Web 产品并另立验收。

### 发布只通过单一 Release Module

- **当前状态**：已实现（2026-08-19）。
- **Interface**：开发者只调用 `build:production`、`audit:production` 或串联全量测试的 `release:check`；`release-budget.json` 是可审阅的版本化预算 Interface。
- **Implementation**：Release Module 独占 `app/ → dist/` 的重建、生产排除、demo 清理、体积统计和预算判定。`dist` 必须是 `app` 的同级目录，避免任意递归删除目标。
- **Depth 与 Locality**：调用方不需要理解排除名单、压缩估算或文件遍历。37.65 MiB 未引用字体仍保留在源码资产中，但不进入发布产物；若正式代码开始引用这些资产，审计会失败，要求在同一 Module 内显式重新决策。
- **当前门禁**：155 files / 20.74 MiB，JS 967.1 KiB、CSS 352.3 KiB；eager local entrypoint 为 62 requests、981.1 KiB raw、239.7 KiB gzip、198.2 KiB Brotli 估算。64 files / 1974 assertions 与硬预算通过；output-size 与 request-count warning 保留。
- **边界**：这只证明静态产物可重复，不证明公开链接的 `/api/*` relay、HTTPS、凭据安全或真实模型连通性已经完成。

### App 资源准备与实例生命周期必须分层

- **当前状态**：已建立首个 Archive 按需加载切片（2026-08-20）。
- **Interface**：`MercuryAppLoader.launch(appId, payload)` 是 Home 与 App 间跳转的统一启动入口；`snapshot/subscribe` 暴露可观察的加载状态。lazy manifest 由 shell 构造传入，不向 App 暴露资源注册能力。
- **Implementation**：Loader 按 style→ordered classic script→definition factory→AppEngine register→shell activate 执行；只去重资源 ensure Promise，不复用整个 launch Promise。每次用户启动分配全局 ticket，只有最新意图可以激活前台。DOM Adapter 在 CSS/脚本错误时移除失败节点和缓存，下一次点击重新尝试。
- **必须保持**：资源任一步失败都不能注册或启动 App；不能吞 CSS 错误，也不能在 `.catch()` 后照常运行。AppEngine 继续独占实例、pause/resume/unmount 和隔离；state machine 继续独占合法前台转换。Settings 保持 eager，作为 Chat Connection Readiness 的恢复入口。
- **Reference Before Reinvention**：接受成熟实现的关键/延迟资源分组、CSS-before-script、Promise 去重和 retry reset；拒绝失败后仍运行、吞样式错误和短延时预取全部非关键资源。只借鉴分层、状态、失败模式和验收，不复制代码、命名、UI、资产、文案或私有字段。
- **验收**：Interface 测试覆盖 eager/lazy、顺序、去重、latest-intent-wins、失败、重试、definition 错配和直接文件相对路径；真实浏览器覆盖首次图标启动与 Chat→Archive 角色深链。

### API 凭据生命周期必须覆盖真实消费者

- **当前状态**：已实现当前标签页会话凭据桥接。
- **为什么**：过去 Settings 的连接测试直接使用控制器内存中的 Key，而 Chat 只读取持久化连接；关闭“记住 API Key”后会出现“测试成功、实际聊天失败”的分叉。
- **必须保持**：Settings 输入首先同步到当前标签页的 `sessionStorage`，Chat、角色分析等真实消费者与连接测试使用同一份解析结果；关闭标签页后会话 Key 清除。只有用户明确开启“记住 API Key”时才写入长期 `localStorage`。
- **权限边界**：Settings 以外的 App 不获得会话凭据读写 facade；凭据只经 AITransport 发送给本地 relay，不写入聊天请求、Generation Profile、角色、世界书、记忆、导出或诊断。
- **回归门禁**：以后任何连接设置必须同时测试“设置页测试调用”和至少一个真实消费者调用，不能用连接测试成功代替功能闭环成功。

### Connection Readiness 属于 Chat Generation Workflow

- **当前状态**：已实现（2026-08-20）。
- **为什么**：session credential 按标签页隔离是既定隐私边界；新标签页没有 Key 时，旧流程先写入用户 turn 再由异步请求失败，且 Chat 没有渲染真实错误，形成无回复、难诊断的幽灵失败消息。
- **决定**：AITransport 暴露不包含任何凭据的同步 Connection Readiness；Chat 的 production generation Adapter 将其交给 `MercuryChatGenerationWorkflow`。Workflow 在 send/retry/regenerate 的会话写入或 delivery 改动前预检，失败 snapshot 保留安全错误码、恢复目标、operation 与 message id；controller 只渲染页内错误和翻译“前往 AI 连接 / 重试”动作。
- **必须保持**：不得让 Chat controller 读取 session credential、不得把预检改成第二条发送通道、不得为跨标签页便利复制 Key。配置失败不落用户消息且保留草稿；网络/模型阶段失败继续落在原 user turn 并可重试；恢复状态不得泄漏到其他 Conversation Scope。
- **回归门禁**：覆盖无配置、session-only、状态对象不含 Key、发送前零提交、retry 不改变失败 turn、可见文字动作、Settings `ai-connection` 深链路、配置就绪后单次重试和真实浏览器重复预检不落库。

### 模型发现不能代替真实连接验证

- **当前状态**：已实现统一 OpenAI-compatible provider adapter 与真实 Test Message。
- **为什么**：`GET /models` 只证明地址、鉴权和可选模型发现端点可能可用，不能证明用户选中的模型接受 `chat/completions`、请求参数或响应格式。此前 Settings 将 `/models` 成功直接显示为“连接成功”，存在稳定假阳性。
- **必须保持**：Settings 的“测试连接”调用 AITransport；AITransport 与 Chat/角色分析共用同一会话凭据解析、本地 relay、Base URL 归一化、鉴权头、超时、错误映射和响应解析。测试先尝试模型发现，再用当前所选模型发送最小真实生成；只有生成返回有效 assistant text 才可显示成功。
- **兼容边界**：`/models` 缺失或不兼容时允许标记 discovery unavailable，并继续以真实生成判断；用户将 Base URL 填成完整 `/chat/completions`、`/completions` 或 `/models` 时先归一化到 API root，禁止重复拼接路径。
- **回归门禁**：必须覆盖“models 成功但真实生成失败”“models 缺失但真实生成成功”“完整端点 URL 不重复拼接”和“上游错误不回显 API Key”。

### 兼容模型服务通过本地 relay

- **当前状态**：已实现开发路径；生产目标已确认采用同源 Stateless Relay，但尚未完成生产化。
- **为什么**：浏览器调用同源 `/api/*`，relay 校验请求、上游地址、超时和错误；支持兼容接口而不绑定单一供应商。开发环境由本地 Node Adapter 承接，生产环境由托管平台的无状态函数/Worker Adapter 承接，浏览器侧 AITransport Interface 不分叉。
- **必须保持**：默认拒绝非 HTTPS 和私有上游地址，除非明确开启开发例外；错误信息不得回显凭据。
- **需要刻意重设计才可改变**：把凭据或上游请求暴露到不可信公开前端而没有安全方案。

### Provider 广度只随真实能力需求增长

- **当前状态**：2026-08-20 API 对照审计确认；当前仍只支持 OpenAI-compatible。
- **为什么**：成熟参考的复杂设置主要来自主备线路、记忆/工具/游戏/图片/语音分流、原生协议、流式和调试记录。Mercury 当前 Chat 主链已有统一真实 Test、会话凭据、超时/取消、错误分类/脱敏和恢复；先复制 Provider 数量不会提高基础聊天可靠性，反而扩大凭据与失败状态。
- **决定**：API-01 已于 2026-08-20 完成：AITransport 只暴露 readiness 与 `chat/testConnection/analyzeRole/generateCinema` 高层能力，credential resolution、relay endpoint/payload 和能力默认超时留在 Implementation；预先 aborted 的四类调用不启动 fetch。下一步按 API-02 建 Provider Network Policy，再按 API-03 落生产 Stateless Relay Adapter。生产链稳定后，只有真实用户证据支持时才评估模型发现 + 手动回退或少量命名连接。
- **暂不启动**：原生 Anthropic/Gemini、自动主备、按功能 API、流式、Model Parameters 与包含正文的 API 调试控制台。新增协议必须有第二个真实 Adapter、协议 fixture、错误映射与真实消费者回归，不能只加 provider 枚举或 UI 标签。

### 凭据防泄漏只检查结构，不扫描自由文本

- **当前状态**：已修复并建立回归门禁。
- **为什么**：旧 relay 对完整请求 JSON 搜索 `secret`、`credential`、`authorization`、`apiKey` 等词，会把角色对白、世界书和成熟外部预设中的正常安全说明误判为凭据泄漏，导致请求在到达模型前失败。
- **必须保持**：只阻止 `apiKey`、`api_key`、`authorization`、`credentials`、`secretKey`、`accessToken` 等凭据形状的字段名；不得因自由文本提到“秘密”或 API 凭据概念而拒绝请求。
- **回归门禁**：测试必须同时证明正常提示词可包含这些词，以及顶层/嵌套凭据字段仍被拒绝、错误响应仍不回显真实 Key。

### 浏览器本地数据优先

- **当前状态**：已实现。
- **为什么**：当前不依赖账户或服务端数据库，消息、档案、体验和连接设置都在浏览器。
- **必须保持**：导出、清理、失败回退和隐私说明必须诚实；本地存储不是永久同步能力。
- **需要刻意重设计才可改变**：引入服务器同步、跨设备共享或多人访问。

## 开发纪律

### 产品流程放入无 DOM 的 Use Case 层

- **当前状态**：已在 Generation Profile 上建立首个实现。
- **为什么**：Archive controller 已同时承担角色、导入、世界书、Generation Profile、路由、草稿与 overlay；继续把 UI-02 状态写进 controller 会让合法转换、失败恢复和只读规则继续扩散。
- **必须保持**：App controller 只渲染 use-case snapshot 并把手势翻译为意图；use case 管合法转换、recoverable draft 与 Store 事务顺序；Store 继续拥有迁移与持久化，core/runtime 继续拥有纯规则。
- **当前边界**：`MercuryGenerationProfileFlow` 只包含 Cabinet / Detail 与已存在的封面/操作 overlay。Pressing Room、Workbench、Playback、继承与参数在各自 checkpoint 前不得加入。
- **需要刻意重设计才可改变**：把 workflow 状态重新复制回多个页面，或让 use case 直接创建 DOM、依赖 CSS/图片资产、拥有 provider 连接。

### 参考资料隔离

- **当前状态**：已实现 `.gitignore` 隔离目录；公开清理是未完成发布门禁。
- **为什么**：只吸收抽象结构，保护项目独立性。
- **必须保持**：不复制代码、命名、字段、文本、资产或独特交互；公开产物和文档不得出现来源名称。
- **需要刻意重设计才可改变**：无。此为硬约束。

### 真实状态优先于旧文档

- **当前状态**：本次交接建立。
- **为什么**：仓库内旧规划有已过时的“未接入”描述，当前代码已实现更多链路。
- **必须保持**：改动前先读源码与测试，更新本组交接文档。
- **需要刻意重设计才可改变**：无。
