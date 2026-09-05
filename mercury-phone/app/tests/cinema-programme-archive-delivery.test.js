"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const app = read("app/apps/cinema-app.js");
const css = read("app/styles/cinema-app.css");
const main = read("app/main.js");
const projection = read("app/core/cinema-programme-archive-projection.js");

assert.match(main, /core\/cinema-programme-archive-projection\.js/, "production loader includes the Archive projection before the app controller");
assert.match(app, /"programme-archive": \(\) => this\.#renderProgrammeArchive\(\)/);
assert.match(app, /past: \(\) => this\.#redirectScreen\("programme-archive"\)/, "legacy Past resolves to the single Archive presentation");
assert.match(app, /this\.#go\("history", \{ instanceId: performance\.id, returnRoute: "programme-archive" \}\)/, "Archive opens immutable History with a return route only");
assert.doesNotMatch(app, /#renderPast\(|#pastRow\(/, "legacy Past renderer is removed instead of retained in parallel");
assert.doesNotMatch(css, /^\.cinema-past(?:-row|\s|,)/m, "legacy Past CSS is removed");

assert.match(projection, /status === "ended"/, "only ended Performances enter the projection");
assert.match(projection, /timestamp\(right\.endedAt\) - timestamp\(left\.endedAt\)/, "group entries sort by endedAt descending");
assert.match(projection, /legacy:\$\{text\(instance\?\.id/, "missing stable identities stay isolated");
assert.match(projection, /historyTruth\(\)\?\.reliableScenes/, "Archive structure metadata uses the established History truth gate");
assert.doesNotMatch(projection, /\b(?:summary|relationshipSummary|minutes|pagination|searchQuery|filterState)\b/, "projection contains no fabricated summary, stats, or premature retrieval state");

assert.match(css, /\.cinema-programme-archive__group \{[^}]*content-visibility: auto;/, "large archive groups may optimize rendering without hiding DOM entries");
assert.match(css, /\.cinema-programme-archive__jump-row \{[\s\S]*?min-height: 44px;/);
assert.match(css, /\.cinema-programme-archive__performance \{[\s\S]*?min-height: 62px;/);
assert.match(css, /\.cinema-programme-archive__performance-copy strong \{[^}]*overflow-wrap: anywhere;/, "long Performance titles wrap instead of truncating");
assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?\.cinema-programme-archive__paper \{ scroll-behavior: auto;/);

console.log("cinema-programme-archive-delivery: projection, replacement, route, density, and reduced-motion assertions passed");
