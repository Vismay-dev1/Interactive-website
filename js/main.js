/* ═══════════════════════════════════════════════════════════
   main.js — page bootstrap: intro dialog, menu, anchors,
   cookie note, docs interactions + real StringTune (CDN) demo.
   Works together with tune.js.
   ═══════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  /* ── intro dialog ───────────────────────────────────────── */
  const Intro = {
    el: document.getElementById("intro"),
    textEl: document.getElementById("introText"),
    nextBtn: document.getElementById("introNext"),
    skipBtn: document.getElementById("introSkip"),
    lines: [
      "You made it past the gate. Good. The dojo opens when you scroll.",
      "Everything here moves — the string binds scroll, text and cursor.",
      "Tune your eye. Keep scrolling. The rest is practice."
    ],
    idx: 0, timer: 0, done: false,

    init() {
      if (!this.el) { document.documentElement.classList.add("is-loaded"); return; }
      if (sessionStorage.getItem("st-intro-seen")) { this.finish(true); return; }
      this.el.setAttribute("aria-hidden", "false");
      this.type(this.lines[0]);
      this.nextBtn.addEventListener("click", () => {
        Tune.Pluck.play(300);
        this.idx++;
        if (this.idx >= this.lines.length) this.finish();
        else this.type(this.lines[this.idx]);
      });
      this.skipBtn.addEventListener("click", () => this.finish());
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !this.done) this.finish();
      });
    },

    type(line) {
      clearInterval(this.timer);
      if (Tune.REDUCED) { this.textEl.textContent = line; return; }
      this.textEl.textContent = "";
      let i = 0;
      this.timer = setInterval(() => {
        this.textEl.textContent = line.slice(0, ++i);
        if (i >= line.length) clearInterval(this.timer);
      }, 17);
      this.textEl.dataset.full = line;
    },

    finish(instant) {
      if (this.done) return;
      this.done = true;
      clearInterval(this.timer);
      sessionStorage.setItem("st-intro-seen", "1");
      document.documentElement.classList.add("is-loaded");
      if (instant) { this.el.remove(); return; }
      this.el.classList.add("is-leaving");
      setTimeout(() => this.el.remove(), 1050);
    }
  };

  /* ── mobile menu ────────────────────────────────────────── */
  const Menu = {
    el: document.getElementById("menu"),
    burger: document.getElementById("burger"),

    init() {
      if (!this.el) return;
      const links = [...this.el.querySelectorAll(".menu-links a")];
      links.forEach((a, i) => a.style.setProperty("--i", i));
      this.burger.addEventListener("click", () => this.toggle());
      links.forEach((a) => a.addEventListener("click", () => this.toggle(false)));
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.toggle(false);
      });
    },
    toggle(force) {
      const open = force !== undefined ? force : !this.el.classList.contains("is-open");
      this.el.classList.toggle("is-open", open);
      this.burger.classList.toggle("is-open", open);
      this.burger.setAttribute("aria-expanded", String(open));
      this.el.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
      if (open) Tune.Pluck.play(420);
    }
  };

  /* ── anchor links (smooth, works with lerp scroll) ──────── */
  const Anchors = {
    init() {
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener("click", (e) => {
          const id = a.getAttribute("href");
          if (id.length < 2) return;
          const target = document.querySelector(id);
          if (!target) return;
          e.preventDefault();
          const g = target.getBoundingClientRect();
          const y = g.top + Tune.y;
          window.scrollTo({ top: Math.max(0, y), behavior: Tune.REDUCED ? "auto" : "smooth" });
        });
      });
    }
  };

  /* ── cookie note (purely local, nothing tracked) ────────── */
  const Cookie = {
    el: document.getElementById("cookie"),
    init() {
      if (!this.el) return;
      if (localStorage.getItem("st-cookie")) return;
      setTimeout(() => this.el.classList.add("is-visible"), 3200);
      const close = (v) => {
        localStorage.setItem("st-cookie", v);
        this.el.classList.remove("is-visible");
      };
      document.getElementById("cookieAccept").addEventListener("click", () => close("accept"));
      document.getElementById("cookieReject").addEventListener("click", () => close("reject"));
      document.getElementById("cookieMore").addEventListener("click", (e) => {
        e.preventDefault();
        close("customize");
      });
    }
  };

  /* ── docs: copy buttons ─────────────────────────────────── */
  const Copy = {
    init() {
      document.querySelectorAll("[data-copy]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const src = document.querySelector(btn.getAttribute("data-copy"));
          if (!src) return;
          const text = src.innerText;
          try {
            await navigator.clipboard.writeText(text);
          } catch (_) {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); } catch (_) { /* noop */ }
            ta.remove();
          }
          btn.classList.add("copied");
          btn.textContent = "Copied ✓";
          Tune.Pluck.play(620);
          setTimeout(() => {
            btn.classList.remove("copied");
            btn.textContent = "Copy";
          }, 1600);
        });
      });
    }
  };

  /* ── docs: mock video player toggle ─────────────────────── */
  const VideoMock = {
    init() {
      document.querySelectorAll(".vid").forEach((v) => {
        const toggle = () => {
          v.classList.toggle("is-paused");
          const glyph = v.querySelector(".vid-play i");
          if (glyph) glyph.textContent = v.classList.contains("is-paused") ? "▶" : "❚❚";
          Tune.Pluck.play(v.classList.contains("is-paused") ? 280 : 480);
        };
        v.addEventListener("click", toggle);
        v.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        });
      });
    }
  };

  /* ── real StringTune from the CDN → drives the live demo ── */
  const RealLib = {
    note: null,
    init() {
      this.note = document.getElementById("demoNote");
      this.try();
      /* deferred CDN script may land after DOMContentLoaded */
      if (!window.StringTune) {
        window.addEventListener("load", () => this.try());
      }
    },
    try() {
      const NS = window.StringTune; /* CDN exposes a namespace */
      if (!NS) {
        this.fallback();
        return;
      }
      try {
        /* README: CDN users must reference the full namespace */
        const Ctor = NS.StringTune || NS;
        if (!Ctor.getInstance) throw new Error("no getInstance");
        const inst = Ctor.getInstance();
        ["StringParallax", "StringMagnetic"].forEach((m) => {
          if (NS[m]) inst.use(NS[m]);
        });
        inst.start(60);
        if (this.note) this.note.textContent = "live — real StringParallax + StringMagnetic · v_ CDN";
      } catch (_) {
        this.fallback();
      }
    },
    fallback() {
      document.querySelectorAll(".demo-stage").forEach((s) => s.classList.add("is-static"));
      if (this.note) this.note.textContent = "cdn offline — css fallback drift";
    }
  };

  /* ── boot ───────────────────────────────────────────────── */
  function boot() {
    Tune.start();
    /* reveal everything only after the intro lifts */
    if (document.documentElement.classList.contains("is-loaded")) {
      document.body.classList.add("page-ready");
    } else {
      const obs = new MutationObserver(() => {
        if (document.documentElement.classList.contains("is-loaded")) {
          document.body.classList.add("page-ready");
          obs.disconnect();
        }
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    }
    Intro.init();
    Menu.init();
    Anchors.init();
    Cookie.init();
    Copy.init();
    VideoMock.init();
    RealLib.init();

    /* re-measure once fonts/images settle */
    window.addEventListener("load", () => Tune.refresh());
    let rt = 0;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => Tune.refresh(), 150);
    });
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => Tune.refresh()).observe(document.getElementById("st-smooth"));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
