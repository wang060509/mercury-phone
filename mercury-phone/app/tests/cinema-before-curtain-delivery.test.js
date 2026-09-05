"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(appRoot, "styles", "cinema-app.css"), "utf8");
const libraryCss = fs.readFileSync(path.join(appRoot, "styles", "cinema-library.css"), "utf8");
const shellCss = fs.readFileSync(path.join(appRoot, "styles", "system-shell.css"), "utf8");
const controller = fs.readFileSync(path.join(appRoot, "apps", "cinema-app.js"), "utf8");
const start = css.indexOf("/* Before the Curtain */");
const end = css.indexOf("/* Reading */", start);
const beforeCurtainCss = css.slice(start, end);

assert.ok(start >= 0 && end > start, "Before the Curtain owns a bounded production style family");
assert.doesNotMatch(beforeCurtainCss, /url\s*\(/i, "the curtain, seam, and threshold are deterministic CSS rather than raster dependencies");
assert.match(beforeCurtainCss, /\.cinema-before-curtain__scroll\s*\{[^}]*overflow-y:\s*auto;/s, "variable-length Scenario and Shared History content has a real vertical scroller");
assert.match(beforeCurtainCss, /\.cinema-before-curtain__seam\s*\{[^}]*width:\s*1px;/s, "the waiting theater retains a narrow central light seam");
assert.match(beforeCurtainCss, /\.cinema-before-curtain\.is-opening\s+\.cinema-before-curtain__wing--left\s*\{[^}]*translateX\(-102%\)/s, "the opening action moves the left stage wing out of the theater");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.cinema-before-curtain__wing,[\s\S]*transition:\s*none\s*!important;/, "Before the Curtain motion has an explicit reduced-motion fallback");

assert.match(libraryCss, /\.cinema-world-plane__actions--prepare\s*\{[^}]*grid-template-columns:/s, "World preparation presents inspect and choose as distinct actions");
assert.match(shellCss, /\.screen\[data-system-state="appOpen"\]:has\(\.cinema-host\)\s+\.home-gesture-zone\s*\{[^}]*height:\s*18px;/s, "Cinema bottom actions are not covered by the system Home gesture target");
assert.match(controller, /#openCurtain\(screen,\s*"opening"\)/, "the final opening action delegates to the existing curtain lifecycle callback");
assert.match(controller, /module\.exports\s*=\s*\{[^}]*buildBeforeCurtainModel/, "the dynamic presentation model remains directly testable");

console.log("cinema-before-curtain-delivery: deterministic curtain, dynamic scroll, preparation actions, and lifecycle delegate verified");
