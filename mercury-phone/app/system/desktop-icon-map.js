(function exposeMercuryDesktopIconMap(global) {
  "use strict";

  const ICONS = Object.freeze({
    photos: "assets/icons/desktop-handdrawn/moments.svg",
    settings: "assets/icons/desktop-handdrawn/settings.svg",
    archive: "assets/icons/desktop-handdrawn/archive.svg",
    cinema: "assets/icons/desktop-handdrawn/cinema.png",
    calculator: "assets/icons/desktop-handdrawn/calculator.svg",
    timer: "assets/icons/desktop-handdrawn/timer.svg",
    "mercury-chat": "assets/icons/desktop-handdrawn/chat.svg",
    camera: "assets/icons/desktop-handdrawn/camera.svg",
    music: "assets/icons/desktop-handdrawn/music.svg",
    market: "assets/icons/desktop-handdrawn/market.svg",
  });

  function forApp(appId) {
    return ICONS[appId] || null;
  }

  global.MercuryDesktopIconMap = Object.freeze({ forApp, ICONS });
})(window);
