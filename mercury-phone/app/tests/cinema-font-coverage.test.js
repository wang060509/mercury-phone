"use strict";

const assert = require("node:assert/strict");
const coverage = require("../core/cinema-font-coverage.js");

function node() {
  return {
    attributes: {},
    classes: [],
    setAttribute(name, value) { this.attributes[name] = String(value); },
    classList: { add: (name) => result.classes.push(name) },
  };
}

let result = node();
assert.equal(coverage.applyWholeStringFallback(result, "display", "静默子午线"), false);
assert.equal(result.attributes["data-cinema-font-fallback"], "false");
assert.deepEqual(result.classes, []);

result = node();
assert.equal(coverage.applyWholeStringFallback(result, "display", "静默𠀀子午线"), true);
assert.equal(result.attributes["data-cinema-font-fallback"], "true");
assert.deepEqual(result.classes, ["cinema-display--fallback"], "one class switches the complete string instead of individual glyphs");

assert.equal(coverage.supports("reading", "雾霭中的渡轮仍在远处鸣笛。"), true);
assert.equal(coverage.supports("ui", "继续演出"), true);
assert.equal(coverage.supports("handwriting", "排演笔记角色适配修改理解确认适配"), true, "the controlled handwriting subset includes the current product-text corpus");
assert.equal(coverage.supports("handwriting", "珩"), false);
assert.equal(coverage.supports("reading", "珩"), true, "a supported reading glyph can trigger deterministic whole-string handwriting fallback");

result = node();
assert.equal(coverage.applyWholeStringFallback(result, "handwriting", "进入雾港后，他如何行动？"), false);
assert.deepEqual(result.classes, []);
result = node();
assert.equal(coverage.applyWholeStringFallback(result, "handwriting", "雾港𠀀"), true);
assert.deepEqual(result.classes, ["cinema-handwriting--fallback"], "unsupported handwriting switches the complete annotation to the release-safe reading face");
result = node();
assert.equal(coverage.applyWholeStringFallback(result, "handwriting", "记得珩石上的旧约"), true);
assert.deepEqual(result.classes, ["cinema-handwriting--fallback"], "a real uncommon Chinese glyph switches the complete annotation without mixed fonts");

console.log("cinema-font-coverage: whole-string fallback assertions passed");
