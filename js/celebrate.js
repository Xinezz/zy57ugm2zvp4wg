/* celebrate.js - small moments of delight: gold confetti, a level-up card and achievement pop-ups.
   Everything is skipped for people who ask their device for reduced motion, and it never blocks
   the page (clicks pass straight through the confetti). */

const Celebrate = (() => {
  "use strict";

  const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["#d4af37", "#f2d479", "#fff1b8", "#a98c2d", "#1fa5ad", "#ff8fd8"];

  /* ---------- confetti ---------- */

  let canvas = null;
  let ctx = null;
  let pieces = [];
  let running = false;

  function setupCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    const size = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    size();
    window.addEventListener("resize", size);
  }

  /** A burst of gold confetti from a point (defaults to the middle top third of the screen). */
  function confetti({ x = window.innerWidth / 2, y = window.innerHeight / 3, count = 90, spread = 1 } = {}) {
    if (reduced()) return;
    setupCanvas();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (4 + Math.random() * 8) * spread;
      pieces.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 4,
        spin: Math.random() * Math.PI,
        vspin: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 0,
        max: 90 + Math.random() * 50,
        star: Math.random() < 0.18,
      });
    }
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  /** Confetti bursting out of an element, e.g. a checkbox that was just ticked. */
  function burstFrom(el, count = 40) {
    if (!el || !el.getBoundingClientRect) { confetti({ count }); return; }
    const r = el.getBoundingClientRect();
    confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count, spread: 0.7 });
  }

  function drawStar(p) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5;
      ctx.lineTo(Math.cos(a) * p.w * 0.7, Math.sin(a) * p.w * 0.7);
    }
    ctx.closePath();
    ctx.fill();
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces = pieces.filter((p) => p.life < p.max);
    pieces.forEach((p) => {
      p.life++;
      p.vy += 0.25; // gravity
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.vspin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.color;
      if (p.star) drawStar(p);
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.spin * 2)) + 1);
      ctx.restore();
    });
    if (pieces.length) requestAnimationFrame(frame);
    else {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /* ---------- level up and achievement cards ---------- */

  let queue = [];
  let showing = false;

  function show(card, ms) {
    queue.push({ card, ms });
    if (!showing) next();
  }

  function next() {
    const item = queue.shift();
    if (!item) { showing = false; return; }
    showing = true;
    document.body.appendChild(item.card);
    requestAnimationFrame(() => item.card.classList.add("is-in"));
    const close = () => {
      item.card.classList.remove("is-in");
      setTimeout(() => { item.card.remove(); next(); }, 350);
    };
    item.card.addEventListener("click", close, { once: true });
    setTimeout(() => { if (item.card.isConnected) close(); }, item.ms);
  }

  function levelUp(level) {
    const card = document.createElement("div");
    card.className = "celebrate-card level-card-pop";
    card.setAttribute("role", "status");
    const medal = document.createElement("div");
    medal.className = "celebrate-medal";
    medal.textContent = level;
    const text = document.createElement("div");
    text.className = "celebrate-text";
    const small = document.createElement("small");
    small.textContent = "Level up!";
    const big = document.createElement("strong");
    big.textContent = `You reached level ${level}`;
    text.append(small, big);
    card.append(medal, text);
    show(card, 4200);
    confetti({ count: 140 });
    if (typeof UiSound !== "undefined" && UiSound.play) UiSound.play("check");
  }

  /** `iconEl` is a badge icon element (LifeData.icon) or null. */
  function achievement(title, description, iconEl) {
    const card = document.createElement("div");
    card.className = "celebrate-card";
    card.setAttribute("role", "status");
    if (iconEl) card.append(iconEl);
    const text = document.createElement("div");
    text.className = "celebrate-text";
    const small = document.createElement("small");
    small.textContent = "Achievement unlocked";
    const big = document.createElement("strong");
    big.textContent = title;
    const sub = document.createElement("span");
    sub.textContent = description || "";
    text.append(small, big, sub);
    card.append(text);
    show(card, 3600);
    confetti({ count: 70, y: window.innerHeight - 140 });
  }

  /* ---------- numbers that count up when they first appear ---------- */

  function countUp(el, to, { duration = 900, format = (n) => String(n) } = {}) {
    if (!el) return;
    if (reduced() || !Number.isFinite(to) || to <= 0) { el.textContent = format(to); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  return { confetti, burstFrom, levelUp, achievement, countUp };
})();
