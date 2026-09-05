(function exposeMomentsDemoView(global) {
  "use strict";

  const ICON_ROOT = "assets/icons/iconoir/";
  const DEMO_ICON_ROOT = ".local-demo/moments/icons/";

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const icon = (source, alt = "") => {
    const image = document.createElement("img");
    image.src = source;
    image.alt = alt;
    return image;
  };

  class MomentsDemoView {
    constructor(fixtures) {
      this.fixtures = fixtures;
      this.state = {
        liked: new Set(),
        comments: new Map(),
        menuFor: null,
        commentFor: null,
        composerOpen: false,
        noticeVisible: true,
        ephemeralPosts: [],
      };
    }

    render(context) {
      this.context = context;
      const page = element("section", "demo-moments");
      page.setAttribute("aria-label", "朋友圈演示");
      page.append(this.hero(), this.feed());
      if (this.state.composerOpen) page.append(this.composer());
      return page;
    }

    hero() {
      const profile = this.fixtures.profile;
      const hero = element("header", "demo-moments__hero");
      hero.append(icon(profile.cover, ""));
      hero.firstChild.className = "demo-moments__cover";
      const veil = element("span", "demo-moments__hero-veil");
      veil.setAttribute("aria-hidden", "true");
      const back = element("button", "demo-moments__back");
      back.type = "button";
      back.setAttribute("aria-label", "返回");
      back.append(icon(`${ICON_ROOT}nav-arrow-left.svg`, ""));
      back.addEventListener("click", () => this.context.navigate("me"));
      const camera = element("button", "demo-moments__camera");
      camera.type = "button";
      camera.setAttribute("aria-label", "发布动态");
      camera.append(icon(`${ICON_ROOT}camera.svg`, ""));
      camera.addEventListener("click", () => { this.state.composerOpen = true; this.repaint(); });
      const name = element("strong", "demo-moments__profile-name", profile.name);
      const avatar = icon(profile.avatar, `${profile.name}的头像`);
      avatar.className = "demo-moments__profile-avatar";
      hero.append(veil, back, camera, name, avatar);
      return hero;
    }

    feed() {
      const feed = element("main", "demo-moments__feed");
      if (this.state.noticeVisible) {
        const unread = this.fixtures.profile.unread;
        const notice = element("button", "demo-moments__notice");
        notice.type = "button";
        notice.append(icon(unread.avatar, ""), element("span", "", `${unread.count}条新消息`));
        notice.addEventListener("click", () => { this.state.noticeVisible = false; this.repaint(); });
        feed.append(notice);
      }
      this.state.ephemeralPosts.forEach((post) => feed.append(this.post(post)));
      this.fixtures.posts.forEach((post) => feed.append(this.post(post)));
      return feed;
    }

    post(post) {
      const article = element("article", `demo-moment demo-moment--${post.images.length === 9 ? "grid" : "single"}`);
      article.dataset.postId = post.id;
      const avatar = icon(post.avatar, `${post.author}的头像`);
      avatar.className = "demo-moment__avatar";
      const body = element("div", "demo-moment__body");
      body.append(element("h2", "", post.author), element("p", "demo-moment__text", post.text));
      if (post.images.length) {
        const gallery = element("div", `demo-moment__gallery demo-moment__gallery--${post.images.length}`);
        post.images.forEach((source, index) => {
          const button = element("button", "demo-moment__photo");
          button.type = "button";
          button.setAttribute("aria-label", `查看第${index + 1}张图片`);
          button.append(icon(source, ""));
          gallery.append(button);
        });
        body.append(gallery);
      }
      const meta = element("div", "demo-moment__meta");
      const metaCopy = element("span", "", [post.time, post.location].filter(Boolean).join("　"));
      const more = element("button", "demo-moment__more");
      more.type = "button";
      more.setAttribute("aria-label", "点赞或评论");
      more.append(icon(`${DEMO_ICON_ROOT}more-horiz.svg`, ""));
      more.addEventListener("click", () => {
        this.state.menuFor = this.state.menuFor === post.id ? null : post.id;
        this.repaint();
      });
      meta.append(metaCopy, more);
      body.append(meta);
      if (this.state.menuFor === post.id) body.append(this.actionMenu(post));
      const social = this.socialBlock(post);
      if (social) body.append(social);
      if (this.state.commentFor === post.id) body.append(this.commentComposer(post));
      article.append(avatar, body);
      return article;
    }

    actionMenu(post) {
      const menu = element("div", "demo-moment__action-menu");
      const liked = this.state.liked.has(post.id);
      const like = element("button", liked ? "is-liked" : "");
      like.type = "button";
      like.append(icon(`${DEMO_ICON_ROOT}${liked ? "heart-filled" : "heart"}.svg`, ""), element("span", "", liked ? "取消" : "赞"));
      like.addEventListener("click", () => {
        liked ? this.state.liked.delete(post.id) : this.state.liked.add(post.id);
        this.state.menuFor = null;
        this.repaint();
      });
      const comment = element("button");
      comment.type = "button";
      comment.append(icon(`${ICON_ROOT}chat-bubble.svg`, ""), element("span", "", "评论"));
      comment.addEventListener("click", () => {
        this.state.commentFor = post.id;
        this.state.menuFor = null;
        this.repaint();
      });
      menu.append(like, comment);
      return menu;
    }

    socialBlock(post) {
      const extraComments = this.state.comments.get(post.id) || [];
      const likes = [...post.likes, ...(this.state.liked.has(post.id) ? ["我"] : [])];
      const comments = [...post.comments, ...extraComments];
      if (!likes.length && !comments.length) return null;
      const block = element("div", "demo-moment__social");
      if (likes.length) {
        const likeRow = element("div", "demo-moment__likes");
        likeRow.append(icon(`${DEMO_ICON_ROOT}heart.svg`, ""), element("span", "", likes.join("、")));
        block.append(likeRow);
      }
      comments.forEach((comment) => {
        const row = element("p", "demo-moment__comment");
        row.append(element("strong", "", `${comment.author}：`), document.createTextNode(comment.text));
        block.append(row);
      });
      return block;
    }

    commentComposer(post) {
      const form = element("form", "demo-moment__comment-form");
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 80;
      input.placeholder = "写评论";
      input.setAttribute("aria-label", "评论内容");
      const submit = element("button");
      submit.type = "submit";
      submit.setAttribute("aria-label", "发送评论");
      submit.append(icon(`${DEMO_ICON_ROOT}send.svg`, ""));
      form.append(input, submit);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const comments = this.state.comments.get(post.id) || [];
        this.state.comments.set(post.id, [...comments, { author: "我", text }]);
        this.state.commentFor = null;
        this.repaint();
      });
      queueMicrotask(() => input.focus());
      return form;
    }

    composer() {
      const overlay = element("div", "demo-moments__composer-overlay");
      const sheet = element("form", "demo-moments__composer");
      const header = element("header");
      const close = element("button");
      close.type = "button";
      close.setAttribute("aria-label", "关闭");
      close.append(icon(`${ICON_ROOT}cancel.svg`, ""));
      close.addEventListener("click", () => { this.state.composerOpen = false; this.repaint(); });
      header.append(close, element("h2", "", "发布动态"));
      const text = document.createElement("textarea");
      text.maxLength = 120;
      text.placeholder = "记录这一刻";
      const publish = element("button", "demo-moments__publish", "发布");
      publish.type = "button";
      sheet.append(header, text, publish);
      const publishPost = () => {
        const content = text.value.trim();
        if (!content) return;
        this.state.ephemeralPosts.unshift({
          id: `ephemeral-${Date.now()}`,
          author: this.fixtures.profile.name,
          avatar: this.fixtures.profile.avatar,
          text: content,
          time: "刚刚",
          images: [],
          likes: [],
          comments: [],
        });
        this.state.composerOpen = false;
        this.repaint();
      };
      publish.addEventListener("click", publishPost);
      sheet.addEventListener("submit", (event) => { event.preventDefault(); publishPost(); });
      overlay.append(sheet);
      return overlay;
    }

    repaint() {
      this.context.repaint();
    }
  }

  global.MercuryDemoMomentsView = MomentsDemoView;
})(window);
