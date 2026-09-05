"use strict";

const assert = require("node:assert/strict");
global.window = global;
require("../core/chat-experience-contracts.js");

const contracts = global.MercuryChatExperienceContracts;
const bindings = contracts.normalizeResourceBindings(
  { runtimeProfileId: "profile-a", worldVariantId: " palace-night ", worldBookMode: "explicit", worldBookIds: ["world-a"] },
  { runtimeProfileId: "profile-default" },
  { userPresetId: "preset-default" },
);
assert.equal(bindings.worldVariantId, "palace-night", "a conversation keeps its selected world variant");

const restored = contracts.normalize({
  schemaVersion: 1,
  user: {},
  contacts: { "contact-a": { ...contracts.DEFAULT_CONTACT } },
  conversations: {
    "contact-a:default": {
      settings: {},
      resourceBindings: { worldVariantId: "harbor", worldBookMode: "inherit" },
    },
  },
});
assert.equal(restored.conversations["contact-a:default"].resourceBindings.worldVariantId, "harbor", "world variant survives local-state normalization");
console.log("world-variant-binding: OK");
