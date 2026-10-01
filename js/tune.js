/* ═══════════════════════════════════════════════════════════
   tune.js — a tiny in-house motion toolkit written for this
   recreation. Attribute-driven, CSS-first, JS-light.
   Modules: SmoothScroll · SplitText · Reveals · Parallax ·
            Pin · Marquee · Counters · Cursor · WordSwap ·
            Magnetic · Pluck(audio) · Progress
   ═══════════════════════════════════════════════════════════ */

const Tune = (() => {
  "use strict";

  /* ── environment ───────────────────────────────────────── */
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOUCH = window.matchMedia("(hover: none), (pointer: coarse)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const num = (el, attr, fb) => {
    const v = parseFloat(el.getAttribute(attr));
    return Number.isNaN(v) ? fb : v;
  };

  /* ═════════ SMOOTH SCROLL (lerp the native bar) ═════════ */
  const Smooth = {
    el: null, target: 0, current: 0, max: 1, enabled: false,

    init() {
      this.el = document.getElementById("st-smooth");
      if (!this.el || REDUCED || TOUCH) return;
      this.enabled = true;
      document.body.classList.add("has-smooth");
      this.target = this.current = window.scrollY;
      this.resize();
    },

    resize() {
      if (!this.enabled) return;
      this.el.style.transform = "translate3d(0,0,0)";
      document.body.style.height = this.el.scrollHeight + "px";
      this.max = Math.max(1, this.el.scrollHeight - window.innerHeight);
      this.target = clamp(window.scrollY, 0, this.max);
      this.current = clamp(this.current, 0, this.max);
    },

    update() {
      if (!this.enabled) return;
      this.target = clamp(window.scrollY, 0, this.max);
      this.current = lerp(this.current, this.target, 0.088);
      if (Math.abs(this.current - this.target) < 0.05) this.current = this.target;
      this.el.style.transform = `translate3d(0, ${-this.current.toFixed(2)}px, 0)`;
    },

    get y() { return this.enabled ? this.current : window.scrollY; },
    get progress() {
      const doc = document.documentElement;
      const total = this.enabled ? this.max : doc.scrollHeight - window.innerHeight;
      return clamp(this.y / (total || 1), 0, 1);
    }
  };

  /* cached document offsets — measured once per resize */
  const Geo = {
    map: new WeakMap(),
    measure(el) {
      const y = Smooth.enabled ? Smooth.current : window.scrollY;
      const r = el.getBoundingClientRect();
      return { top: r.top + y, height: r.height };
    },
    of(el) {
      let g = this.map.get(el);
      if (!g) { g = this.measure(el); this.map.set(el, g); }
      return g;
    },
    remeasure(el) { this.map.set(el, this.measure(el)); },
    clear() { this.map = new WeakMap(); }
  };

  /* ═════════ SPLIT TEXT ═════════ */
  function SplitText(el) {
    const mode = el.getAttribute("data-split") || "lines";
    const aria = el.getAttribute("aria-label") || el.textContent.trim();
    el.setAttribute("aria-label", aria);

    const parts = [];
    const mkSpan = (cls, txt) => {
      const s = document.createElement("span");
      s.className = cls;
      s.textContent = txt;
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", parts.length);
      parts.push(s);
      return s;
    };

    if (mode === "lines") {
      /* split at <br>, keeping the original inline markup intact */
      const nodes = [...el.childNodes];
      el.textContent = "";
      const seg = [];
      const flush = () => {
        if (!seg.length) return;
        const wrap = document.createElement("span");
        wrap.className = "st-line";
        wrap.setAttribute("aria-hidden", "true");
        const inner = document.createElement("span");
        inner.className = "st-line-inner";
        inner.style.setProperty("--i", parts.length);
        seg.forEach((n) => inner.appendChild(n));
        wrap.appendChild(inner);
        el.appendChild(wrap);
        parts.push(inner);
        seg.length = 0;
      };
      nodes.forEach((n) => {
        if (n.nodeType === 1 && n.tagName === "BR") flush();
        else seg.push(n);
      });
      flush();
    } else {
      /* chars / words: recurse, preserving inline wrappers like <em> */
      const process = (node) => {
        [...node.childNodes].forEach((k) => {
          if (k.nodeType === 3) {
            const frag = document.createDocumentFragment();
            const tokens = mode === "chars"
              ? [...k.textContent]
              : k.textContent.split(/(\s+)/);
            tokens.forEach((tok) => {
              if (!tok || /^\s+$/.test(tok)) {
                frag.appendChild(document.createTextNode(" "));
                return;
              }
              frag.appendChild(mkSpan(mode === "chars" ? "st-char" : "st-word", tok));
            });
            node.replaceChild(frag, k);
          } else if (k.nodeType === 1 && k.tagName !== "BR") {
            process(k);
          }
        });
      };
      process(el);
    }
    return { el, parts, mode };
  }

  /* ═════════ REVEALS (class-driven, IntersectionObserver-free) ═════════ */
  const Reveals = {
    items: [],
    collect() {
      document.querySelectorAll("[data-reveal], [data-split]").forEach((el) => {
        if (el._tuneSplit === undefined && el.hasAttribute("data-split")) {
          el._tuneSplit = SplitText(el);
        }
        if (!el._tuneReveal) {
          el._tuneReveal = true;
          const d = parseInt(el.getAttribute("data-delay") || "0", 10);
          if (d) el.style.setProperty("--rd", d);
          this.items.push(el);
        }
      });
    },
    update() {
      if (!document.body.classList.contains("page-ready")) return; /* wait for the intro to lift */
      for (let i = this.items.length - 1; i >= 0; i--) {
        const el = this.items[i];
        const g = Geo.of(el);
        if (g.top - Smooth.y < window.innerHeight * 0.92) {
          el.classList.add("is-inview");
          this.items.splice(i, 1);
        }
      }
    }
  };

  /* ═════════ HERO TITLE — ink weight driven by scroll progress ═════════ */
  const HeroInk = {
    lines: [],
    collect() {
      document.querySelectorAll("[data-split-scroll]").forEach((el) => {
        this.lines.push({ el, chars: [...el.querySelectorAll(".st-char")] });
      });
    },
    update() {
      const vh = window.innerHeight;
      for (const line of this.lines) {
        const g = Geo.of(line.el);
        const chars = line.chars;
        if (!chars.length) continue;
        const screenTop = g.top - Smooth.y;
        if (screenTop > vh * 1.2 || screenTop + g.height < -vh * 0.4) continue;
        /* 0 near load → 1 once the hero has scrolled most of a viewport */
        const p = clamp((Smooth.y + vh * 0.32 - g.top * 0.35) / (vh * 0.55), 0, 1);
        const n = chars.length;
        const fade = Math.max(5, n * 0.6);
        for (let i = 0; i < n; i++) {
          const t = clamp((p * (n + fade) - i) / fade, 0, 1);
          const c = chars[i];
          c.style.opacity = (0.32 + 0.68 * t).toFixed(3);
          c.style.fontVariationSettings = `"wght" ${Math.round(320 + 380 * t)}`;
        }
      }
    }
  };

  /* ═════════ PARALLAX ═════════ */
  const Parallax = {
    items: [],
    collect() {
      document.querySelectorAll("[data-parallax]").forEach((wrap) => {
        const depth = num(wrap, "data-parallax", 10);
        let target = wrap;
        if (wrap.classList.contains("ph")) {
          const img = wrap.querySelector("img");
          if (img) {
            const d = Math.abs(depth);
            wrap.style.setProperty("--ph-h", (100 + d * 2) + "%");
            wrap.style.setProperty("--ph-top", (-d) + "%");
            target = img;
          }
        }
        this.items.push({ wrap, target, depth });
      });
    },
    update() {
      const vh = window.innerHeight;
      for (const it of this.items) {
        const g = Geo.of(it.wrap);
        const top = g.top - Smooth.y;
        if (top + g.height < -80 || top > vh + 80) continue;
        /* -1 (element below viewport) … 1 (above) */
        const p = clamp((top + g.height / 2 - vh / 2) / (vh / 2 + g.height / 2), -1, 1);
        const px = -p * it.depth * 0.5 * (g.height / 100);
        it.target.style.transform = `translate3d(0, ${px.toFixed(2)}px, 0)`;
      }
    }
  };

  /* ═════════ PIN SECTION (scroll-scrubbed scene) ═════════ */
  const Pin = {
    sec: null, stage: null, dist: 1, layers: [], slash: null, swap: null, p: -1,

    init() {
      this.sec = document.querySelector("[data-pin]");
      if (!this.sec) return;
      this.stage = this.sec.querySelector(".pin-stage");
      this.slash = this.sec.querySelector(".pin-slash-path");
      this.swap = WordSwap.make(this.sec.querySelector("#pinWordswap"), 0);
      this.layers = [...this.sec.querySelectorAll("[data-pin-layer]")].map((el) => ({
        el, speed: num(el, "data-pin-layer", 0.1)
      }));
      if (this.slash) {
        const len = this.slash.getTotalLength();
        this.slash.style.strokeDasharray = len;
        this.slash.style.strokeDashoffset = len;
      }
    },

    resize() {
      if (!this.sec) return;
      Geo.remeasure(this.sec);
      const g = Geo.of(this.sec);
      this.dist = Math.max(1, g.height - window.innerHeight);
    },

    update() {
      if (!this.sec) return;
      const g = Geo.of(this.sec);
      const rel = Smooth.y - g.top;
      if (rel + window.innerHeight < -100 || rel > this.dist + window.innerHeight + 100) return;

      /* poor man's sticky: push the stage down while the section passes */
      this.stage.style.transform =
        rel <= 0 ? "translate3d(0,0,0)" : `translate3d(0, ${Math.min(rel, this.dist).toFixed(1)}px, 0)`;

      const pinned = clamp(rel / this.dist, 0, 1);
      if (Math.abs(pinned - this.p) < 0.0015) return;
      this.p = pinned;

      /* words swap at thirds */
      if (this.swap) this.swap.set(pinned < 0.34 ? 0 : pinned < 0.7 ? 1 : 2);

      /* slash draws across the middle */
      if (this.slash) {
        const t = clamp((pinned - 0.15) / 0.55, 0, 1);
        const len = parseFloat(this.slash.style.strokeDasharray) || 1;
        this.slash.style.strokeDashoffset = len * (1 - t);
      }
      /* micro layers — via --ply so each element's own transforms survive */
      for (const l of this.layers) {
        l.el.style.setProperty("--ply", ((pinned - 0.5) * l.speed * -200).toFixed(2) + "px");
      }
    }
  };

  /* ═════════ WORD SWAP ═════════ */
  const WordSwap = {
    all: [],
    make(el, interval) {
      if (!el) return null;
      const words = [...el.querySelectorAll(".wordswap-word")];
      const state = { el, words, idx: 0, timer: 0, auto: interval || 0 };
      const set = (i) => {
        if (i === state.idx) return;
        words[state.idx].classList.remove("is-active");
        words[state.idx].classList.add("was-active");
        state.idx = i;
        words[i].classList.remove("was-active");
        words[i].classList.add("is-active");
      };
      const next = () => set((state.idx + 1) % words.length);
      state.set = set;
      if (state.auto && !REDUCED) {
        state.timer = setInterval(next, state.auto);
      }
      this.all.push(state);
      return state;
    },
    init() {
      document.querySelectorAll(".wordswap").forEach((el) => {
        if (el.id === "pinWordswap") return; /* pin drives this one */
        this.make(el, el.closest(".pin") ? 0 : 2200);
      });
    }
  };

  /* ═════════ COUNTERS ═════════ */
  const Counters = {
    items: [],
    collect() {
      document.querySelectorAll("[data-count]").forEach((el) => this.items.push(el));
    },
    update() {
      const vh = window.innerHeight;
      for (let i = this.items.length - 1; i >= 0; i--) {
        const el = this.items[i];
        const g = Geo.of(el);
        if (g.top - Smooth.y > vh * 0.92) continue;
        const end = parseInt(el.getAttribute("data-count"), 10) || 0;
        const t0 = performance.now();
        const dur = 1500;
        const step = (now) => {
          const p = clamp((now - t0) / dur, 0, 1);
          const e = 1 - Math.pow(2, -10 * p); /* expo-out */
          el.textContent = Math.round(end * e);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        this.items.splice(i, 1);
      }
    }
  };

  /* ═════════ METERS (skill bars) ═════════ */
  const Meters = {
    items: [],
    collect() {
      document.querySelectorAll("[data-meter]").forEach((el) => {
        el.style.setProperty("--meter", (parseInt(el.getAttribute("data-meter"), 10) / 100).toFixed(2));
        this.items.push(el);
      });
    },
    update() {
      const vh = window.innerHeight;
      for (let i = this.items.length - 1; i >= 0; i--) {
        const el = this.items[i];
        const g = Geo.of(el);
        if (g.top - Smooth.y < vh * 0.92) { el.classList.add("is-inview"); this.items.splice(i, 1); }
      }
    }
  };

  /* ═════════ CUSTOM CURSOR ═════════ */
  const Cursor = {
    x: 0, y: 0, rx: 0, ry: 0, on: false,

    init() {
      if (TOUCH || REDUCED) return;
      this.root = document.getElementById("cursor");
      this.dotPos = document.getElementById("cursorDotPos");
      this.ringPos = document.getElementById("cursorRingPos");
      this.label = this.root.querySelector(".cursor-label");
      document.body.classList.add("cursor-on");

      window.addEventListener("mousemove", (e) => {
        this.x = e.clientX; this.y = e.clientY;
        if (!this.on) { this.on = true; this.rx = this.x; this.ry = this.y; }
      }, { passive: true });
      document.addEventListener("mouseleave", () => { this.on = false; document.body.classList.remove("cursor-on"); });
      document.addEventListener("mouseenter", () => document.body.classList.add("cursor-on"));
      window.addEventListener("mousedown", () => this.root.classList.add("is-down"), { passive: true });
      window.addEventListener("mouseup", () => this.root.classList.remove("is-down"), { passive: true });

      document.addEventListener("mouseover", (e) => {
        const labelled = e.target.closest("[data-cursor]");
        const hit = e.target.closest("a, button, .who-card, .p-card, .m-item");
        if (labelled) {
          this.label.textContent = labelled.getAttribute("data-cursor");
          this.root.classList.add("is-label");
          this.root.classList.remove("is-hover");
        } else if (hit) {
          this.root.classList.add("is-hover");
          this.root.classList.remove("is-label");
        } else {
          this.root.classList.remove("is-hover", "is-label");
        }
      }, { passive: true });
    },

    update() {
      if (!this.root || !this.on) return;
      this.rx = lerp(this.rx, this.x, 0.16);
      this.ry = lerp(this.ry, this.y, 0.16);
      this.dotPos.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
      this.ringPos.style.transform = `translate3d(${this.rx.toFixed(2)}px, ${this.ry.toFixed(2)}px, 0)`;
    }
  };

  /* ═════════ MAGNETIC ELEMENTS ═════════ */
  const Magnetic = {
    init() {
      if (TOUCH || REDUCED) return;
      document.querySelectorAll("[data-magnetic]").forEach((el) => {
        const strength = 0.32;
        el.addEventListener("mousemove", (e) => {
          const r = el.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
        });
        el.addEventListener("mouseleave", () => { el.style.transform = ""; });
      });
    }
  };

  /* ═════════ KOTO PLUCK — a soft string note on interaction ═════════ */
  const Pluck = {
    ctx: null,
    init() {
      if (TOUCH) return;
      const unlock = () => {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) this.ctx = new AC();
        } catch (_) { this.ctx = null; }
        window.removeEventListener("pointerdown", unlock);
      };
      window.addEventListener("pointerdown", unlock, { once: true });
      document.querySelectorAll("[data-pluck]").forEach((el) => {
        el.addEventListener("pointerenter", () => this.play(520 + Math.random() * 160));
        el.addEventListener("click", () => this.play(340));
      });
    },
    play(freq) {
      if (!this.ctx) return;
      try {
        if (this.ctx.state === "suspended") this.ctx.resume();
        const t = this.ctx.currentTime;
        const out = this.ctx.createGain();
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(0.055, t + 0.012);
        out.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 2400;
        [1, 2.01].forEach((mult, i) => {
          const osc = this.ctx.createOscillator();
          osc.type = i ? "sine" : "triangle";
          osc.frequency.value = freq * mult;
          const g = this.ctx.createGain();
          g.gain.value = i ? 0.35 : 1;
          osc.connect(g).connect(filter);
          osc.start(t); osc.stop(t + 0.55);
        });
        filter.connect(out).connect(this.ctx.destination);
      } catch (_) { /* silence is also zen */ }
    }
  };

  /* ═════════ MARQUEE (duplicate chunk for seamless loop) ═════════ */
  const Marquee = {
    init() {
      document.querySelectorAll("[data-marquee-speed]").forEach((m) => {
        const v = parseFloat(m.getAttribute("data-marquee-speed"));
        if (!Number.isNaN(v)) m.style.setProperty("--marquee-duration", v + "s");
        const clone = m.querySelector("[data-marquee-clone]");
        const src = m.querySelector(".marquee-chunk");
        if (clone && src) clone.innerHTML = src.innerHTML;
      });
    }
  };

  /* ═════════ PROGRESS BAR + NAV HIDE + TO-TOP ═════════ */
  const Chrome = {
    bar: null, nav: null, top: null, lastY: 0,
    init() {
      this.bar = document.getElementById("scrollProgressBar");
      this.nav = document.getElementById("nav");
      this.top = document.getElementById("toTop");
      if (this.top) this.top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }));
    },
    update() {
      const p = Smooth.progress;
      if (this.bar) this.bar.style.transform = `scaleX(${p.toFixed(4)})`;

      const y = Smooth.y;
      if (this.nav) {
        if (y > this.lastY + 6 && y > 140) this.nav.classList.add("is-hidden");
        else if (y < this.lastY - 4 || y < 140) this.nav.classList.remove("is-hidden");
      }
      if (this.top) this.top.classList.toggle("is-visible", p > 0.5);
      this.lastY = y;
    }
  };

  /* ═════════ MASTER LOOP ═════════ */
  function loop() {
    Smooth.update();
    Reveals.update();
    HeroInk.update();
    Parallax.update();
    Pin.update();
    Counters.update();
    Meters.update();
    Cursor.update();
    Chrome.update();
    requestAnimationFrame(loop);
  }

  function start() {
    Smooth.init();
    Reveals.collect();
    HeroInk.collect();
    Parallax.collect();
    Pin.init();
    WordSwap.init();
    Counters.collect();
    Meters.collect();
    Cursor.init();
    Magnetic.init();
    Marquee.init();
    Chrome.init();
    Pluck.init();
    Pin.resize();
    requestAnimationFrame(loop);
  }

  function refresh() {
    Geo.clear();
    Smooth.resize();
    Pin.resize();
  }

  return {
    start, refresh,
    get y() { return Smooth.y; },
    get progress() { return Smooth.progress; },
    REDUCED, TOUCH,
    Pluck, Smooth
  };
})();
