/* timeline.js - the Life Timeline: events, milestones, projects, skills, achievements and
   website updates in one stream, plus a time machine that shows any past day. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const today = LifeData.todayKey();
  const FILTER_KEY = "timelineHiddenKinds"; // this device only

  const KINDS = {
    event: { label: "Life events", icon: "heart" },
    milestone: { label: "Milestones", icon: "flag" },
    project: { label: "Projects", icon: "rocket" },
    skill: { label: "Skills", icon: "bolt" },
    achievement: { label: "Achievements", icon: "trophy" },
    update: { label: "Website updates", icon: "code" },
  };

  const PROMPTS = {
    accomplished: "Accomplished:",
    learned: "Learned:",
    wrong: "Went wrong:",
    tomorrow: "Most important next:",
  };

  let hidden = new Set();
  try { hidden = new Set(JSON.parse(localStorage.getItem(FILTER_KEY) || "[]")); } catch {}

  const updates = () => (typeof UPDATE_SEEDS !== "undefined" ? UPDATE_SEEDS : []);

  /* ---------- the stream ---------- */

  function linkFor(e) {
    if (e.kind === "project" || (e.kind === "milestone" && !e.manual)) return `workshop.html#${e.ref}`;
    if (e.kind === "update") return "museum.html?wing=updates";
    if (e.kind === "skill" || (e.kind === "achievement" && !e.manual)) return "achievements.html";
    return null;
  }

  function renderFilters(all) {
    const counts = {};
    all.forEach((e) => { counts[e.kind] = (counts[e.kind] || 0) + 1; });
    $("kindFilters").replaceChildren(...Object.entries(KINDS).map(([kind, info]) =>
      h("button", { type: "button", class: `chip kind-chip kind-${kind}`, "aria-pressed": String(!hidden.has(kind)), onclick: () => {
        if (hidden.has(kind)) hidden.delete(kind); else hidden.add(kind);
        try { localStorage.setItem(FILTER_KEY, JSON.stringify([...hidden])); } catch {}
        render();
      } }, `${info.label} (${counts[kind] || 0})`)));
  }

  function eventRow(e) {
    const info = KINDS[e.kind] || KINDS.event;
    const href = linkFor(e);
    const title = href ? h("a", { href }, e.title) : e.title;
    const row = h("li", { class: `tl-item kind-${e.kind}` },
      LifeData.icon(info.icon),
      h("div", { class: "tl-body" },
        h("div", { class: "tl-top" },
          h("strong", {}, title),
          h("span", { class: "when" }, LifeData.prettyDate(e.date, { day: "numeric", month: "short", year: "numeric" }))),
        e.detail ? h("p", { class: "muted" }, e.detail) : null,
        e.manual ? h("button", { type: "button", class: "chip small-chip", onclick: () => openEvent(e.ref) }, "Edit") : null));
    return row;
  }

  function render() {
    const d = LifeData.all();
    const all = LifeCore.timelineEvents(d, updates());
    renderFilters(all);
    const shown = all.filter((e) => !hidden.has(e.kind));
    const first = all.length ? all[all.length - 1].date : null;
    $("timelineSub").textContent = first
      ? `${all.length} moments since ${LifeData.prettyDate(first, { day: "numeric", month: "long", year: "numeric" })}.`
      : "Your story so far, newest first.";

    if (!shown.length) {
      $("timeline").replaceChildren(h("p", { class: "empty-note" }, all.length ? "Everything is filtered out. Turn a type back on above." : "Nothing here yet. Add an event, finish a project or log a skill."));
      return;
    }
    const months = [];
    shown.forEach((e) => {
      const m = e.date.slice(0, 7);
      if (!months.length || months[months.length - 1].m !== m) months.push({ m, items: [] });
      months[months.length - 1].items.push(e);
    });
    $("timeline").replaceChildren(...months.map(({ m, items }) =>
      h("section", { class: "tl-month" },
        h("h2", { class: "tl-month-title" }, LifeData.prettyDate(`${m}-01`, { month: "long", year: "numeric" })),
        h("ol", { class: "tl-list" }, items.map(eventRow)))));
  }

  /* ---------- time machine ---------- */

  function travel(key) {
    if (!key) return;
    $("machineDate").value = key;
    const d = LifeData.all();
    const s = LifeCore.snapshot(d, key);
    const ago = LifeCore.daysBetween(key, today);
    const when = ago === 0 ? "today" : ago > 0 ? `${ago} day${ago === 1 ? "" : "s"} ago` : `in ${-ago} days`;
    const parts = [h("h3", { class: "machine-title" }, `${LifeData.prettyDate(key, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} `, h("span", { class: "muted" }, `(${when})`))];

    if (LifeCore.snapshotIsEmpty(s)) {
      parts.push(h("p", { class: "empty-note" }, "Nothing was recorded on this day. The pages are blank."));
    } else {
      const section = (title, children) => h("div", { class: "machine-section" }, h("h4", { class: "section-title" }, title), children);
      if (s.tasks.length) {
        const done = s.tasks.filter((t) => t.done).length;
        parts.push(section(`Tasks (${done}/${s.tasks.length} done)`, h("ul", { class: "list" }, s.tasks.map((t) =>
          h("li", { class: `list-item${t.done ? " is-done" : ""}` }, `${t.done ? "✓" : "○"} ${t.text}`)))));
      }
      if (s.notes) parts.push(section("Notes", h("p", { class: "machine-notes" }, s.notes)));
      if (s.journal) {
        parts.push(section("Reflection", h("div", {}, LifeCore.JOURNAL_FIELDS.filter((f) => s.journal[f]).map((f) =>
          h("p", { class: "machine-notes" }, h("strong", {}, `${PROMPTS[f]} `), s.journal[f])))));
      }
      if (s.focus.length) {
        const minutes = s.focus.reduce((n, x) => n + (x.minutes || 0), 0);
        parts.push(section(`Locked in for ${minutes} minutes`, h("ul", { class: "list" }, s.focus.map((f) =>
          h("li", { class: "list-item" }, `${f.minutes}m: ${f.task || "Focus"}${f.accomplished ? ` — ${f.accomplished}` : ""}`)))));
      }
      if (s.events.length) parts.push(section("What happened", h("ol", { class: "tl-list" }, s.events.map(eventRow))));
      if (s.projectsActive.length) {
        parts.push(section("Projects on the go", h("div", { class: "tag-row" }, s.projectsActive.map((p) =>
          h("a", { class: "tag clickable", href: `workshop.html#${p.id}` }, p.title)))));
      }
      if (s.vaultNotes.length) {
        parts.push(section("Notes saved to the vault", h("div", { class: "tag-row" }, s.vaultNotes.map((n) =>
          h("a", { class: "tag clickable", href: `vault.html#${n.id}` }, n.title)))));
      }
      if (s.journal || s.notes || s.tasks.length) {
        parts.push(h("p", {}, h("a", { class: "card-link", href: `journal.html#${key}` }, "Open this day in the journal →")));
      }
    }
    $("machineResult").replaceChildren(...parts);
  }

  document.querySelectorAll("[data-back]").forEach((b) =>
    b.addEventListener("click", () => travel(LifeCore.addDays(today, -Number(b.dataset.back)))));
  $("machineDate").max = today;
  $("machineDate").addEventListener("change", (e) => travel(e.target.value));

  /* ---------- manual events ---------- */

  let editing = null;

  function openEvent(id) {
    const events = LifeData.load("events");
    editing = id ? events.find((e) => e.id === id) || null : null;
    $("eventDialogTitle").textContent = editing ? "Edit event" : "Add an event";
    $("eTitle").value = editing ? editing.title : "";
    $("eKind").value = editing ? editing.kind || "event" : "event";
    $("eDate").value = editing ? editing.date : today;
    $("eDescription").value = editing ? editing.description || "" : "";
    $("eDelete").hidden = !editing;
    $("eventDialog").showModal();
    $("eTitle").focus();
  }

  $("addEvent").addEventListener("click", () => openEvent(null));

  $("eSave").addEventListener("click", () => {
    const title = $("eTitle").value.trim();
    if (!title) { $("eTitle").focus(); showToast("Say what happened first."); return; }
    const events = LifeData.load("events");
    const data = { title, kind: $("eKind").value, date: $("eDate").value || today, description: $("eDescription").value.trim() };
    if (editing) {
      const found = events.find((e) => e.id === editing.id);
      if (found) Object.assign(found, data);
    } else {
      events.push({ id: LifeData.uid("ev"), ...data });
    }
    LifeData.save("events", events);
    $("eventDialog").close();
    render();
  });

  $("eDelete").addEventListener("click", (e) => {
    const button = e.currentTarget;
    if (!button.classList.contains("armed")) {
      button.classList.add("armed");
      button.textContent = "Click again to delete";
      setTimeout(() => { button.classList.remove("armed"); button.textContent = "Delete"; }, 3000);
      return;
    }
    LifeData.save("events", LifeData.load("events").filter((x) => x.id !== editing.id));
    $("eventDialog").close();
    render();
  });

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $(b.dataset.close).close()));

  render();
  const hash = location.hash.slice(1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(hash)) travel(hash);
})();
