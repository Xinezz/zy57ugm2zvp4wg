// Run with: node tests/life-core.test.js
const assert = require("node:assert/strict");
const L = require("../js/life-core.js");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}\n     ${err.message}`);
    process.exitCode = 1;
  }
}

const empty = () => ({ days: {}, rules: [], journal: {}, projects: [], vault: [], focusLog: [], skills: [], badges: [], countdowns: [], events: [], achievementDates: {} });
const TODAY = "2026-10-11"; // a Sunday

test("date helpers: weeks start on Monday, gaps counted in days", () => {
  assert.equal(L.weekStart("2026-10-11"), "2026-10-05");
  assert.equal(L.weekStart("2026-10-05"), "2026-10-05");
  assert.equal(L.daysBetween("2026-10-11", "2026-12-25"), 75);
  assert.deepEqual(L.lastNDays("2026-10-02", 3), ["2026-09-30", "2026-10-01", "2026-10-02"]);
});

test("daily progress counts one-off and repeating tasks", () => {
  const d = empty();
  d.days[TODAY] = { notes: "", tasks: [{ text: "a", done: true }, { text: "b", done: false }] };
  d.rules = [{ id: "r", text: "stretch", freq: "daily", start: "2026-10-01", end: null, skip: [], done: { [TODAY]: true } }];
  assert.deepEqual(L.dailyProgress(L.tasksOn(d.days, d.rules, TODAY)), { done: 2, total: 3, ratio: 2 / 3 });
  assert.deepEqual(L.dailyProgress([]), { done: 0, total: 0, ratio: 0 });
});

test("journal streak ends today, or yesterday when today isn't written yet", () => {
  const j = {
    "2026-10-08": { accomplished: "x" }, "2026-10-09": { learned: "y" }, "2026-10-10": { tomorrow: "z" },
    "2026-10-05": { accomplished: "   " },
  };
  assert.equal(L.journalStreak(j, TODAY), 3);
  j[TODAY] = { wrong: "w" };
  assert.equal(L.journalStreak(j, TODAY), 4);
  assert.equal(L.journalKeys(j).length, 4, "blank entries don't count");
});

test("weekly recap picks the starred (or fullest) accomplishment and lists unfinished tasks", () => {
  const d = empty();
  d.journal["2026-10-06"] = { accomplished: "Wired the motor driver and tested PWM speeds", learned: "PWM duty cycle" };
  d.journal["2026-10-07"] = { accomplished: "Small fix", highlight: true };
  d.days["2026-10-08"] = { tasks: [{ text: "solder board", done: false }, { text: "email", done: true }] };
  const recap = L.weeklyRecap(d, "2026-10-05");
  assert.equal(recap.biggest.text, "Small fix", "a starred entry wins");
  delete d.journal["2026-10-07"].highlight;
  assert.equal(L.weeklyRecap(d, "2026-10-05").biggest.text, "Wired the motor driver and tested PWM speeds");
  assert.deepEqual(recap.unfinished, [{ key: "2026-10-08", text: "solder board" }]);
  assert.equal(recap.tasksDone, 1);
  assert.equal(recap.learned.length, 1);
  assert.equal(recap.end, "2026-10-11");
});

test("upcoming deadlines merge tasks, project deadlines, milestones and countdowns in date order", () => {
  const d = empty();
  d.days["2026-10-13"] = { tasks: [{ text: "lab report", done: false }, { text: "done already", done: true }] };
  d.projects = [{ id: "p", title: "Robot arm", status: "progress", deadline: "2026-10-20", milestones: [{ id: "m", text: "Print gripper", due: "2026-10-12", done: false }] }];
  d.countdowns = [{ id: "c", title: "Exams", date: "2026-10-15" }, { id: "far", title: "Holiday", date: "2026-12-25" }];
  const up = L.upcoming(d, TODAY, 14);
  assert.deepEqual(up.map((u) => u.kind), ["milestone", "task", "countdown", "deadline"]);
  assert.ok(!up.some((u) => u.title === "done already" || u.title === "Holiday"));
});

test("project progress follows milestones, otherwise the column it's in", () => {
  assert.equal(L.projectProgress({ status: "progress", milestones: [{ done: true }, { done: false }, { done: true }, { done: false }] }), 0.5);
  assert.equal(L.projectProgress({ status: "testing", milestones: [] }), 0.8);
  assert.equal(L.projectProgress({ status: "done", milestones: [{ done: false }] }), 1);
});

test("levels: 100 XP to reach level 2, 300 for level 3, 600 for level 4", () => {
  assert.equal(L.levelFor(0).level, 1);
  assert.equal(L.levelFor(99).level, 1);
  assert.equal(L.levelFor(100).level, 2);
  assert.equal(L.levelFor(300).level, 3);
  const mid = L.levelFor(450);
  assert.equal(mid.level, 3);
  assert.equal(mid.current, 150);
  assert.equal(mid.needed, 300);
});

test("XP rewards finishing things, and focus sessions count once each regardless of length", () => {
  const d = empty();
  d.days["2026-10-10"] = { tasks: [{ text: "a", done: true }, { text: "b", done: false }] };
  d.journal["2026-10-10"] = { accomplished: "x" };
  d.focusLog = [{ date: "2026-10-10", minutes: 25 }, { date: "2026-10-10", minutes: 180 }, { date: "2026-10-10", minutes: 4 }];
  d.projects = [{ id: "p", title: "P", status: "done", museumId: "w1", milestones: [{ done: true }, { done: false }] }];
  d.skills = [{ id: "s", name: "PWM", date: "2026-10-10" }];
  const xp = L.computeXp(d);
  const byName = Object.fromEntries(xp.lines.map((l) => [l.source, l.xp]));
  assert.equal(byName["Tasks completed"], 10);
  assert.equal(byName["Focus sessions"], 30, "two sessions of 10+ minutes, each worth the same");
  assert.equal(byName["Milestones reached"], 25);
  assert.equal(byName["Projects completed"], 100);
  assert.equal(byName["Projects published to the museum"], 30);
  assert.equal(xp.total, 10 + 20 + 30 + 25 + 100 + 30 + 50);
});

test("achievements unlock at their targets and report capped progress", () => {
  const d = empty();
  d.days[TODAY] = { tasks: [{ text: "a", done: true }, { text: "b", done: true }, { text: "c", done: true }] };
  const list = L.achievements(d);
  const get = (id) => list.find((a) => a.id === id);
  assert.equal(get("first-task").unlocked, true);
  assert.equal(get("perfect-day").unlocked, true);
  assert.equal(get("tasks-50").unlocked, false);
  assert.equal(get("tasks-50").value, 3);
  assert.equal(get("first-task").value, 1, "progress never shows more than the target");
});

test("personal bests find the busiest day and longest session", () => {
  const d = empty();
  d.days["2026-10-01"] = { tasks: [{ text: "a", done: true }] };
  d.days["2026-10-02"] = { tasks: [{ text: "a", done: true }, { text: "b", done: true }] };
  d.focusLog = [{ date: "2026-10-01", minutes: 25 }, { date: "2026-10-03", minutes: 90 }];
  const bests = Object.fromEntries(L.personalBests(d).map((b) => [b.id, b]));
  assert.equal(bests["most-tasks"].value, "2 tasks");
  assert.equal(bests["most-tasks"].date, "2026-10-02");
  assert.equal(bests["longest-focus"].value, "90 min");
});

test("vault search matches title, body and tags, filtered by category and tag", () => {
  const notes = [
    { id: 1, title: "PWM basics", category: "electronics", body: "analogWrite 0-255", tags: ["arduino"], updatedAt: "2026-10-01" },
    { id: 2, title: "Array map", category: "coding", body: "arr.map(fn)", tags: ["js"], updatedAt: "2026-10-05" },
  ];
  assert.deepEqual(L.searchVault(notes, { query: "analogwrite" }).map((n) => n.id), [1]);
  assert.deepEqual(L.searchVault(notes, { query: "ARDUINO" }).map((n) => n.id), [1]);
  assert.deepEqual(L.searchVault(notes, { category: "coding" }).map((n) => n.id), [2]);
  assert.deepEqual(L.searchVault(notes, {}).map((n) => n.id), [2, 1], "newest first");
});

test("timeline gathers events from everywhere, newest first, and the time machine shows one day", () => {
  const d = empty();
  d.events = [{ id: "e", date: "2024-10-11", title: "Joined robotics club", kind: "event" }];
  d.projects = [{ id: "p", title: "Robot", status: "done", createdAt: "2026-09-01T10:00:00Z", completedAt: "2026-10-01T10:00:00Z", milestones: [{ text: "Wheels", done: true, doneAt: "2026-09-15T00:00:00Z" }] }];
  d.skills = [{ id: "s", name: "Soldering", date: "2026-09-20" }];
  d.journal["2024-10-11"] = { accomplished: "First club meeting" };
  const events = L.timelineEvents(d, [{ id: "u", title: "Museums", date: "2026-10-02" }]);
  assert.equal(events[0].title, "Website: Museums");
  assert.equal(events[events.length - 1].title, "Joined robotics club");
  assert.ok(events.some((e) => e.kind === "milestone"));

  const twoYearsAgo = L.snapshot(d, "2024-10-11");
  assert.equal(twoYearsAgo.journal.accomplished, "First club meeting");
  assert.equal(twoYearsAgo.events.length, 1);
  assert.equal(L.snapshotIsEmpty(L.snapshot(d, "2025-01-01")), true);
  assert.equal(L.snapshot(d, "2026-09-10").projectsActive.length, 1);
});

console.log(`\n${passed} passed`);
