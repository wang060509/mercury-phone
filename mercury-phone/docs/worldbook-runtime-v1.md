# Mercury Worldbook Runtime v1

## Scope

This runtime turns imported worldbook entries into bounded conversation context. It is separate from import: a successful import means the resource was preserved locally, not that every entry is sent with every request.

## Binding boundary

- A conversation resolves only worlds bound to its active role profile through `worldBindings` or the world's `relatedProfileIds`.
- Unbound worlds are excluded.
- Disabled entries, private entries, and entries without usable text are excluded.
- A role-card embedded worldbook is stored independently and bound to that imported role before the contact is created.

## Retrieval and budget

For each request, `MercuryWorldBookRuntime.resolve` considers the current user message and the last six supplied messages.

1. Entries matching the current user message are ranked first.
2. Eligible always-active entries are ranked next.
3. Entries matched only in recent history are ranked last.
4. Priority, match count, source-world order, and entry order make ties deterministic.

The default cap is eight entries, 1,200 characters per entry, and 5,000 characters total. An entry can be truncated when enough budget remains; otherwise it is omitted. The trace records every selected entry and every budget warning. Explicit keys remain the preferred trigger. For legacy books that express a universal entry as empty keys plus legacy activation metadata, import translates that behavior to Mercury's `unkeyed-universal` mode. Ordinary keyless entries use only their title/name/tags as a narrow fallback; Mercury does not index the full body as a trigger. Duplicate entries with the same world and entry id are collapsed before budget selection, and the trace exposes raw candidates, deduped candidates, and duplicate count.

## Request assembly and trace

Only selected entries are passed to `runtimeContext.worlds` before `compileRuntime` constructs `systemPrompt`. `buildRuntimeInput` returns a `resourceTrace` and warnings for local inspection. `buildAssistantRequest` keeps that trace local in `lastRuntimeAssembly`; it does not transmit diagnostics to an AI provider.

If the worldbook runtime is unavailable, Mercury sends no worldbook entries and records `world_runtime_unavailable`. This is a deliberate safe downgrade, not a simulated injection.

## Local compatibility validation

The local source folder was read without exporting or storing private content. The validation found four importable role cards with embedded worldbooks and one importable standalone worldbook. A read-only batch probe exercised empty-message and representative-trigger paths: the standalone twelve-entry legacy book selected eight entries within the default budget, while the embedded books also produced bounded candidates. This proves import, normalization, retrieval, and budgeting; it does not claim provider prose quality. No external AI API was connected for this validation. The remaining acceptance step is a provider-backed reply-quality test after the user chooses an API connection.

No external AI API was connected for this validation. The remaining acceptance step is a provider-backed reply-quality test after the user chooses an API connection.
