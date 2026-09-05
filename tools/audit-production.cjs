"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildProduction,
  excludedRelativePaths,
  findForbiddenOutputFiles,
  findForbiddenTextDigests,
  summarizeProductionTree,
} = require("./build-production.cjs");

const root = path.resolve(__dirname, "..");
const project = path.join(root, "mercury-phone");
const source = path.join(project, "app");
const forbiddenOutputTokens = [
  ".local-demo",
  "MercuryDemoMomentsFixtures",
  "MercuryDemoMomentsView",
  "demo-moments",
  "雾散得很慢",
  "3条新消息",
];
const forbiddenReferenceDigests = [
  { length: 4, sha256: "1f542ab39a9dc8885a5fc9044782838dc79883f8bd7073def13994ac5fa082f5" },
  { length: 13, sha256: "333f957de05ae7d5b4441928fd4cc108612c0332703aec658b7b2e87f4e043ea" },
  { length: 12, sha256: "a5c77bd030e8557df10eeec3b46f3e7be5143941f43a5f6e7899051095902718" },
  { length: 3, sha256: "04b539a4dd1ea03a1bcd6369d2e5d70fe8edc8bb928b7ce5616c25c1b48d136d" },
  { length: 2, sha256: "4799ea6fc322b829a3d800a88ea5738809bbd51be70cadda6f8a083983a7cfd3" },
  { length: 3, sha256: "4b1d824248f3c750f2e2c222756332139cc95fc6c1dce689d6b1006fefb735f6" },
  { length: 4, sha256: "60057959e74290675dd0d220df3b14d9981ad7ec5401910cbc0cba887b588f55" },
  { length: 4, sha256: "e58cd262b238c8a5cbe65595cebf8b7577ddf2c2bcce816219676bdd10c08621" },
  { length: 4, sha256: "d0cf9576c9ad5ef11677d11012a72f9e69bc2e6469184bbb96d1da93690073f1" },
  { length: 3, sha256: "70a4bb804966fbc4716160ce1b2e0371b105cc0b2567081b1fd6d062fab1ee7c" },
  { length: 4, sha256: "ae6e4b8c51d53a40a5cd3e1c7b0b7ba240db17dc8099de2e84546388fb6341a7" },
  { length: 3, sha256: "e2f3657c47fd869218e10f5c9629cba3fd381cffeaba751943280f9f9d66f78c" },
  { length: 3, sha256: "17cb6854ce5edfd77bd33743a4982c3ef25fcad197267943c53c19dc42d6fa3e" },
  { length: 4, sha256: "7f33e92a1e71f13c96edb804723c35be145a30e54bb9fbc9359d64d865b7d63c" },
  { length: 3, sha256: "a668d39e97b52086013c4b97d219889587b7aee849c06bf5c064af2ffa6c1b5b" },
  { length: 8, sha256: "ffaef8813e753d22d704511faad5a7efe1b2ed306b997c43fd9a7ecfe4e525f3" },
  { length: 3, sha256: "330c7203426d3da5fbc8c3e1e00f55f9a09def807d4e82e83508df51c956f4a5" },
  { length: 4, sha256: "f7aa9075a25ac9a0136346eaa63f9491a474130cf48ce8ee4434d5062d6b5385" },
];
const failures = [];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function check(name, condition, detail = "") {
  process.stdout.write(`${condition ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
  if (!condition) failures.push(name);
}

function warn(name, condition, detail = "") {
  if (condition) return;
  process.stdout.write(`WARN ${name}${detail ? ` — ${detail}` : ""}\n`);
}

function findForbiddenOutputTokens(directory, relative = "") {
  const findings = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      findings.push(...findForbiddenOutputTokens(fullPath, rel));
      continue;
    }
    if (![".html", ".js", ".css", ".json"].includes(path.extname(entry.name))) continue;
    const contents = fs.readFileSync(fullPath, "utf8");
    forbiddenOutputTokens.forEach((token) => {
      if (contents.includes(token)) findings.push(`${rel}: ${token}`);
    });
  }
  return findings;
}

function findExcludedAssetReferences(directory, relative = "") {
  const findings = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = path.join(relative, entry.name);
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const normalized = rel.split(path.sep).join("/");
      if (!["tests", ".local-demo"].includes(entry.name) && !excludedRelativePaths.includes(normalized)) {
        findings.push(...findExcludedAssetReferences(fullPath, rel));
      }
      continue;
    }
    if (![".html", ".js", ".css", ".json"].includes(path.extname(entry.name))) continue;
    const contents = fs.readFileSync(fullPath, "utf8");
    excludedRelativePaths.forEach((excludedPath) => {
      if (contents.includes(excludedPath)) findings.push(`${rel}: ${excludedPath}`);
    });
  }
  return findings;
}

function git(args) {
  return childProcess.execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const budget = JSON.parse(fs.readFileSync(path.join(project, "release-budget.json"), "utf8"));
const sourceTree = summarizeProductionTree(source);
const release = buildProduction();
const output = release.outputDirectory;
const javascriptBytes = release.tree.byExtension[".js"]?.bytes || 0;
const cssBytes = release.tree.byExtension[".css"]?.bytes || 0;
const cinemaBefore = release.cinemaRouteBeforeBundling;
const cinemaAfter = release.cinemaRoute;
const cinemaBudget = budget.routes.cinemaColdOpen;

check("production output excludes internal and unused source assets", findForbiddenOutputFiles(output).length === 0);
check("production source does not reference excluded assets", findExcludedAssetReferences(source).length === 0);
check("production output excludes demo routes, fixtures, assets, and copy", findForbiddenOutputTokens(output).length === 0);
const referenceFindings = [
  ...findForbiddenTextDigests(output, forbiddenReferenceDigests, "dist"),
  ...findForbiddenTextDigests(path.join(source, "tests"), forbiddenReferenceDigests, "app/tests"),
  ...findForbiddenTextDigests(path.join(project, "samples"), forbiddenReferenceDigests, "samples"),
];
check("production and test surfaces exclude private reference identifiers", referenceFindings.length === 0, referenceFindings.slice(0, 4).join(", "));
const deployConfig = JSON.parse(fs.readFileSync(path.join(project, "deploy.config.json"), "utf8"));
check("deployment manifest publishes only dist", deployConfig.publishDirectory === "dist");
check("production entrypoint exists", fs.existsSync(path.join(output, "index.html")));
const thirdPartyNoticesPath = path.join(output, "THIRD_PARTY_NOTICES.md");
const iconoirLicensePath = path.join(output, "third-party", "Iconoir-LICENSE.txt");
check("production includes third-party notices", fs.existsSync(thirdPartyNoticesPath));
check("production includes the Iconoir MIT notice", fs.existsSync(iconoirLicensePath)
  && fs.readFileSync(iconoirLicensePath, "utf8").includes("Copyright (c) 2021 Luca Burgio"));
check("Cinema production delivery is bundled", Boolean(release.cinemaBundle)
  && release.cinemaBundle.outputManifest.styles.length === 1
  && release.cinemaBundle.outputManifest.scripts.length === 1);
check("Cinema route accounting is available", Boolean(cinemaBefore && cinemaAfter));

check("production output stays below the hard budget", release.tree.totalBytes <= budget.output.maximumBytes, `${formatBytes(release.tree.totalBytes)} / ${formatBytes(budget.output.maximumBytes)}`);
check("production JavaScript stays below the hard budget", javascriptBytes <= budget.output.maximumJavaScriptBytes, `${formatBytes(javascriptBytes)} / ${formatBytes(budget.output.maximumJavaScriptBytes)}`);
check("production CSS stays below the hard budget", cssBytes <= budget.output.maximumCssBytes, `${formatBytes(cssBytes)} / ${formatBytes(budget.output.maximumCssBytes)}`);
check("largest production asset stays below the hard budget", release.tree.largestFile.bytes <= budget.output.maximumSingleAssetBytes, `${release.tree.largestFile.path} at ${formatBytes(release.tree.largestFile.bytes)}`);
check("eager local request count stays below the hard budget", release.entrypoint.requestCount <= budget.entrypoint.maximumRequestCount, `${release.entrypoint.requestCount} / ${budget.entrypoint.maximumRequestCount}`);
check("eager local raw bytes stay below the hard budget", release.entrypoint.rawBytes <= budget.entrypoint.maximumRawBytes, `${formatBytes(release.entrypoint.rawBytes)} / ${formatBytes(budget.entrypoint.maximumRawBytes)}`);
check("eager local gzip estimate stays below the hard budget", release.entrypoint.gzipBytes <= budget.entrypoint.maximumGzipBytes, `${formatBytes(release.entrypoint.gzipBytes)} / ${formatBytes(budget.entrypoint.maximumGzipBytes)}`);
check("eager local Brotli estimate stays below the hard budget", release.entrypoint.brotliBytes <= budget.entrypoint.maximumBrotliBytes, `${formatBytes(release.entrypoint.brotliBytes)} / ${formatBytes(budget.entrypoint.maximumBrotliBytes)}`);
check("Cinema cold-open request count stays below the route hard budget", cinemaAfter.coldOpen.requestCount <= cinemaBudget.maximumRequestCount, `${cinemaAfter.coldOpen.requestCount} / ${cinemaBudget.maximumRequestCount}`);
check("Cinema cold-open raw bytes stay below the route hard budget", cinemaAfter.coldOpen.rawBytes <= cinemaBudget.maximumRawBytes, `${formatBytes(cinemaAfter.coldOpen.rawBytes)} / ${formatBytes(cinemaBudget.maximumRawBytes)}`);
check("Cinema cold-open gzip estimate stays below the route hard budget", cinemaAfter.coldOpen.gzipBytes <= cinemaBudget.maximumGzipBytes, `${formatBytes(cinemaAfter.coldOpen.gzipBytes)} / ${formatBytes(cinemaBudget.maximumGzipBytes)}`);
check("Cinema cold-open Brotli estimate stays below the route hard budget", cinemaAfter.coldOpen.brotliBytes <= cinemaBudget.maximumBrotliBytes, `${formatBytes(cinemaAfter.coldOpen.brotliBytes)} / ${formatBytes(cinemaBudget.maximumBrotliBytes)}`);

warn("production output crossed its warning budget", release.tree.totalBytes <= budget.output.warningBytes, `${formatBytes(release.tree.totalBytes)} / ${formatBytes(budget.output.warningBytes)}`);
warn("eager local request count crossed its warning budget", release.entrypoint.requestCount <= budget.entrypoint.warningRequestCount, `${release.entrypoint.requestCount} / ${budget.entrypoint.warningRequestCount}`);
warn("eager local Brotli estimate crossed its warning budget", release.entrypoint.brotliBytes <= budget.entrypoint.warningBrotliBytes, `${formatBytes(release.entrypoint.brotliBytes)} / ${formatBytes(budget.entrypoint.warningBrotliBytes)}`);
warn("Cinema cold-open request count crossed its route warning budget", cinemaAfter.coldOpen.requestCount <= cinemaBudget.warningRequestCount, `${cinemaAfter.coldOpen.requestCount} / ${cinemaBudget.warningRequestCount}`);
warn("Cinema cold-open Brotli estimate crossed its route warning budget", cinemaAfter.coldOpen.brotliBytes <= cinemaBudget.warningBrotliBytes, `${formatBytes(cinemaAfter.coldOpen.brotliBytes)} / ${formatBytes(cinemaBudget.warningBrotliBytes)}`);

process.stdout.write(`INFO production files=${release.tree.fileCount} total=${formatBytes(release.tree.totalBytes)} js=${formatBytes(javascriptBytes)} css=${formatBytes(cssBytes)}\n`);
process.stdout.write(`INFO source-tree files=${sourceTree.fileCount} total=${formatBytes(sourceTree.totalBytes)} omitted-from-release=${formatBytes(sourceTree.totalBytes - release.tree.totalBytes)}\n`);
process.stdout.write(`INFO eager-local requests=${release.entrypoint.requestCount} raw=${formatBytes(release.entrypoint.rawBytes)} gzip=${formatBytes(release.entrypoint.gzipBytes)} brotli=${formatBytes(release.entrypoint.brotliBytes)}\n`);
process.stdout.write(`INFO cinema-before incremental-requests=${cinemaBefore.incremental.requestCount} cold-open-requests=${cinemaBefore.coldOpen.requestCount} raw=${formatBytes(cinemaBefore.coldOpen.rawBytes)} gzip=${formatBytes(cinemaBefore.coldOpen.gzipBytes)} brotli=${formatBytes(cinemaBefore.coldOpen.brotliBytes)}\n`);
process.stdout.write(`INFO cinema-after incremental-requests=${cinemaAfter.incremental.requestCount} cold-open-requests=${cinemaAfter.coldOpen.requestCount} raw=${formatBytes(cinemaAfter.coldOpen.rawBytes)} gzip=${formatBytes(cinemaAfter.coldOpen.gzipBytes)} brotli=${formatBytes(cinemaAfter.coldOpen.brotliBytes)}\n`);
process.stdout.write(`INFO cinema-hard-headroom requests=${cinemaBudget.maximumRequestCount - cinemaAfter.coldOpen.requestCount} raw=${formatBytes(cinemaBudget.maximumRawBytes - cinemaAfter.coldOpen.rawBytes)} gzip=${formatBytes(cinemaBudget.maximumGzipBytes - cinemaAfter.coldOpen.gzipBytes)} brotli=${formatBytes(cinemaBudget.maximumBrotliBytes - cinemaAfter.coldOpen.brotliBytes)}\n`);

if (fs.existsSync(path.join(root, ".git", "HEAD"))) {
  try {
    check("Git release anomaly check is available", git(["rev-parse", "--is-inside-work-tree"]) === "true");
  } catch {
    check("Git release anomaly check is available", false, "Git metadata is not a valid repository in this workspace.");
  }
} else {
  process.stdout.write("SKIP Git release anomaly check - workspace has no usable Git metadata.\n");
}

if (failures.length) {
  process.stderr.write(`Production audit failed: ${failures.join(", ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Production audit passed.\n");
}
