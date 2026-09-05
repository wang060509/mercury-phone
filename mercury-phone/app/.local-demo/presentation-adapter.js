(function installDemoPresentationAdapter(global) {
  "use strict";

  const params = new URLSearchParams(global.location.search);
  if (params.get("demo") !== "1") return;

  const moments = new global.MercuryDemoMomentsView(global.MercuryDemoMomentsFixtures);

  global.MercuryPresentationAdapter = Object.freeze({
    initialRoute: params.get("start") === "moments" ? "demo-moments" : null,
    meEntries: Object.freeze([
      Object.freeze({
        slot: "moments",
        route: "demo-moments",
        label: "朋友圈",
        subtitle: "查看自己和联系人的动态",
        icon: "camera",
      }),
    ]),
    renderRoute(route, context) {
      return route === "demo-moments" ? moments.render(context) : null;
    },
  });
})(window);
