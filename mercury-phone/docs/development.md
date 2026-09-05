# Mercury Phone development

This document describes the current local development boundary.

## Run locally

From the workspace root:

```powershell
npm test
npm run build:production
node mercury-phone/server/server.js
```

Open the app through the local server. The browser calls the local proxy; it does not call a provider directly.

## Current call chain

```text
Chat -> AITransport -> POST /api/chat -> local Node proxy
     -> OpenAI-compatible /chat/completions -> strict parser
     -> ChatApiResponse -> AssistantTurn -> ConversationV2

Settings -> POST /api/provider/test -> local Node proxy -> provider /models
```

`/models` 只做可选发现；Settings 的成功状态还必须由当前模型的最小真实生成确认。

## BYOK connection

Settings stores Base URL, Model, and the Remember API Key choice in its private settings storage. The Key defaults to the current tab's session credential store and enters long-term local storage only when the user explicitly enables Remember API Key. It is sent only through the local relay for the requested operation. Chat messages, ConversationV2, runtime data, profiles, memory candidates, exported data, and usage records never contain credentials.

The local proxy accepts `PORT` and the development-only insecure-provider exception. It does not log request bodies or credentials. Provider limits, authentication policy, and billing remain provider responsibilities; this app does not estimate cost.

## Storage and contracts

Chat keeps the existing `conversation.v1` storage key for compatibility. Its value is normalized to ConversationV2. One assistant response is one AssistantTurn, with one to four ordered parts. Failed requests are not persisted as empty assistant turns. `MercuryChatGenerationWorkflow` owns the non-DOM send/retry/regenerate lifecycle through `start(command)`, `cancel()`, and `snapshot()`; the controller supplies storage/runtime Adapters and renders the resulting state. `MercuryConversationTransferWorkflow` separately owns portable JSON/readable text export, preflight, new-timeline import, local resource reconciliation, and rollback across the Chat-private transcript Adapter and shared session Adapter.

## Current boundary

The current build is non-streaming. Retry, regenerate, cancellation, character/world/Profile import, scoped event memory, local persistence, and single-conversation portable export/import are implemented. Portable chat files do not bundle the original character/world/Profile resources, account data, secrets, or derived memory indexes. Accounts, automatic cross-device sync, server-side user data, and a production relay are not implemented.

## Production build

The Release Module copies only runtime HTML, CSS, JavaScript, referenced assets, fonts, and locales from `app`. Tests, local demos, internal documents, and currently unreferenced large source fonts are excluded without deleting source files. The current gate runs 64 test files / 1974 assertions and the production audit, including warning/hard size budgets. The current output is 155 files / 20.74 MiB; Archive is lazy and the eager entrypoint is 62 requests / 198.2 KiB Brotli. Hard budgets pass; output-size and request-count warnings remain.

## Next phase

The DOM-free Chat generation, Resource Intake, Local Data Vault, and Conversation Transfer workflows are complete. The vertical resource-to-chat round-trip matrix now covers import, binding, request assembly, durable save, portable export/import, safe degradation, and fresh reload. The next narrow slice is an audit and implementation of App/route lazy loading behind one launch Interface. Global restore remains closed until format validation, domain transactions, protected-key handling, rollback, and reload checks exist. Public deployment remains a separate slice for HTTPS, a safe same-origin relay, caching, and live connectivity checks.
