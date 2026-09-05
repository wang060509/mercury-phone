"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  buildProduction,
  collectAppRouteResources,
  collectEntrypointResources,
  excludedRelativePaths,
  findForbiddenTextDigests,
  findForbiddenTextTokens,
  summarizeProductionTree,
} = require("../../../tools/build-production.cjs");

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mercury-release-"));
const sourceDirectory = path.join(fixtureRoot, "app");
const outputDirectory = path.join(fixtureRoot, "dist");

function write(relativePath, contents) {
  const target = path.join(sourceDirectory, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

try {
  write("index.html", [
    "<!doctype html>",
    '<link rel="stylesheet" href="styles/app.css">',
    '<link rel="stylesheet" href=".local-demo/demo.css" data-local-demo>',
    '<script src="main.js"></script>',
    '<script src=".local-demo/demo.js" data-local-demo></script>',
  ].join("\n"));
  write("styles/app.css", "body { color: #111; }");
  write("main.js", [
    "globalThis.MercuryReleaseFixture = true;",
    "const manifests = [{",
    '  id: "cinema",',
    '  styles: ["styles/cinema-a.css", "styles/cinema-b.css"],',
    '  scripts: ["core/cinema-a.js", "apps/cinema-b.js"],',
    "  createDefinition: () => globalThis.MercuryCreateCinemaDefinition?.(),",
    "}];",
  ].join("\n"));
  write("styles/cinema-a.css", ".cinema-a { color: #eee; }");
  write("styles/cinema-b.css", ".cinema-b { color: #ddd; }");
  write("core/cinema-a.js", "globalThis.MercuryCinemaA = true");
  write("apps/cinema-b.js", "globalThis.MercuryCinemaB = true");
  write("README.md", "internal");
  write("tests/fixture.test.js", "throw new Error('private-marker must not ship');");
  write(".local-demo/demo.css", "body { color: red; }");
  write(".local-demo/demo.js", "throw new Error('must not ship');");
  write("assets/fonts/lxgw-wenkai-lite/unused.ttf", "unused");
  write("assets/fonts/noto-sans-sc/unused.otf", "unused");
  write("assets/fonts/manrope/used.ttf", "font");

  const release = buildProduction({ sourceDirectory, outputDirectory });
  assert.equal(release.outputDirectory, outputDirectory);
  assert.equal(fs.existsSync(path.join(outputDirectory, "README.md")), false);
  assert.equal(fs.existsSync(path.join(outputDirectory, "tests")), false);
  assert.equal(fs.existsSync(path.join(outputDirectory, ".local-demo")), false);
  assert.equal(fs.existsSync(path.join(outputDirectory, "assets/fonts/lxgw-wenkai-lite")), false);
  assert.equal(fs.existsSync(path.join(outputDirectory, "assets/fonts/noto-sans-sc")), false);
  assert.equal(fs.existsSync(path.join(outputDirectory, "assets/fonts/manrope/used.ttf")), true);
  assert.equal(fs.readFileSync(path.join(outputDirectory, "index.html"), "utf8").includes("data-local-demo"), false);
  assert.deepEqual(excludedRelativePaths, ["assets/fonts/lxgw-wenkai-lite", "assets/fonts/noto-sans-sc"]);

  const tree = summarizeProductionTree(outputDirectory);
  assert.equal(tree.fileCount, 6);
  assert.equal(tree.byExtension[".js"].files, 2);
  assert.equal(tree.byExtension[".css"].files, 2);
  assert.equal(tree.largestFile.path, "main.js");
  assert.deepEqual(release.cinemaBundle.sourceManifest.styles, ["styles/cinema-a.css", "styles/cinema-b.css"]);
  assert.deepEqual(release.cinemaBundle.sourceManifest.scripts, ["core/cinema-a.js", "apps/cinema-b.js"]);
  assert.equal(release.cinemaRouteBeforeBundling.incremental.requestCount, 4);
  assert.equal(release.cinemaRouteBeforeBundling.coldOpen.requestCount, 7);
  assert.equal(fs.existsSync(path.join(outputDirectory, "styles/cinema-a.css")), false);
  assert.equal(fs.existsSync(path.join(outputDirectory, "core/cinema-a.js")), false);
  assert.match(fs.readFileSync(path.join(outputDirectory, "bundles/cinema.css"), "utf8"), /cinema-a[\s\S]*cinema-b/);
  assert.match(fs.readFileSync(path.join(outputDirectory, "bundles/cinema.js"), "utf8"), /MercuryCinemaA[\s\S]*MercuryCinemaB/);
  assert.match(fs.readFileSync(path.join(outputDirectory, "main.js"), "utf8"), /styles: \["bundles\/cinema\.css"\]/);

  const entrypoint = collectEntrypointResources(outputDirectory);
  assert.equal(entrypoint.requestCount, 3);
  assert.equal(entrypoint.scriptCount, 1);
  assert.equal(entrypoint.stylesheetCount, 1);
  assert.equal(entrypoint.rawBytes > 0, true);
  assert.equal(entrypoint.gzipBytes > 0, true);
  assert.equal(entrypoint.brotliBytes > 0, true);
  const cinemaRoute = collectAppRouteResources(outputDirectory, "cinema");
  assert.equal(cinemaRoute.incremental.requestCount, 2);
  assert.equal(cinemaRoute.coldOpen.requestCount, 5);
  assert.deepEqual(cinemaRoute.manifest.styles, ["bundles/cinema.css"]);
  assert.deepEqual(cinemaRoute.manifest.scripts, ["bundles/cinema.js"]);
  assert.deepEqual(findForbiddenTextTokens(sourceDirectory, ["private-marker"]), ["tests/fixture.test.js: private-marker"]);
  const privateMarkerDigest = crypto.createHash("sha256").update("private-marker").digest("hex");
  assert.deepEqual(
    findForbiddenTextDigests(sourceDirectory, [{ length: "private-marker".length, sha256: privateMarkerDigest }]),
    [`tests/fixture.test.js: content matches private digest ${privateMarkerDigest.slice(0, 12)}`],
  );
} finally {
  const resolvedFixtureRoot = path.resolve(fixtureRoot);
  const temporaryRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!resolvedFixtureRoot.startsWith(temporaryRoot) || path.basename(resolvedFixtureRoot).startsWith("mercury-release-") === false) {
    throw new Error("Refusing to remove an unexpected release fixture directory.");
  }
  fs.rmSync(resolvedFixtureRoot, { recursive: true, force: true });
}
