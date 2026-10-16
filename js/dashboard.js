/* dashboard.js - Mission Control, the home page: today's tasks and progress ring,
   lock-in time, level, journal, countdowns, upcoming deadlines, projects and the week. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const today = LifeData.todayKey();
  const RING = 2 * Math.PI * 66;
  const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  const short = (key) => LifeData.prettyDate(key, { weekday: "short", day: "numeric", month: "short" });

  // one line of encouragement a day (the same all day, a new one tomorrow)
  const DAILY_LINES = [
    "Small steps every day add up to big things.",
    "Finish one thing before you start the next.",
    "Done is better than perfect. Ship it.",
    "Future you will thank you for today's work.",
    "Focus on the next right step, not the whole staircase.",
    "Consistency beats intensity.",
    "A messy start beats a perfect plan that never begins.",
    "You don't need more time, just fewer tabs open.",
    "Make today's list short and finish all of it.",
    "Progress, not perfection.",
    "Lock in for 25 minutes. That's all it takes to start.",
    "Every expert was once a beginner who kept going.",
    "Write it down so your head is free to think.",
    "The hard part is starting. You're already here.",
    "Tiny wins today, big wins this month.",
    "Rest is part of the work, not a break from it.",
    "Learn one new thing today and write it in the vault.",
    "Be proud of how far you've come.",
    "Discipline is choosing what you want most over what you want now.",
    "If it takes less than two minutes, do it now.",
    "Clear the small tasks, then go deep on the big one.",
    "Your streak is a promise to yourself. Keep it.",
    "Good things take time. Keep building.",
    "One focused hour beats a distracted day.",
    "Celebrate the small wins. They count.",
    "Plan the night before and wake up with a head start.",
    "Ask for help early, not late.",
    "Build things you're proud to show.",
  ];

  function greet() {
    const hour = PlannerCore.sgNow().hours;
    const name = (LifeData.profile().name || "").trim();
    $("greeting").textContent = `${hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening"}${name ? `, ${name}` : ""}`;
    $("todayText").textContent = LifeData.prettyDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const dayNumber = LifeCore.daysBetween("2026-01-01", today);
    $("dailyLine").textContent = DAILY_LINES[((dayNumber % DAILY_LINES.length) + DAILY_LINES.length) % DAILY_LINES.length];
  }

  /* ---------- today ---------- */

  function renderToday(d) {
    const items = PlannerCore.byTime(LifeCore.tasksOn(d.days, d.rules, today));
    const p = LifeCore.dailyProgress(items);
    $("ringFill").style.strokeDasharray = RING;
    $("ringFill").style.strokeDashoffset = RING * (1 - p.ratio);
    $("ring").classList.toggle("is-complete", p.total > 0 && p.done === p.total);
    $("ringPct").textContent = `${Math.round(p.ratio * 100)}%`;
    $("ringText").textContent = p.total ? `${p.done} of ${p.total} done` : "No tasks yet";

    $("taskList").replaceChildren(...(items.length ? items.map((item) =>
      h("li", { class: `list-item${item.done ? " is-done" : ""}` },
        h("input", { type: "checkbox", checked: item.done, "aria-label": `Done: ${item.text}`, onchange: (e) => toggle(item, e.target.checked, e.target) }),
        item.time ? h("span", { class: "task-time" }, PlannerCore.formatTime(item.time)) : null,
        h("span", { class: "grow" }, item.text),
        item.repeat ? h("span", { class: "tag" }, "repeats") : null))
      : [h("li", { class: "empty-note" }, "A clear day. Add something below, like \"read chapter 3 at 8pm\".")]));

    // notes for today (the same notes as the Calendar's)
    const notes = (d.days[today] && d.days[today].notes) || "";
    if (document.activeElement !== $("todayNotes")) $("todayNotes").value = notes;
    if (notes && !$("todayNotesBox").dataset.touched) $("todayNotesBox").open = true;
  }

  let notesTimer = null;
  $("todayNotes").addEventListener("input", (e) => {
    clearTimeout(notesTimer);
    const value = e.target.value;
    notesTimer = setTimeout(() => {
      const days = LifeData.load("days");
      days[today] = days[today] || { notes: "", tasks: [] };
      days[today].notes = value;
      if (!value && !(days[today].tasks || []).length) delete days[today];
      LifeData.save("days", days);
    }, 400);
  });
  $("todayNotesBox").addEventListener("toggle", (e) => { e.currentTarget.dataset.touched = "1"; });

  function toggle(item, done, box) {
    const days = LifeData.load("days");
    const rules = LifeData.load("rules");
    PlannerCore.setDone(days, rules, today, item, done);
    LifeData.save("days", days);
    LifeData.save("rules", rules);
    const p = LifeCore.dailyProgress(LifeCore.tasksOn(days, rules, today));
    if (done && p.total && p.done === p.total) {
      showToast("Every task done today. Brilliant!");
      if (typeof Celebrate !== "undefined") Celebrate.confetti({ count: 140 });
    } else if (done && typeof Celebrate !== "undefined") {
      Celebrate.burstFrom(box, 24);
    }
    LifeData.checkAchievements();
    render();
  }

  function quickAdd() {
    const result = LifeData.quickAdd($("quickTask").value);
    if (!result) return;
    $("quickTask").value = "";
    $("quickHint").textContent = "";
    if (result.date !== today || result.parsed.repeat) showToast(`Added "${result.parsed.text}" \u2014 ${LifeData.describeWhen(result)}`);
    render();
  }

  // live preview of what the quick-add box understood
  $("quickTask").addEventListener("input", () => {
    const raw = $("quickTask").value;
    const preview = LifeData.previewQuickAdd(raw);
    $("quickHint").textContent = raw.trim() && preview.parsed.found.length && preview.parsed.text
      ? `\u2192 "${preview.parsed.text}" \u00b7 ${LifeData.describeWhen(preview)}`
      : "";
  });

  $("quickAdd").addEventListener("click", quickAdd);
  $("quickTask").addEventListener("keydown", (e) => { if (e.key === "Enter") quickAdd(); });

  function renderSide(d) {
    const focus = LifeCore.focusOn(d.focusLog, today);
    $("focusToday").textContent = fmt(focus.minutes);
    $("focusSessions").textContent = focus.sessions ? `${focus.sessions} session${focus.sessions === 1 ? "" : "s"}` : "No sessions yet";

    const xp = LifeCore.computeXp(d);
    $("levelLabel").textContent = `Level ${xp.level} · ${xp.total} XP`;
    $("levelBar").style.width = `${Math.round(xp.progress * 100)}%`;
    $("levelText").textContent = `${xp.needed - xp.current} XP to level ${xp.level + 1}`;

    const written = LifeCore.entryFilled(d.journal[today]);
    $("journalState").textContent = written ? "Written ✓" : PlannerCore.sgNow().hours >= 18 ? "Time to reflect" : "Not written yet";
    const streak = LifeCore.journalStreak(d.journal, today);
    $("journalStreak").textContent = streak ? `${streak}-day streak` : "Four quick questions";
  }

  /* ---------- internship: live countdown tab ---------- */

  // the dates are set in the planner's Settings (saved as "plannerPeriods")
  const loadPeriods = () => PlannerCore.cleanPeriods(Store.read("plannerPeriods", null));
  const pad2 = (n) => String(n).padStart(2, "0");

  function tickLive() {
    const box = $("liveCountdown");
    const period = loadPeriods().find((p) => PlannerCore.periodEndTime(p) > Date.now());
    if (!period) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const started = today >= period.start;
    const target = started ? PlannerCore.periodEndTime(period) : PlannerCore.sgTime(period.start);
    const t = PlannerCore.splitDuration(target - Date.now());
    $("liveLabel").textContent = started ? `${period.label} ends in` : `${period.label} starts in`;
    const [hh, mm] = (started ? period.finish : "00:00").split(":").map(Number);
    const clock = `${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
    const day = LifeData.prettyDate(started ? period.end : period.start, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    $("liveTarget").textContent = `until ${day}, ${clock} SGT`;
    $("liveDays").textContent = t.days;
    $("liveHours").textContent = pad2(t.hours);
    $("liveMinutes").textContent = pad2(t.minutes);
    $("liveSeconds").textContent = pad2(t.seconds);
    box.title = `${period.label}: ${short(period.start)} to ${short(period.end)}, last day finishes at ${period.finish}`;
  }

  /* ---------- countdowns ---------- */

  function renderCountdowns(d) {
    const list = d.countdowns.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    // special periods (e.g. the internship) count down in weekdays, not days
    const periods = loadPeriods().map((p) => ({ p, c: PlannerCore.periodCountdown(p, today) }))
      .filter(({ c }) => c.phase !== "after")
      .map(({ p, c }) => h("a", { class: `countdown period-count ${p.className}`, href: "planner.html", title: `${c.done} of ${c.total} weekdays done` },
        h("strong", { class: "count-num" }, String(c.phase === "before" ? c.untilStart : c.left)),
        h("span", { class: "count-unit" }, c.phase === "before" ? "weekdays until it starts" : "weekdays left"),
        h("span", { class: "count-title" }, p.label),
        h("span", { class: "when" }, `ends ${short(p.end)}`),
        c.phase === "during" ? h("span", { class: "bar period-progress" }, h("span", { style: `width:${Math.round((c.done / c.total) * 100)}%` })) : null));
    if (periods.length || list.length) {
      $("countdowns").replaceChildren(...periods, ...list.map(countdownCard));
      return;
    }
    $("countdowns").replaceChildren(h("p", { class: "empty-note" }, "Count down to exams, trips, birthdays or launch day."));
  }

  function countdownCard(c) {
    const left = LifeCore.daysBetween(today, c.date);
    const big = left > 0 ? String(left) : left === 0 ? "Today" : "Done";
    const unit = left > 1 ? "days to go" : left === 1 ? "day to go" : left === 0 ? "it's here!" : `${-left} day${left === -1 ? "" : "s"} ago`;
    return h("div", { class: `countdown${left < 0 ? " is-past" : left <= 7 ? " is-soon" : ""}` },
      h("strong", { class: "count-num" }, big),
      h("span", { class: "count-unit" }, unit),
      h("span", { class: "count-title" }, c.title),
      h("span", { class: "when" }, short(c.date)),
      h("button", { type: "button", class: "icon-btn count-del", "aria-label": `Remove countdown ${c.title}`, onclick: () => {
        LifeData.save("countdowns", LifeData.load("countdowns").filter((x) => x.id !== c.id));
        render();
      } }, "✕"));
  }

  $("countToggle").addEventListener("click", () => {
    const form = $("countForm");
    form.hidden = !form.hidden;
    $("countToggle").setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) { $("countDate").min = today; $("countTitle").focus(); }
  });

  $("countSave").addEventListener("click", () => {
    const title = $("countTitle").value.trim();
    const date = $("countDate").value;
    if (!title || !date) { showToast("Give the countdown a name and a date."); return; }
    const list = LifeData.load("countdowns");
    list.push({ id: LifeData.uid("c"), title, date });
    LifeData.save("countdowns", list);
    $("countTitle").value = "";
    $("countDate").value = "";
    $("countForm").hidden = true;
    $("countToggle").setAttribute("aria-expanded", "false");
    render();
  });

  /* ---------- upcoming, projects, week ---------- */

  function renderUpcoming(d) {
    // one row per day: a little calendar tile, then that day's deadlines first and tasks after
    const days = [];
    LifeCore.upcoming(d, today, 14).forEach((u) => {
      const last = days[days.length - 1];
      if (last && last.key === u.key) last.items.push(u);
      else days.push({ key: u.key, items: [u] });
    });
    const MAX_TASK_CHIPS = 3;
    $("upcomingList").replaceChildren(...(days.length ? days.slice(0, 6).map(({ key, items }) => {
      const left = LifeCore.daysBetween(today, key);
      const big = items.filter((u) => u.kind !== "task");
      const tasks = items.filter((u) => u.kind === "task");
      const chip = (u) => {
        const href = u.kind === "deadline" || u.kind === "milestone" ? `workshop.html#${u.ref}` : u.kind === "task" ? `planner.html` : null;
        return h(href ? "a" : "span", { class: `up-chip up-${u.kind}`, href }, u.title);
      };
      return h("li", { class: `up-day${big.length ? " has-deadline" : ""}` },
        h("div", { class: "up-tile", "aria-hidden": "true" },
          h("span", {}, LifeData.prettyDate(key, { weekday: "short" })),
          h("strong", {}, LifeData.prettyDate(key, { day: "numeric" })),
          h("span", {}, LifeData.prettyDate(key, { month: "short" }))),
        h("div", { class: "up-body" },
          h("span", { class: "up-when" }, left === 1 ? "Tomorrow" : left < 7 ? `In ${left} days` : short(key)),
          h("div", { class: "up-chips" },
            big.map(chip),
            tasks.slice(0, MAX_TASK_CHIPS).map(chip),
            tasks.length > MAX_TASK_CHIPS ? h("a", { class: "up-chip up-more", href: "planner.html" }, `+${tasks.length - MAX_TASK_CHIPS} more`) : null)));
    }) : [h("li", { class: "empty-note" }, "Nothing due in the next two weeks.")]));
  }

  function renderProjects(d) {
    const order = { progress: 0, testing: 1, backlog: 2 };
    const list = d.projects.filter((p) => p.status !== "done").sort((a, b) => order[a.status] - order[b.status]).slice(0, 6);
    $("projectList").replaceChildren(...(list.length ? list.map((p) => {
      const pct = Math.round(LifeCore.projectProgress(p) * 100);
      return h("li", { class: "list-item project-row" },
        h("div", { class: "grow" },
          h("div", { class: "project-top" },
            h("a", { href: `workshop.html#${p.id}` }, p.title || "Untitled project"),
            h("span", { class: "tag" }, LifeCore.STATUS_LABELS[p.status])),
          h("span", { class: "bar" }, h("span", { style: `width:${pct}%` })),
          h("span", { class: "muted project-meta" }, `${pct}%${p.deadline ? ` · due ${short(p.deadline)}` : ""}`)));
    }) : [h("li", { class: "empty-note" }, "No active projects. Start one in the Workshop.")]));
  }

  function renderWeek(d) {
    const w = LifeCore.weeklySummary(d, today);
    $("weekStats").replaceChildren(
      h("div", { class: "stat" }, h("strong", {}, String(w.tasksDone)), h("span", {}, "tasks done")),
      h("div", { class: "stat" }, h("strong", {}, fmt(w.focusMinutes)), h("span", {}, "locked in")),
      h("div", { class: "stat" }, h("strong", {}, `${w.journalDays}/7`), h("span", {}, "days reflected")),
    );
    const maxTasks = Math.max(3, ...w.days.map((x) => x.tasksDone));
    const maxFocus = Math.max(30, ...w.days.map((x) => x.focusMinutes));
    $("weekChart").replaceChildren(...w.days.map((x) =>
      h("div", { class: `chart-col${x.key === today ? " is-today" : ""}`, title: `${short(x.key)}: ${x.tasksDone} tasks, ${x.focusMinutes} min focus` },
        h("div", { class: "chart-bars" },
          h("div", { class: "chart-bar", style: `height:${(x.tasksDone / maxTasks) * 100}%` }),
          h("div", { class: "chart-bar alt", style: `height:${(x.focusMinutes / maxFocus) * 100}%` })),
        h("span", { class: "chart-day" }, LifeData.prettyDate(x.key, { weekday: "short" }).slice(0, 2)))));
  }

  /* ---------- consistency heatmap (last 20 weeks) ---------- */

  const HEAT_WEEKS = 26;

  function renderHeatmap(d) {
    // columns are weeks starting on Monday; the last column is the current week
    const start = LifeCore.addDays(LifeCore.weekStart(today), -7 * (HEAT_WEEKS - 1));
    const keys = [];
    for (let i = 0; i < HEAT_WEEKS * 7; i++) keys.push(LifeCore.addDays(start, i));
    const activity = LifeCore.activityByDay(d, keys);

    $("heatmap").replaceChildren(...activity.map((a) => {
      const future = a.key > today;
      const parts = [];
      if (a.tasksDone) parts.push(`${a.tasksDone} task${a.tasksDone === 1 ? "" : "s"}`);
      if (a.focusMinutes) parts.push(`${fmt(a.focusMinutes)} focus`);
      if (a.journaled) parts.push("reflected");
      return h("span", {
        class: `heat l${future ? "x" : a.level}${a.key === today ? " is-today" : ""}`,
        title: future ? "" : `${short(a.key)}: ${parts.length ? parts.join(", ") : "nothing logged"}`,
      });
    }));

    // month names above the first week that starts in that month
    let lastMonth = "";
    let lastLabelAt = -9;
    $("heatMonths").replaceChildren(...Array.from({ length: HEAT_WEEKS }, (_, w) => {
      const month = LifeData.prettyDate(keys[w * 7], { month: "short" });
      // a label needs about three columns of room, so skip one that would crowd the previous
      const label = month !== lastMonth && w - lastLabelAt >= 3 ? month : "";
      if (label) lastLabelAt = w;
      lastMonth = month;
      return h("span", {}, label);
    }));

    const past = activity.filter((a) => a.key <= today);
    const streak = LifeCore.activeStreak(past, today);
    $("streakBadge").replaceChildren(
      LifeData.icon("flame"),
      h("strong", {}, String(streak.current)),
      h("span", {}, `day streak · best ${streak.best}`));
    $("streakBadge").classList.toggle("is-hot", streak.current >= 3);
    $("heatSummary").textContent = `${streak.activeDays} active day${streak.activeDays === 1 ? "" : "s"} in the last ${HEAT_WEEKS} weeks`;

    const total = (field) => past.reduce((n, a) => n + (typeof a[field] === "boolean" ? Number(a[field]) : a[field]), 0);
    const best = past.slice().sort((a, b) => b.score - a.score)[0];
    const stat = (value, label) => h("div", { class: "heat-stat" }, h("strong", {}, value), h("span", {}, label));
    $("heatStats").replaceChildren(
      stat(String(total("tasksDone")), "tasks finished"),
      stat(fmt(total("focusMinutes")), "locked in"),
      stat(String(total("journaled")), "reflections"),
      stat(best && best.score > 0 ? short(best.key) : "-", "biggest day"),
    );
    // show the latest weeks first when the map is wider than the screen
    const scroller = $("heatScroll");
    scroller.scrollLeft = scroller.scrollWidth;
  }

  function render() {
    const d = LifeData.all();
    renderHeatmap(d);
    renderToday(d);
    renderSide(d);
    renderCountdowns(d);
    renderUpcoming(d);
    renderProjects(d);
    renderWeek(d);
    if (window.SiteNav) SiteNav.refreshLevel();
  }

  /* ---------- a gentle nudge to sign in, once there's something worth backing up ---------- */

  const NUDGE_KEY = "syncNudgeHidden"; // this device only
  function syncNudge(state) {
    let hidden = false;
    try { hidden = localStorage.getItem(NUDGE_KEY) === "1"; } catch {}
    const d = LifeData.all();
    const hasData = Object.keys(d.days).length > 2 || d.projects.length || d.vault.length || Object.keys(d.journal).length;
    $("syncNudge").hidden = hidden || !hasData || state.status !== "signedout";
  }
  $("syncNudgeClose").addEventListener("click", () => {
    try { localStorage.setItem(NUDGE_KEY, "1"); } catch {}
    $("syncNudge").hidden = true;
  });
  if (typeof CloudSync !== "undefined") CloudSync.onChange(syncNudge);
  else window.addEventListener("load", () => { if (typeof CloudSync !== "undefined") CloudSync.onChange(syncNudge); });

  // the welcome tour calls this after saving your name, countdown and first task
  window.TodayPage = { refresh: () => { greet(); render(); tickLive(); } };

  greet();
  tickLive();
  setInterval(tickLive, 1000);
  render();
  LifeData.checkAchievements();
  // keep the greeting fresh, and pick up changes made in another tab
  setInterval(greet, 60000);
  window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith("planner")) render(); });
})();
