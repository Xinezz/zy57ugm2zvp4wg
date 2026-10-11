/* dashboard.js - Mission Control, the home page: today's tasks and progress ring,
   lock-in time, level, journal, countdowns, upcoming deadlines, projects and the week. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const today = LifeData.todayKey();
  const RING = 2 * Math.PI * 66;
  const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
  const short = (key) => LifeData.prettyDate(key, { weekday: "short", day: "numeric", month: "short" });

  function greet() {
    const hour = new Date().getHours();
    $("greeting").textContent = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
    $("todayText").textContent = LifeData.prettyDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  /* ---------- today ---------- */

  function renderToday(d) {
    const items = LifeCore.tasksOn(d.days, d.rules, today);
    const p = LifeCore.dailyProgress(items);
    $("ringFill").style.strokeDasharray = RING;
    $("ringFill").style.strokeDashoffset = RING * (1 - p.ratio);
    $("ring").classList.toggle("is-complete", p.total > 0 && p.done === p.total);
    $("ringPct").textContent = `${Math.round(p.ratio * 100)}%`;
    $("ringText").textContent = p.total ? `${p.done} of ${p.total} done` : "No tasks yet";

    $("taskList").replaceChildren(...(items.length ? items.map((item) =>
      h("li", { class: `list-item${item.done ? " is-done" : ""}` },
        h("input", { type: "checkbox", checked: item.done, "aria-label": `Done: ${item.text}`, onchange: (e) => toggle(item, e.target.checked) }),
        h("span", { class: "grow" }, item.text),
        item.repeat ? h("span", { class: "tag" }, "repeats") : null))
      : [h("li", { class: "empty-note" }, "A clear day. Add something below or plan ahead in the planner.")]));
  }

  function toggle(item, done) {
    const days = LifeData.load("days");
    const rules = LifeData.load("rules");
    PlannerCore.setDone(days, rules, today, item, done);
    LifeData.save("days", days);
    LifeData.save("rules", rules);
    const p = LifeCore.dailyProgress(LifeCore.tasksOn(days, rules, today));
    if (done && p.total && p.done === p.total) showToast("Every task done today. Brilliant!");
    LifeData.checkAchievements();
    render();
  }

  function quickAdd() {
    const text = $("quickTask").value.trim();
    if (!text) return;
    const days = LifeData.load("days");
    days[today] = days[today] || { notes: "", tasks: [] };
    days[today].tasks = days[today].tasks || [];
    days[today].tasks.push({ text, done: false });
    LifeData.save("days", days);
    $("quickTask").value = "";
    render();
  }

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
    $("journalState").textContent = written ? "Written ✓" : new Date().getHours() >= 18 ? "Time to reflect" : "Not written yet";
    const streak = LifeCore.journalStreak(d.journal, today);
    $("journalStreak").textContent = streak ? `${streak}-day streak` : "Four quick questions";
  }

  /* ---------- countdowns ---------- */

  function renderCountdowns(d) {
    const list = d.countdowns.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    $("countdowns").replaceChildren(...(list.length ? list.map((c) => {
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
    }) : [h("p", { class: "empty-note" }, "Count down to exams, trips, birthdays or launch day.")]));
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
    const list = LifeCore.upcoming(d, today, 14).slice(0, 10);
    const label = { task: "Task", deadline: "Deadline", milestone: "Milestone", countdown: "Countdown" };
    $("upcomingList").replaceChildren(...(list.length ? list.map((u) => {
      const left = LifeCore.daysBetween(today, u.key);
      const href = u.kind === "deadline" || u.kind === "milestone" ? `workshop.html#${u.ref}` : u.kind === "task" ? "planner.html" : null;
      return h("li", { class: `list-item up-${u.kind}` },
        h("span", { class: "when" }, left === 1 ? "Tomorrow" : short(u.key)),
        h("span", { class: "grow" }, href ? h("a", { href }, u.title) : u.title),
        h("span", { class: `tag up-tag` }, label[u.kind]));
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

  function render() {
    const d = LifeData.all();
    renderToday(d);
    renderSide(d);
    renderCountdowns(d);
    renderUpcoming(d);
    renderProjects(d);
    renderWeek(d);
    if (window.SiteNav) SiteNav.refreshLevel();
  }

  greet();
  render();
  LifeData.checkAchievements();
  // keep the greeting fresh, and pick up changes made in another tab
  setInterval(greet, 60000);
  window.addEventListener("storage", (e) => { if (e.key && e.key.startsWith("planner")) render(); });
})();
