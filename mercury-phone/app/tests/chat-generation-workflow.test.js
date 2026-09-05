"use strict";

const assert = require("node:assert/strict");
const contracts = require("../core/chat-contracts.js");
const MercuryChatGenerationWorkflow = require("../use-cases/chat-generation-workflow.js");

const iso = "2026-08-19T12:00:00.000Z";
const clone = (value) => JSON.parse(JSON.stringify(value));

function user(id, text, delivery = "queued") {
  return { id, role: "user", text, createdAt: iso, delivery, replyToId: null, quote: null };
}

function assistant(id, text) {
  return { id, role: "assistant", parts: [{ id: `${id}:part`, text, order: 0, pauseAfter: "none", deliveryStatus: "delivered" }], status: "complete", createdAt: iso, usage: null, unspokenAside: null, legacyMessageId: id };
}

function response(id, text) {
  return { assistantTurn: assistant(id, text), memoryCandidates: [], warnings: [] };
}

function conversation(entries = []) {
  const base = clone(contracts.loadConversation(null).conversation);
  return { ...base, id: "conversation-test", entries: entries.map(clone) };
}

function memoryHost(initial = conversation(), options = {}) {
  let current = clone(initial);
  const scope = { contactId: "contact-a", timelineId: "default" };
  const commits = [];
  const states = [];
  const effects = [];
  return {
    adapter: {
      read: () => ({ conversation: current, scope }),
      commit: (next, meta) => {
        if (options.failCommit) throw new Error("Storage unavailable.");
        contracts.validateConversationV2(next);
        current = clone(next);
        commits.push({ conversation: current, meta });
        return current;
      },
      changed: (state) => states.push(state),
      effect: options.failEffect ? () => { throw new Error("Notification unavailable."); } : (event) => effects.push(event),
    },
    current: () => current,
    scope,
    commits,
    states,
    effects,
  };
}

(async () => {
  // The Interface queues durably before generation, rejects concurrent work,
  // and ignores effect failures after the assistant reply is committed.
  const successHost = memoryHost(conversation(), { failEffect: true });
  let resolveSuccess;
  let successSignal;
  const successRequests = [];
  const successWorkflow = new MercuryChatGenerationWorkflow({
    contracts,
    host: successHost.adapter,
    generation: { generate: ({ requestId, signal }) => { successRequests.push(requestId); successSignal = signal; return new Promise((resolve) => { resolveSuccess = resolve; }); } },
  });
  assert.equal(successWorkflow.snapshot().phase, "idle");
  assert.equal(Object.isFrozen(successWorkflow.snapshot()), true);
  const success = successWorkflow.start({ kind: "send", userEntry: user("user-1", "Hello") });
  assert.equal(success.accepted, true);
  assert.equal(success.generated, true);
  assert.equal(successWorkflow.snapshot().phase, "running");
  assert.equal(successHost.current().entries.length, 1, "user entry commits before the remote Adapter resolves");
  assert.equal(successHost.current().entries[0].delivery, "queued");
  assert.equal(Boolean(successSignal), true);
  assert.equal(successWorkflow.start({ kind: "send", userEntry: user("user-duplicate", "No") }).reason, "busy");
  resolveSuccess(response("assistant-1", "Hi"));
  assert.equal(await success.completion, true);
  assert.equal(successHost.current().entries.length, 2);
  assert.equal(successHost.current().entries[0].delivery, "complete");
  assert.equal(successHost.current().entries[1].parts[0].text, "Hi");
  assert.equal(successWorkflow.snapshot().phase, "idle", "post-commit effect failure cannot reverse a durable reply");
  assert.deepEqual(successRequests, ["request-user-1"]);

  // Configuration readiness is checked synchronously before the user turn is
  // persisted. A failed preflight keeps the draft caller-owned and exposes a
  // recovery route; after configuration changes the same operation can run.
  const preflightHost = memoryHost();
  let connectionReady = false;
  let preflightGenerationCalls = 0;
  const preflightWorkflow = new MercuryChatGenerationWorkflow({
    contracts,
    host: preflightHost.adapter,
    generation: {
      preflight: () => connectionReady
        ? { ready: true }
        : { ready: false, code: "AI_CONNECTION_API_KEY_REQUIRED", message: "当前标签页缺少 API Key。", recovery: "ai-connection", retryable: false },
      generate: async () => { preflightGenerationCalls += 1; return response("assistant-preflight", "Connected"); },
    },
  });
  const blocked = preflightWorkflow.start({ kind: "send", userEntry: user("user-preflight", "Keep this draft") });
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.reason, "preflight-failed");
  assert.equal(preflightHost.commits.length, 0, "configuration failure happens before any conversation write");
  assert.equal(preflightHost.current().entries.length, 0, "configuration failure never creates a phantom failed message");
  assert.equal(preflightGenerationCalls, 0, "configuration failure never calls the provider");
  assert.equal(preflightWorkflow.snapshot().error.kind, "preflight");
  assert.equal(preflightWorkflow.snapshot().error.recovery, "ai-connection");
  connectionReady = true;
  const resumed = preflightWorkflow.start({ kind: "send", userEntry: user("user-preflight", "Keep this draft") });
  assert.equal(resumed.accepted, true);
  assert.equal(await resumed.completion, true);
  assert.equal(preflightGenerationCalls, 1);
  assert.equal(preflightHost.current().entries.at(-1).id, "assistant-preflight");

  // Failure persists on the original user turn; retry reuses that turn and
  // produces a fresh request id without duplicating user history.
  const retryHost = memoryHost();
  let retryCalls = 0;
  const retryRequestIds = [];
  const retryWorkflow = new MercuryChatGenerationWorkflow({
    contracts,
    host: retryHost.adapter,
    generation: { generate: async ({ requestId }) => { retryRequestIds.push(requestId); retryCalls += 1; if (retryCalls === 1) throw new Error("Provider unavailable."); return response("assistant-retry", "Recovered"); } },
  });
  const failed = retryWorkflow.start({ kind: "send", userEntry: user("user-retry", "Try this") });
  assert.equal(await failed.completion, false);
  assert.equal(retryWorkflow.snapshot().phase, "failed");
  assert.equal(retryWorkflow.snapshot().error.message, "Provider unavailable.");
  assert.equal(retryHost.current().entries[0].delivery, "failed");
  const retried = retryWorkflow.start({ kind: "retry", messageId: "user-retry" });
  assert.equal(retried.accepted, true);
  assert.equal(retryHost.current().entries.length, 1);
  assert.equal(retryHost.current().entries[0].delivery, "queued");
  assert.equal(await retried.completion, true);
  assert.equal(retryHost.current().entries.filter((entry) => entry.role === "user").length, 1);
  assert.equal(retryHost.current().entries.at(-1).id, "assistant-retry");
  assert.equal(retryWorkflow.snapshot().error, null);
  assert.equal(retryRequestIds[0] === retryRequestIds[1], false);

  let retryReady = false;
  const retryPreflightHost = memoryHost(conversation([user("user-preflight-retry", "Retry later", "failed")]));
  const retryPreflightWorkflow = new MercuryChatGenerationWorkflow({
    contracts,
    host: retryPreflightHost.adapter,
    generation: {
      preflight: () => ({ ready: retryReady, code: "AI_CONNECTION_API_KEY_REQUIRED", message: "Missing key", recovery: "ai-connection" }),
      generate: async () => response("assistant-preflight-retry", "Recovered"),
    },
  });
  const blockedRetry = retryPreflightWorkflow.start({ kind: "retry", messageId: "user-preflight-retry" });
  assert.equal(blockedRetry.accepted, false);
  assert.equal(retryPreflightHost.current().entries[0].delivery, "failed", "retry preflight leaves the failed turn recoverable instead of falsely queueing it");
  assert.equal(retryPreflightHost.commits.length, 0);
  retryReady = true;
  const resumedRetry = retryPreflightWorkflow.start({ kind: "retry", messageId: "user-preflight-retry" });
  assert.equal(await resumedRetry.completion, true);

  // Explicit cancellation aborts the Adapter, persists a distinct state, and
  // prevents a late response from being committed.
  const cancelHost = memoryHost();
  let resolveLate;
  let cancelSignal;
  const cancelWorkflow = new MercuryChatGenerationWorkflow({
    contracts,
    host: cancelHost.adapter,
    generation: { generate: ({ signal }) => { cancelSignal = signal; return new Promise((resolve) => { resolveLate = resolve; }); } },
  });
  const pending = cancelWorkflow.start({ kind: "send", userEntry: user("user-cancel", "Stop") });
  assert.equal(cancelWorkflow.cancel(), true);
  assert.equal(cancelSignal.aborted, true);
  assert.equal(cancelHost.current().entries[0].delivery, "cancelled");
  assert.equal(cancelWorkflow.snapshot().phase, "idle");
  assert.equal(cancelWorkflow.cancel(), false);
  resolveLate(response("assistant-late", "Too late"));
  assert.equal(await pending.completion, false);
  assert.equal(cancelHost.current().entries.some((entry) => entry.id === "assistant-late"), false);

  // Regeneration updates only the selected assistant entry, retains later
  // records, and records both versions instead of truncating the timeline.
  const regenHost = memoryHost(conversation([
    user("user-original", "Original", "complete"),
    assistant("assistant-original", "Old reply"),
    user("user-later", "Later record", "complete"),
  ]));
  let regenerateInput = null;
  const regenWorkflow = new MercuryChatGenerationWorkflow({
    contracts,
    host: regenHost.adapter,
    now: () => Date.parse(iso),
    generation: { generate: async (input) => { regenerateInput = input; return response("assistant-new", "New reply"); } },
  });
  const regenerated = regenWorkflow.start({ kind: "regenerate", message: { id: "assistant-original", turnId: "assistant-original" } });
  assert.equal(regenerated.accepted, true);
  assert.equal(await regenerated.completion, true);
  assert.equal(regenHost.current().entries.length, 3);
  assert.equal(regenHost.current().entries[2].id, "user-later");
  const regeneratedEntry = regenHost.current().entries[1];
  assert.equal(regeneratedEntry.id, "assistant-original");
  assert.equal(regeneratedEntry.parts[0].text, "New reply");
  assert.equal(regeneratedEntry.versions.length, 2);
  assert.equal(regeneratedEntry.versions[0].parts[0].text, "Old reply");
  assert.equal(regeneratedEntry.activeVersionId, "assistant-new");
  assert.equal(regenerateInput.message.id, "user-original");
  assert.equal(regenerateInput.previousEntries.length, 0);
  assert.equal(regenHost.effects[0].operation, "regenerate");

  // A scope change makes the in-flight result stale even if a host forgets to
  // call cancel; storage failure rejects before generation begins.
  const staleHost = memoryHost();
  let resolveStale;
  const staleWorkflow = new MercuryChatGenerationWorkflow({ contracts, host: staleHost.adapter, generation: { generate: () => new Promise((resolve) => { resolveStale = resolve; }) } });
  const stale = staleWorkflow.start({ kind: "send", userEntry: user("user-stale", "Old scope") });
  staleHost.scope.timelineId = "other";
  resolveStale(response("assistant-stale", "Wrong timeline"));
  assert.equal(await stale.completion, false);
  assert.equal(staleHost.current().entries.some((entry) => entry.id === "assistant-stale"), false);
  assert.equal(staleWorkflow.snapshot().phase, "idle");

  let unavailableCalls = 0;
  const unavailableHost = memoryHost(conversation(), { failCommit: true });
  const unavailableWorkflow = new MercuryChatGenerationWorkflow({ contracts, host: unavailableHost.adapter, generation: { generate: async () => { unavailableCalls += 1; return response("never", "Never"); } } });
  const unavailable = unavailableWorkflow.start({ kind: "send", userEntry: user("user-storage", "Keep draft") });
  assert.equal(unavailable.accepted, false);
  assert.equal(unavailable.reason, "commit-failed");
  assert.equal(unavailableWorkflow.snapshot().error.kind, "storage");
  assert.equal(unavailableCalls, 0);

  console.log("chat-generation-workflow: interface assertions passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
