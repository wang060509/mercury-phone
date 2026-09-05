"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const csstree = require("css-tree");

const cssPath = path.join(__dirname, "../styles/archive-app.css");
const css = fs.readFileSync(cssPath, "utf8");

// Parse CSS into AST using csstree
const ast = csstree.parse(css, { positions: true });

// Collect all rule selectors and their property counts by walking the AST
const selectorRules = []; // { selector, propertyCount, range }

csstree.walk(ast, {
  visit: "Rule",
  enter(node) {
    const prelude = csstree.generate(node.prelude);
    const selectors = prelude.split(",").map((s) => s.trim()).filter(Boolean);

    // Count declarations (actual CSS properties)
    let propertyCount = 0;
    const declarations = [];
    if (node.block && node.block.children) {
      node.block.children.forEach((child) => {
        if (child.type === "Declaration") {
          propertyCount++;
          declarations.push(child.property);
        }
      });
    }

    for (const selector of selectors) {
      selectorRules.push({ selector, propertyCount, declarations });
    }
  },
});

// ---- Check 1: No selector is fully redefined more than once ----
// A "full redefinition" is the same selector appearing in two separate rules
// where both have 3+ properties. This catches the dual-style pattern without
// false positives for single-property overrides (like .archive-secondary or
// .archive-import-row.archive-list-row which override just 1-2 props).
const grouped = {};
for (const rule of selectorRules) {
  if (!grouped[rule.selector]) grouped[rule.selector] = [];
  grouped[rule.selector].push({ propertyCount: rule.propertyCount, declarations: rule.declarations });
}

let fullDupes = 0;
for (const [sel, defs] of Object.entries(grouped)) {
  // Count how many times this selector appears with 3+ properties
  const fullDefs = defs.filter((d) => d.propertyCount >= 3);
  if (fullDefs.length > 1) {
    // Check if they have overlapping properties (not just different sub-sets)
    // to distinguish dual-style from intentional shared-base pattern
    for (let i = 0; i < fullDefs.length; i++) {
      for (let j = i + 1; j < fullDefs.length; j++) {
        const overlap = fullDefs[i].declarations.filter((d) => fullDefs[j].declarations.includes(d));
        if (overlap.length >= 3) {
          fullDupes++;
          console.log(`DUPLICATE: "${sel}" — ${overlap.length} overlapping props (${overlap.join(", ")})`);
          console.log(`  Def 1: ${fullDefs[i].propertyCount} props | Def 2: ${fullDefs[j].propertyCount} props`);
        }
      }
    }
  }
}
assert.equal(fullDupes, 0, "No selector should be fully redefined (3+ overlapping properties)");

// ---- Check 2: No archive-bottom-nav ----
assert.equal(css.includes("archive-bottom-nav"), false, "archive-bottom-nav must not be present");

// ---- Check 3: No .status-bar in archive CSS ----
assert.equal(/\.status-bar/.test(css), false, "archive-app.css must not define .status-bar");

// ---- Check 4: Imports keep the compact row; WorldBooks use a scalable shelf grid ----
assert.equal(css.includes(".archive-import-row.archive-list-row"), true, "Imports must use .archive-list-row");
assert.equal(css.includes(".worldbook-shelf-grid"), true, "WorldBooks must use a shelf grid");
assert.equal(css.includes(".worldbook-card"), true, "WorldBooks must use formal shelf cards");

// ---- Check 5: Profile sections have no width constraints ----
const sectionRules = selectorRules.filter(
  (r) => r.selector.includes("archive-detail-section") || r.selector.includes("archive-profile-sections") || r.selector.includes("archive-profile-check")
);
for (const rule of sectionRules) {
  const hasMaxWidth = rule.declarations.includes("max-width");
  const hasFixedWidth = rule.declarations.includes("width") && !rule.declarations.includes("min-width");
  assert.equal(hasMaxWidth, false, `Profile section "${rule.selector}" should not have max-width`);
  assert.equal(hasFixedWidth, false, `Profile section "${rule.selector}" should not have fixed width`);
}

// ---- Check 6: Required components exist (via AST, not string search) ----
const allSelectors = new Set(selectorRules.map((r) => r.selector));
const requiredSelectors = [
  ".archive-editor-card",
  ".archive-error-banner",
  ".archive-block-list",
  ".archive-safety-note",
  ".archive-raw-details",
  ".archive-profile-hero",
  ".archive-form-actions",
  ".archive-button--primary",
  ".archive-button--secondary",
  ".worldbook-shelf-grid",
  ".worldbook-card",
  ".archive-worldbook-editor",
  ".archive-worldbook-overview",
  ".archive-worldbook-index",
  ".worldbook-cover-sheet",
  ".archive-scroll.record-cabinet-page",
  ".record-cabinet-shelf",
  ".record-cabinet-collection",
  ".generation-record__sleeve",
  ".generation-record-action",
  ".record-profile-menu",
  ".record-cover-preview",
  ".generation-cover-input",
  ".archive-scroll.archive-generation-profile-detail",
  ".generation-profile-detail-hero",
  ".generation-profile-detail-stats",
  ".generation-profile-detail-tracks",
  ".generation-profile-detail-app",
  ".generation-profile-detail-facts",
  ".generation-profile-detail-action",
];
for (const sel of requiredSelectors) {
  assert.equal(allSelectors.has(sel), true, `Required selector missing: ${sel}`);
}

// ---- Check 7: Recent-card type labels are removed from the footer flow ----
const recentTypeRule = selectorRules.find((rule) => rule.selector === ".archive-recent-row-v2 .archive-recent-card__type");
assert.equal(Boolean(recentTypeRule), true, "Recent-card type label rule missing");
assert.equal(recentTypeRule.declarations.includes("position"), true, "Recent-card type label must remain independently positioned");

// ---- Check 8: Record Cabinet uses a horizontal shelf object, not the old card grid ----
assert.equal(css.includes("archive-vinyl-disc-v1.png"), false, "the vinyl asset belongs in markup and must not be faked in CSS");
assert.equal(css.includes("inset: 0 0 var(--safe-bottom);"), true, "Record Cabinet sheets must clear the system home gesture area");
assert.equal(css.includes(".generation-record__more"), false, "Record Cabinet must not restore a floating ellipsis CRUD control");
assert.equal(/\.generation-record__sleeve\s*\{[^}]*width:\s*92px;[^}]*height:\s*92px;/s.test(css), true, "record sleeves must keep a 92 px by 92 px square surface");

// ---- Check 9: UI-02 remains a detail surface, not a hidden edit form or player ----
assert.equal(css.includes(".generation-profile-detail-hero__disc"), true, "Profile detail keeps the record as an independent asset layer");
assert.equal(css.includes(".generation-profile-detail-slider"), false, "Profile detail must not introduce slider-first editing");
assert.equal(css.includes(".generation-profile-playback"), false, "UI-02 must not start Playback");

console.log("archive-css-structure: assertions passed");
