/* nav.js - the top menu bar on every page. On narrow screens it folds into a "Menu" button.
   Shows your level when LifeCore and LifeData are loaded. */

(() => {
  "use strict";

  const PAGES = [
    { href: "index.html", label: "Home", icon: "M3 11l9-8 9 8v10h-6v-6H9v6H3z" },
    { href: "planner.html", label: "Planner", icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4" },
    { href: "focus.html", label: "Lock-In", icon: "M12 3a9 9 0 1 0 9 9M12 7v5l3 3" },
    { href: "workshop.html", label: "Workshop", icon: "M14 6l4 4-9 9H5v-4zM13 7l4 4" },
    { href: "journal.html", label: "Journal", icon: "M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2zM6 17h13" },
    { href: "vault.html", label: "Vault", icon: "M4 6h16v13H4zM8 6V4h8v2M12 11v4M10 13h4" },
    { href: "achievements.html", label: "Achievements", icon: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6" },
    { href: "timeline.html", label: "Timeline", icon: "M12 3v18M12 7h6M12 12H6M12 17h6" },
    { href: "gallery.html", label: "Gallery", icon: "M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4" },
  ];

  const path = location.pathname.split("/").pop() || "index.html";
  const current = path === "museum.html" ? "gallery.html" : path;

  const icon = (d) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Main menu");

  const links = PAGES.map((p) => {
    const here = p.href === current ? ' aria-current="page"' : "";
    return `<a class="site-link" href="${p.href}"${here}>${icon(p.icon)}<span>${p.label}</span></a>`;
  }).join("");

  nav.innerHTML = `
    <a class="site-brand" href="index.html" aria-label="Home"><img src="assets/notes-icon.gif" alt=""><span>Mission Control</span></a>
    <button type="button" class="site-menu-btn" aria-expanded="false" aria-controls="siteLinks">${icon("M4 7h16M4 12h16M4 17h16")}<span>Menu</span></button>
    <div class="site-links" id="siteLinks">${links}</div>
    <button type="button" class="site-search" aria-label="Quick actions (Ctrl+K)" title="Quick actions (Ctrl+K)">${icon("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5")}<kbd>Ctrl K</kbd></button>
    <a class="site-level" href="achievements.html" hidden title="Your level"><span class="site-level-num"></span><span class="site-level-bar"><span></span></span></a>
  `;

  const loader = document.getElementById("loader");
  if (loader && loader.parentNode === document.body) loader.after(nav);
  else document.body.prepend(nav);
  document.body.classList.add("has-site-nav");

  const menuBtn = nav.querySelector(".site-menu-btn");
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) && nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });

  // While locked in to a focus session, the menu doesn't let you wander off.
  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (link && document.body.classList.contains("locked-in")) {
      event.preventDefault();
      if (typeof showToast === "function") showToast("Pause the timer to leave the Lock-In Room.");
    }
  });

  /* ---------- quick actions (Ctrl+K or /): jump anywhere or add a task from any page ---------- */

  const palette = document.createElement("dialog");
  palette.className = "cmdk";
  palette.setAttribute("aria-label", "Quick actions");
  palette.innerHTML = `
    <div class="cmdk-box">
      <div class="cmdk-input-row">${icon("M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5")}
        <input type="text" class="cmdk-input" placeholder="Type to search, or type a task and press Enter" aria-label="Search pages and actions" autocomplete="off" spellcheck="false">
        <kbd>Esc</kbd>
      </div>
      <ul class="cmdk-list" role="listbox"></ul>
      <p class="cmdk-hint">&uarr;&darr; to move &middot; Enter to choose &middot; Ctrl K to open from anywhere</p>
    </div>`;
  document.body.appendChild(palette);
  const input = palette.querySelector(".cmdk-input");
  const list = palette.querySelector(".cmdk-list");
  let active = 0;
  let shown = [];

  const go = (href) => {
    if (document.body.classList.contains("locked-in")) {
      if (typeof showToast === "function") showToast("Pause the timer to leave the Lock-In Room.");
      return;
    }
    location.href = href;
  };

  const ACTIONS = [
    { label: "Start a focus session", hint: "Lock-In Room", icon: PAGES[2].icon, run: () => go("focus.html") },
    { label: "Write today's reflection", hint: "Journal", icon: PAGES[4].icon, run: () => go("journal.html") },
    { label: "New project", hint: "Workshop", icon: PAGES[3].icon, run: () => go("workshop.html#new") },
    { label: "New vault note", hint: "Vault", icon: PAGES[5].icon, run: () => go("vault.html#new") },
    { label: "Log a skill you learned", hint: "Achievements", icon: PAGES[6].icon, run: () => go("achievements.html#skill") },
    { label: "Earn a custom badge", hint: "Achievements", icon: PAGES[6].icon, run: () => go("achievements.html#badge") },
    { label: "Look back in time", hint: "Timeline", icon: PAGES[7].icon, run: () => go("timeline.html") },
    { label: "Change internship dates", hint: "Planner settings", icon: PAGES[1].icon, run: () => go("planner.html#internship") },
  ];

  function addTaskToday(text) {
    if (typeof LifeData === "undefined") return;
    const key = LifeData.todayKey();
    const days = LifeData.load("days");
    days[key] = days[key] || { notes: "", tasks: [] };
    days[key].tasks = days[key].tasks || [];
    days[key].tasks.push({ text, done: false });
    if (!LifeData.save("days", days)) return;
    palette.close();
    // the home page and planner show today's tasks, so refresh them to include the new one
    if (/^(index|planner)\.html$/.test(current)) location.reload();
    else if (typeof showToast === "function") showToast(`Added to today: ${text}`);
  }

  function options(query) {
    const q = query.trim();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (text) => words.every((w) => text.toLowerCase().includes(w));
    const out = [];
    if (q) {
      out.push({ label: `Add "${q}" to today's tasks`, hint: "Enter", icon: "M12 5v14M5 12h14", run: () => addTaskToday(q.slice(0, 200)) });
    }
    PAGES.filter((p) => !q || match(`${p.label} go open page`)).forEach((p) =>
      out.push({ label: `Go to ${p.label}`, hint: p.href === current ? "You're here" : "Page", icon: p.icon, run: () => go(p.href) }));
    ACTIONS.filter((a) => !q || match(`${a.label} ${a.hint}`)).forEach((a) => out.push(a));
    if (q) {
      out.push({ label: `Search the vault for "${q}"`, hint: "Vault", icon: PAGES[5].icon, run: () => go(`vault.html?q=${encodeURIComponent(q)}`) });
    }
    return out;
  }

  function draw() {
    shown = options(input.value);
    active = Math.min(active, shown.length - 1);
    list.innerHTML = "";
    shown.forEach((o, i) => {
      const li = document.createElement("li");
      li.className = `cmdk-item${i === active ? " is-active" : ""}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === active));
      li.innerHTML = icon(o.icon);
      const label = document.createElement("span");
      label.className = "cmdk-label";
      label.textContent = o.label;
      const hint = document.createElement("span");
      hint.className = "cmdk-item-hint";
      hint.textContent = o.hint || "";
      li.append(label, hint);
      li.addEventListener("click", () => o.run());
      li.addEventListener("mousemove", () => { if (active !== i) { active = i; highlight(); } });
      list.appendChild(li);
    });
  }

  function highlight() {
    [...list.children].forEach((li, i) => {
      li.classList.toggle("is-active", i === active);
      li.setAttribute("aria-selected", String(i === active));
    });
    const li = list.children[active];
    if (li) li.scrollIntoView({ block: "nearest" });
  }

  function openPalette() {
    if (palette.open) return;
    input.value = "";
    active = 0;
    draw();
    palette.showModal();
    input.focus();
  }

  input.addEventListener("input", () => { active = 0; draw(); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { active = (active + 1) % shown.length; highlight(); event.preventDefault(); }
    else if (event.key === "ArrowUp") { active = (active - 1 + shown.length) % shown.length; highlight(); event.preventDefault(); }
    else if (event.key === "Enter" && shown[active]) { event.preventDefault(); shown[active].run(); }
  });
  palette.addEventListener("click", (event) => { if (event.target === palette) palette.close(); });
  nav.querySelector(".site-search").addEventListener("click", openPalette);

  document.addEventListener("keydown", (event) => {
    const typing = event.target.closest && event.target.closest("input, textarea, select, [contenteditable='true']");
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (palette.open) palette.close(); else openPalette();
    } else if (event.key === "/" && !typing && !document.querySelector("dialog[open]")) {
      event.preventDefault();
      openPalette();
    }
  });

  /** Updates the level badge (call again after earning XP). */
  function refreshLevel() {
    if (typeof LifeCore === "undefined" || typeof LifeData === "undefined") return;
    const xp = LifeCore.computeXp(LifeData.all());
    const badge = nav.querySelector(".site-level");
    badge.hidden = false;
    badge.querySelector(".site-level-num").textContent = `Lv ${xp.level}`;
    badge.querySelector(".site-level-bar span").style.width = `${Math.round(xp.progress * 100)}%`;
    badge.setAttribute("aria-label", `Level ${xp.level}, ${xp.current} of ${xp.needed} XP to the next level`);
    badge.title = `Level ${xp.level} · ${xp.current}/${xp.needed} XP to level ${xp.level + 1}`;

    let seen = null;
    try { seen = Number(localStorage.getItem(SEEN_LEVEL_KEY)) || null; } catch {}
    if (seen !== xp.level) {
      try { localStorage.setItem(SEEN_LEVEL_KEY, String(xp.level)); } catch {}
      if (seen && xp.level > seen && typeof Celebrate !== "undefined") Celebrate.levelUp(xp.level);
    }
  }

  const SEEN_LEVEL_KEY = "lifeSeenLevel"; // this device only: the last level it celebrated

  window.SiteNav = { refreshLevel };
  refreshLevel();
})();
