# 预设系统 · codex 开工包

> 日期：2026-08-02
> 性质：**给 codex（周一复工）可直接执行的落地规格**。预设**内容/契约**已在 `docs/preset-control-v1.md` 定稿，本文件是把那份内容变成"照做就能交付"的代码 + UI 清单。codex 开工先读 `preset-control-v1.md`（内容）再读本文件（怎么落地）。
> 分工：Claude 已把**文字/契约/防油腻核心纪律**备好；**代码逻辑由 Claude 或 codex 写皆可，UI 交 codex**。本文件把两端接口钉死，避免扯皮。
> 边界（用户已拍板）：**自研内核 + 边界翻译**，内部不直接存酒馆 schema；生态靠导入端丝滑转译。阅后即焚红线遵守，不落专有名词。

---

## 0. 一句话承接现状

- 预设**契约/生成器文本/上传格式/防油腻纪律**已定稿于 `preset-control-v1.md`（§1/§2/§3/§8）与核心（`runtime-core.js` [Core 27]，core-v0.3）。
- Mercury 运行时已有编译槽：`compileRuntime({ ..., userPreset: { id, instructions } })`（`chat-contracts.js:215`），app 侧 `buildRuntimeInput()`（`mercury-chat-app.js:456`）目前 `userPreset: null`，等你接。
- 存储基建模板：`docs/feature-store-layer.md` §4（统一 `_commit` + normalize + 坏数据留存）——新 store 照它建，别另起炉灶。

---

## 1. 要交付的四个产物

| # | 产物 | 归属 | 关键接口 |
|---|---|---|---|
| 1 | `UserPresetStore`（存预设列表） | 逻辑代码 | 见 §2 |
| 2 | 生成器 `assemblePresetInstructions(preset)` | 逻辑代码 | 见 §3 |
| 3 | 契约校验 `validateUserPreset(preset)` | 逻辑代码 | 见 §4 |
| 4 | 聊天接线 + 设置面板/预设编辑器 UI | UI（codex）+ 少量接线 | 见 §5/§6 |

> 核心逻辑（1–3）**不依赖 UI**，可立刻开工；UI（4）等 codex。理想：codex 来之前核心逻辑已写好，codex 专注 UI + 接线。

---

## 2. 产物 1：UserPresetStore（存储）

**放**：`app/system/user-preset-store.js`（新文件），命名空间 `mercury.apps.userPresets` 存列表。
**建法**：照 `docs/feature-store-layer.md` §4 模板（`_commit` + `#normalizeAll` + `corrupt` 留存），不要旧店那套。

```js
class MercuryUserPresetStore {
  constructor({ storage, storageKey }) {}  // storageKey 默认 mercury.apps.userPresets
  list()            // 返回预设数组（含内置 preset-default）
  get(id)           // 单个预设
  add(preset)       // 新建/覆盖（同 id）
  remove(id)
  // 以下看是否要，MVP 可略
  // export(preset) → { kind, PresetFormat, preset }  字符串
  // importFromText(rawText) → candidate（走校验，见 §4）
}
```

**内置默认**：`preset-default` 数据直接取 `preset-control-v1.md` §5.1（骨架 + rel.respect-card + int.balanced + pro.standard）。用常量硬编码在 store 里作为兜底，未显式启用时 `get(null)` 返回它。

**接受清单**：
- `list()` 始终含 `preset-default`（即使 localStorage 空）。
- 加 bad 数据不清空、`corrupt` 留存（照 feature 模板）。
- store 测试照 `notification-store.test.js` 的 FakeStorage 写法，至少 见 feature-template 三必测点。

---

## 3. 产物 2：生成器 `assemblePresetInstructions(preset)`

**输入**：一个规范化的 `UserPreset`（§1 契约，`modules.order` / `modules.enabled` / `custom`）。
**输出**：一段 string（作为 `compileRuntime.userPreset.instructions` 喂进去）。
**规则**（对齐 `preset-control-v1.md` §3 顶部"用法"）：
1. 按 `modules.order` 依序拼，**只拼 `enabled` 为 true 的模块**。
2. 互斥组（group.rel/int/pro）内只取 `enabled` 的那个候选的文本；基准文本映射表见 `preset-control-v1.md` §2 + §3（例如 `rel.respect-card` → §3.1a 文本）。
3. 骨架段（skeleton.*）最前；偏好项（pref.*）依序；未知模块按其随文件带来的文本原样拼入。
4. `custom.instructions` 非空时，追加在最后。
5. 段间空行，每段以角色立场写（生成文本已按此写好，直接取）。
6. **不在这里碰活人感**——防油腻/活人感纪律在核心（core-v0.3），预设只带玩法，不重复带反 AI 味。

**实现建议**：`assemblePresetInstructions` 内部持有一张 `{ moduleId: text }` 的映射表（把 §3 的中文文本常量搬进一个 `preset-content.js` 或直接内联）。未知模块 id 从 `preset.modules.texts[id]` 取（上传预设随文件带的文本），取不到则该模块跳过 + 记 warning。

**接受清单**：
- `assemblePresetInstructions(preset-default)` 的输出 == §5.1 注释里"逐段取 §3"那份拼起来的正文（供 diff 断言）。
- 输入 enabled 里某互斥组两个候选同时 true → 视为不合法（见 §4），生成器仍按 order 优先取第一个，但应标 warning。
- 返回非空 string；空预设返回空字符串（不该 `null`）。

---

## 4. 产物 3：契约校验 `validateUserPreset(preset)`

拒绝非法预设，返回 `{ ok, errors: [] }`（或 throw，看工程风格）。校验项（对齐 `preset-control-v1.md` §1.2/§4）：
1. 顶层有 `id`、`name`。
2. `modules` 是对象，含 `order`（数组）与 `enabled`（对象）。
3. **互斥组不多选**：对每个已知互斥组（`group.rel` / `group.int` / `group.pro`），`enabled` 内该组候选 true 的数量 ≤ 1。
4. `order` 里每一项都在 `enabled` 中有定义；`order` 不含 `enabled` 里 false 的互斥候选（非开启的不进 order）。
5. 未知模块：允许存在（上传预设可能带库外模块），只要它带自身文本；不带文本且库不认 → 标 warning 或丢弃（`preset-control-v1.md` §8 定"未知模块丢弃"）。
6. `custom` 可选。

**风格**：照 `chat-contracts.js` 的 `validateSettings` 那种 `fail()`/返回错误集合方式，别用新风格。配一个 `validateUserPreset` 的测试（几个边界用例：互斥双选拒绝、order 含未启用拒绝、未知模块不炸）。

---

## 5. 产物 4a：聊天接线（进 `buildRuntimeInput`）

`mercury-chat-app.js:456` `buildRuntimeInput()` 现在 `userPreset: null`。改成：
```js
const presetId = /* 当前对话绑定的 userPresetId，见 §5.1 */;
const preset = (presetId && userPresetStore.get(presetId)) || userPresetStore.get(null /*default*/);
...
userPreset: preset ? { id: preset.id, instructions: assemblePresetInstructions(preset) } : null,
```
优先级：**对话绑定 > 全局默认**。预设仍走 `userPreset` 槽、前置顺序不变（`compileRuntime` 已管）。

### 5.1 对话绑定 `userPresetId`
`chat-experience-contracts.js` 的 `DEFAULT_CONVERSATION_SETTINGS` 加字段 `userPresetId: null`（可空=用全局默认）。`ConversationSettings` 校验如有白名单，把 `userPresetId` 视为可空 string、不固定值（延续 `preset-control-v1.md` §5「每对话绑定」）。

**接受清单**：
- 对话未指定 userPresetId → `preset-default` 生效；指定了已存预设 id → 用那个。
- 绑定的 id 不存在（预设被删）→ 静默回退到 preset-default，不崩。

---

## 6. 产物 4b：UI（交 codex）——按 `preset-control-v1.md` §6 做，这里只钉组件清单

不做固定四格面板，做**瀑布卡片**（§6.3，用户拍板）。codex 需要产出这些**组件/事件**：

| 组件 | 位置 | 逻辑 | 数据 |
|---|---|---|---|
| 预设入口 | 对话设置（铃铛/齿轮）里一行「玩法预设」 | 点开进预设面板 | |
| 预设列表 | 面板顶部 | 切换启用：内置默认 + 已存预设 | `store.list()` |
| 预设编辑器（瀑布卡片） | 面板主体 | 一卡一模块，按 `modules.order` 堆叠；组内单选；骨架必开只读；自由文本卡嵌输入框；新增/未知模块末尾追加新卡 | `store.get(id)` → 编辑 → `store.add()` |
| 即时预览 | 编辑右侧/底部只读 | 实时显示 `assemblePresetInstructions` 结果 | `assemblePresetInstructions(editingPreset)` |
| 导入/导出 | 列表/编辑器 | 复用 Archive 的 file-picker 链路 | `store.importFromText` / `store.export` |
| 状态反馈 | 对话顶部/设置 | 显示当前生效预设名 | 绑定的 `userPresetId` |

**UI 红线**（别越界）：
- **别改契约层**（modules 列表结构不动）；UI 只做展示/开关/单选/文本。
- **别并入 `DEFAULT_SETTINGS`**（那是呈现层）；预设面板和"气泡/分泡/心声"区**分开放、不合并**（§6.4）。
- **别碰活人感**——防油腻纪律在核心，预设 UI 不涉入。
- 上传走 §8 审核预览（复用 `archive-app` 的 import-review 皮肤），安全红线：纯文本、不执行、不自动进聊天。

---

## 7. 依赖检查 / 给 codex 的先读清单

1. `docs/preset-control-v1.md` — 内容契约（§1/§2/§3/§5.1/§8）
2. `docs/feature-store-layer.md` — 存储加固模板（§4）
3. `app/core/chat-contracts.js` `compileRuntime`（:215）— userPreset 槽
4. `app/apps/mercury-chat-app.js` `buildRuntimeInput`（:456）— 接线点
5. `app/core/chat-experience-contracts.js` — DEFAULT_CONVERSATION_SETTINGS 加 userPresetId
6. `app/apps/archive-app.js` `openFilePicker/prepareImport/confirmImport` — 导入链路复用
7. 现有测试跑法：`node app/tests/*.test.js`（FakeStorage + `N assertions passed` 手动维护，见 `dev-progress`）

---

## 8. 验收清单（全做完再算预设件完成）

- [ ] `UserPresetStore` 建好，`list()` 恒含 `preset-default`，坏数据不清空
- [ ] `assemblePresetInstructions(preset-default)` 输出与 §5.1 一致
- [ ] `validateUserPreset` 拒绝互斥双选 / order 含未启用，未知模块不炸
- [ ] 对话绑定 `userPresetId` 接入，缺省回退 preset-default，绑定不存在回退不崩
- [ ] UI 瀑布卡片编辑器可建/改/存预设，即时预览正确
- [ ] 导入导出走 Archive 链路，审核预览，未知模块丢弃
- [ ] 全测试绿；新 store/校验都配了测试
