/* nav.js - the menu on every page: five main tabs (Today, Calendar, Focus, Projects, Me) across the
   top, or as a tab bar along the bottom on phones; a strip of sub-tabs on the "Me" pages; the level
   badge; and the Ctrl+K quick-actions bar. */

(() => {
  "use strict";

  const ICONS = {
    today: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
    calendar: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8 13h2M14 13h2M8 16h2",
    focus: "M12 3a9 9 0 1 0 9 9M12 7v5l3 3",
    projects: "M14 6l4 4-9 9H5v-4zM13 7l4 4",
    me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    overview: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    journal: "M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2zM6 17h13",
    vault: "M4 6h16v13H4zM8 6V4h8v2M12 11v4M10 13h4",
    achievements: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6",
    timeline: "M12 3v18M12 7h6M12 12H6M12 17h6",
    trophy: "M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4",
    settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
    search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5",
    plus: "M12 5v14M5 12h14",
  };

  // the five main tabs
  const TABS = [
    { href: "index.html", label: "Today", icon: ICONS.today },
    { href: "planner.html", label: "Calendar", icon: ICONS.calendar },
    { href: "focus.html", label: "Focus", icon: ICONS.focus },
    { href: "workshop.html", label: "Projects", icon: ICONS.projects },
    { href: "me.html", label: "Me", icon: ICONS.me },
  ];

  // everything that lives under "Me"
  const ME_PAGES = [
    { href: "me.html", label: "Overview", icon: ICONS.overview },
    { href: "journal.html", label: "Journal", icon: ICONS.journal },
    { href: "vault.html", label: "Vault", icon: ICONS.vault },
    { href: "achievements.html", label: "Achievements", icon: ICONS.achievements },
    { href: "timeline.html", label: "Timeline", icon: ICONS.timeline },
    { href: "gallery.html", label: "Trophy room", icon: ICONS.trophy },
  ];

  const path = location.pathname.split("/").pop() || "index.html";
  const page = path === "museum.html" ? "gallery.html" : path;
  const inMe = ME_PAGES.some((p) => p.href === page);
  const tab = inMe ? "me.html" : page;

  const icon = (d) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const link = (p, cls, here) =>
    `<a class="${cls}" href="${p.href}"${here ? ' aria-current="page"' : ""}>${icon(p.icon)}<span>${p.label}</span></a>`;

  /* ---------- top bar ---------- */

  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Main menu");
  nav.innerHTML = `
    <a class="site-brand" href="index.html" aria-label="Today"><img src="assets/notes-icon.gif" alt=""><span>Mission Control</span></a>
    <div class="site-links">${TABS.map((p) => link(p, "site-link", p.href === tab)).join("")}</div>
    <button type="button" class="site-search" aria-label="Quick actions (Ctrl+K)" title="Quick actions (Ctrl+K)">${icon(ICONS.search)}<kbd>Ctrl K</kbd></button>
    <a class="site-level" href="achievements.html" hidden title="Your level"><span class="site-level-num"></span><span class="site-level-bar"><span></span></span></a>
  `;

  const loader = document.getElementById("loader");
  if (loader && loader.parentNode === document.body) loader.after(nav);
  else document.body.prepend(nav);
  document.body.classList.add("has-site-nav", "has-tabbar");

  /* ---------- sub-tabs on the "Me" pages ---------- */

  if (inMe) {
    const sub = document.createElement("nav");
    sub.className = "sub-nav";
    sub.setAttribute("aria-label", "Me");
    sub.innerHTML = ME_PAGES.map((p) => link(p, "sub-link", p.href === page)).join("");
    nav.after(sub);
    const here = sub.querySelector("[aria-current]");
    if (here) here.scrollIntoView({ block: "nearest", inline: "center" });
    // the sub-tabs stick right under the top bar, whatever height it ends up
    const fit = () => document.documentElement.style.setProperty("--nav-h", `${nav.offsetHeight}px`);
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(nav);
  }

  /* ---------- bottom tab bar (phones) ---------- */

  const tabbar = document.createElement("nav");
  tabbar.className = "tabbar";
  tabbar.setAttribute("aria-label", "Main tabs");
  tabbar.innerHTML = TABS.map((p) => link(p, "tab-link", p.href === tab)).join("");
  document.body.appendChild(tabbar);

  // While locked in to a focus session, the menus don't let you wander off.
  const guard = (event) => {
    const a = event.target.closest("a[href]");
    if (a && document.body.classList.contains("locked-in")) {
      event.preventDefault();
      if (typeof showToast === "function") showToast("Pause the timer to leave the Lock-In Room.");
    }
  };
  document.querySelectorAll(".site-nav, .sub-nav, .tabbar").forEach((el) => el.addEventListener("click", guard));

  /* ---------- quick actions (Ctrl+K or /): jump anywhere or add a task from any page ---------- */

  const palette = document.createElement("dialog");
  palette.className = "cmdk";
  palette.setAttribute("aria-label", "Quick actions");
  palette.innerHTML = `
    <div class="cmdk-box">
      <div class="cmdk-input-row">${icon(ICONS.search)}
        <input type="text" class="cmdk-input" placeholder="Search, or type a task like &quot;report fri 3pm&quot;" aria-label="Search pages and actions" autocomplete="off" spellcheck="false">
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

  const PAGES = [
    ...TABS.map((p) => ({ ...p, words: { "index.html": "home dashboard", "planner.html": "planner month week", "focus.html": "lock-in timer pomodoro", "workshop.html": "workshop kanban", "me.html": "profile settings account" }[p.href] })),
    ...ME_PAGES.slice(1).map((p) => ({ ...p, words: p.href === "gallery.html" ? "gallery museum hall" : "" })),
  ];

  const ACTIONS = [
    { label: "Start a focus session", hint: "Focus", icon: ICONS.focus, run: () => go("focus.html") },
    { label: "Write today's reflection", hint: "Journal", icon: ICONS.journal, run: () => go("journal.html") },
    { label: "New project", hint: "Projects", icon: ICONS.projects, run: () => go("workshop.html#new") },
    { label: "New vault note", hint: "Vault", icon: ICONS.vault, run: () => go("vault.html#new") },
    { label: "Log a skill you learned", hint: "Achievements", icon: ICONS.achievements, run: () => go("achievements.html#skill") },
    { label: "Earn a custom badge", hint: "Achievements", icon: ICONS.achievements, run: () => go("achievements.html#badge") },
    { label: "Look back in time", hint: "Timeline", icon: ICONS.timeline, run: () => go("timeline.html") },
    { label: "See this week", hint: "Calendar", icon: ICONS.calendar, run: () => go("planner.html#week") },
    { label: "Reminders and notifications", hint: "Settings", icon: ICONS.settings, run: () => go("me.html#reminders") },
    { label: "Sign in and sync", hint: "Settings", icon: ICONS.settings, run: () => go("me.html#account") },
    { label: "Change countdown dates", hint: "Settings", icon: ICONS.settings, run: () => go("planner.html#internship") },
  ];

  function addTask(raw) {
    if (typeof LifeData === "undefined" || !LifeData.quickAdd) return;
    const result = LifeData.quickAdd(raw);
    if (!result) return;
    palette.close();
    // the Today and Calendar pages show tasks, so refresh them to include the new one
    if (/^(index|planner)\.html$/.test(page)) location.reload();
    else if (typeof showToast === "function") showToast(`Added: ${result.parsed.text} (${LifeData.describeWhen(result)})`);
  }

  function options(query) {
    const q = query.trim();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (text) => words.every((w) => text.toLowerCase().includes(w));
    const out = [];
    if (q && typeof LifeData !== "undefined" && LifeData.previewQuickAdd) {
      const preview = LifeData.previewQuickAdd(q);
      if (preview.parsed.text) {
        out.push({ label: `Add "${preview.parsed.text}"`, hint: LifeData.describeWhen(preview), icon: ICONS.plus, run: () => addTask(q) });
      }
    }
    PAGES.filter((p) => !q || match(`${p.label} ${p.words || ""} go open page`)).forEach((p) =>
      out.push({ label: `Go to ${p.label}`, hint: p.href === page ? "You're here" : "Page", icon: p.icon, run: () => go(p.href) }));
    ACTIONS.filter((a) => !q || match(`${a.label} ${a.hint}`)).forEach((a) => out.push(a));
    if (q) {
      out.push({ label: `Search the vault for "${q}"`, hint: "Vault", icon: ICONS.vault, run: () => go(`vault.html?q=${encodeURIComponent(q)}`) });
    }
    return out;
  }

  function draw() {
    shown = options(input.value);
    active = Math.max(0, Math.min(active, shown.length - 1));
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

  window.SiteNav = { refreshLevel, openPalette };
  refreshLevel();
})();
