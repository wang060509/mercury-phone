"use strict";

module.exports = Object.freeze({
  id: "quiet-station-fixture",
  version: 1,
  title: "The Quiet Station",
  shortTitle: "Quiet Station",
  premise: "Two people wait through the night at a remote station.",
  summary: "The platforms are nearly empty, and the final departure has been delayed without explanation.",
  tagline: "Wait together until the last train arrives.",
  roleConfiguration: {
    playerRoleLabel: "Your role",
    playerRolePlaceholder: "Describe why you are waiting here",
    defaultPlayerRole: "traveller",
    defaultCharacterRole: "fellow traveller",
    sharedHistoryPlaceholder: "Describe what happened between you before tonight; this can be left blank.",
  },
  scenarios: [{
    id: "last-train",
    title: "Last Train",
    season: "After midnight",
    summary: "The last train is late. There is time for a conversation neither person planned.",
    entryPeriods: ["The delay begins", "Near the final announcement"],
    defaultEntryPeriod: "The delay begins",
    opening: "The departure board changed again. Beyond the glass, the dark track remained empty.",
  }],
  relationshipOptions: ["初次相识", "多年好友", "恋人", "自定义"],
  places: ["Platform", "Waiting Room"],
});
