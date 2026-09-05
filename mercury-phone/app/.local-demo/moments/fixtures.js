(function exposeMomentsDemoFixtures(global) {
  "use strict";

  const asset = (name) => `.local-demo/moments/assets/${name}`;

  global.MercuryDemoMomentsFixtures = Object.freeze({
    profile: Object.freeze({
      name: "澄野",
      cover: asset("hero-field.png"),
      avatar: asset("profile-leaf.png"),
      unread: Object.freeze({
        count: 3,
        avatar: asset("notice-glass.png"),
      }),
    }),
    posts: Object.freeze([
      Object.freeze({
        id: "mist",
        author: "雾岚",
        avatar: asset("avatar-fog.png"),
        text: "雾散得很慢，远处的树先亮起来。",
        time: "1小时前",
        images: Object.freeze([asset("fog-field.png")]),
        likes: Object.freeze(["澄野", "听雪", "清河"]),
        comments: Object.freeze([
          Object.freeze({ author: "听雪", text: "光会慢慢回来。" }),
          Object.freeze({ author: "清河", text: "安静得很好。" }),
        ]),
      }),
      Object.freeze({
        id: "creek",
        author: "溪白",
        avatar: asset("avatar-leaf.png"),
        text: "把今天收进九张安静的小事里。",
        time: "3小时前",
        location: "星河镇 · 云栖书屋",
        images: Object.freeze([
          asset("grid-01.png"),
          asset("grid-02.png"),
          asset("grid-03.png"),
          asset("grid-04.png"),
          asset("grid-05.png"),
          asset("grid-06.png"),
          asset("grid-07.png"),
          asset("grid-08.png"),
          asset("grid-09.png"),
        ]),
        likes: Object.freeze(["澄野", "鹿迟"]),
        comments: Object.freeze([]),
      }),
    ]),
  });
})(window);
