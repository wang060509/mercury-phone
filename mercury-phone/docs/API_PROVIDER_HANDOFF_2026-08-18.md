# Mercury API Provider 修复交接

更新日期：2026-08-18。本文件记录本轮 API 连接事故、修复后的真实边界、验证证据和下一位接手者必须遵守的工程纪律。

## 本轮结论

旧 Settings 仅凭 `GET /models` 成功就显示“连接成功”，而真实 Chat 通过另一条请求链路生成；两条路径对地址、凭据、模型和错误的处理不一致，因此出现“测试成功、聊天失败”的假阳性。

当前已经改为：

```text
Settings Test ─┐
Chat ──────────┼─> AITransport ─> local relay ─> provider-adapter ─> upstream
Role Analysis ─┘
```

- `app/core/ai-transport.js` 是浏览器侧唯一 AI 请求边界；Settings 不再直接调用 `fetch()` 拼测试请求。
- `server/provider-adapter.js` 是 OpenAI-compatible URL、Header、超时、JSON、响应正文和错误脱敏的唯一协议边界。
- `/models` 只用于可选模型发现，不能证明选中模型可生成。
- `/api/provider/test` 必须使用当前模型完成一次最小真实 `chat/completions` 请求后才能报告连接成功。
- 用户填写根地址、`/v1`、`/models` 或完整 `/chat/completions` 地址时，必须先归一化，不能重复追加路径。
- 上游错误越过 relay 前必须分类并脱敏；不得把 API Key、Bearer Token 或原始敏感响应暴露给 UI。

## 已验证

- `npm test`：49 files / 1429 assertions / 0 failures / 0 skipped。
- 回归覆盖 `/models` 成功但真实生成 401、`/models` 404 但真实生成成功、完整 endpoint URL、预取消请求、非 JSON/字符串错误、HTTP 200 内嵌错误和密钥脱敏。
- 真实浏览器 Settings 使用当前 DeepSeek-compatible 配置显示“连接成功”。
- 随后 Runtime Verification 会话使用同一配置发送真实消息并收到“回归通过”。该测试消息已写入对应本地会话。
- Character、World Book、Memory、Generation Profile 与 `compileRuntime()` 输出协议未修改。

## 当前真实支持范围

- 当前只实现 OpenAI-compatible provider adapter。
- 原生 Anthropic、Gemini 等 provider 尚未实现，不得在 UI、文档或汇报中宣称已支持。
- 外部 Generation Profile 当前仍是部分兼容：32 项运行、47 个变量已适配、6 个模板项待处理、33 项保留。API 连接成功不能被描述为这些保留项已经生效。

## 固定工程纪律：Reference Before Reinvention

开始基础设施、兼容层、导入器、存储、同步、Provider、流式协议、错误恢复或安全边界开发前，先完成一次成熟实现审计：

1. 先读 Mercury 当前 contracts、handoff、测试和已知问题，确认问题没有在仓库内解决。
2. 再检查私有参考索引中允许参考的成熟小手机项目，以及相关项目的公开实现或官方文档。
3. 只提取已验证的功能分层、状态机、数据流、失败模式和验收方法；记录参考来源和 Mercury 的取舍。
4. 禁止复制代码、命名、UI、资产、文案或私有字段；所有外部格式必须在导入/adapter 边界翻译为 Mercury 自有合同。
5. 先为成熟项目已经暴露过的失败模式补合同测试，再实施最小闭环。
6. 如果选择偏离成熟做法，必须在 `DECISIONS.md` 写明产品收益、代价和回退方案，不能无证据地另造一条链路。

这条纪律不限制 Mercury 在玩法、交互、信息架构、视觉系统和面向年轻女性用户的美化体验上形成自己的产品表达；它限制的是对已有稳定工程问题的无依据重复试错。

## 受影响文件

### 运行时与服务端

- `app/core/ai-transport.js`
- `app/apps/settings-app.js`
- `app/system/system-services.js`
- `server/provider-adapter.js`
- `server/upstream-client.js`
- `server/chat-handler.js`
- `server/server-contracts.js`

### 测试

- `server/tests/provider-adapter.test.js`
- `server/tests/proxy.test.js`
- `app/tests/ai-transport.test.js`
- `app/tests/settings-app.test.js`
- `app/tests/system-services.test.js`

### 记录

- `artifacts/api-provider-architecture-regression-2026-08-18.md`
- `docs/PROJECT_STATE.md`
- `docs/AI_HANDOFF.md`
- `docs/DECISIONS.md`
- `docs/KNOWN_ISSUES.md`
- `docs/NEXT_STEPS.md`
- `docs/HANDOFF_SUMMARY.md`

## 下一任务入口

新任务先阅读 `README_AI.md`、`PROJECT_STATE.md`、`AI_HANDOFF.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`、`NEXT_STEPS.md`、`GENERATION_PROFILE_UI_HANDOFF.md` 和本文件。

当前产品主线仍是 Generation Profile：UI-01 Record Cabinet 已于 2026-08-18 通过用户视觉确认，下一项产品工作是 Profile Detail；其后仍按 Pressing Room → Tracklist / Workbench 顺序逐阶段确认。不得借 API 修复重新引入旧 `promptModules` 顶层入口、Chat-owned preset Store、第二条 runtime prompt lane，或提前实现 Global → Contact → Session、Model Parameters、Advanced UI 和 Playback。
