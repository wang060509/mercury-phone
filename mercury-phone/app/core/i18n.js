(function exposeMercuryI18n(global) {
  "use strict";

  class MercuryI18n {
    constructor(options = {}) {
      this.locales = options.locales || global.MercuryLocales || {};
      this.fallbackLocale = options.fallbackLocale || "en-US";
      this.locale = this.locales[options.locale] ? options.locale : this.fallbackLocale;
      this.listeners = new Set();
    }

    hasLocale(locale) {
      return Boolean(this.locales[locale]);
    }

    setLocale(locale) {
      if (!this.hasLocale(locale)) throw new Error(`Unsupported locale: ${locale}`);
      if (locale === this.locale) return false;
      this.locale = locale;
      this.listeners.forEach((listener) => listener(locale));
      return true;
    }

    t(key, values = {}) {
      const current = this.#read(this.locales[this.locale], key);
      const fallback = this.#read(this.locales[this.fallbackLocale], key);
      const template = current ?? fallback ?? key;
      return String(template).replace(/\{(\w+)\}/g, (_, token) => values[token] ?? `{${token}}`);
    }

    formatDate(date, options = {}) {
      return new Intl.DateTimeFormat(this.locale, options).format(date);
    }

    translate(root = document) {
      root.querySelectorAll("[data-i18n]").forEach((node) => {
        node.textContent = this.t(node.dataset.i18n);
      });
      root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
        node.setAttribute("placeholder", this.t(node.dataset.i18nPlaceholder));
      });
      document.documentElement.lang = this.locale;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    #read(source, path) {
      return path.split(".").reduce((value, segment) => value?.[segment], source);
    }
  }

  global.MercuryI18n = MercuryI18n;
})(window);
