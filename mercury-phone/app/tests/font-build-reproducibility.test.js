"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const project = path.resolve(__dirname, "../..");
const manifestPath = path.join(project, "scripts", "cinema-font-sources.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const codepointManifestPath = path.join(project, "scripts", "cinema-font-codepoints.json");
const codepointManifest = JSON.parse(fs.readFileSync(codepointManifestPath, "utf8"));
const buildSource = fs.readFileSync(path.join(project, "scripts", "build-cinema-fonts.py"), "utf8");
const fetchSource = fs.readFileSync(path.join(project, "scripts", "fetch-cinema-fonts.py"), "utf8");
const notices = fs.readFileSync(path.join(project, "app", "THIRD_PARTY_NOTICES.md"), "utf8");
const iconoirLicense = fs.readFileSync(path.join(project, "app", "third-party", "Iconoir-LICENSE.txt"), "utf8");

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.sourceDirectory, "vendor/cinema-font-sources");
assert.equal(codepointManifest.schemaVersion, 1);
assert.equal(crypto.createHash("sha256").update(fs.readFileSync(codepointManifestPath)).digest("hex").toUpperCase(), manifest.codepointManifestSha256);
assert.deepEqual(Object.keys(manifest.sources), ["display", "reading", "ui", "handwriting"]);
Object.entries(manifest.sources).forEach(([role, source]) => {
  assert.match(source.url, /^https:\/\//, `${role} has an upstream HTTPS source`);
  assert.doesNotMatch(source.url, /\/main\//, `${role} does not rely on a moving main branch URL`);
  assert.match(source.sha256, /^[A-F0-9]{64}$/, `${role} pins the extracted source hash`);
  assert.equal(fs.existsSync(path.join(project, source.license)), true, `${role} preserves its local license notice`);
  const vendoredSource = path.join(project, manifest.sourceDirectory, source.filename);
  assert.equal(fs.existsSync(vendoredSource), true, `${role} source is available in a clean clone`);
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(vendoredSource)).digest("hex").toUpperCase(),
    source.sha256,
    `${role} vendored source matches its pinned hash`,
  );
});
Object.entries(manifest.approvedOutputs).forEach(([role, expected]) => {
  const filename = role === "coverage" ? "app/core/cinema-font-coverage.js" : {
    display: "app/assets/fonts/cinema/cinema-zhuque-display.woff2",
    reading: "app/assets/fonts/cinema/cinema-noto-serif-reading.woff2",
    ui: "app/assets/fonts/cinema/cinema-noto-sans-ui.woff2",
    handwriting: "app/assets/fonts/cinema/cinema-jason-handwriting-8.woff2",
  }[role];
  const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(project, filename))).digest("hex").toUpperCase();
  assert.equal(actual, expected, `${role} output remains at the approved binary hash`);
});
assert.match(buildSource, /cinema-font-sources\.json/);
assert.match(buildSource, /CINEMA_FONT_SOURCE_DIR/);
assert.match(buildSource, /newline="\\r\\n"/);
assert.match(fetchSource, /--connect-timeout/);
assert.match(fetchSource, /--max-time/);
assert.match(fetchSource, /timeout=30/);
assert.doesNotMatch(`${buildSource}\n${fetchSource}\n${JSON.stringify(manifest)}`, /D:\\codex-temp/i);
assert.match(notices, /Iconoir/);
assert.match(notices, /JasonHandwriting 8 subset remains annotation-only/);
assert.match(iconoirLicense, /Copyright \(c\) 2021 Luca Burgio/);

console.log("font-build-reproducibility: pinned sources, licenses, and notices verified");
