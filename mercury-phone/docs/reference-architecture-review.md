# 参考架构审阅与 Mercury 落地记录

日期：2026-08-09

这份记录只保留可迁移的工程方法，不保存外部项目的专有名称、角色、剧情、提示词或界面文案。

## 2026-08-18 再审计：Generation Profile Workflow

在 UI-02 开始前，重新审计了私有索引允许的成熟浏览器小手机项目、公开资源聊天项目及其官方文档。只检查应用拆分、资源 ownership、状态流、存储、导入、失败恢复与验收；没有把参考代码、命名、字段、UI、资产或文案写入 Mercury。

本轮接受的结构原则：

- 手机壳路由保持薄；页面 UI、产品流程、领域计算、Store 和外部 adapter 分层。
- 本地优先项目可以继续使用顺序脚本，但复杂产品流程需要独立 use-case module，不能依赖 controller 中不断增加的 route 字符串和临时字段。
- 资源管理、scope/binding、运行时装配与 provider 连接是不同边界；管理页面不能直接拥有提示词装配或 provider 语义。
- 可编辑资源必须明确区分持久状态与未确认 draft；存储失败时保留用户 draft，成功后才关闭 overlay。
- shell router 只映射 App；可测试的状态转换和数据规则放在无 DOM 的纯逻辑文件。

明确不采用：

- 超大单体 Store、超大 UI-coupled resource manager 或继续扩张的页面 controller。
- 为了分层而引入 React、Vite、新存储技术或一次性重写现有 IIFE 运行时。
- 复制任何参考项目的资源字段、组件结构、界面隐喻、交互细节或错误文案。

Mercury 落地：新增 `app/use-cases/generation-profile-flow.js`，只承接当前 Cabinet / Detail、操作菜单、封面 preview/confirm/cancel、只读保护、reload 修复与存储失败草稿保留。Archive controller 已开始通过该 interface 驱动现有页面；UI-02 视觉、Pressing Room、Workbench、Playback、继承和参数均未在本轮实现。

验证：`npm test` 为 50 files / 1460 assertions / 0 failures / 0 skipped。

## 2026-08-19 补充审计：成熟小手机的存储与应用宿主

在正式 UI-02 开始前，又对私有索引允许的一套公开成熟小手机实现做了补充审计。审计只记录通用结构，不在公开文档中保留项目专名、组件名、字段、UI、资产或文案。

本次接受的结构原则：

- 首屏应先完成关键本地存储 hydration，再开放依赖这些数据的界面；主题和非关键资源预载失败应降级而不是阻断整个手机。
- 迁移标记与真实数据不在同一存储介质时，标记丢失不能直接触发空数据覆盖。应先检查目标数据库是否已有真实数据，再决定迁移或复用。
- 导入解析应返回明确的分类结果，例如成功、格式无效、目标类型不匹配或包含多个条目；调用方据此保留草稿并给出正确去向。
- 备份、清理和本地工具应共享一份数据源清单。迁移标记、凭据和设备本地运行状态需要显式排除，不能靠各页面自行猜测。
- 大数据导入/导出应按模块或数据源逐项处理，避免在移动浏览器中一次持有全部解析结果。

明确拒绝：

- 把所有 App 分派、后台任务、桌面状态和领域流程继续集中进单个超大宿主文件。
- 因参考项目使用某个框架、数据库或 provider 就迁移 Mercury 的现有栈。
- 复制参考项目的 preset 字段、双重排序合同、组件分层、交互文案或视觉表达。

对 Mercury UI-02 的直接影响：保持 `App Engine → Archive controller → MercuryGenerationProfileFlow → GenerationProfileStore → runtime inspection` 的单向关系；正式详情只读消费派生数据，不拥有迁移、装配、provider 或持久化规则。旧 `module-editor` 表单已退出主 route，`profile-detail` 成为正式详情，并于 2026-08-19 获用户视觉确认。验证为 50 files / 1471 assertions / 0 failures / 0 skipped，并完成顶部与滚动底部手机截图 QA。

## 2026-08-19 架构审计：两个新增公开小手机实现

在用户确认后，对私有索引中新加入的跨端小手机实现和本地优先 PWA 实现进行了代码级对照。审计覆盖启动装配、领域 Repository、消息模型、本地数据库升级、导入导出、前台恢复、同步失败与测试；公开记录继续只保留通用方法，不保存项目专名、私有字段、界面或文案。

本次接受并翻译为 Mercury 规则：

- 领域持久化通过窄 Repository/Store 接口进入，UI controller 不重复决定 key、迁移和损坏恢复；内存替身用于合同测试。
- 消息先经过类型/领域合同，再进入持久化或运行时，迁移输出也必须用同一合同验证。
- 版本升级可以在读取时产生规范化内存结果；升级写回失败不能使原本可读的数据变成不可用，损坏源也不能在自动恢复阶段被静默覆盖。
- 恢复重试只应用于幂等操作；备份/恢复需要一份数据源清单、凭据排除规则和可分批处理的传输方式。
- 应用宿主必须以合同测试锁定 `context`、payload 和生命周期顺序，不能只靠各 App 自行猜测参数。

明确拒绝：

- 在合同和构建链不完整时引入 Flutter/C++ 双核心、JSON 字符串 FFI 或新的数据库，只为了看起来更“工程化”。
- 把页面状态、DOM、存储、同步和错误恢复塞进超大控制器或全局脚本对象。
- 依赖隐式全局变量和脆弱脚本顺序，却没有边界测试；也不在浏览器客户端直接承担生产同步凭据。
- 因参考实现存在后台、视频或同步模块，就把尚无 Mercury 产品合同的能力提前接入。

对 Mercury 的差距判断：现有领域合同与测试强于参考实现，但 Chat 和 Archive controller 仍过大；Chat 曾重复读取会话 storage，Archive 的 `onResume` 还把 App Engine 第一参数 `context` 当成 deep-route payload。全局数据清单、显式易失存储状态、备份恢复边界和大媒体预算仍缺失。

本轮最小落地：新增 `MercuryConversationStore`，保持既有 key 完全兼容，把会话读取、V1→V2 写回、损坏回退和写失败分类移出 Chat controller，并显式区分 missing / ready / migrated / corrupted / unavailable；修正 Archive `onResume(context, payload)` 并在 App Engine 测试中锁定参数顺序。没有迁移框架、数据库或 UI，也没有启动 UI-03/04、同步、Playback 或 Model Parameters。验证：`npm test` 为 51 files / 1506 assertions / 0 failures / 0 skipped。

### 链接式产品的构建方式结论

对照静态本地优先实现、带服务端路由的 Web 实现与跨端原生实现后，Mercury 当前更适合保留“静态手机壳 + 浏览器本地数据 + 同源 relay”的构建方式：它与用户打开链接即玩、数据留在各自浏览器的目标最一致。没有证据支持为了工程观感迁移到 React/Next、Flutter/C++ 或新的数据库。

成熟实现中值得吸收的是关键/延迟启动分层、正式 build Interface、版本化存储、可恢复导入导出和部署缓存门禁，而不是它们的框架或目录名。Mercury 因此先建立独立 Release Module，再新增 shell-owned AppLoader：保留 Chat 和作为恢复入口的 Settings 为关键路径，Archive CSS/JS 进入 lazy manifest；CSS 先于有序脚本、同一 attempt 去重、失败重试重置、所有资源成功后才注册/激活，并用全局 launch ticket 保证 latest intent wins。明确拒绝参考实现中吞 CSS 错误、加载失败仍运行 App、短延时预取全部非关键资源的做法。当前产物为 155 files / 20.74 MiB，eager local entrypoint 为 62 requests / 198.2 KiB Brotli。硬预算通过，output-size 与 request-count warning 保留。验证：当前门禁为 64 files / 1974 assertions / 0 failures / 0 skipped，生产审计与真实浏览器首次启动/深链回归通过。

2026-08-20 用户确认将该方向提升为正式交付决策：HTTPS Web/PWA 是主要产品，用户无需 Node；业务数据留在浏览器，模型连接由用户自带，生产 AI 请求通过同源 Stateless Relay。静态/PWA 参考证明“链接打开 + 主屏安装 + 本地数据”可用，带服务端路由的 Web 参考证明同源 `/api/*` 可独立部署，跨端参考只保留以后薄包装的可能性。明确拒绝把 ZIP/`file:` 直开、浏览器直连任意 Provider、框架迁移、账户/同步或 Web/原生双核心作为当前上线前提。现有 `dist/` 仍缺 manifest、Service Worker、安装/更新合同、生产 relay 与 HTTPS 手机验收，因此方向已定不等于已经上线。

### 2026-08-20 定向审计：API 连接复杂度与生产 Relay

审计对照了静态小手机的主/备用线路与直接浏览器请求、多用途小手机的主 API/记忆/工具/游戏/图片分流、Web/PWA 项目的统一 Provider helper 与原生协议分支、跨端项目的多 Provider 数据枚举，以及公开聊天工具的 Provider 分层。只提取 Interface、Adapter、数据流、失败模式和验收方法，没有复制代码、命名、字段、UI、资产或文案。

参考中的“复杂”主要有四个来源：功能类型已经扩展到文本、图片、语音、Embedding 和工具；保存多组连接并做主备/按用途路由；原生 Anthropic/Google 与 OpenAI-compatible 的 URL、Header、请求/响应格式确实不同；调试日志、流式、工具循环和兼容回退增加了状态。值得吸收的是统一 URL/Header/解析入口、能力明确的协议 Adapter、真实 Test Message、Abort/timeout、错误脱敏和可选诊断。明确拒绝：业务模块各自 `fetch()`；对所有错误自动切备用线路；空响应无条件重复计费请求；把 Key/正文放入长期调试记录；只因 UI Provider 列表很多就宣称协议都已成熟。

Mercury 的结论是“广度克制，主链已有深度”：当前只支持 OpenAI-compatible、单一活动连接、非流式，也没有按功能 API 和自动 fallback；但 Settings Test、Chat 与角色分析已经共享 AITransport/Provider Adapter，会话 Key、可选模型发现、最小真实生成、endpoint 归一化、请求合同、超时/取消、错误分类/脱敏和 Chat 失败恢复都有回归。因此不应先复制参考的 11 Provider、API 预设悬浮球或多用途面板。

代码级 P1 最初有三项。API-01 已解决第一项：Cinema workflow 只调用 `generateCinema()`；credential resolution、relay endpoint/payload、默认超时与响应验证留在 AITransport Implementation，低层方法私有化；Chat、Settings Test、角色分析与 Cinema 均覆盖调用前已 aborted 时 0 fetch。剩余两项是：Provider URL 只拦截字面私网 hostname，尚未按 A/AAAA 解析结果覆盖 IPv4/IPv6、DNS rebinding 和实际连接绑定；虽然已禁止重定向，但不足以直接公开部署。512 KiB 上游响应限制仍在 `response.text()` 完整缓冲后检查，不能及时终止超大响应；生产 server 也尚无 rate/concurrency/origin/host 与无敏感正文日志合同。

下一顺序固定为：API-02 建立 Provider Network Policy Module 和假 DNS/fetch 安全矩阵；API-03 用部署 Adapter 实现 Stateless Relay 的滥用/日志/连通性边界；再进入 PWA manifest、Service Worker 和真实手机 HTTPS。模型列表 + 手动回退、少量命名连接可在生产链稳定后按用户证据评估；原生 Anthropic/Gemini、自动主备、流式和 Model Parameters 不随本审计启动。

## 2026-08-19 定向审计：聊天生成请求生命周期

在实现前再次对允许参考的成熟小手机代码做了定向审计，只比较会话级并发、取消、迟到响应、持久化顺序、失败恢复与重试/重新生成语义。

共同的成熟骨架是：会话级单飞锁、独立 request/run id、每次请求自己的 AbortController、每个异步边界后的“仍是当前请求”检查，以及无论成功失败都释放状态的终结路径。可靠实现还会先持久化用户消息，并阻止已取消或已切换会话的迟到结果写回。部分参考仍把这些状态散在页面控制器、依赖全局 pending 集合，或缺少明确的失败/重试合同，因此这些做法没有照搬。

Mercury 将这组不变量收进无 DOM 的 `MercuryChatGenerationWorkflow`。其公开 Interface 只有 `start(command)`、`cancel()` 与 `snapshot()`；生产 host Adapter 连接 Conversation Store 与 UI 状态，generation Adapter 连接记忆召回、runtime 和 AITransport，测试则使用内存 Adapter。Mercury 保留了自身更强的非破坏式重新生成语义：更新选中 AssistantTurn 的 active version，但不截断后续记录。没有复制参考代码、命名、字段、UI、资产或文案，也没有引入新框架、数据库、后台同步或流式 UI。

## 2026-08-19 定向审计：本地数据清单、健康与备份范围

实现前对允许参考的本地优先 Web 小手机与跨端项目再次做了存储定向审计。接受的通用结构是：一份数据源清单同时驱动统计、备份和未来清理；规范数据、迁移来源、凭据、设备状态、派生索引与缓存必须有显式不同策略；浏览器配额/持久性诊断失败只能降级；恢复写入前必须完整预检，并对受保护键和失败回滚有明确规则。

明确拒绝：扫描并导出同源全部 `localStorage`；把同步凭据或设备密码放进同一备份；因参考实现有大量 IndexedDB 就迁移 Mercury；在没有事务和回滚时开放覆盖式全局 restore；为当前小规模 JSON 数据引入流式压缩、大文件分批或后台同步。

Mercury 因此新增 `MercuryLocalDataVault`。Module 的 Interface 只有 `snapshot()` 与 `createBackup()`；内部 catalog 收录规范/旧版用户数据、动态会话键、需脱敏连接偏好、设备 secret、session credential、可重建向量索引、浏览器模型缓存与未知键。`localStorage` 不可用时 System Services 使用内存 Adapter 并明确报告 `volatile`；写探针失败报告 `degraded`。Settings 只消费 Interface，真实浏览器验收覆盖实际配额和备份按钮反馈。备份不可安全脱敏时跳过记录，未知键只报警。未复制参考代码、命名、字段、UI、资产或文案。

## 2026-08-19 纵向审计：角色资源进入聊天与可携带性

本轮沿“角色/世界/生成资源 → 绑定 → 聊天请求 → 失败恢复 → 导出/再导入”审计了私有索引允许的多套浏览器小手机、跨端实现、本地优先 PWA 以及公开资源聊天工具的官方文档。公开记录仍只保留功能分层、状态机、数据流、失败模式和验收方法，不保存项目专名、代码、字段、UI、资产或文案。

共同的成熟边界：

- 文件读取、格式预检和持久化提交是三个阶段；预检必须给出类型、版本、错误和警告，不能在识别过程中写数据。
- 角色、角色绑定的世界资料和聊天实例是相关但不同的资源；导入角色后必须能追到聊天请求实际使用的角色/世界，而不是只在列表中出现。
- 重复导入需要明确分配新身份或要求覆盖选择，不能隐式覆盖现有角色、世界或会话。
- 多数据源提交要么使用真实事务，要么先构造完整写入计划并提供补偿回滚；失败必须区分格式失败、存储失败和恢复失败。
- 聊天发送必须保持 queued/running/failed/cancelled/retry 等显式状态；只有幂等操作可自动重试，异步返回必须重新确认会话 scope。
- 导出格式必须能被同一导入边界重新识别；聊天的可携带导出与便于阅读的纯文本导出是两种不同能力。

审计也发现部分参考实现只有数组校验后批量覆盖、巨大页面脚本或逐记录错误累计，没有跨域原子性；这些被作为失败模式，不作为 Mercury 目标。Mercury 继续保留现有版本化 JSON 和直接文件运行方式，没有因为参考项目使用数据库、框架、流式压缩或服务端目录就迁移技术栈。

本轮落地为无 DOM 的 `MercuryResourceIntakeWorkflow`：`inspect(input)` 只建立预检阶段，`commit(stage, { destination })` 统一 Archive 与 Chat 的角色导入，分配不冲突的角色/世界/联系人 ID，按计划写入来源资产、运行档案、嵌入世界书、联系人实例与 Chat 联系人，并在后续写失败时恢复已捕获键。Archive 的 `library` 目的地不会自动创建 Chat 联系人；Chat 目的地只接受通过预检的角色卡。现有 `MercuryChatGenerationWorkflow` 继续独立拥有生成状态机。

随后完成了“可再导入的会话传输合同”。定向核对显示：成熟公开聊天工具把保留完整 metadata、可原样再导入的聊天文件与丢失 metadata、只供阅读的文本明确分开；本地参考中也有能按目标会话重映射并批量导入消息的实现，但仅检查 `messages` 数组、直接追加、无格式版本/逐条校验/冲突合同/事务恢复。后者只作为失败模式，不作为 Mercury 的成熟标准。

Mercury 落地为两层深 Module：`MercuryConversationTransferContracts` 负责版本化 portable JSON、readable text、ConversationV2/session 预检、重复身份、16 MiB 边界与瞬态状态归一化；`MercuryConversationTransferWorkflow` 负责新 timeline、目标联系人重绑定、本地资源交集和跨 Chat 私有/shared storage 的补偿事务。导入不会覆盖来源记录，也不会盲绑外来的角色/Profile/world variant；场景文本可随会话携带，显式世界书/预设只恢复目标浏览器已存在的部分。外观、草稿、置顶、未读、事件记忆、API 设置、secret 与派生索引不进入聊天文件。

该阶段历史验证为 57 files / 1756 assertions / 0 failures / 0 skipped；当时生产产物 139 files / 19.63 MiB，eager local entrypoint 63 requests / 226.5 KiB Brotli。随后角色导入连续性、完整纵向资源/会话 round-trip 矩阵与首个 Archive lazy slice 均已完成；后续仍不应继续无审计地增加全局脚本。

### 2026-08-20 定向审计：角色导入完成后的连续可玩路径

四套允许参考的小手机/本地优先实现呈现出一致的成熟原则：导入提交要返回可核对的结果并刷新目标列表；新角色应进入显眼位置；首条与备选开场应分别保留；批量或跨存储导入需要可读的新增/跳过/错误统计。参考中“只弹瞬时提示”“同 ID 批量覆盖”“没有开场就自动生成通用问候”等做法被视为失败模式，没有进入 Mercury。

Mercury 保持原有 Resource Intake / Chat seam：Workflow outcome 只返回 Mercury 自有提交状态、来源资产和内部 ID；Chat 将 outcome 保存在当前 UI state 作为可关闭、可行动的成功回执。联系人选择页只把当前刚导入角色置顶/高亮，不改变永久排序；重名从 Archive SourceAsset 派生本地文件来源，同一来源仍冲突时使用 Mercury 自有副本序号。开场分类保留被过滤原因和安全备选；0 个候选时显式进入 0 消息空白会话，不伪造角色回复、不调用模型、不更改世界书绑定。

该切片完成时验收为 57 files / 1781 assertions / 0 failures / 0 skipped；真实手机浏览器回放含元数据首条和多备选的角色卡，以及完全无开场角色卡；回执、来源/副本、选择安全备选、空白聊天与 0 console warnings/errors 均通过。

### 2026-08-20 定向审计：聊天纵向 round-trip 与导入降级

在补完整矩阵前，再次定向核对允许参考的本地优先小手机与聊天实现。接受的共同原则是：联系人/角色 identity 解析与上下文装配必须显式；世界、角色和生成规则先聚合再发请求；传输文件要有版本化预检、来源级结果和可读 warning；导入新会话不能覆盖已有实例，失败或降级必须能从目标页面恢复。参考实现中的名称猜测、巨型 controller 直接写数据库、只有 `messages` 数组校验和静默跳过资源被作为失败模式。

Mercury 没有复制代码、命名、字段、UI、资产或文案，也没有迁移框架/数据库。`MercuryConversationTransferWorkflow` 继续作为唯一提交 Seam，但 timeline allocation 现在同时检查 Chat 私有正文和 shared session，堵住“只有 scene/session、没有 transcript body”时被覆盖的缺口。Chat 消费已有 `unresolvedBindings`，在导入后的目标会话显示缺失世界书、缺失 Profile/default fallback 与角色重绑定，并复用既有资源页作为恢复入口。

新增自有 fixture 的 `chat-roundtrip-matrix`：角色、独立世界书、Generation Profile 导入 → 显式绑定 → request/trace 装配 → 可控生成与持久化 → portable export/import → 新 timeline → fresh app reload → 再装配。禁用世界条目保持排除，测试不依赖最终必须删除的参考目录。真实手机浏览器另用真实本地资源验证审核导入、绑定、刷新、导出/回导与资源恢复，0 console errors；没有再次调用真实模型。该矩阵完成时门禁为 58 files / 1828 assertions，当前总门禁为 64 files / 1974 assertions / 0 failures / 0 skipped，生产审计通过。

### 2026-08-20 定向审计：四类资源进入真实请求的准入与诊断

实现前对允许参考的浏览器小手机、跨端小手机、本地优先 PWA 与公开资源聊天工具官方资料做了代码级对照，只审计上下文分层、角色/世界/生成规则/记忆组装、历史窗口、字符或 token 估算、失败模式和调试方式。

可接受的共同结构：每次生成重新从当前 Store 读取资源；不同来源先形成固定顺序的 section/bundle；世界资料先执行 scope/激活再按预算入场；聊天历史使用明确窗口或 summary bridge；调试信息按来源报告实际规模。需要拒绝的失败模式也很明确：只显示字符/token 估算却不阻止超量资源；角色、预设或世界书自由文本无上限；把 500/1000 回合历史或 12 条长期记忆当作通用默认；公开源码子集没有运行时装配证据时，不能凭项目成熟度替它补出结论。

酒馆官方文档补充确认：世界信息激活不等于最终入场，预算耗尽后其余命中必须停止；角色定义属于稳定上下文来源，但仍受模型总 context 分配约束。Mercury 因此没有复制任一参考的上限或字段，而是先测量自身 21146 字符 Runtime Core 和隔离区内六份可识别 Profile 的真实装配规模（285–14896 字符），再确定 Mercury source-lane admission：Generation Profile 16000、角色档案 12000、世界书沿用 8/5000、事件沿用 Top-3/560。

落地继续深化现有 `compileRuntime()`，没有增加浅薄 wrapper 或第二编译器。角色字段按身份/行为优先、自由背景/lore 后置；Profile 保持启用块顺序并在段落边界内有序截断；统一 `resourceTrace.assembly` 只记录 ID、数量、字符、上限、截断与最终 system prompt 长度，不保存正文。新增 Mercury 自有 `runtime-resource-acceptance-matrix`，从实际 `buildAssistantRequest()` 验证四类资源的正向、禁用/越 scope、预算、顺序与 memory disabled 路径。浏览器回归覆盖 Chat、既有 Runtime Verification 会话和资源设置页，0 warnings/errors；没有再次发送真实模型请求。

## 已确认的可迁移结构

- 入口是一个静态壳层：系统状态、应用挂载、全局样式和脚本启动顺序由壳层统一管理。
- 启动分为关键路径和延迟路径。聊天、基础资料和核心设置优先可用，其余应用按进入时加载，并在空闲时预取。
- 每个领域拆成数据存储、运行桥接和界面入口三层。界面不直接拼接别的领域的原始数据。
- 小数据采用版本化 JSON 存储；大体积媒体另存二进制仓库；导入导出按领域拆分，并允许失败恢复。
- 聊天生成不是单一函数，而是一条流水线：读取历史、合并领域上下文、编译运行规则、发起请求、解析结构化结果、写回会话、更新状态。
- 复杂功能通过显式注册和应用分组进入，不把所有功能永久塞进首屏启动。
- 主题和桌面定制属于展示层；它们可以改变皮肤和布局，不应改变运行语义。

## 对 Mercury 的直接结论

1. `SystemServices` 负责跨应用边界，应用私有数据仍留在各自的 `storage`。
2. `ArchiveStore` 负责资料、人物、世界条目和规则模块；聊天只读取编译后的运行上下文。
3. `buildRuntimeInput()` 是唯一的运行时装配入口，必须可测试、可追踪、可在缺少资料时安全降级。
4. 世界条目必须经过绑定和可见性筛选；规则模块必须经过启用状态筛选；两者不能绕过编译器直接写入请求。
5. 所有应用都要补齐空、加载、错误、禁用、编辑和删除状态；“页面看得到”不等于“功能已经生效”。

## 早期已完成的垂直切片（历史基线）

`资料导入/编辑 → 添加到聊天 → 共享边界 → 运行时编译 → AI 请求`

- 新增显式 `sharedStorage`，解决应用私有存储无法互通的问题，并兼容旧命名空间读取。
- 资料应用改用共享资料边界；聊天体验也迁移到共享边界，跨应用桥不再写错空间。
- 联系人保存资料档案 ID，运行时可以准确找到对应人物档案。
- `compileRuntime()` 新增关系状态、绑定世界、公开条目和启用规则的编译能力。
- 资料规则模块增加启用/停用 UI；启用后下一次聊天生成才会带入运行上下文。
- 资料页运行检查文案已改为反映真实状态，不再把已接通能力显示成“未来功能”。

## 当前下一条开发顺序

1. API 对照审计与 API-01 AITransport Interface 收口已完成；下一步按 API-02 建 Provider Network Policy、按 API-03 实现生产 Stateless Relay Adapter。
2. 再实现 Web/PWA 的托管、HTTPS、manifest、Service Worker 安装/更新和真实手机生产连通性；保持现有 App lifecycle、Store 与失败恢复。
3. 首个 Archive lazy slice 已完成；第二个 App/route 只有在重新证明首屏非关键、失败可恢复且不会削弱 Chat/Settings 闭环后才迁移。
4. 全局 restore 与 IndexedDB 媒体仓库继续等待独立容量证据、格式合同、事务和 reload 验收。
5. 发布前删除整个 `reference-sources/`，并扫描正式代码、测试、文档和构建产物中的外部痕迹。

## 验证记录

- 当前全量测试：64 个测试文件、1974 个断言、0 失败、0 跳过。
- 当前生产审计：155 files / 20.74 MiB；62 eager requests；981.1 KiB raw / 239.7 KiB gzip / 198.2 KiB Brotli 估算。硬预算通过，output-size 与 request-count warning 保留。
- 纵向矩阵覆盖人物档案、世界条目、Generation Profile、事件记忆、请求 trace、持久化、portable transfer、资源降级与 fresh reload；真实浏览器日志为 0 warnings / 0 errors。
