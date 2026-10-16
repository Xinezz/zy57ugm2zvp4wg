/* timer-visual.js - makes the Lock-In timer something to watch, not just a number.
   Pick a style: a glowing ring, an hourglass that drains, a candle that burns down, a tree that
   grows over the session, or the classic digits. The choice is saved (and synced).
   focus.js sends "focus:render" with the timer's state every time it redraws. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const stage = $("timerStage");
  const visual = $("timerVisual");
  if (!stage || !visual) return;

  const KEY = "plannerTimerStyle";
  const STYLES = [
    { id: "ring", label: "Ring", icon: "◯" },
    { id: "hourglass", label: "Hourglass", icon: "⌛" },
    { id: "candle", label: "Candle", icon: "🕯️" },
    { id: "tree", label: "Tree", icon: "🌱" },
    { id: "classic", label: "Digits", icon: "12" },
  ];
  const RING_R = 88;
  const RING_C = 2 * Math.PI * RING_R;

  /* ---------- the drawings (fixed markup; only attributes change while the timer runs) ---------- */

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2;
    const r1 = i % 5 === 0 ? 93 : 96;
    const x1 = 100 + Math.sin(a) * r1;
    const y1 = 100 - Math.cos(a) * r1;
    const x2 = 100 + Math.sin(a) * 99;
    const y2 = 100 - Math.cos(a) * 99;
    return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" class="${i % 5 === 0 ? "tv-tick major" : "tv-tick"}"/>`;
  }).join("");

  const SVG = {
    ring: `
      <svg viewBox="0 0 200 200" class="tv-svg tv-ring" aria-hidden="true">
        <defs>
          <filter id="tvGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        ${ticks}
        <circle cx="100" cy="100" r="${RING_R}" class="tv-track"/>
        <circle cx="100" cy="100" r="${RING_R}" class="tv-arc" transform="rotate(-90 100 100)" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}" filter="url(#tvGlow)"/>
        <circle r="6" class="tv-tip" filter="url(#tvGlow)" cx="100" cy="${100 - RING_R}"/>
        <circle r="2.6" class="tv-second" cx="100" cy="${100 - 76}"/>
      </svg>`,

    hourglass: `
      <svg viewBox="0 0 120 200" class="tv-svg tv-hourglass" aria-hidden="true">
        <defs>
          <clipPath id="tvGlass"><path d="M26 22 C26 70 54 86 57 100 C54 114 26 130 26 178 L94 178 C94 130 66 114 63 100 C66 86 94 70 94 22 Z"/></clipPath>
        </defs>
        <rect x="8" y="8" width="104" height="12" rx="4" class="tv-wood"/>
        <rect x="8" y="180" width="104" height="12" rx="4" class="tv-wood"/>
        <line x1="14" y1="20" x2="14" y2="180" class="tv-post"/>
        <line x1="106" y1="20" x2="106" y2="180" class="tv-post"/>
        <g clip-path="url(#tvGlass)">
          <rect x="0" y="22" width="120" height="78" class="tv-sand tv-sand-top"/>
          <rect x="0" y="178" width="120" height="0" class="tv-sand tv-sand-bottom"/>
          <line x1="60" y1="100" x2="60" y2="178" class="tv-stream"/>
        </g>
        <path d="M26 22 C26 70 54 86 57 100 C54 114 26 130 26 178 L94 178 C94 130 66 114 63 100 C66 86 94 70 94 22 Z" class="tv-glass"/>
        <path d="M34 30 C34 60 46 74 52 84" class="tv-shine"/>
      </svg>`,

    candle: `
      <svg viewBox="0 0 120 200" class="tv-svg tv-candle" aria-hidden="true">
        <defs>
          <radialGradient id="tvHalo"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
          <linearGradient id="tvWax" x1="0" x2="1"><stop offset="0" stop-color="#f6ead0"/><stop offset="0.55" stop-color="#fff8e8"/><stop offset="1" stop-color="#d9c79f"/></linearGradient>
        </defs>
        <ellipse cx="60" cy="188" rx="46" ry="8" class="tv-plate"/>
        <g class="tv-candle-body">
          <rect x="42" y="45" width="36" height="140" rx="4" fill="url(#tvWax)" class="tv-wax"/>
          <ellipse cx="60" cy="45" rx="18" ry="4" class="tv-wax-top"/>
          <path d="M44 49 q-2 10 0 16 q2 4 2 -2 z" class="tv-drip"/>
          <path d="M73 49 q2 16 0 24 q-2 4 -2 -3 z" class="tv-drip"/>
        </g>
        <g class="tv-flame-group" transform="translate(0 0)">
          <circle cx="60" cy="28" r="30" fill="url(#tvHalo)" class="tv-halo"/>
          <line x1="60" y1="45" x2="60" y2="37" class="tv-wick"/>
          <g class="tv-flame">
            <path d="M60 10 C69 22 70 32 60 40 C50 32 51 22 60 10 Z" class="tv-flame-outer"/>
            <path d="M60 20 C65 27 65 33 60 38 C55 33 55 27 60 20 Z" class="tv-flame-inner"/>
          </g>
        </g>
      </svg>`,

    tree: `
      <svg viewBox="0 0 160 200" class="tv-svg tv-tree" aria-hidden="true">
        <ellipse cx="80" cy="186" rx="58" ry="9" class="tv-ground"/>
        <path d="M58 172 L102 172 L96 192 L64 192 Z" class="tv-pot"/>
        <rect x="54" y="166" width="52" height="8" rx="3" class="tv-pot-rim"/>
        <g class="tv-plant">
          <rect x="77" y="60" width="6" height="108" rx="3" class="tv-trunk"/>
          <path d="M80 120 L58 98" class="tv-branch b1"/>
          <path d="M80 104 L104 84" class="tv-branch b2"/>
          <path d="M80 88 L62 70" class="tv-branch b3"/>
          <g class="tv-sprout"><path d="M80 158 C70 150 66 144 70 140 C76 142 80 150 80 158 Z"/><path d="M80 156 C90 148 94 142 90 138 C84 140 80 148 80 156 Z"/></g>
          <circle cx="56" cy="96" r="16" class="tv-leaf l1"/>
          <circle cx="106" cy="82" r="18" class="tv-leaf l2"/>
          <circle cx="62" cy="66" r="18" class="tv-leaf l3"/>
          <circle cx="96" cy="58" r="20" class="tv-leaf l4"/>
          <circle cx="80" cy="44" r="24" class="tv-leaf l5"/>
          <circle cx="70" cy="80" r="14" class="tv-leaf l6"/>
          <circle cx="92" cy="98" r="13" class="tv-leaf l7"/>
          <circle cx="66" cy="50" r="3.5" class="tv-fruit f1"/>
          <circle cx="98" cy="70" r="3.5" class="tv-fruit f2"/>
          <circle cx="84" cy="34" r="3.5" class="tv-fruit f3"/>
          <circle cx="108" cy="88" r="3.5" class="tv-fruit f4"/>
        </g>
      </svg>`,

    classic: "",
  };

  /* ---------- drawing the current moment ---------- */

  let style = (() => { try { return localStorage.getItem(KEY) || "ring"; } catch { return "ring"; } })();
  if (!STYLES.some((s) => s.id === style)) style = "ring";
  let last = { phase: "focus", running: false, remainingMs: 0, totalMs: 1 };

  const q = (sel) => visual.querySelector(sel);
  const set = (el, attr, value) => { if (el && el.getAttribute(attr) !== String(value)) el.setAttribute(attr, value); };

  function update() {
    const { phase, running, remainingMs, totalMs } = last;
    const p = totalMs ? Math.min(1, Math.max(0, (totalMs - remainingMs) / totalMs)) : 0;
    stage.dataset.phase = phase;
    stage.classList.toggle("is-running", running);

    if (style === "ring") {
      set(q(".tv-arc"), "stroke-dashoffset", (RING_C * (1 - p)).toFixed(2));
      const a = p * Math.PI * 2;
      set(q(".tv-tip"), "cx", (100 + Math.sin(a) * RING_R).toFixed(2));
      set(q(".tv-tip"), "cy", (100 - Math.cos(a) * RING_R).toFixed(2));
      q(".tv-tip").style.opacity = p > 0 ? 1 : 0;
      // a small dot laps the dial once a minute, so the ring always feels alive while running
      const s = ((remainingMs / 1000) % 60) / 60;
      const b = -s * Math.PI * 2;
      set(q(".tv-second"), "cx", (100 + Math.sin(b) * 76).toFixed(2));
      set(q(".tv-second"), "cy", (100 - Math.cos(b) * 76).toFixed(2));
    } else if (style === "hourglass") {
      // sand leaves the top bulb (y 22-100) and piles into the bottom one (y 110-178)
      const topY = 22 + p * 78;
      set(q(".tv-sand-top"), "y", topY.toFixed(2));
      set(q(".tv-sand-top"), "height", (100 - topY).toFixed(2));
      const pile = Math.pow(p, 0.8) * 68;
      set(q(".tv-sand-bottom"), "y", (178 - pile).toFixed(2));
      set(q(".tv-sand-bottom"), "height", pile.toFixed(2));
      q(".tv-stream").style.opacity = running && p > 0 && p < 1 ? 1 : 0;
    } else if (style === "candle") {
      // burns from 140 tall down to a stub of 22
      const height = 140 - p * 118;
      const top = 185 - height;
      set(q(".tv-wax"), "y", top.toFixed(2));
      set(q(".tv-wax"), "height", height.toFixed(2));
      set(q(".tv-wax-top"), "cy", top.toFixed(2));
      q(".tv-drip").parentNode.querySelectorAll(".tv-drip").forEach((d) => { d.style.transform = `translateY(${(top - 45).toFixed(2)}px)`; });
      set(q(".tv-flame-group"), "transform", `translate(0 ${(top - 45).toFixed(2)})`);
    } else if (style === "tree") {
      // a break shows the tree you just grew; a focus session grows it from a seed
      const g = phase === "rest" ? 1 : p;
      const trunk = 10 + g * 98;
      set(q(".tv-trunk"), "y", (168 - trunk).toFixed(2));
      set(q(".tv-trunk"), "height", trunk.toFixed(2));
      const show = (sel, at) => q(sel).classList.toggle("is-grown", g >= at);
      show(".tv-sprout", 0);
      q(".tv-sprout").style.opacity = g < 0.25 ? 1 : 0;
      show(".b1", 0.3); show(".b2", 0.42); show(".b3", 0.55);
      show(".l1", 0.32); show(".l2", 0.44); show(".l6", 0.5); show(".l3", 0.58); show(".l7", 0.66); show(".l4", 0.74); show(".l5", 0.84);
      show(".f1", 0.95); show(".f2", 0.97); show(".f3", 0.99); show(".f4", 1);
    }

    syncLight();

    // when the session will end, in Singapore time
    const ends = $("timerEnds");
    if (running) {
      const at = PlannerCore.sgNow(Date.now() + remainingMs);
      const hhmm = `${String(at.hours).padStart(2, "0")}:${String(at.minutes).padStart(2, "0")}`;
      ends.textContent = `${phase === "focus" ? "Focus" : "Break"} until ${PlannerCore.formatTime(hhmm)}`;
    } else {
      ends.textContent = p > 0 ? "Paused" : "";
    }
  }

  /* ---------- candlelight: with the candle style, the candle is the room's only light ---------- */

  let light = null;
  let lightFrame = 0;

  function placeLight() {
    lightFrame = 0;
    if (!light) return;
    const flame = q(".tv-flame-outer");
    if (!flame) return;
    const r = flame.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.55;
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    // a bigger pool of light while the flame burns; smaller when paused
    const radius = Math.max(340, Math.hypot(w, hgt) * (last.running ? 0.5 : 0.36));
    // scrolled away from the candle: the room isn't left in the dark
    const outside = cy < 0 ? -cy : cy > hgt ? cy - hgt : 0;
    const strength = Math.max(0.3, 1 - outside / 700);
    light.style.setProperty("--cx", `${cx.toFixed(1)}px`);
    light.style.setProperty("--cy", `${cy.toFixed(1)}px`);
    light.style.setProperty("--candle-r", `${radius.toFixed(0)}px`);
    light.style.setProperty("--candle-strength", strength.toFixed(2));
  }

  const queueLight = () => { if (light && !lightFrame) lightFrame = requestAnimationFrame(placeLight); };

  function syncLight() {
    if (style === "candle" && !light) {
      light = h("div", { class: "candle-light", "aria-hidden": "true" }, h("div", { class: "candle-dark" }), h("div", { class: "candle-warm" }));
      document.body.appendChild(light);
      requestAnimationFrame(() => { placeLight(); light.classList.add("is-on"); });
    } else if (style !== "candle" && light) {
      const old = light;
      light = null;
      old.classList.remove("is-on");
      setTimeout(() => old.remove(), 1200);
    }
    if (!light) return;
    light.classList.toggle("is-running", !!last.running);
    light.classList.toggle("is-rest", last.phase === "rest");
    queueLight();
    // the flame slides down as the candle burns (0.3s), so follow it a moment longer
    setTimeout(queueLight, 350);
  }

  window.addEventListener("scroll", queueLight, { passive: true });
  window.addEventListener("resize", queueLight);

  /* ---------- lights off: nothing on screen but the timer (and the candle), until switched back ---------- */

  let wakeLock = null;
  let wentFullscreen = false;
  let cursorTimer = null;
  const lightsAreOff = () => document.body.classList.contains("lights-off");

  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { wakeLock = null; });
      }
    } catch {}
  }

  function hideCursorSoon() {
    document.body.classList.remove("cursor-hidden");
    clearTimeout(cursorTimer);
    if (lightsAreOff()) cursorTimer = setTimeout(() => document.body.classList.add("cursor-hidden"), 2500);
  }

  async function lightsOff() {
    if (lightsAreOff()) return;
    document.body.classList.add("lights-off");
    window.scrollTo({ top: 0 });
    keepAwake();
    hideCursorSoon();
    const hint = $("lightsHint");
    hint.classList.add("is-shown");
    setTimeout(() => hint.classList.remove("is-shown"), 3500);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        wentFullscreen = true;
      }
    } catch {}
    queueLight();
  }

  function lightsOn() {
    if (!lightsAreOff()) return;
    document.body.classList.remove("lights-off", "cursor-hidden");
    clearTimeout(cursorTimer);
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    if (wentFullscreen && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    wentFullscreen = false;
    queueLight();
  }

  $("lightsOffBtn").addEventListener("click", lightsOff);
  $("lightsOnBtn").addEventListener("click", lightsOn);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightsAreOff() && !document.querySelector("dialog[open]")) lightsOn();
  });
  // leaving fullscreen (Esc in most browsers) turns the lights back on too
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && wentFullscreen) { wentFullscreen = false; lightsOn(); }
  });
  document.addEventListener("mousemove", () => { if (lightsAreOff()) hideCursorSoon(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && lightsAreOff()) keepAwake(); });

  function draw() {
    visual.innerHTML = SVG[style];
    stage.dataset.style = style;
    $("timerStylePicker").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.style === style)));
    update();
  }

  $("timerStylePicker").replaceChildren(...STYLES.map((s) => h("button", {
    type: "button",
    class: "tv-pick",
    "data-style": s.id,
    title: s.label,
    "aria-label": `Timer style: ${s.label}`,
    onclick: () => {
      style = s.id;
      try { localStorage.setItem(KEY, style); } catch {}
      draw();
    },
  }, h("span", { "aria-hidden": "true" }, s.icon), h("span", { class: "tv-pick-label" }, s.label))));

  document.addEventListener("focus:render", (e) => {
    last = e.detail;
    update();
  });

  // the timer drew itself before this script loaded, so start from its current state
  if (window.FocusTimer) last = FocusTimer.current();
  draw();
})();
