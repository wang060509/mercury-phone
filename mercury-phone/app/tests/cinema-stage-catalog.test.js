"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const stageCatalogModule = require("../core/cinema-stage-catalog.js");
const quietStation = require("./fixtures/quiet-station-stage.js");
const { buildStageDetailModel, buildStagePreparationModel } = require("../apps/cinema-app.js");

const catalog = stageCatalogModule.createStageCatalog([stageCatalogModule.AEVORIA_STAGE, quietStation]);
assert.deepEqual(catalog.listStages().map((stage) => stage.id), ["aevoria-academy", "quiet-station-fixture"]);
assert.equal(catalog.getStage("aevoria-academy").title, "埃沃利亚学院");
assert.equal(catalog.getStage("quiet-station-fixture").title, "The Quiet Station");
assert.equal(catalog.getScenario("quiet-station-fixture", "last-train").title, "Last Train");
assert.equal(catalog.getStage("missing-stage"), null, "unknown stages never fall back to Aevoria");

const detail = buildStageDetailModel(catalog, "quiet-station-fixture", "last-train");
assert.equal(detail.stage.title, "The Quiet Station", "generic Stage Detail consumes the neutral fixture");
assert.equal(detail.material, null, "Stage Detail does not require a presentation asset");
assert.deepEqual(detail.specializations, [], "Stage Detail omits unsupported specialization capability");

const preparation = buildStagePreparationModel(catalog, "quiet-station-fixture", "last-train", ["自定义"]);
assert.equal(preparation.scenario.title, "Last Train", "generic Preparation consumes the neutral fixture");
assert.deepEqual(preparation.specializations, [], "Preparation does not require specialization");
assert.equal(preparation.roleConfiguration.playerRoleLabel, "Your role");

const neutralCopy = JSON.stringify({ detail, preparation });
["学院", "专业", "分流", "埃沃利亚", "Vendar"].forEach((term) => assert.doesNotMatch(neutralCopy, new RegExp(term), `neutral fixture must not inherit ${term}`));
const rendererSource = fs.readFileSync(path.resolve(__dirname, "../apps/cinema-app.js"), "utf8");
assert.doesNotMatch(rendererSource, /stageId\s*={2,3}/, "adding a Stage does not require renderer branching by stage id");

console.log("cinema-stage-catalog: generic catalog and optional capability assertions passed");
