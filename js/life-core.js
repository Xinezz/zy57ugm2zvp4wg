/* life-core.js - the rules behind the Dashboard, Journal, Workshop, Vault, Lock-In reports,
   XP & Achievements and Life Timeline. No page code, so it can be tested in Node.

   Data shapes (all saved in browser storage under "planner..." keys, so they sync and back up):
     days       { "YYYY-MM-DD": { notes, tasks: [{ text, done }] } }            (planner)
     rules      [{ id, text, freq, start, end, skip, done: { key: true } }]       (repeating tasks)
     journal    { "YYYY-MM-DD": { accomplished, learned, wrong, tomorrow, mood, highlight } }
     projects   [{ id, title, status, deadline, createdAt, completedAt, milestones: [{ id, text, due, done, doneAt }], ... }]
     vault      [{ id, title, category, body, tags, projectIds, createdAt, updatedAt }]
     focusLog   [{ id, date, start, minutes, task, projectId, accomplished, notes }]
     skills     [{ id, name, category, date, note }]
     badges     [{ id, title, description, icon, date }]
     countdowns [{ id, title, date }]
     events     [{ id, date, title, kind, description }]                          (timeline)        */

(function (root) {
  const XP = {
    task: 10,
    repeatTask: 5,
    journal: 20,
    vaultNote: 15,
    milestone: 25,
    projectDone: 100,
    published: 30,
    skill: 50,
    badge: 40,
    focusSession: 15,
  };

  const MIN_FOCUS_SESSION = 10; // minutes; shorter sessions don't count for XP or achievements

  /* ---------- dates ---------- */

  const pad = (n) => String(n).padStart(2, "0");

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return { y, m, d };
  }

  function addDays(key, n) {
    const { y, m, d } = parseKey(key);
    const date = new Date(Date.UTC(y, m - 1, d + n));
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  function daysBetween(fromKey, toKey) {
    const a = parseKey(fromKey);
    const b = parseKey(toKey);
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  }

  function weekday(key) {
    const { y, m, d } = parseKey(key);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  /** Monday of the week containing `key`. */
  function weekStart(key) {
    const dow = weekday(key);
    return addDays(key, dow === 0 ? -6 : 1 - dow);
  }

  function lastNDays(todayKey, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(addDays(todayKey, -i));
    return out;
  }

  const keyOfIso = (iso) => (iso ? String(iso).slice(0, 10) : "");

  /* ---------- tasks ---------- */

  function occursOn(rule, key) {
    if (key < rule.start) return false;
    if (rule.end && key > rule.end) return false;
    if (rule.skip && rule.skip.includes(key)) return false;
    const dow = weekday(key);
    switch (rule.freq) {
      case "daily": return true;
      case "weekdays": return dow >= 1 && dow <= 5;
      case "weekly": return dow === weekday(rule.start);
      case "monthly": {
        const { y, m, d } = parseKey(key);
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return d === Math.min(parseKey(rule.start).d, last);
      }
      default: return false;
    }
  }

  function tasksOn(days, rules, key) {
    const items = [];
    const entry = days[key];
    (entry && entry.tasks ? entry.tasks : []).forEach((t, index) => {
      items.push({ kind: "day", index, text: t.text, done: !!t.done });
    });
    rules.forEach((rule) => {
      if (occursOn(rule, key)) {
        items.push({ kind: "rule", ruleId: rule.id, text: rule.text, done: !!(rule.done && rule.done[key]), repeat: rule.freq });
      }
    });
    return items;
  }

  function dailyProgress(items) {
    const total = items.length;
    const done = items.filter((i) => i.done).length;
    return { done, total, ratio: total ? done / total : 0 };
  }

  /** How many tasks were finished, overall and per day. */
  function doneTaskStats(days, rules) {
    const perDay = {};
    let oneOff = 0;
    let repeat = 0;
    Object.keys(days).forEach((key) => {
      const n = (days[key].tasks || []).filter((t) => t.done).length;
      oneOff += n;
      if (n) perDay[key] = (perDay[key] || 0) + n;
    });
    rules.forEach((rule) => {
      Object.keys(rule.done || {}).forEach((key) => {
        if (!rule.done[key]) return;
        repeat++;
        perDay[key] = (perDay[key] || 0) + 1;
      });
    });
    return { oneOff, repeat, total: oneOff + repeat, perDay };
  }

  /* ---------- journal ---------- */

  const JOURNAL_FIELDS = ["accomplished", "learned", "wrong", "tomorrow"];

  function entryFilled(entry) {
    return !!entry && JOURNAL_FIELDS.some((f) => entry[f] && String(entry[f]).trim());
  }

  function journalKeys(journal) {
    return Object.keys(journal).filter((k) => entryFilled(journal[k])).sort();
  }

  /** Days in a row with a journal entry, ending today (or yesterday, if today isn't written yet). */
  function journalStreak(journal, todayKey) {
    let key = entryFilled(journal[todayKey]) ? todayKey : addDays(todayKey, -1);
    let streak = 0;
    while (entryFilled(journal[key])) {
      streak++;
      key = addDays(key, -1);
    }
    return streak;
  }

  function longestRun(sortedKeys) {
    let best = 0;
    let run = 0;
    let prev = null;
    sortedKeys.forEach((key) => {
      run = prev && daysBetween(prev, key) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = key;
    });
    return best;
  }

  /** Weekly recap from journal entries and tasks for the 7 days starting `startKey`. */
  function weeklyRecap({ journal, days, rules }, startKey) {
    const keys = lastNDays(addDays(startKey, 6), 7);
    const entries = keys.filter((k) => entryFilled(journal[k])).map((k) => ({ key: k, ...journal[k] }));

    const starred = entries.filter((e) => e.highlight && e.accomplished);
    const pool = starred.length ? starred : entries.filter((e) => e.accomplished && e.accomplished.trim());
    const biggest = pool.slice().sort((a, b) => b.accomplished.trim().length - a.accomplished.trim().length)[0] || null;

    const unfinished = [];
    let doneCount = 0;
    keys.forEach((key) => {
      tasksOn(days, rules, key).forEach((item) => {
        if (item.done) doneCount++;
        else if (item.kind === "day") unfinished.push({ key, text: item.text });
      });
    });

    return {
      start: startKey,
      end: keys[6],
      journalDays: entries.length,
      biggest: biggest ? { key: biggest.key, text: biggest.accomplished.trim() } : null,
      learned: entries.filter((e) => e.learned && e.learned.trim()).map((e) => ({ key: e.key, text: e.learned.trim() })),
      improvements: entries.filter((e) => e.wrong && e.wrong.trim()).map((e) => ({ key: e.key, text: e.wrong.trim() })),
      unfinished,
      tasksDone: doneCount,
    };
  }

  /* ---------- focus (Lock-In) ---------- */

  const countedSessions = (log) => log.filter((s) => (s.minutes || 0) >= MIN_FOCUS_SESSION);

  function focusOn(log, key) {
    const sessions = log.filter((s) => s.date === key);
    return { minutes: sessions.reduce((sum, s) => sum + (s.minutes || 0), 0), sessions: sessions.length };
  }

  function weeklySummary({ days, rules, focusLog, journal }, todayKey) {
    const stats = doneTaskStats(days, rules);
    const keys = lastNDays(todayKey, 7);
    const perDay = keys.map((key) => ({
      key,
      tasksDone: stats.perDay[key] || 0,
      focusMinutes: focusOn(focusLog, key).minutes,
      journaled: entryFilled(journal[key]),
    }));
    return {
      days: perDay,
      tasksDone: perDay.reduce((s, d) => s + d.tasksDone, 0),
      focusMinutes: perDay.reduce((s, d) => s + d.focusMinutes, 0),
      journalDays: perDay.filter((d) => d.journaled).length,
      bestDay: perDay.slice().sort((a, b) => b.tasksDone - a.tasksDone)[0],
    };
  }

  /* ---------- projects ---------- */

  const STATUS_ORDER = ["backlog", "progress", "testing", "done"];
  const STATUS_LABELS = { backlog: "Backlog", progress: "In Progress", testing: "Testing", done: "Completed" };

  function projectProgress(project) {
    if (project.status === "done") return 1;
    const ms = project.milestones || [];
    if (ms.length) return ms.filter((m) => m.done).length / ms.length;
    return { backlog: 0, progress: 0.4, testing: 0.8 }[project.status] || 0;
  }

  /* ---------- upcoming deadlines ---------- */

  function upcoming({ days, rules, projects, countdowns }, todayKey, aheadDays = 14) {
    const out = [];
    for (let n = 1; n <= aheadDays; n++) {
      const key = addDays(todayKey, n);
      tasksOn(days, rules, key).forEach((item) => {
        if (!item.done && item.kind === "day") out.push({ key, title: item.text, kind: "task" });
      });
    }
    const last = addDays(todayKey, aheadDays);
    projects.forEach((p) => {
      if (p.status !== "done" && p.deadline && p.deadline >= todayKey && p.deadline <= last) {
        out.push({ key: p.deadline, title: `${p.title} deadline`, kind: "deadline", ref: p.id });
      }
      (p.milestones || []).forEach((m) => {
        if (!m.done && m.due && m.due >= todayKey && m.due <= last) {
          out.push({ key: m.due, title: `${p.title}: ${m.text}`, kind: "milestone", ref: p.id });
        }
      });
    });
    countdowns.forEach((c) => {
      if (c.date >= todayKey && c.date <= last) out.push({ key: c.date, title: c.title, kind: "countdown", ref: c.id });
    });
    return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }

  /* ---------- XP ---------- */

  const totalForLevel = (level) => 50 * level * (level - 1);

  function levelFor(xp) {
    let level = 1;
    while (xp >= totalForLevel(level + 1)) level++;
    const base = totalForLevel(level);
    const next = totalForLevel(level + 1);
    return { level, current: xp - base, needed: next - base, progress: (xp - base) / (next - base), nextAt: next };
  }

  function computeXp(d) {
    const tasks = doneTaskStats(d.days, d.rules);
    const milestones = d.projects.reduce((n, p) => n + (p.milestones || []).filter((m) => m.done).length, 0);
    const lines = [
      { source: "Tasks completed", count: tasks.oneOff, each: XP.task },
      { source: "Repeating tasks completed", count: tasks.repeat, each: XP.repeatTask },
      { source: "Journal entries", count: journalKeys(d.journal).length, each: XP.journal },
      { source: "Focus sessions", count: countedSessions(d.focusLog).length, each: XP.focusSession },
      { source: "Vault notes", count: d.vault.length, each: XP.vaultNote },
      { source: "Milestones reached", count: milestones, each: XP.milestone },
      { source: "Projects completed", count: d.projects.filter((p) => p.status === "done").length, each: XP.projectDone },
      { source: "Projects published to the museum", count: d.projects.filter((p) => p.museumId).length, each: XP.published },
      { source: "Skills learned", count: d.skills.length, each: XP.skill },
      { source: "Badges earned", count: d.badges.length, each: XP.badge },
    ].map((line) => ({ ...line, xp: line.count * line.each }));
    const total = lines.reduce((s, l) => s + l.xp, 0);
    return { total, lines, ...levelFor(total) };
  }

  /* ---------- achievements ---------- */

  function perfectDays(days, rules) {
    const keys = new Set([...Object.keys(days)]);
    rules.forEach((r) => Object.keys(r.done || {}).forEach((k) => keys.add(k)));
    return [...keys].filter((key) => {
      const items = tasksOn(days, rules, key);
      return items.length >= 3 && items.every((i) => i.done);
    }).length;
  }

  function achievements(d) {
    const tasks = doneTaskStats(d.days, d.rules).total;
    const journalCount = journalKeys(d.journal).length;
    const bestJournalRun = longestRun(journalKeys(d.journal));
    const sessions = countedSessions(d.focusLog).length;
    const done = d.projects.filter((p) => p.status === "done").length;
    const published = d.projects.filter((p) => p.museumId).length;
    const milestones = d.projects.reduce((n, p) => n + (p.milestones || []).filter((m) => m.done).length, 0);
    const taskDays = Object.keys(doneTaskStats(d.days, d.rules).perDay).sort();

    const list = [
      { id: "first-task", title: "First Step", description: "Complete your first task.", icon: "star", value: tasks, target: 1 },
      { id: "tasks-50", title: "Task Tamer", description: "Complete 50 tasks.", icon: "check", value: tasks, target: 50 },
      { id: "tasks-200", title: "Unstoppable", description: "Complete 200 tasks.", icon: "trophy", value: tasks, target: 200 },
      { id: "perfect-day", title: "Perfect Day", description: "Finish every task on a day with 3 or more.", icon: "sun", value: perfectDays(d.days, d.rules), target: 1 },
      { id: "task-streak-7", title: "On a Roll", description: "Complete tasks 7 days in a row.", icon: "flame", value: longestRun(taskDays), target: 7 },
      { id: "first-journal", title: "Dear Diary", description: "Write your first reflection.", icon: "book", value: journalCount, target: 1 },
      { id: "journal-7", title: "Reflective Mind", description: "Reflect 7 days in a row.", icon: "flame", value: bestJournalRun, target: 7 },
      { id: "journal-30", title: "Chronicler", description: "Write 30 reflections.", icon: "book", value: journalCount, target: 30 },
      { id: "first-focus", title: "Locked In", description: `Finish a focus session of ${MIN_FOCUS_SESSION}+ minutes.`, icon: "moon", value: sessions, target: 1 },
      { id: "focus-25", title: "Deep Worker", description: "Finish 25 focus sessions.", icon: "moon", value: sessions, target: 25 },
      { id: "first-project", title: "Blueprint", description: "Start a project in the Workshop.", icon: "wrench", value: d.projects.length, target: 1 },
      { id: "milestones-10", title: "Milestone Maker", description: "Reach 10 project milestones.", icon: "flag", value: milestones, target: 10 },
      { id: "first-done", title: "Shipped It", description: "Complete a project.", icon: "rocket", value: done, target: 1 },
      { id: "done-5", title: "Serial Shipper", description: "Complete 5 projects.", icon: "rocket", value: done, target: 5 },
      { id: "curator", title: "Curator", description: "Publish a project to the museum.", icon: "frame", value: published, target: 1 },
      { id: "vault-10", title: "Scholar", description: "Save 10 notes in the Knowledge Vault.", icon: "chip", value: d.vault.length, target: 10 },
      { id: "vault-50", title: "Librarian", description: "Save 50 notes in the Knowledge Vault.", icon: "chip", value: d.vault.length, target: 50 },
      { id: "first-skill", title: "Skill Up", description: "Log a skill you learned.", icon: "bolt", value: d.skills.length, target: 1 },
      { id: "skills-10", title: "Polymath", description: "Log 10 skills.", icon: "bolt", value: d.skills.length, target: 10 },
    ];
    return list.map((a) => ({ ...a, value: Math.min(a.value, a.target), unlocked: a.value >= a.target }));
  }

  function personalBests(d) {
    const perDay = doneTaskStats(d.days, d.rules).perDay;
    const busiest = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0];
    const longest = d.focusLog.slice().sort((a, b) => (b.minutes || 0) - (a.minutes || 0))[0];
    const sessionsPerDay = {};
    d.focusLog.forEach((s) => { sessionsPerDay[s.date] = (sessionsPerDay[s.date] || 0) + 1; });
    const mostSessions = Object.entries(sessionsPerDay).sort((a, b) => b[1] - a[1])[0];
    const bigProject = d.projects
      .filter((p) => p.status === "done")
      .sort((a, b) => (b.milestones || []).length - (a.milestones || []).length)[0];

    return [
      { id: "most-tasks", title: "Most tasks finished in a day", value: busiest ? `${busiest[1]} tasks` : null, date: busiest ? busiest[0] : null },
      { id: "longest-focus", title: "Longest focus session", value: longest ? `${longest.minutes} min` : null, date: longest ? longest.date : null },
      { id: "most-sessions", title: "Most focus sessions in a day", value: mostSessions ? `${mostSessions[1]} sessions` : null, date: mostSessions ? mostSessions[0] : null },
      { id: "journal-run", title: "Longest reflection streak", value: journalKeys(d.journal).length ? `${longestRun(journalKeys(d.journal))} days` : null, date: null },
      { id: "biggest-project", title: "Biggest project finished", value: bigProject ? `${bigProject.title} (${(bigProject.milestones || []).length} milestones)` : null, date: bigProject ? keyOfIso(bigProject.completedAt) : null },
    ];
  }

  /* ---------- knowledge vault ---------- */

  function searchVault(notes, { query = "", category = "", tag = "" } = {}) {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => !category || n.category === category)
      .filter((n) => !tag || (n.tags || []).includes(tag))
      .filter((n) => !q || [n.title, n.body, (n.tags || []).join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  }

  /* ---------- timeline ---------- */

  function timelineEvents(d, updates = []) {
    const out = [];
    d.events.forEach((e) => out.push({ date: e.date, kind: e.kind || "event", title: e.title, detail: e.description || "", ref: e.id, manual: true }));
    d.projects.forEach((p) => {
      if (p.createdAt) out.push({ date: keyOfIso(p.createdAt), kind: "project", title: `Started ${p.title}`, detail: "", ref: p.id });
      if (p.status === "done" && p.completedAt) out.push({ date: keyOfIso(p.completedAt), kind: "project", title: `Finished ${p.title}`, detail: "", ref: p.id });
      (p.milestones || []).forEach((m) => {
        if (m.done && m.doneAt) out.push({ date: keyOfIso(m.doneAt), kind: "milestone", title: `${p.title}: ${m.text}`, detail: "", ref: p.id });
      });
    });
    d.skills.forEach((s) => out.push({ date: s.date, kind: "skill", title: `Learned ${s.name}`, detail: s.note || "", ref: s.id }));
    d.badges.forEach((b) => out.push({ date: b.date, kind: "achievement", title: b.title, detail: b.description || "", ref: b.id }));
    Object.entries(d.achievementDates || {}).forEach(([id, date]) => {
      const a = achievements(d).find((x) => x.id === id);
      if (a) out.push({ date, kind: "achievement", title: `Unlocked "${a.title}"`, detail: a.description, ref: id });
    });
    updates.filter((u) => u.date).forEach((u) => out.push({ date: u.date, kind: "update", title: `Website: ${u.title}`, detail: u.description || "", ref: u.id }));
    return out.filter((e) => e.date).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  /** Everything recorded on one day, for the time machine. */
  function snapshot(d, key) {
    const entry = d.days[key] || {};
    return {
      key,
      notes: entry.notes || "",
      tasks: tasksOn(d.days, d.rules, key),
      journal: entryFilled(d.journal[key]) ? d.journal[key] : null,
      focus: d.focusLog.filter((s) => s.date === key),
      projectsActive: d.projects.filter((p) => keyOfIso(p.createdAt) <= key && (!p.completedAt || keyOfIso(p.completedAt) >= key)),
      vaultNotes: d.vault.filter((n) => keyOfIso(n.createdAt) === key),
      skills: d.skills.filter((s) => s.date === key),
      events: timelineEvents(d).filter((e) => e.date === key),
    };
  }

  function snapshotIsEmpty(s) {
    return !s.notes && !s.tasks.length && !s.journal && !s.focus.length && !s.vaultNotes.length && !s.skills.length && !s.events.length;
  }

  const api = {
    XP, MIN_FOCUS_SESSION, JOURNAL_FIELDS, STATUS_ORDER, STATUS_LABELS,
    addDays, daysBetween, weekday, weekStart, lastNDays, keyOfIso,
    tasksOn, dailyProgress, doneTaskStats,
    entryFilled, journalKeys, journalStreak, longestRun, weeklyRecap,
    focusOn, weeklySummary, countedSessions,
    projectProgress, upcoming,
    levelFor, totalForLevel, computeXp, achievements, personalBests,
    searchVault, timelineEvents, snapshot, snapshotIsEmpty,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LifeCore = api;
})(typeof window !== "undefined" ? window : globalThis);
