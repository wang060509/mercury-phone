"use strict";

const assert = require("node:assert/strict");
const { completionBody } = require("../dev-provider.js");

const response = completionBody({ messages: [{ role: "user", content: "周末做点什么？" }] });
assert.equal(response.choices[0].message.content, "我记下来了。周末一起看展。");
assert.equal(response.choices[0].message.tool_calls[0].function.name, "record_memory");
assert.deepEqual(JSON.parse(response.choices[0].message.tool_calls[0].function.arguments), { kind: "shared_event", content: "周末一起看展", certainty: "explicit" });

const declined = completionBody({ messages: [{ role: "user", content: "这次不记录" }] });
assert.deepEqual(declined.choices[0].message.tool_calls, []);

console.log("dev-provider: 4 assertions passed");
