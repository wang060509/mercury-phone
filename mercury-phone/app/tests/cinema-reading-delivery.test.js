"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(appRoot, "styles", "cinema-app.css"), "utf8");
const controller = fs.readFileSync(path.join(appRoot, "apps", "cinema-app.js"), "utf8");
const cssStart = css.indexOf("/* Reading */");
const cssEnd = css.indexOf("/* Intermission and ending */", cssStart);
const readingCss = css.slice(cssStart, cssEnd);
const sourceStart = controller.indexOf("\n    #renderReading() {");
const sourceEnd = controller.indexOf("\n    #renderIntermission() {", sourceStart);
const readingSource = controller.slice(sourceStart, sourceEnd);

assert.ok(cssStart >= 0 && cssEnd > cssStart, "Reading owns a bounded production style family");
assert.ok(sourceStart >= 0 && sourceEnd > sourceStart, "Reading owns a bounded controller presentation family");
assert.doesNotMatch(readingCss, /url\s*\(/i, "the zero-image Reading has no raster background dependency");
assert.doesNotMatch(readingSource, /#icon(?:Button)?\s*\(/, "Reading functional and decorative symbols use deterministic SVG/CSS");
assert.doesNotMatch(readingSource, /呼出思绪/, "no fixture-only thought control ships in production Reading");
assert.match(readingCss, /\.cinema-reading\s*\{[\s\S]*?near-black|\.cinema-reading\s*\{[\s\S]*?#060606/i, "Reading begins from a near-black stage surface");
assert.match(readingCss, /\.cinema-reading__scroll\s*\{[^}]*overflow-y:\s*auto;/s, "long prose owns a real vertical scroller");
assert.match(readingCss, /\.cinema-composer__send\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s, "the minimal send action keeps a phone-scale hit target");
assert.match(readingCss, /\.cinema-composer\s*\{[^}]*border-radius:\s*0;/s, "the composer is an editorial writing rule rather than a chat pill");
assert.match(readingCss, /\.cinema-composer\.is-expanded\s*\{[^}]*background:\s*var\(--reader-stage\);/s, "the keyboard-compressed writing state masks prose instead of layering live text over text");
assert.match(readingSource, /commitInFlight/, "the composer owns a synchronous submission lock before delegating to Workflow");
assert.match(readingSource, /send\.disabled\s*=\s*!hasText\s*\|\|\s*commitInFlight/, "empty and already-submitting composer states remain inert");
assert.ok(readingSource.indexOf('composer.classList.toggle("is-expanded", isWriting)') < readingSource.indexOf('area.style.height = "auto"'), "composer state changes before textarea height is measured so keyboard dismissal can fully collapse it");
assert.match(readingSource, /isWriting\s*&&\s*this\.readingViewport\.atEnd/, "composer growth follows the narrative only when the reader is already near the end");
assert.doesNotMatch(readingSource, /if\s*\(isWriting\)\s*global\.requestAnimationFrame/, "composer focus cannot unconditionally force an older-prose reader to the end");
assert.match(readingSource, /scroller\.addEventListener\("pointerdown",[\s\S]*?document\.activeElement\s*===\s*area[\s\S]*?area\.blur\(\)/, "tapping prose can dismiss the mobile writing state without making prose clickable");
assert.match(readingSource, /cancelRequested/, "running cancellation is re-entry safe at the presentation boundary");
assert.match(readingSource, /retryRequested/, "explicit recovery is re-entry safe at the presentation boundary");
assert.match(controller, /#chineseNumber\(scene\.actNumber\)/, "Chinese Act identity is formatted from runtime Scene truth");
assert.match(controller, /scene\.title,\s*"display"/, "Scene title remains runtime-owned dynamic text");
assert.match(controller, /savedViewport\.atEnd/, "rerenders distinguish readers at the latest passage from readers inspecting older prose");
assert.match(controller, /pendingContinuation[\s\S]*retryable:\s*true/, "durable pending continuation still maps to explicit recovery");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.cinema-prose--latest,[\s\S]*\.cinema-generating__line,[\s\S]*animation:\s*none\s*!important;/, "Reading reveal and generation motion have a reduced-motion fallback");

console.log("cinema-reading-delivery: dark stage, text-first rendering, deterministic glyphs, scroll retention, and recovery affordance verified");
