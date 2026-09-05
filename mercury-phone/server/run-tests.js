"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const roots = [path.resolve(__dirname, "..", "app", "tests"), path.resolve(__dirname, "tests")];
const files = roots.flatMap((root) => fs.readdirSync(root).filter((name) => name.endsWith(".test.js")).map((name) => path.join(root, name))).sort();
const countAssertions = (file) => (fs.readFileSync(file, "utf8").match(/\bassert\.[A-Za-z]+\s*\(/g) || []).length;
const results = [];
for (const file of files) {
  const result = spawnSync(process.execPath, [file], { stdio: "inherit" });
  results.push({ file, status: result.status || 0, assertions: countAssertions(file) });
}
const failures = results.filter((result) => result.status !== 0);
const assertions = results.reduce((sum, result) => sum + result.assertions, 0);
results.forEach((result) => console.log(`${result.status === 0 ? "PASS" : "FAIL"} ${path.relative(path.resolve(__dirname, ".."), result.file)} — ${result.assertions} assertion calls`));
console.log(`TEST SUMMARY files=${files.length} assertions=${assertions} skipped=0 failures=${failures.length}`);
if (failures.length) process.exit(1);
