"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const demoRoot = path.join(appRoot, ".local-demo", "moments");
const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");

const fixtures = read(demoRoot, "fixtures.js");
const view = read(demoRoot, "moments-view.js");
const adapter = read(appRoot, ".local-demo", "presentation-adapter.js");
const styles = read(demoRoot, "moments.css");
const formalChat = read(appRoot, "apps", "mercury-chat-app.js");

assert.match(fixtures, /MercuryDemoMomentsFixtures/);
assert.match(adapter, /MercuryPresentationAdapter/);
assert.match(adapter, /demo-moments/);
assert.match(styles, /\.app-layer:has\(\.demo-moments\)/);
assert.match(styles, /inset:\s*0 0 -12px/);
assert.match(styles, /calc\(86px \+ env\(safe-area-inset-bottom\)\)/);
assert.doesNotMatch(`${fixtures}\n${view}\n${adapter}`, /localStorage|ConversationV2|fetch\s*\(|\/api\//);
assert.doesNotMatch(formalChat, /this\.experience\.moments|momentsView\s*\(/);

console.log("moments-demo-isolation: 8 assertions passed");
