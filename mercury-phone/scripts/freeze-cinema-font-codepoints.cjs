"use strict";

const fs = require("node:fs");
const path = require("node:path");

const project = path.resolve(__dirname, "..");
const input = path.resolve(process.argv[2] || path.join(project, "app", "core", "cinema-font-coverage.js"));
const output = path.join(__dirname, "cinema-font-codepoints.json");
const source = fs.readFileSync(input, "utf8");
const match = source.match(/const ranges = Object\.freeze\((\{[\s\S]*?\})\);/);
if (!match) throw new Error(`Cannot extract Cinema font ranges from ${input}`);
const ranges = JSON.parse(match[1]);
const roles = ["display", "reading", "ui", "handwriting"];
if (JSON.stringify(Object.keys(ranges)) !== JSON.stringify(roles)) {
  throw new Error(`Unexpected Cinema font roles: ${Object.keys(ranges).join(", ")}`);
}
for (const role of roles) {
  let previous = -1;
  for (const range of ranges[role]) {
    if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isInteger) || range[0] > range[1] || range[0] <= previous) {
      throw new Error(`Invalid or unordered ${role} range.`);
    }
    previous = range[1];
  }
}
fs.writeFileSync(output, `${JSON.stringify({ schemaVersion: 1, source: "approved Cinema font coverage", ranges })}\n`, "utf8");
process.stdout.write(`Frozen Cinema font codepoints: ${output}\n`);
