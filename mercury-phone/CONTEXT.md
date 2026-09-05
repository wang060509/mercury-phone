# Mercury Phone

Mercury Phone 是本地优先的角色聊天手机；本词汇表只定义跨 Archive、Chat、Settings 与运行时都必须保持一致的产品概念。

## Language

**Generation Profile**:
由 Archive 管理、由 Chat 与玩法消费的共享生成资产；它不是连接设置，也不是聊天外观。
_Avoid_: Chat preset、提示词卡、模型配置

**AI Connection**:
一次模型服务连接所需的提供商类型、Base URL、模型与凭据的组合；它属于 Settings，不属于任何角色、会话或 Generation Profile。
_Avoid_: Provider profile、聊天模型卡

**Web/PWA Delivery**:
Mercury 的主要交付形态：用户通过 HTTPS 链接打开并可安装到手机主屏，业务数据继续保存在该浏览器本地；它不等同于云账户、跨设备同步或原生安装包。
_Avoid_: 网页演示、云端版、手机安装包

**Stateless Relay**:
公开 Web/PWA 中位于同源 `/api/*` 后的无状态请求中继；它只校验并转发当前请求，不长期保存用户 API Key、聊天、角色、世界书或 Generation Profile。
_Avoid_: Mercury 后台、云同步服务、API 账号托管

**Session Credential**:
只在当前浏览器标签页生命周期内有效的 AI Connection 凭据；关闭标签页后消失，不能被解释为跨标签页或跨设备同步。
_Avoid_: 临时账号、全局 Key

**Connection Readiness**:
当前标签页是否已经具备发起真实生成所需的完整 AI Connection；它只表达发送前可用性，不等同于模型服务已经通过真实请求验证。
_Avoid_: 连接成功、模型可用

**Conversation Scope**:
由联系人和时间线共同确定的一次聊天边界；生成状态、草稿、消息与恢复动作都不能泄漏到其他 Conversation Scope。
_Avoid_: Chat ID、联系人会话

**Runtime Resource Admission**:
一次生成请求中，对已绑定角色、世界书、Generation Profile 与事件记忆执行启用、范围、优先级和容量边界后的实际入场结果；它不是模型提供商的总 context window。
_Avoid_: 全量提示词拼接、模型 token 上限

**Request Assembly Trace**:
不保存资源正文、只描述本次 Runtime Resource Admission 的绑定、命中、入场量、截断和警告的诊断记录。
_Avoid_: Prompt 备份、聊天日志
