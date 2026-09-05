"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.resolve(__dirname, "../styles/mercury-chat-app.css"), "utf8");
const refreshCss = fs.readFileSync(path.resolve(__dirname, "../styles/mercury-chat-refresh.css"), "utf8");
const systemCss = fs.readFileSync(path.resolve(__dirname, "../styles/system-shell.css"), "utf8");
const dockedNavigation = css.slice(css.lastIndexOf("\n.mercury-chat-primary-nav {\n  right:"));

assert.match(
  systemCss,
  /\.home-gesture-zone\s*\{[^}]*height:\s*58px[^}]*\}/s,
  "the system shell reserves a 58px bottom home-gesture zone",
);
assert.match(
  dockedNavigation,
  /\.mercury-chat-primary-nav\s*\{[^}]*bottom:\s*20px[^}]*\}/s,
  "primary navigation stays visually docked to the bottom of the app",
);
assert.match(
  systemCss,
  /\.screen\[data-system-state="appOpen"\]:has\(\.mercury-chat-app\)\s+\.home-gesture-zone\s*\{[^}]*height:\s*18px[^}]*\}/s,
  "Mercury Chat reduces the system gesture capture area to the home-indicator strip",
);
assert.match(
  css,
  /\.mercury-chat-me\s*>\s*\.mercury-chat-primary-nav\s*\{[^}]*margin-bottom:\s*20px[^}]*\}/s,
  "the Me tab shares the same bottom dock as Chat and Contacts",
);
assert.doesNotMatch(
  css,
  /\.mercury-chat-contacts-page\s+\.mercury-chat-primary-nav\s*\{[^}]*bottom:/s,
  "contacts cannot reintroduce a smaller bottom inset than the shared navigation",
);
assert.match(
  refreshCss,
  /\.mercury-chat-app\s+\.mercury-chat-conversation\s*\{[^}]*grid-template-rows:\s*54px minmax\(0, 1fr\) auto[^}]*\}/s,
  "conversation fixes header and composer while the middle message rail owns remaining height",
);
assert.match(
  refreshCss,
  /\.mercury-chat-app\s+\.mercury-chat-messages\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*scroll[^}]*\}/s,
  "message history exposes an independent vertical scroll rail",
);
assert.match(
  refreshCss,
  /\.mercury-chat-app\s+\.mercury-chat-list__threads\s*\{[^}]*grid-row:\s*3[^}]*min-height:\s*0[^}]*overflow-y:\s*auto[^}]*\}/s,
  "a long chat list scrolls without moving the primary navigation",
);
assert.match(
  refreshCss,
  /\.mercury-chat-app\s+\.mercury-chat-primary-nav[^}]*\{[^}]*position:\s*absolute[^}]*bottom:\s*19px[^}]*\}/s,
  "the refreshed primary navigation remains fixed above the home indicator",
);
assert.match(
  refreshCss,
  /\.mercury-chat-app\s+\.mercury-chat-page\s*>\s*:not\(\.mercury-chat-page__header\)\s*\{[^}]*height:\s*100%[^}]*overflow-y:\s*scroll[^}]*touch-action:\s*pan-y[^}]*-webkit-overflow-scrolling:\s*touch[^}]*\}/s,
  "settings pages expose a bounded touch-scroll rail below the fixed header",
);
assert.match(
  refreshCss,
  /\.mercury-chat-app\s+\.mercury-chat-preset-card\s*\{[^}]*margin:\s*0[^}]*padding:\s*0[^}]*\}/s,
  "preset accordion cards reset legacy outer spacing",
);
assert.match(
  refreshCss,
  /\.mercury-chat-app\s+\.mercury-chat-preset-card__title::after\s*\{[^}]*content:\s*none[^}]*display:\s*none[^}]*\}/s,
  "the legacy title chevron is removed so the accordion renders one aligned icon",
);
assert.match(
  refreshCss,
  /Alpha polish:[\s\S]*?\.mercury-chat-app \.mercury-chat-list__search-button,[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/s,
  "chat list utilities expose reliable touch targets without enlarging their inner artwork",
);
assert.match(
  refreshCss,
  /Alpha polish:[\s\S]*?\.mercury-chat-app \.mercury-chat-header__back,[\s\S]*?min-width:\s*44px;[\s\S]*?height:\s*44px;/s,
  "conversation navigation and utilities expose 44px touch targets",
);
assert.match(
  refreshCss,
  /Alpha polish:[\s\S]*?\.mercury-chat-app \.mercury-chat-message__action\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s,
  "contextual message actions remain usable at phone scale",
);
assert.match(
  refreshCss,
  /\.mercury-chat-messages::\-webkit-scrollbar-button,[\s\S]*?\.mercury-chat-me__content::\-webkit-scrollbar-button\s*\{[^}]*width:\s*0[^}]*height:\s*0[^}]*display:\s*none[^}]*\}/s,
  "scroll rails never expose standalone browser arrow buttons",
);

console.log("mercury-chat-navigation-safe-area: assertions passed");
