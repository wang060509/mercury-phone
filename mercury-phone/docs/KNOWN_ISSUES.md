# Mercury Phone 已知问题与风险

更新日期：2026-09-06。状态：**确认**表示当前源码直接可见；**未验证**表示没有足够运行证据。

## 确认问题

### Relay 将预设正文误判为凭据字段（已解决）

- **状态**：已解决（2026-08-18）。
- **根因**：服务端使用正则扫描整个序列化 Chat request；外部预设正文只要出现 `secret`、`credential`、`authorization` 或 `apiKey` 等正常词汇，请求就在调用模型前被拒绝。
- **修复**：凭据防泄漏改为递归检查对象字段名，不检查角色、世界书、记忆、消息或 Generation Profile 的自由文本值。
- **防复发**：测试覆盖正常提示词包含上述词汇仍可到达 provider，以及顶层和嵌套 `apiKey/api_key` 字段继续被拒绝。私有参考预检显示此问题会影响大多数成熟样例，因此不得恢复全文关键词拦截。

### Settings 连接成功但 Chat 无法读取会话 Key（已解决）

- **状态**：已解决（2026-08-18）。
- **根因**：关闭“记住 API Key”时，Settings 测试按钮直接使用控制器内存值，但持久化层会清空 Key；AITransport 只读取持久化层，形成两条不一致的凭据路径。
- **修复**：新增当前标签页 session credential store；Settings 输入同步到会话层，AITransport 合并会话与长期连接。Settings 以外的 App 不获得凭据 facade，关闭标签页后会话 Key 清除。
- **防复发**：测试覆盖非持久 Key 的 Settings 输入、Settings 重建、AITransport 读取、长期存储保持空值，以及 Chat facade 不暴露凭据接口。

### 新标签页缺少会话 Key 时 Chat 静默失败（已解决）

- **状态**：已解决（2026-08-20）。
- **根因**：session credential 按标签页隔离符合既定规则，但 Chat 过去没有发送前 Connection Readiness；它先写入 user turn，再在异步请求中失败，同时只把错误放进未渲染的 `ui.lastError`。
- **修复**：AITransport 提供不含凭据的安全 readiness；Chat Generation Workflow 在任何写入前同步预检。配置失败不落库、保留草稿，并显示含真实安全原因、“前往 AI 连接”和“重新发送”的页内错误卡；网络/模型失败继续保留原 turn 与重试语义。
- **防复发**：自动回归覆盖无配置/session-only/不泄漏 Key、零提交、retry delivery、可见按钮、Settings 深链路和配置后单次重试。真实浏览器确认重复预检时消息数 4→4、草稿跨 reload 保留、错误卡可见且 0 console errors。

### 角色导入成功后难以找到、重名难辨且无开场时路径中断（已解决）

- **状态**：已解决（2026-08-20）。
- **根因**：Resource Intake 虽已原子提交角色与联系人，但 Chat 只取回 `contact` 后立即清空提示；新联系人按旧顺序落在选择页末尾，重名只显示角色身份；开场过滤器会静默丢掉来源说明，场景页在 0 个候选时没有继续动作。
- **修复**：Workflow 返回稳定 Mercury outcome；Chat 显示不自动消失的成功回执，将新联系人置顶/高亮，使用 SourceAsset 文件来源和同源“副本 N”区分重名。开场分类保留被拒原因和安全备选；没有可用开场时可从回执或场景页进入不伪造消息的空白会话。
- **防复发**：合同覆盖 committed outcome、重复 ID/名称、不同来源、同文件副本、首条元数据 + 安全备选、完全无开场、可见按钮标签和 0 消息空白会话。真实浏览器以私有复杂样例确认 15 个安全备选、同源副本 1/2/3、空白会话输入框与 0 console warnings/errors；样例本身不进入仓库。

### `/models` 成功被误报为模型可聊天（已解决）

- **症状**：设置页可显示“连接成功”，但实际 Chat 仍可能因模型名、`chat/completions` 路径、参数、鉴权或响应格式失败。
- **根因**：旧测试只请求 `/models`，且 Settings 自己拼请求；模型发现、真实聊天和角色分析没有统一 provider adapter，连接状态表达超过了实际证据。
- **修复**：Settings 改为调用 AITransport 的 `testConnection()`；服务端 `provider-adapter.js` 成为 URL、鉴权、超时、错误与 JSON 解析的唯一 OpenAI-compatible 边界。测试连接先做可选模型发现，再以当前模型运行最小真实生成。
- **防复发**：禁止以 `/models` 的 2xx 直接显示“连接成功”；禁止 Settings 绕开 AITransport 自建测试请求；新增假阳性、无 models 端点、完整 endpoint URL 和凭据脱敏回归。

### 外部预设兼容仍有明确边界

- **状态**：确认。
- **证据**：导入已能按结构识别多类常见预设，旧 Profile 也会幂等升级；当前真实档案显示 32 项运行、47 个变量已适配、6 个模板项待处理、33 项保留。只读批量预检中 6 份预设均可规范化，角色卡与世界书未被误判，两份无关合法 JSON 被明确拒绝。
- **影响**：用户不再依赖某一个文件格式或重新导入，但来源预设的 In-Chat 注入、非 system role、状态和脚本语义仍未还原；合法 JSON 也不自动等于预设。
- **当前缓解**：Chat 显示“部分接入”与运行/适配/剩余/保留数量；来源文件、共享 Store、参数与未知宏保持不变，脚本和状态命令不执行。无法识别预设能力的文件返回不支持，不伪装为成功。
- **建议动作**：先对扩大装配后的真实 Profile 做 API 输出回归，再逐类审计剩余项是否能映射到 Mercury 现有合同；没有安全等价语义的内容永久保留，不以兼容为由增加脚本执行器。

### 档案馆模块状态与运行时代码不一致（已解决）

- **状态**：已解决（2026-08-17，Generation Profile Checkpoint 1）。
- **证据**：旧 `archive.v1.promptModules` 已变为只读迁移来源；Chat 不再把它们作为 `runtimeModules` 全局装配。迁移内容保存在 `generation-profiles.v1` 的 Instruction Blocks 中，只有显式选择对应 Profile 才进入原 `userPreset` 槽。
- **剩余工作**：UI-01 Record Cabinet 与 UI-02 Profile Detail 已分别于 2026-08-18、2026-08-19 通过用户视觉确认。Pressing Room 和 Workbench 尚未实施，仍需按阶段获得新的明确开始指令与确认。

### 世界书可见性策略（已解决）

- **状态**：已解决（2026-08-16）。
- **证据**：`resource-contracts.js` 与 `archive-contracts.js` 保留世界/条目 scope 元数据；`worldbook-runtime.js` 在检索前执行 worldVariant、timeline、角色授权和四级 visibility；`runtime-context.test.js` 与 `worldbook-runtime.test.js` 覆盖请求文本和 trace。
- **当前规则**：`objective/public` 仅在已绑定世界内可见；`restricted` 要求世界关联当前运行时角色；`character-specific` 要求条目指向当前运行时角色；无档案角色的显式世界绑定仍可使用公开条目。

### 超长角色与 Generation Profile 可无上限挤占请求（已解决）

- **状态**：已解决（2026-08-20）。
- **根因**：世界书和事件记忆已有 scope 与预算，但角色运行档案和 Generation Profile 仍会把全部可运行文本直接交给 `compileRuntime()`；资源一旦导入成功，不等于本次请求一定有资格无上限进入。
- **修复**：唯一编译入口现在对 Generation Profile 和角色分别执行 16000 / 12000 字符的有序准入；角色身份、稳定特质、动机、价值、边界、行为和声音先于自由背景与 lore。世界书继续限制为 8 条 / 5000 字符，事件继续限制为当前三维 scope 下 Top-3 / 560 字符。四类资源统一写入不含正文的 `resourceTrace.assembly`，截断产生稳定 warning。
- **防复发**：真实请求矩阵覆盖启用与排除、未绑定/越 scope、预算、优先级及 memory disabled。上述限制是 Mercury source lane 的字符预算，不代表 provider token/context window；场景、历史消息和 provider 总上下文仍需在相应独立切片中审计。

### 生产构建已闭环，公开部署仍未闭环

- **状态**：部分解决（2026-09-06 Final Safe Cleanup 更新）。
- **已解决**：`build:production` 可重复重建 `dist/`，并以 production-only bundle 将 Cinema 增量资源收为 2 requests；`release:check` 现串联 86 files / 3052 assertions、production 390x844 smoke、Cinema core E2E 与生产审计。当前产物 162 files / 22.61 MiB，硬预算通过；shell Brotli 已回到 warning budget 内。
- **当前风险**：静态 `dist/` 不包含同源 `/api/*` relay；直接上传静态托管只能运行 UI 和本地数据，真实 Chat/Settings Test/角色分析/Cinema 生成会失败。shell 为 62 requests / 986.1 KiB raw / 241.2 KiB gzip / 199.7 KiB Brotli；output-size 与 request-count warning 保留。
- **建议动作**：下一发布切片只决定托管 + HTTPS + 安全 relay Interface，并做真实部署连通性/缓存验收；第二个加载切片必须先证明不会削弱 Chat 或 Settings 恢复路径，不因体积焦虑迁移框架。

### Provider 网络边界只达到开发强度

- **状态**：确认（2026-08-20 API 架构审计）。
- **证据**：`provider-adapter.js` 已要求 HTTPS、禁止 URL 内凭据、拒绝常见字面私网主机并设置 `redirect: "error"`，但只检查 `url.hostname` 字符串；没有解析 A/AAAA 后分类全部地址，也没有绑定实际连接地址。`readBody()` 先执行 `response.text()`，再用字符串长度判断 512 KiB，不能在下载过程中终止超大响应。开发 server 也没有生产 rate/concurrency/origin/host policy。
- **影响**：公开 Stateless Relay 若原样部署，可能被 DNS rebinding、IPv6/特殊地址或超大响应绕过当前防线，并被当作公开转发/资源消耗入口。OWASP 对可访问任意外部域名的 SSRF 建议要求协议约束、DNS/IP 分类、重定向链控制和受限网络客户端；当前只完成其中一部分。
- **建议动作**：先建独立 Provider Network Policy Module 与假 DNS/fetch 合同测试，再由部署 Adapter 实现 DNS 解析/连接绑定或平台等价限制；流式计数响应字节并尽早 abort；补每路 body、timeout、并发/rate、host/origin、无正文日志和生产 debug 禁用合同。不要把字符串黑名单继续堆成安全方案。

### AITransport Interface 向 Cinema 泄漏凭据装配（已解决）

- **状态**：已解决（2026-08-20，API-01）。
- **修复**：`MercuryCinemaGenerationWorkflow` 只调用 `generateCinema(request, { signal })`；AITransport 将 credential resolution、relay endpoint/payload、Cinema 默认超时和响应验证留在 Implementation，`readCredential/postLocal` 已改为私有方法。
- **合同**：Chat、Settings Test、角色分析、Cinema 四条高层操作均覆盖调用前已经 aborted 时返回 `AbortError` 且 0 fetch；Cinema workflow 的测试 Adapter 不提供任何凭据或底层 POST 方法，证明消费者无法依赖泄漏接口。
- **保持**：新增 AI 能力只能通过面向业务的高层方法进入 AITransport Interface；不得重新公开 Key resolver 或任意 endpoint POST。

### AI 连接信息保存在浏览器本地

- **状态**：确认。
- **证据**：Settings 将 `baseUrl`、`model` 等连接元数据写入长期 storage；API Key 默认只进入当前标签页的 `sessionStorage`，仅在用户明确勾选“记住 API Key”时写入长期 storage。AITransport 通过同一凭据解析路径合并二者并发送到 relay。
- **影响**：默认会话模式可降低共享设备上的长期残留，但当前页面中的恶意脚本仍可能触及会话凭据；用户主动选择“记住”后仍承担长期本地保存风险，站点数据清理也会使连接失效。
- **建议动作**：生产前确定不暴露凭据的请求/代理设计，并写明本地存储和清除数据的影响。

### 会话记录键未包含世界变体

- **状态**：确认，风险待产品规则验证。
- **证据**：会话键由 `contactId` 与 `timelineId` 构成；事件 scope 还包含 `worldVariantId`。
- **影响**：若允许同一联系人、同一时间线使用多个世界变体，消息记录可能共享。
- **建议动作**：在开始多世界变体 UI 前决定世界变体是否等价于独立时间线；否则扩展会话 identity 并迁移数据。

## 未验证问题

### 本地语义模型真实可用性与存储成本

- **状态**：未验证。
- **证据**：代码动态加载模型运行时、下载模型、使用浏览器缓存并提供关键词回退；单元测试覆盖合同和降级，未见真实设备下载/缓存验收记录。
- **影响**：首次使用可能因网络、浏览器能力、配额、模型更新或缓存失效而失败；检索质量尚未证明。
- **建议动作**：用自有事件集做真实设备验收，记录下载、失败回退、清理/重建、模型版本切换、Precision@K 与误召回率。

### 消息提供方兼容性

- **状态**：未验证。
- **证据**：relay 假定兼容 `models` 和 `chat/completions` 的接口，支持开发期不安全地址例外；没有跨多种真实服务的验收矩阵。
- **影响**：不同中转或模型服务可能因路径、认证、响应格式或限制而无法聊天。
- **建议动作**：建立不含真实凭据的兼容性测试矩阵与可读错误说明。

### 浏览器存储配额与大媒体/来源资产

- **状态**：部分处理，仍未完成全局验证。
- **证据**：头像、背景和导入原文可保存为 Data URL/纯文本；Local Data Vault 已通过 `navigator.storage` 显示全浏览器 usage/quota/persisted，并用写探针区分 healthy/degraded/volatile，但尚无每种媒体的写入上限。
- **当前缓解**：会话迁移与普通写入已通过 `MercuryConversationStore` 分类错误；迁移写回失败时继续使用内存中的规范化结果，损坏源不会在自动恢复时被覆盖。Settings 会诚实显示易失或降级状态并允许立即导出脱敏备份。其他 Store 的错误呈现和大媒体预算仍不一致。
- **影响**：用户添加大图或大量资产后写入可能失败，造成保存失败或体验不一致。
- **建议动作**：明确上限、在写入处捕获并展示错误，测试配额失败路径。

### 聊天记录缺少可再导入的传输合同（已解决）

- **修复**：新增版本化 Conversation Transfer Contracts 与无 DOM Workflow；portable JSON 和不可再导入的可读文本明确分流。导入先完整预检，始终新建 timeline，并显式重绑目标联系人、过滤缺失资源。
- **恢复**：正文和会话状态分别写入 Chat 私有/shared storage；任一步失败会跨两个 Adapter 补偿回滚，回滚失败另有错误状态。
- **防复发**：合同/工作流测试锁定损坏 kind/version/ConversationV2/session、重复消息、富媒体、瞬态状态、重复导入、缺失资源降级、角色/scope 重映射和 export→import 等价性。timeline 冲突同时检查私有正文和 shared session，避免覆盖仅有场景/设置的空会话；Chat 会把缺失世界/Profile 和角色重绑定显示在导入回执中。此能力仍不等于全局备份恢复或自动携带角色/世界/Profile 原件。

### 全局备份可以导出但尚不能恢复

- **状态**：确认，是刻意关闭的能力而非遗漏文案。
- **证据**：Local Data Vault 可生成版本化脱敏备份，明确排除 API Key、设备密码、派生向量索引、模型缓存和未知键；Settings 页面也明确说明 restore 尚未开放。
- **原因**：浏览器逐键写入没有原生跨源事务。未完成格式预检、分域写入、受保护键、失败回滚和 reload 验收前开放恢复，会产生比无恢复更危险的半写入状态。
- **建议动作**：单资源 Resource Intake 与单会话 Conversation Transfer 均已完成；全局 restore 仍须另建更宽的独立合同，不把这两种窄补偿事务直接放大为覆盖式恢复。

### Archive 恢复深链路参数错位（已解决）

- **根因**：App Engine 的生命周期合同始终传入 `(context, payload)`，但 Archive 曾声明 `onResume(launchPayload)`，导致已挂载实例恢复时把 context 当成路由参数。
- **修复**：Archive 改为 `onResume(_, launchPayload)`；架构文档明确 render 与 lifecycle 签名。
- **防复发**：App Engine 测试锁定 immutable context 为第一参数、launch payload 为第二参数；Archive 测试通过同一调用合同覆盖 home 与 character deep route。

### 非首屏 Archive 长期占用 eager path（已解决首个切片）

- **根因**：`index.html` 静态加载所有 App CSS/JS，App Engine 只接受已注册 definition；即使用户只进入 Chat，仍为 Archive 支付首屏请求和传输成本。
- **修复**：新增 AppLoader/DOM Asset Adapter，把 Archive CSS/JS 移入 shell-owned lazy manifest。资源完全成功后才注册/激活；失败节点与 Promise 清除后可重试，latest launch ticket 防止慢加载 App 抢回前台。
- **证据**：首次页面 DOM 无 Archive link/script，点击图标后才各注入一次；Chat→Runtime Verification→完整人设首次深链正确。生产 eager 从 63 requests / 229.1 KiB Brotli 降到 62 / 196.6 KiB；浏览器 0 warnings/errors。
- **剩余风险**：仍有 62 个 eager request，超过 55 warning；但 Settings 是连接失败恢复入口，Chat 是产品核心。后续不得只按文件大小盲拆，必须先审计真实首屏依赖、直开文件、失败回退和深链。

### 视觉回归覆盖不足

- **状态**：确认。
- **证据**：`npm run snap` 只定义三个页面；聊天会话、档案馆、设置和资源状态没有统一快照基线。
- **影响**：局部 CSS 改动可能在手机视口破坏滚动、安全边距或消息操作，而测试不捕获。
- **建议动作**：在不重做 UI 的前提下，逐步为聊天会话、档案馆和设置增加真实手机视口截图检查。

### Chat 消息操作面板未专门接入浏览器/系统硬件 Back

- **状态**：已知 Alpha 限制，当前冻结。
- **现状**：消息操作面板支持点击外部、选择动作、Escape 和离开会话时清理；没有新增浏览器 history 或系统硬件 Back 处理。
- **决定**：不为消除理论风险继续修改已冻结 Chat。仅当真实 Alpha 测试证明 Android/浏览器 Back 会破坏面板或 Chat 导航时，再按实际复现补最小修复。

## 临时机制与技术债

- `.local-demo/` 是隔离演示层，不能逐步混入正式聊天数据或 API。
- `mercury-chat-app.js` 仍集中承载大量 UI、运行时装配与消息交互；会话 key/迁移/损坏恢复已移入 `MercuryConversationStore`，生成单飞/取消/失败/重试/重新生成已移入 `MercuryChatGenerationWorkflow`，portable/text 格式与跨 storage 提交已移入 Conversation Transfer Contracts/Workflow。全局数据清单、健康和备份范围已移入 `MercuryLocalDataVault`；下一步只沿独立产品流程继续小步拆分，不做一次性重写。
- `archive-app.js` 仍集中承载角色、导入审核 UI、世界书与 Generation Profile DOM。Generation Profile 的 Cabinet / Detail、overlay 和 cover draft 已迁入独立 flow，导入提交顺序已迁入 Resource Intake Workflow；正式 UI-02 已使用 `profile-detail` route，旧 `module-editor` 仅保留为内部兼容渲染别名，其余领域尚未拆分。
- 当前工作树未发现 Git 元数据，无法通过 `git status` 判断未提交改动或追溯变更；交接前应确认真实版本控制位置与备份策略。
- 参考隔离目录仍在工作区；公开发布前必须执行清理与扫描门禁。

## 敏感信息审计

- **状态**：本次只读扫描未发现 `.env` 文件，也未发现可识别的硬编码 API 密钥、访问令牌或 Bearer 凭据。
- **注意**：宽泛模式在样式文件中产生了一个非凭据误报，未记录其内容；源码中存在凭据字段名和上游 Authorization 逻辑，这是功能代码而不是已填入的凭据。
- **建议动作**：提交或部署前再次运行不回显值的扫描，并确认浏览器 localStorage 不随截图、导出或诊断包泄露。
