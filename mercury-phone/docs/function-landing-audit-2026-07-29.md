# Mercury 功能落地盘点

日期：2026-07-29

## 结论

不要把所有功能做成同一张 UI。应统一视觉语言和页面骨架，但按任务类型分成三套：

1. 设置类：统一列表、分组、开关、选择器和详情页骨架。
2. 美化类：统一“实时预览 + 素材选择 + 裁切/参数 + 应用范围”的编辑器。
3. 任务类：朋友圈、钱包、Archive、相机、音乐、计算器、计时器保留各自专用界面。

优先处理“已有正式页面但入口未连接”的项目，再做纯演示落地页。

## 当前流程

### 1. 朋友圈

健康度：良好，Demo 主流程已可展示。

![朋友圈](../artifacts/function-audit/01-moments.png)

- 已有动态流、九宫格、点赞、评论、发布入口和沉浸式半屏封面。
- 发布与互动属于 Demo Presentation Adapter，不应写入正式会话、正式 localStorage 或 API。
- 仍缺少联系人维度的动态入口，以及用户/角色各自封面的美化管理。

### 2. Me

健康度：部分可用，入口密度高但大部分没有落地。

![Me](../artifacts/function-audit/02-me.png)

- “朋友圈”和“Profile & Appearance”有页面。
- Wallet、Archive、Appearance、Notifications、Data & Privacy、AI Connection 均显示为可点击行，但当前回调为空。
- Archive 和 AI Connection 实际已有独立页面，属于“页面已存在但入口断开”，不应重新做一套。

### 3. Profile & Appearance

健康度：功能可触发，视觉和信息架构未完成。

![Profile & Appearance](../artifacts/function-audit/03-profile-appearance.png)

- 更换头像、主页背景、名称和状态已经有基础动作。
- 当前是四个裸按钮，没有预览、当前值、裁切、撤销和应用范围。
- “朋友圈半屏封面”应在这里出现，并同时支持自己和角色。

## 未绑定与半落地清单

### Mercury Chat / Me

| 功能 | 当前状态 | 建议落地 |
| --- | --- | --- |
| Profile options | 禁用 | 先不做；并入编辑资料或更多操作菜单 |
| Wallet | 空回调 | 独立钱包首页 |
| Archive | 空回调，但 Archive App 已完整存在 | 直接跨 App 打开 Archive |
| Appearance | 空回调 | 打开统一美化中心 |
| Notifications | 空回调，但系统通知中心已存在 | 打开通知设置，不复制通知列表 |
| Data & Privacy | 空回调 | 打开设置详情页 |
| AI Connection | 空回调，但 Settings 内已有正式页 | 直接打开 Settings 的 AI Connection |

### 对话与发送面板

| 功能 | 当前状态 | 建议落地 |
| --- | --- | --- |
| 新建会话 | 只切换状态，没有可见面板 | 联系人选择页/新会话页 |
| 图片 | 只显示 Coming soon 状态 | 系统媒体选择器 |
| 表情包 | 只显示 Coming soon 状态 | 表情面板 |
| 转账 | 只显示 Coming soon 状态 | 钱包子流程，Demo 使用独立模拟账本 |
| 红包 | 只显示 Coming soon 状态 | 钱包子流程，独立红包样式 |
| 聊天背景 | 有路由，但页面没有背景选择 | 美化编辑器的聊天背景模式 |
| 气泡样式 | 仅循环文本值，无预览 | 美化编辑器的气泡模式 |
| 聊天字体 | 仅循环文本值，无预览 | 美化编辑器的字体模式 |
| 删除消息/重新生成 | 按钮禁用 | 正式聊天能力，不能用 Demo 假实现 |

### Contacts / 角色资料

| 功能 | 当前状态 | 建议落地 |
| --- | --- | --- |
| 联系人搜索 | 输入框无过滤逻辑 | 当前列表内即时筛选 |
| Profile notes | 空回调 | 角色资料子页 |
| World context | 空回调 | 复用 Archive 的世界绑定视图 |
| Key moments | 空回调 | 角色关键记忆只读/编辑页 |
| Proactive messages | 空回调 | 角色主动消息设置页 |
| 角色朋友圈 | 入口缺失 | 打开按角色筛选的朋友圈 |
| 角色美化 | 只有头像和主页背景 | 增加朋友圈封面及聊天视觉入口 |

### Settings

Settings 当前只有 AI Connection 和 Usage & Costs 有详情页。以下行只显示 Coming soon：

- Appearance
- Home & Widgets
- Lock Screen
- Notifications
- Sound & Feedback
- Data & Privacy
- General

这些应统一使用 Settings 详情页骨架，不需要七套不同布局。

### 桌面与系统入口

| 功能 | 当前状态 | 建议落地 |
| --- | --- | --- |
| Lumi 小组件 | 无点击行为 | 打开默认角色或状态页 |
| Moments 小组件 | 无点击行为 | Demo 打开朋友圈；Production 无适配器时隐藏或降级 |
| Memory 小组件 | 无点击行为 | 打开记忆摘要 |
| Home & Widgets 小组件 | 无点击行为 | 打开 Settings 对应详情 |
| Photos/Moments 图标 | App 未注册 | 统一到朋友圈或媒体库，避免两个名称指向不明 |
| Calculator | App 未注册 | 独立工具页 |
| Timer | App 未注册 | 独立工具页 |
| Market | 禁用且 App 未注册 | 金融玩法首页，后置 |
| Camera | App 未注册 | 独立相机/媒体选择页 |
| Music | App 未注册 | 独立播放器 |

Archive、Settings 和 Mercury Chat 是当前仅注册的三个 App。其余桌面图标都会被启动器拒绝。

## UI 复用决策

### 共用设置页骨架

适用：Notifications、Data & Privacy、AI Connection、Home & Widgets、Lock Screen、Sound、General、角色主动消息、会话设置。

统一内容：

- 顶部导航和返回
- 分组标题与设置行
- 开关、单选、步进器、说明和危险操作区
- 保存反馈、空状态和错误状态

内容按功能变化，不复制页面结构。

### 共用美化编辑器

适用：头像、个人主页背景、角色主页背景、朋友圈半屏封面、聊天背景、气泡、字体、主题色。

统一结构：

- 顶部实时预览
- 素材来源：内置、上传、最近使用
- 图片模式：裁切位置、缩放、亮度/遮罩、恢复默认
- 样式模式：缩略图选项、颜色样本、字体预览
- 应用范围：当前角色、全部对话或系统

不同模式只替换预览画布和参数，不换一套导航。

### 独立任务页面

以下功能不能套设置页：

- 朋友圈：动态流、发布器、评论与点赞
- Wallet：余额、流水、转账、红包
- Archive：角色、世界、导入与运行检查
- Camera/媒体：拍摄、预览、选择
- Music：播放队列与播放器
- Calculator/Timer：各自工具界面
- Market：行情/金融玩法

它们只共享颜色、字体、图标、按钮和安全区规则。

## 朋友圈封面纳入美化

入口建议：

- 自己：`Me > Profile & Appearance > 朋友圈封面`
- 角色：`Contacts > 角色资料 > 美化 > 朋友圈封面`
- 朋友圈相机按钮：只负责发布，不承担换封面；点击封面本身可进入封面编辑器

数据建议：

```text
Presentation Profile
  user.momentsCover
  contacts[contactId].momentsCover

momentsCover
  assetId / source
  cropX / cropY / zoom
  veil / brightness
```

Demo Mode 从 `.local-demo` fixtures 读取并只写 Demo 内存状态。Production 由正式 Presentation Adapter 读取正式资料 Store；不要写入 `ConversationV2`。

## 建议优先级

### P0：连接已有页面

- Me > Archive
- Me > AI Connection
- Me > Notifications
- Me > Appearance
- 桌面 Moments/小组件 > 朋友圈
- Contacts > 角色朋友圈

### P1：完成统一美化中心

- 自己与角色的朋友圈半屏封面
- 头像、主页背景
- 聊天背景、气泡、字体
- 预览、裁切、恢复默认和应用范围

### P2：补齐高展示价值的 Demo 落地页

- Wallet 首页、转账、红包
- 新建会话、图片、表情包
- Profile notes、World context、Key moments、Proactive messages

### P3：独立工具和金融玩法

- Camera、Music、Calculator、Timer、Market

## 可见性与无障碍风险

- Profile & Appearance 当前四个按钮拥挤且没有当前状态，中文文字在窄屏下容易挤压。
- 多个看似可点击的行实际无反应，用户无法区分“未开放”和“故障”。
- 仅凭截图不能确认键盘焦点、读屏顺序、触控目标尺寸和动态状态播报；实现落地页后需要单独测试。

