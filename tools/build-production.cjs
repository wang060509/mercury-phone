"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const defaultSource = path.join(root, "mercury-phone", "app");
const defaultOutput = path.join(root, "mercury-phone", "dist");

const excludedDirectoryNames = new Set(["tests", ".local-demo"]);
const excludedFileNames = new Set(["design-qa.md", "README.md"]);
const excludedRelativePaths = Object.freeze([
  "assets/fonts/lxgw-wenkai-lite",
  "assets/fonts/noto-sans-sc",
]);
const cinemaBundleManifest = Object.freeze({
  styles: Object.freeze(["bundles/cinema.css"]),
  scripts: Object.freeze(["bundles/cinema.js"]),
});

function normalizeRelative(relativePath) {
  return relativePath.split(path.sep).join("/").replace(/^\.\//, "");
}

function isPathExcluded(relativePath, entry) {
  const normalized = normalizeRelative(relativePath);
  if (entry.isDirectory() && excludedDirectoryNames.has(entry.name)) return true;
  if (!entry.isDirectory() && (excludedFileNames.has(entry.name) || entry.name === ".env" || entry.name.startsWith(".env."))) return true;
  return excludedRelativePaths.some((excludedPath) => normalized === excludedPath || normalized.startsWith(`${excludedPath}/`));
}

function assertSafeBuildPaths(sourceDirectory, outputDirectory) {
  const sourceParent = path.dirname(sourceDirectory);
  const outputParent = path.dirname(outputDirectory);
  if (sourceParent !== outputParent || path.basename(outputDirectory) !== "dist") {
    throw new Error("Production output must be the dist sibling of the source directory.");
  }
  if (sourceDirectory === outputDirectory || outputDirectory === path.parse(outputDirectory).root) {
    throw new Error("Refusing an unsafe production output path.");
  }
}

function copyProductionTree(from, to, relative = "") {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    if (isPathExcluded(rel, entry)) continue;
    const sourcePath = path.join(from, entry.name);
    const outputPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyProductionTree(sourcePath, outputPath, rel);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, outputPath);
  }
}

function findForbiddenOutputFiles(directory, relative = "") {
  const findings = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    if (isPathExcluded(rel, entry) || (entry.isDirectory() && entry.name === "server")) {
      findings.push(normalizeRelative(rel));
    } else if (entry.isDirectory()) {
      findings.push(...findForbiddenOutputFiles(path.join(directory, entry.name), rel));
    }
  }
  return findings;
}

function findForbiddenTextTokens(directory, tokens, relative = "") {
  if (!fs.existsSync(directory)) return [];
  const findings = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    const fullPath = path.join(directory, entry.name);
    tokens.forEach((token) => {
      if (entry.name.includes(token)) findings.push(`${normalizeRelative(rel)}: filename contains ${token}`);
    });
    if (entry.isDirectory()) {
      findings.push(...findForbiddenTextTokens(fullPath, tokens, rel));
      continue;
    }
    if (![".html", ".js", ".css", ".json", ".md", ".txt"].includes(path.extname(entry.name).toLowerCase())) continue;
    const contents = fs.readFileSync(fullPath, "utf8");
    tokens.forEach((token) => {
      if (contents.includes(token)) findings.push(`${normalizeRelative(rel)}: ${token}`);
    });
  }
  return findings;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function findDigestMatches(value, digests) {
  const matches = new Set();
  const byLength = new Map();
  for (const digest of digests) {
    if (!byLength.has(digest.length)) byLength.set(digest.length, new Set());
    byLength.get(digest.length).add(digest.sha256);
  }
  const runs = value.match(/[A-Za-z0-9_-]+|[\u3400-\u9fff]+/gu) || [];
  for (const run of runs) {
    for (const [length, hashes] of byLength) {
      if (run.length < length) continue;
      for (let index = 0; index <= run.length - length; index += 1) {
        const digest = sha256(run.slice(index, index + length));
        if (hashes.has(digest)) matches.add(digest);
      }
    }
  }
  return matches;
}

function findForbiddenTextDigests(directory, digests, relative = "") {
  if (!fs.existsSync(directory)) return [];
  const findings = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    const fullPath = path.join(directory, entry.name);
    for (const digest of findDigestMatches(entry.name, digests)) {
      findings.push(`${normalizeRelative(rel)}: filename matches private digest ${digest.slice(0, 12)}`);
    }
    if (entry.isDirectory()) {
      findings.push(...findForbiddenTextDigests(fullPath, digests, rel));
      continue;
    }
    if (![".html", ".js", ".css", ".json", ".md", ".txt"].includes(path.extname(entry.name).toLowerCase())) continue;
    const contents = fs.readFileSync(fullPath, "utf8");
    for (const digest of findDigestMatches(contents, digests)) {
      findings.push(`${normalizeRelative(rel)}: content matches private digest ${digest.slice(0, 12)}`);
    }
  }
  return findings;
}

function listFiles(directory, relative = "", files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) listFiles(fullPath, rel, files);
    else if (entry.isFile()) files.push({ path: normalizeRelative(rel), bytes: fs.statSync(fullPath).size });
  }
  return files;
}

function summarizeProductionTree(directory) {
  const files = listFiles(directory);
  const byExtension = {};
  for (const file of files) {
    const extension = path.extname(file.path).toLowerCase() || "[none]";
    byExtension[extension] ||= { files: 0, bytes: 0 };
    byExtension[extension].files += 1;
    byExtension[extension].bytes += file.bytes;
  }
  const largestFile = files.reduce((largest, file) => (!largest || file.bytes > largest.bytes ? file : largest), null);
  return Object.freeze({
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    byExtension: Object.freeze(byExtension),
    largestFile: largestFile ? Object.freeze(largestFile) : null,
  });
}

function extractEntrypointReferences(index) {
  const references = [];
  const stylesheetPattern = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const scriptPattern = /<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
  for (const match of index.matchAll(stylesheetPattern)) references.push(match[1]);
  for (const match of index.matchAll(scriptPattern)) references.push(match[1]);
  return [...new Set(references)];
}

function resolveLocalResource(directory, reference) {
  const directoryPrefix = `${path.resolve(directory)}${path.sep}`;
  if (/^(?:[a-z]+:)?\/\//i.test(reference)) throw new Error(`External resource cannot be measured locally: ${reference}`);
  const cleanReference = reference.split(/[?#]/, 1)[0];
  const resourcePath = path.resolve(directory, cleanReference);
  if (resourcePath !== path.resolve(directory) && !resourcePath.startsWith(directoryPrefix)) {
    throw new Error(`Resource escapes production output: ${reference}`);
  }
  return Object.freeze({ cleanReference: normalizeRelative(cleanReference), resourcePath });
}

function collectLocalResources(directory, references) {
  const uniqueReferences = [...new Set(references.map((reference) => reference.split(/[?#]/, 1)[0]))];
  const resources = uniqueReferences.map((reference) => {
    const { cleanReference, resourcePath } = resolveLocalResource(directory, reference);
    const contents = fs.readFileSync(resourcePath);
    return Object.freeze({
      path: cleanReference,
      bytes: contents.length,
      gzipBytes: zlib.gzipSync(contents, { level: 9 }).length,
      brotliBytes: zlib.brotliCompressSync(contents, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
      }).length,
    });
  });
  const sum = (field) => resources.reduce((total, resource) => total + resource[field], 0);
  return Object.freeze({
    requestCount: resources.length,
    scriptCount: resources.filter((resource) => resource.path.endsWith(".js")).length,
    stylesheetCount: resources.filter((resource) => resource.path.endsWith(".css")).length,
    rawBytes: sum("bytes"),
    gzipBytes: sum("gzipBytes"),
    brotliBytes: sum("brotliBytes"),
    resources: Object.freeze(resources),
  });
}

function collectEntrypointResources(directory) {
  const indexPath = path.join(directory, "index.html");
  const index = fs.readFileSync(indexPath, "utf8");
  return collectLocalResources(directory, ["index.html", ...extractEntrypointReferences(index)]);
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseManifestList(source, propertyName, appId) {
  const propertyPattern = new RegExp(`\\b${escapeRegularExpression(propertyName)}\\s*:\\s*(\\[[\\s\\S]*?\\])`);
  const match = source.match(propertyPattern);
  if (!match) throw new Error(`App manifest ${appId} is missing ${propertyName}.`);
  const literal = match[1];
  const values = [...literal.matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
  const residue = literal.replace(/["'][^"']+["']/g, "").replace(/[\[\],\s]/g, "");
  if (residue || values.length === 0) throw new Error(`App manifest ${appId} has an unsupported ${propertyName} list.`);
  return Object.freeze(values);
}

function extractAppManifest(mainSource, appId) {
  const idPattern = new RegExp(`\\bid\\s*:\\s*["']${escapeRegularExpression(appId)}["']`);
  const idMatch = idPattern.exec(mainSource);
  if (!idMatch) return null;
  const remainder = mainSource.slice(idMatch.index);
  const boundary = remainder.indexOf("createDefinition:");
  if (boundary < 0) throw new Error(`App manifest ${appId} has no createDefinition boundary.`);
  const block = remainder.slice(0, boundary);
  return Object.freeze({
    id: appId,
    styles: parseManifestList(block, "styles", appId),
    scripts: parseManifestList(block, "scripts", appId),
  });
}

function readAppManifest(directory, appId) {
  const mainPath = path.join(directory, "main.js");
  if (!fs.existsSync(mainPath)) return null;
  return extractAppManifest(fs.readFileSync(mainPath, "utf8"), appId);
}

function collectAppRouteResources(directory, appId) {
  const shell = collectEntrypointResources(directory);
  const manifest = readAppManifest(directory, appId);
  if (!manifest) throw new Error(`Cannot measure unknown app route: ${appId}`);
  const shellPaths = shell.resources.map((resource) => resource.path);
  const appPaths = [...manifest.styles, ...manifest.scripts];
  const incrementalPaths = appPaths.filter((resourcePath) => !shellPaths.includes(normalizeRelative(resourcePath)));
  return Object.freeze({
    appId,
    manifest,
    shell,
    incremental: collectLocalResources(directory, incrementalPaths),
    coldOpen: collectLocalResources(directory, [...shellPaths, ...appPaths]),
  });
}

function concatenateResources(directory, resources, separator) {
  return resources.map((resource) => {
    const { resourcePath } = resolveLocalResource(directory, resource);
    return fs.readFileSync(resourcePath, "utf8").trimEnd();
  }).join(separator) + "\n";
}

function replaceAppManifest(mainSource, appId, manifest) {
  const id = escapeRegularExpression(appId);
  const pattern = new RegExp(`(\\bid\\s*:\\s*["']${id}["'][\\s\\S]*?\\bstyles\\s*:\\s*)\\[[\\s\\S]*?\\](\\s*,\\s*\\bscripts\\s*:\\s*)\\[[\\s\\S]*?\\](\\s*,\\s*createDefinition:)`);
  if (!pattern.test(mainSource)) throw new Error(`Cannot rewrite app manifest: ${appId}`);
  return mainSource.replace(pattern, `$1${JSON.stringify(manifest.styles)}$2${JSON.stringify(manifest.scripts)}$3`);
}

function bundleCinemaForProduction(outputDirectory) {
  const mainPath = path.join(outputDirectory, "main.js");
  if (!fs.existsSync(mainPath)) return null;
  const mainSource = fs.readFileSync(mainPath, "utf8");
  const sourceManifest = extractAppManifest(mainSource, "cinema");
  if (!sourceManifest) return null;

  const css = concatenateResources(outputDirectory, sourceManifest.styles, "\n\n");
  const javascript = concatenateResources(outputDirectory, sourceManifest.scripts, "\n;\n");
  for (const bundlePath of [...cinemaBundleManifest.styles, ...cinemaBundleManifest.scripts]) {
    const { resourcePath } = resolveLocalResource(outputDirectory, bundlePath);
    fs.mkdirSync(path.dirname(resourcePath), { recursive: true });
    fs.writeFileSync(resourcePath, bundlePath.endsWith(".css") ? css : javascript, "utf8");
  }

  for (const sourcePath of [...sourceManifest.styles, ...sourceManifest.scripts]) {
    const { resourcePath } = resolveLocalResource(outputDirectory, sourcePath);
    fs.rmSync(resourcePath);
  }
  fs.writeFileSync(mainPath, replaceAppManifest(mainSource, "cinema", cinemaBundleManifest), "utf8");
  return Object.freeze({ sourceManifest, outputManifest: cinemaBundleManifest });
}

function buildProduction(options = {}) {
  const sourceDirectory = path.resolve(options.sourceDirectory || defaultSource);
  const outputDirectory = path.resolve(options.outputDirectory || defaultOutput);
  assertSafeBuildPaths(sourceDirectory, outputDirectory);
  if (!fs.existsSync(sourceDirectory)) throw new Error("Production source directory is missing.");

  if (fs.existsSync(outputDirectory)) fs.rmSync(outputDirectory, { recursive: true, force: true });
  copyProductionTree(sourceDirectory, outputDirectory);

  const forbidden = findForbiddenOutputFiles(outputDirectory);
  if (forbidden.length) throw new Error(`Forbidden production files found: ${forbidden.join(", ")}`);

  const indexPath = path.join(outputDirectory, "index.html");
  const index = fs.readFileSync(indexPath, "utf8");
  const productionIndex = index
    .split(/\r?\n/)
    .filter((line) => !line.includes("data-local-demo"))
    .join("\n");
  fs.writeFileSync(indexPath, productionIndex, "utf8");
  const cinemaRouteBeforeBundling = readAppManifest(outputDirectory, "cinema")
    ? collectAppRouteResources(outputDirectory, "cinema")
    : null;
  const cinemaBundle = bundleCinemaForProduction(outputDirectory);

  return Object.freeze({
    outputDirectory,
    tree: summarizeProductionTree(outputDirectory),
    entrypoint: collectEntrypointResources(outputDirectory),
    cinemaBundle,
    cinemaRouteBeforeBundling,
    cinemaRoute: cinemaBundle ? collectAppRouteResources(outputDirectory, "cinema") : null,
  });
}

if (require.main === module) {
  const result = buildProduction();
  process.stdout.write(`Built production output: ${result.outputDirectory}\n`);
}

module.exports = {
  buildProduction,
  bundleCinemaForProduction,
  collectAppRouteResources,
  collectEntrypointResources,
  collectLocalResources,
  extractAppManifest,
  excludedRelativePaths,
  findForbiddenOutputFiles,
  findForbiddenTextDigests,
  findForbiddenTextTokens,
  summarizeProductionTree,
};
