"use strict";

const path = require("node:path");
const sharp = require("sharp");

const sources = process.argv.slice(2);
if (sources.length !== 6) {
  process.stderr.write("Usage: node scripts/prepare-cinema-cast-placeholders.cjs <source-1> ... <source-6>\n");
  process.exit(1);
}

const destination = path.resolve(__dirname, "../app/assets/cinema");

Promise.all(sources.map(async (source, index) => {
  const target = path.join(destination, `cast-neutral-${String(index + 1).padStart(2, "0")}.webp`);
  const result = await sharp(source)
    .resize(192, 256, { fit: "cover", position: "attention" })
    .webp({ quality: 76, effort: 6, smartSubsample: true })
    .toFile(target);
  return { file: path.basename(target), width: result.width, height: result.height, bytes: result.size, format: result.format };
})).then((results) => {
  const report = { assets: results, totalBytes: results.reduce((sum, item) => sum + item.bytes, 0) };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
