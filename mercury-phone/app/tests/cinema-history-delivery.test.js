"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(appRoot, "styles", "cinema-app.css"), "utf8");
const controller = fs.readFileSync(path.join(appRoot, "apps", "cinema-app.js"), "utf8");
const creditsProjection = fs.readFileSync(path.join(appRoot, "core", "cinema-credits-projection.js"), "utf8");
const assets = [
  ["history-paper-fiber.webp", 384, 384],
  ["history-dark-textile.webp", 384, 384],
  ["history-transition-alpha.webp", 780, 192],
];

const assetBytes = assets.reduce((total, entry) => {
  const file = path.join(appRoot, "assets", "cinema", entry[0]);
  assert.ok(fs.existsSync(file), `${entry[0]} is shipped with the History material family`);
  const bytes = fs.statSync(file).size;
  assert.ok(bytes > 0 && bytes < 90 * 1024, `${entry[0]} remains bounded`);
  return total + bytes;
}, 0);

assert.ok(assetBytes <= 90 * 1024, `the three-request material family stays within budget (${assetBytes} bytes)`);
assert.match(css, /\.cinema-history-reader__scroll\s*\{[^}]*overflow-y:\s*auto;/s, "History owns one real vertical scroller");
assert.match(css, /\.cinema-history-section\s*\{[^}]*content-visibility:\s*auto;[^}]*contain-intrinsic-size:/s, "long works use scene-level rendering containment without truncation");
assert.match(css, /\.cinema-history-reader__transition\s*\{/, "History owns one primary front-matter to body transition");
assert.equal((css.match(/\.cinema-history-reader__transition\s*\{/g) || []).length, 1, "the dramatic material transition is defined once");
assert.doesNotMatch(controller, /cinema-history-reader[\s\S]{0,9000}cinema-reading__scene/, "History does not inherit the live Reading runtime DOM");
assert.match(controller, /#renderHistorySegment\(segment\)/, "History owns immutable archive segment rendering");
assert.match(controller, /#scrollHistoryTarget\(scroll,\s*target\)/, "Contents anchors target the continuous document");
assert.match(controller, /#scrollHistoryTarget\(scroll,\s*null\)/, "the complete work exposes a return-to-top action");
assert.match(creditsProjection, /historyAvailable:\s*true/, "Credits opens the real History destination after this gate");
assert.doesNotMatch(controller.slice(controller.indexOf("#renderHistory()"), controller.indexOf("#renderNotes()")), /computeCredits|minutes|分钟/, "the legacy minutes and unconditional credit computation are removed from History");

console.log(`cinema-history-delivery: hybrid document, immutable renderer, and 3-request material budget verified (${assetBytes} bytes)`);
