/* journal.js - Daily Reflection Journal: four questions a day, mood, a weekly highlight star,
   and a weekly recap built from your entries and tasks. */

(() => {
  "use strict";

  const { addDays, weekStart, entryFilled, journalStreak, journalKeys, weeklyRecap, tasksOn } = LifeCore;
  const FIELDS = ["accomplished", "learned", "wrong", "tomorrow"];
  const MOODS = [
    { value: 1, label: "Rough" },
    { value: 2, label: "Meh" },
    { value: 3, label: "Okay" },
    { value: 4, label: "Good" },
    { value: 5, label: "Great" },
  ];
  const $ = (id) => document.getElementById(id);
  const today = LifeData.todayKey();

  let journal = LifeData.load("journal");
  let day = /^#\d{4}-\d{2}-\d{2}$/.test(location.hash) ? location.hash.slice(1) : today;
  let week = weekStart(day);
  let saveTimer = null;

  const entry = () => journal[day] || {};

  function persist() {
    const e = journal[day];
    if (e && !entryFilled(e) && !e.mood && !e.highlight) delete journal[day];
    LifeData.save("journal", journal);
    LifeData.checkAchievements();
    if (window.SiteNav) SiteNav.refreshLevel();
    $("saveState").textContent = "Saved";
    renderSide();
    renderRecap();
    renderStreak();
  }

  function update(field, value) {
    journal[day] = { ...entry(), [field]: value, updatedAt: LifeData.nowIso() };
    $("saveState").textContent = "Saving...";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 500);
  }

  /* ---------- the entry ---------- */

  function renderEntry() {
    const e = entry();
    const label = day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : "";
    $("entryDate").textContent = `${label ? `${label} · ` : ""}${LifeData.prettyDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
    $("dayPicker").value = day;
    $("nextDay").disabled = day >= today;
    FIELDS.forEach((f) => { $(f).value = e[f] || ""; });
    $("highlight").checked = !!e.highlight;
    $("saveState").textContent = "";

    $("moods").replaceChildren(...MOODS.map((m) =>
      h("button", {
        type: "button",
        class: "mood",
        "aria-pressed": String(e.mood === m.value),
        onclick: () => { update("mood", e.mood === m.value ? 0 : m.value); clearTimeout(saveTimer); persist(); renderEntry(); },
      }, h("span", { class: `mood-face mood-${m.value}`, "aria-hidden": "true" }), m.label)));

    const tomorrowKey = addDays(day, 1);
    $("toTasks").textContent = day === today ? "Add to tomorrow's tasks" : `Add to ${LifeData.prettyDate(tomorrowKey, { day: "numeric", month: "short" })} tasks`;
  }

  FIELDS.forEach((f) => $(f).addEventListener("input", (e) => update(f, e.target.value)));
  $("highlight").addEventListener("change", (e) => { update("highlight", e.target.checked); clearTimeout(saveTimer); persist(); });

  $("toTasks").addEventListener("click", () => {
    const text = ($("tomorrow").value || "").trim();
    if (!text) {
      showToast("Write tomorrow's most important thing first.");
      return;
    }
    const days = LifeData.load("days");
    const key = addDays(day, 1);
    days[key] = days[key] || { notes: "", tasks: [] };
    days[key].tasks = days[key].tasks || [];
    if (days[key].tasks.some((t) => t.text === text)) {
      showToast("It's already on that day's task list.");
      return;
    }
    days[key].tasks.unshift({ text, done: false });
    if (LifeData.save("days", days)) showToast(`Added to your tasks for ${LifeData.prettyDate(key, { weekday: "long" })}.`);
  });

  /* ---------- side panels ---------- */

  function renderSide() {
    const items = tasksOn(LifeData.load("days"), LifeData.load("rules"), day);
    $("dayTasks").replaceChildren(...(items.length ? items.map((t) =>
      h("li", { class: `list-item${t.done ? " is-done" : ""}` },
        h("span", { class: "tick", "aria-hidden": "true" }, t.done ? "✓" : "•"),
        h("span", { class: "grow" }, t.text),
      )) : [h("li", { class: "empty-note" }, "No tasks on this day.")]));

    const keys = journalKeys(journal).reverse().slice(0, 8);
    $("recent").replaceChildren(...(keys.length ? keys.map((k) =>
      h("li", {},
        h("button", { type: "button", class: `entry-link${k === day ? " is-current" : ""}`, onclick: () => go(k) },
          h("span", { class: "when" }, LifeData.prettyDate(k, { weekday: "short", day: "numeric", month: "short" })),
          journal[k].highlight ? h("span", { class: "star", "aria-label": "highlight" }, "★") : null,
          h("span", { class: "snippet" }, (journal[k].accomplished || journal[k].learned || journal[k].tomorrow || "").slice(0, 60)),
        ))) : [h("li", { class: "empty-note" }, "Your entries will appear here.")]));
  }

  function renderStreak() {
    const streak = journalStreak(journal, today);
    $("streakText").textContent = streak
      ? `${streak}-day reflection streak. ${entryFilled(journal[today]) ? "Today is done." : "Keep it going today."}`
      : "Look back on your day in four questions.";
  }

  /* ---------- weekly recap ---------- */

  function renderRecap() {
    const recap = weeklyRecap({ journal, days: LifeData.load("days"), rules: LifeData.load("rules") }, week);
    $("weekLabel").textContent = `${LifeData.prettyDate(recap.start, { day: "numeric", month: "short" })} – ${LifeData.prettyDate(recap.end, { day: "numeric", month: "short", year: "numeric" })}`;
    $("nextWeek").disabled = addDays(week, 7) > today;

    const section = (title, items, empty) => h("div", { class: "recap-section" },
      h("h3", { class: "section-title" }, title),
      items.length
        ? h("ul", { class: "list" }, items.map((i) => h("li", { class: "list-item" },
            h("span", { class: "when" }, LifeData.prettyDate(i.key, { weekday: "short" })),
            h("span", { class: "grow" }, i.text))))
        : h("p", { class: "empty-note" }, empty));

    $("recapBody").replaceChildren(
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("strong", {}, String(recap.journalDays)), h("span", {}, "days reflected")),
        h("div", { class: "stat" }, h("strong", {}, String(recap.tasksDone)), h("span", {}, "tasks done")),
        h("div", { class: "stat" }, h("strong", {}, String(recap.unfinished.length)), h("span", {}, "left unfinished")),
      ),
      h("div", { class: "recap-highlight" },
        h("h3", { class: "section-title" }, "Biggest accomplishment"),
        recap.biggest
          ? h("blockquote", {}, recap.biggest.text, h("cite", {}, LifeData.prettyDate(recap.biggest.key, { weekday: "long", day: "numeric", month: "short" })))
          : h("p", { class: "empty-note" }, "Write what you accomplished on a few days and the best one shows up here (or star one)."),
      ),
      h("div", { class: "recap-grid" },
        section("What I learned", recap.learned, "Nothing recorded this week."),
        section("What to improve", recap.improvements, "Nothing recorded this week."),
        section("Unfinished tasks", recap.unfinished, "Everything got done. Nice."),
      ),
    );
  }

  /* ---------- navigation ---------- */

  function go(key) {
    if (saveTimer) { clearTimeout(saveTimer); persist(); }
    day = key > today ? today : key;
    week = weekStart(day);
    history.replaceState(null, "", day === today ? location.pathname : `#${day}`);
    renderEntry();
    renderSide();
    renderRecap();
  }

  $("prevDay").addEventListener("click", () => go(addDays(day, -1)));
  $("nextDay").addEventListener("click", () => go(addDays(day, 1)));
  $("todayBtn").addEventListener("click", () => go(today));
  $("dayPicker").addEventListener("change", (e) => { if (e.target.value) go(e.target.value); });
  $("prevWeek").addEventListener("click", () => { week = addDays(week, -7); renderRecap(); });
  $("nextWeek").addEventListener("click", () => { week = addDays(week, 7); renderRecap(); });
  window.addEventListener("pagehide", () => { if (saveTimer) { clearTimeout(saveTimer); persist(); } });

  $("dayPicker").max = today;
  renderEntry();
  renderSide();
  renderRecap();
  renderStreak();
})();
