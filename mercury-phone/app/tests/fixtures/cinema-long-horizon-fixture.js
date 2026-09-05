"use strict";

const MARKERS = Object.freeze({
  main: "MAIN-HORIZON",
  shadow: "SHADOW-HORIZON",
  extractedDelayed: "GLASS-TRIANGLE-41",
  rawOnlyDelayed: "BRASS-NOTCH-73",
  correctionOld: "BELIEF-EAST-GATE",
  correctionNew: "CORRECTION-NORTH-GATE",
  stateOld: "LAMP-STATE-LIT",
  stateNew: "LAMP-STATE-DARK",
  openThread: "THREAD-COPPER-ENVELOPE",
  commitment: "PROMISE-HILL-GARDEN",
  repeatedFact: "SATCHEL-CHECK",
  earlyLocation: "LOCATION-OLD-FERRY",
  returnedLocation: "LOCATION-OLD-FERRY-RETURN",
  identityFood: "IDENTITY-FOOD",
  identitySkill: "IDENTITY-SKILL",
  identityObject: "IDENTITY-OBJECT",
  relationship1: "RELATION-PHASE-1",
  relationship2: "RELATION-PHASE-2",
  relationship3: "RELATION-PHASE-3",
});

const STAGE = Object.freeze({
  id: "harbor-repair-hall",
  version: 1,
  order: 1,
  title: "Harbor Repair Hall",
  shortTitle: "Repair Hall",
  programmeTitle: "Rain Inventory",
  region: "North Harbor",
  tagline: "Ordinary work leaves a precise trail.",
  summary: "A civic repair hall beside a ferry basin, used for tools, records, and patient restoration work.",
  premise: "Two workers keep the hall running through a long season while old assumptions, promises, and small objects acquire context.",
  presentation: {},
  roleConfiguration: { defaultPlayerRole: "inventory assistant", defaultCharacterRole: "repair clerk" },
  scenarios: [{
    id: "rain-inventory",
    title: "Rain Inventory Morning",
    season: "Early autumn",
    summary: "The yearly inventory begins during a week of steady rain.",
    entryPeriods: ["Inventory week"],
    defaultEntryPeriod: "Inventory week",
    opening: "Rain traced the high windows while the first tool drawers were opened for inventory.",
  }],
  specializations: [],
  defaultSpecialization: "",
  relationshipOptions: ["new colleagues", "trusted colleagues"],
  places: ["repair hall", "old ferry landing", "hill garden"],
  worldRules: ["Keep the story grounded in ordinary work, travel, and relationships."],
  materials: [],
});

const PROFILES = Object.freeze({
  a: Object.freeze({ id: "profile-horizon-a", name: "Measured", description: "PROFILE-A-MEASURED: use patient, concrete prose." }),
  b: Object.freeze({ id: "profile-horizon-b", name: "Reflective", description: "PROFILE-B-REFLECTIVE: use reflective but concrete prose." }),
  c: Object.freeze({ id: "profile-horizon-c", name: "Direct", description: "PROFILE-C-DIRECT: use direct, economical prose." }),
  shadow: Object.freeze({ id: "profile-horizon-shadow", name: "Shadow Neutral", description: "PROFILE-SHADOW-NEUTRAL: keep the secondary story plain." }),
});

const LOCATIONS = ["north bench", "records alcove", "ferry steps", "tool cage", "drying room", "courtyard drain"];
const TASKS = ["sorted brass labels", "checked hinge pins", "aired damp ledgers", "counted ceramic sleeves", "tested hand lamps", "rewound measuring cord"];
const WEATHER = ["fine rain", "clear wind", "low cloud", "late sunlight", "harbor mist", "a cold drizzle"];

function mainTurn(turn) {
  const location = LOCATIONS[turn % LOCATIONS.length];
  const task = TASKS[turn % TASKS.length];
  const weather = WEATHER[turn % WEATHER.length];
  const user = [
    `${MARKERS.main} turn ${turn}: At the ${location}, the pair ${task} while ${weather} moved across the windows. The exchange stayed ordinary and specific, with one completed task and one small decision recorded for the next shift.`,
  ];
  const assistant = [
    `Ari checked the work against the paper ledger for turn ${turn}, returned each item to its numbered tray, and answered without rushing. Nothing dramatic happened; the hall simply accumulated another precise piece of shared routine.`,
  ];

  const events = {
    5: `Important ${MARKERS.identityFood}: Ari consistently dislikes candied fennel and leaves it untouched.`,
    7: `Important ${MARKERS.identitySkill}: Ari learned to splice thin rope during childhood and still does it neatly.`,
    8: `Important ${MARKERS.earlyLocation}: the old ferry landing has three green mooring rings.`,
    9: `Important remember ${MARKERS.extractedDelayed}: the blue glass counter has a triangular scratch on its underside.`,
    11: `A brass shim in drawer six bears the inventory mark ${MARKERS.rawOnlyDelayed}.`,
    12: `Important ${MARKERS.identityObject}: Ari owns a narrow canvas satchel. They promise ${MARKERS.commitment} to visit the hill garden after inventory week.`,
    14: `An unresolved thread ${MARKERS.openThread} begins when an unsigned copper envelope appears behind the ledger press.`,
    20: `Important ${MARKERS.correctionOld}: everyone currently believes the missing cart entered through the east gate.`,
    30: `Important ${MARKERS.stateOld}: the inspection lamp is genuinely lit and working at this point in the story.`,
    40: `Important ${MARKERS.relationship1}: Ari and the player move from formal coworkers to reliable work partners.`,
    80: `Important ${MARKERS.relationship2}: after many ordinary shifts, they begin sharing concerns they previously kept private.`,
    86: `Important ${MARKERS.correctionNew}: signed dock records prove the earlier east-gate belief was wrong; the cart entered through the north gate.`,
    105: `Important ${MARKERS.stateNew}: the same inspection lamp is now dark because its fuel cell has been removed for repair; the earlier lit state was true then.`,
    120: `Important ${MARKERS.relationship3}: trust has gradually become a close friendship, without an abrupt relationship switch.`,
    130: `The thread ${MARKERS.openThread} is resolved when the copper envelope is matched to a routine supplier receipt.`,
    145: `Much later, while checking the old counters and shims, the player asks Ari to recall the exact identifying marks recorded early in inventory week.`,
    160: `Important ${MARKERS.returnedLocation}: they return to the old ferry landing and verify the same three green mooring rings.`,
    170: `The promise ${MARKERS.commitment} is fulfilled when they finally visit the hill garden after work.`,
  };
  if (events[turn]) user.unshift(events[turn]);

  if (turn % 3 === 0) user.push(`Important ROUTINE-FACT-${turn}: tray ${turn % 17} was checked during this shift and recorded without incident.`);
  if (turn % 4 === 0) assistant.push(`A later thread ROUTINE-THREAD-${turn} remains open only until the next numbered maintenance check.`);
  if (turn % 5 === 0) assistant.push(`They promise ROUTINE-PROMISE-${turn} to compare the next delivery note before shelving it.`);
  if (turn % 25 === 0) {
    const phrasings = [
      "the narrow canvas satchel stayed dry beside the door",
      "no harbor rain reached the narrow canvas satchel",
      "the canvas of the narrow satchel still showed no damp",
      "Ari's narrow satchel remained dry through the wet shift",
    ];
    user.unshift(`Important ${MARKERS.repeatedFact} turn ${turn}: ${phrasings[(turn / 25) % phrasings.length]}.`);
  }

  return Object.freeze({ turn, label: "main", user: user.join(" "), assistant: assistant.join(" ") });
}

function shadowTurn(turn) {
  const location = LOCATIONS[(turn + 2) % LOCATIONS.length];
  return Object.freeze({
    turn,
    label: "shadow",
    user: `${MARKERS.shadow} turn ${turn}: At the ${location}, Bea records a separate set of plain maintenance notes for the secondary performance.`,
    assistant: `The secondary ledger receives its own response for turn ${turn}; no object, promise, or continuity from the other performance is mentioned.`,
  });
}

module.exports = { MARKERS, STAGE, PROFILES, mainTurn, shadowTurn };
