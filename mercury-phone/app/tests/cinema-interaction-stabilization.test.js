"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(appRoot, "styles", "cinema-app.css"), "utf8");
const libraryCss = fs.readFileSync(path.join(appRoot, "styles", "cinema-library.css"), "utf8");
const shellCss = fs.readFileSync(path.join(appRoot, "styles", "system-shell.css"), "utf8");

assert.match(css, /\.cinema-host\s+:where\(button\)\s*\{[^}]*transition:\s*opacity\s+110ms\s+ease;/s, "Cinema controls share restrained immediate opacity feedback");
assert.match(css, /\.cinema-host\s+button:active\s*\{[^}]*opacity:\s*\.64;[^}]*\}/s, "pressed feedback remains perceptible without positional motion");
assert.doesNotMatch(css, /\.cinema-host\s+button:active\s*\{[^}]*transform:/s, "shared pressed feedback cannot replace component positioning transforms");
assert.match(css, /\.cinema-icon-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s, "legacy Cinema back controls expose a 44 by 44 touch target");
assert.match(css, /--cinema-system-gesture-clearance:\s*18px;/, "Cinema records the integrated shell gesture clearance");
assert.match(css, /\.cinema-before-curtain__actions\s*\{[^}]*bottom:\s*var\(--cinema-system-gesture-clearance\);/s, "Before the Curtain action clears the shell gesture layer");
assert.match(css, /\.cinema-before-curtain__control\s*\{[^}]*min-height:\s*44px;/s, "expanded Before the Curtain controls retain a real touch target");
assert.match(libraryCss, /\.cinema-cast-sheet--main\s*\{[^}]*padding:\s*24px\s+22px\s+43px\s+25px;/s, "Cast can scroll its final action fully above the shell gesture layer");
assert.match(shellCss, /\.screen\[data-system-state="appOpen"\]:has\(\.cinema-host\)\s+\.home-gesture-zone\s*\{[^}]*height:\s*18px;/s, "the shell reserves only its explicit 18px Cinema gesture strip");

console.log("cinema-interaction-stabilization: feedback, touch targets, and bottom ownership verified");
