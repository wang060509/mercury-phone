# Mercury Phone — 开发交接（2026-07-26）

## 今日结论

Mercury Phone 已完成从纯聊天壳到「本地代理 + Archive 第一阶段」的可运行基础：聊天继续通过本地 Node 代理访问 OpenAI-compatible 服务；Archive 已进入正式 Mercury 系统壳，具备安全导入、角色运行档案、最小世界条目、Prompt Module 保存与 ContactInstance 占位。

今天重点不是新增功能，而是完成 Archive 的阶段封口与审查修复。当前可以继续向 Runtime / 用户预设的最小闭环推进，但不应直接开始复杂世界模拟、隐藏预设或联系人关系系统。

## 已验证的当前状态

### Chat 与本地 API

- Chat 保持 `ConversationV2`、`AssistantTurn`、普通 JSON 严格解析和单气泡降级。
- 前端只调用本地 `/api/chat`；Settings 只通过 `/api/provider/test` 测试 provider 连接。
- 真实 provider 连接曾验证成功；凭证仍局限于 Settings / CredentialStore / AITransport 边界。
- 非流式；尚未实现取消、重试 UI、重新生成、长期记忆写入或 Runtime 正文编译。

### Archive 第一阶段

- Archive 已从 Mercury Home 进入正式 App Engine，复用系统状态栏、返回与 Home Indicator；页面内没有第二套模拟状态栏。
- `archive.v1` 包含 `SourceAsset`、`RuntimeProfile`、`WorldProfile`、`PromptModule`、`ContactInstance`。
- 导入内容只按纯文本保存；HTML/CSS/JavaScript 字符串不会执行或进入 Chat。
- 角色、最小世界与 Prompt Module 均可保存和阅读；Prompt Module 明确为「已保存，尚未影响 Chat」。
- 删除角色时会清理其 `ContactInstance`，但保留原始 `SourceAsset`。

### 本次封口修复（已复查）

- Store 的所有写入都通过 `save()`；写入失败统一抛出 `ARCHIVE_STORAGE_WRITE_FAILED`，并保留原始 `cause`。
- Archive UI 的写入失败会显示安全的本地存储提示；成功重试后会清空横幅。
- `safeStore()` 仅依据稳定错误码决定存储提示，不再按错误文案猜测类别，也不显示未知异常原文。
- Archive preview 的 `Import JSON` / Imports 路由已恢复，`importReviewPage()` 可达。
- CSS 结构检查已改为 `css-tree` AST 解析；避免旧的双重 CSS 定义回归。

## 验证记录

从工作区根目录执行：

```powershell
npm test
npm run build:production
npm run audit:production
```

- `npm test`：通过；22 个测试文件、0 failed、0 skipped。运行器报告 513 个静态 `assert.*` 调用点；它不是运行时断言总次数，报告时不得写成「513 个实际断言」。
- `npm run build:production`：通过，输出为 `mercury-phone/dist`。
- `npm run audit:production`：构建内容、部署 manifest、入口检查通过；Git release anomaly 检查失败，因为当前工作区 `.git` 元数据不是有效 Git 仓库。
- `dist` 顶层仅有 `apps`、`assets`、`core`、`locales`、`styles`、`system`、`index.html`、`main.js`；未发现 tests、server、`.env`、design preview 或内部文档。

## 已知风险与不要误做的事

1. Git 发布审计当前无法通过。它不是应用逻辑故障，但在恢复有效 Git 元数据或调整正式交付环境前，不能宣称发布门禁全绿。
2. Archive preview 仅是视觉参考，不是正式应用的第二实现；以后任何功能验收都必须在 Mercury 正式壳内完成。
3. 当前测试运行器的断言计数是静态计数。若需要真正运行时断言总数，应先改造 runner，不能继续用现有数字做质量宣传。
4. Archive 目前不会把 ContactInstance 写入 Chat 联系人，也不会把 Prompt Module / World 数据传入模型；这是刻意的边界，不是遗漏。
5. 世界书具体产品语义尚未冻结。不要为地图、时间线、触发器、复杂关系图或自动世界模拟开工。

## 明日任务：加速但不越界

### P0 — 30 至 60 分钟：封口复核与发布门禁

目标：让今天的修复变成可信基线，而不是「看起来通过」。

- 在正式 Mercury 壳手工走一遍：导入文件 -> Review -> Confirm -> 角色详情 -> 创建 ContactInstance -> 返回 Archive。
- 人工模拟一次 localStorage 写入失败，再恢复后重试；确认横幅出现、成功后消失、数据没有半写入。
- 确认 preview 的 Imports 与 Review 页面仅作演示，正式功能仍只从正式 Archive 验收。
- 查明 `.git` 元数据为何不可用：如果是工作区挂载限制，记录为环境门禁；如果仓库损坏，恢复有效仓库前不做发布声明。

完成标准：以上流程有截图或简短验收记录；生产审计的唯一失败原因可解释且被明确归类。

### P1 — 半天：冻结 Runtime Core 与用户预设的数据契约

目标：为「用户写预设，真实聊天可受控响应」建立唯一正确的输入边界，先不写最终提示词正文。

- 明确定义 `RuntimeCore`、`RuntimeModule`、`UserPreset`、`RuntimeCompilationInput`、`RuntimeCompilationOutput` 的版本化纯数据契约。
- 定义优先级：Core > Safety / product rules > conversation context > approved character/world/module data > user preset > temporary request hints。
- 明确 provenance：编译结果必须能说明每段来自 Core、用户预设、角色、世界、模块或会话上下文。
- 定义 UserPreset 的最小生命周期：草稿、保存、启用、禁用、复制；先只支持用户主动编辑，不读取 API Key，不导入隐藏预设。
- 补契约测试：不能覆盖 Core、不能泄露凭证、Prompt Module 仍默认 inactive、缺少数据时可稳定编译。

完成标准：一份 `docs/runtime-phase-0.md`、纯数据模块与单元测试；不修改 Chat UI，不向 provider 发送 Runtime 正文。

### P2 — 半天：选择并实现一个完整垂直切片

建议选择：**一个用户预设保存后进入 Runtime Compiler，再作为可审计的 compiledSystemText 传给本地 `/api/chat`，最终产生一个 AssistantTurn。**

这是最快能证明产品核心价值的一条线，因为它穿过现有 Chat、本地代理、真实 provider 和未来 Archive 的数据边界；不要同时开始 Contacts、世界书触发器和视觉重做。

前置决定：默认预设是全局还是按 ContactInstance 绑定。建议第一版只做「全局默认 + 会话临时覆盖」，按角色绑定留到联系人正式接入后。

完成标准：设置一个中性预设 -> 发送测试消息 -> 开发态能查看安全 provenance -> 聊天中可验证结果来自该编译输入；API Key 和原始导入内容不进入会话导出或 Usage。

### P3 — 可并行：缩短后续视觉返工

- 把已选的 Archive 视觉规格整理成一页 Design Lock：正式壳尺寸、状态栏归属、页面顶部结构、列表卡片、按钮、空状态、允许使用的素材池。
- 禁止再把独立 preview 当正式页面复制；每个视觉改动都先在正式壳的真实 viewport 截图对比。
- 为角色封面建立资产轮换表：玻璃、水面、雾林、光点等中性自建方向，避免叶脉图成为全局背景。

## 头脑风暴：未来两周的正确加速方式

### 1. 以「可用闭环」取代「页面数量」

优先完成：用户预设 -> Runtime 编译 -> Chat 请求 -> 可追溯回复。它能立即验证产品差异；世界书和复杂关系图即使做得漂亮，在未进入 Runtime 前也不会产生真实价值。

### 2. 将 Archive 定位为 Runtime 的可信资料库

Archive 不应变成第二个聊天 App。它的价值是保存原始资料、让用户审核结构化档案、管理可启用模块，并在未来向 Runtime Compiler 提供受控输入。

### 3. 联系人是下一道产品闸门，而不是当前的数据副本

当 RuntimeProfile 已 ready 后，创建 ContactInstance 才应真正生成或绑定一个 Chat contact。这个阶段要先定义：一个角色能否有多个 timeline、联系人删除是否保留角色、会话如何选择 RuntimeProfile。先冻结三条规则，再做 UI。

### 4. 世界书先解决「何时生效」，再解决「写多少」

第一版只需世界绑定、条目优先级、alwaysActive、visibility 与手动启用。语义检索、地图、时间流逝与条件触发必须等真实聊天上下文和 Runtime provenance 都稳定后再做。

### 5. 设立每日不可妥协的质量门

- 真实正式壳截图，而非仅 preview。
- `npm test`、production build、production audit 都记录输出。
- 新增的路由、主按钮和失败状态必须至少有一个交互测试。
- 文档只写已验证事实；测试计数要说明是静态调用点还是运行时计数。

## 需要产品侧尽快决定的三个问题

1. 用户预设第一版的作用域：全局默认、单联系人、还是两者都有？建议从「全局默认 + 会话临时覆盖」开始。
2. ContactInstance 创建后是否立即在 Chats 列表显示？建议下一阶段才接入，创建时让用户明确确认。
3. 世界书第一版是否只允许手动启用条目？建议是；这样可以先交付可靠控制，再讨论自动触发。

## 下一位开发者的起点

先读：

- `docs/development.md`
- `docs/archive-phase-1.md`
- 本文件
- `app/core/archive-contracts.js`
- `app/apps/archive-app.js`
- `app/core/chat-contracts.js`

不要修改 Chat 视觉、System Shell 或 Home，除非任务明确要求。先完成 P0 复核，再进入 Runtime Core / UserPreset 契约工作。
