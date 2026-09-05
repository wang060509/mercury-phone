"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(appRoot, "styles", "cinema-library.css"), "utf8");

assert.match(css, /\.cinema-world-track\s*\{[^}]*touch-action:\s*pan-y;/s, "the World track leaves vertical reading gestures to the browser");
assert.match(css, /\.cinema-world-track\.is-dragging\s*\{[^}]*user-select:\s*none;/s, "committed horizontal drags cannot select text");
assert.match(css, /--cinema-world-plane-width:\s*clamp\(250px,\s*calc\(100vw - 110px\),\s*280px\);/, "the selected World remains a bounded scenery plane");
assert.match(css, /\.cinema-world-library\[data-world-count="1"\]\s+\.cinema-world-track\s*\{[^}]*right:\s*auto;[^}]*width:\s*var\(--cinema-world-plane-width\);/s, "one World preserves a black stage bay without fake spines");
assert.match(css, /\.cinema-world-plane\s*\{[^}]*flex:\s*0 0 var\(--cinema-world-plane-width\);/s, "multi-World layouts reserve exactly two compressed spine widths");
assert.match(css, /\.cinema-cast-row__portrait\s*\{[^}]*width:\s*44px;[^}]*height:\s*58px;/s, "Cast portrait windows retain their approved optical size");
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none;[\s\S]*transition:\s*none;/, "Cinema Library motion has an explicit static fallback");

const visualNames = Array.from({ length: 6 }, (_, index) => `cast-neutral-0${index + 1}.webp`);
const visualSizes = visualNames.map((name) => {
  const filePath = path.join(appRoot, "assets", "cinema", name);
  assert.equal(fs.existsSync(filePath), true, `${name} is included in the production asset set`);
  const size = fs.statSync(filePath).size;
  assert.ok(size > 0, `${name} is non-empty`);
  return size;
});

assert.ok(visualSizes.reduce((sum, size) => sum + size, 0) <= 64 * 1024, "the complete neutral Cast set stays below its 64 KiB budget");

console.log(`cinema-library-delivery: six neutral visuals, ${visualSizes.reduce((sum, size) => sum + size, 0)} bytes total`);
