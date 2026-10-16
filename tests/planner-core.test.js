// Run with: node tests/planner-core.test.js
const assert = require("node:assert/strict");
const core = require("../js/planner-core.js");

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

const rule = (freq, start, extra = {}) => ({ id: "r1", text: "x", freq, start, end: null, skip: [], done: {}, ...extra });

test("addDays crosses month and year boundaries", () => {
  assert.equal(core.addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(core.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(core.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(core.addDays("2028-03-01", -1), "2028-02-29");
});

test("weekday of a known date (2026-10-02 is a Friday)", () => {
  assert.equal(core.weekdayOf("2026-10-02"), 5);
  assert.equal(core.isWeekendKey("2026-10-03"), true);
  assert.equal(core.isWeekendKey("2026-10-02"), false);
});

test("daily rules start on their start date and not before", () => {
  const r = rule("daily", "2026-10-05");
  assert.equal(core.occursOn(r, "2026-10-04"), false);
  assert.equal(core.occursOn(r, "2026-10-05"), true);
  assert.equal(core.occursOn(r, "2027-01-01"), true);
});

test("weekdays rules skip Saturday and Sunday", () => {
  const r = rule("weekdays", "2026-10-02");
  assert.equal(core.occursOn(r, "2026-10-03"), false);
  assert.equal(core.occursOn(r, "2026-10-04"), false);
  assert.equal(core.occursOn(r, "2026-10-05"), true);
});

test("weekly rules repeat on the same weekday", () => {
  const r = rule("weekly", "2026-10-02");
  assert.equal(core.occursOn(r, "2026-10-09"), true);
  assert.equal(core.occursOn(r, "2026-10-10"), false);
  assert.equal(core.occursOn(r, "2026-09-25"), false);
});

test("monthly rules use the same day, clamped for short months", () => {
  const r = rule("monthly", "2026-01-31");
  assert.equal(core.occursOn(r, "2026-02-28"), true);
  assert.equal(core.occursOn(r, "2026-02-27"), false);
  assert.equal(core.occursOn(r, "2026-04-30"), true);
  assert.equal(core.occursOn(r, "2026-03-31"), true);
  assert.equal(core.occursOn(r, "2026-03-30"), false);
});

test("end date and skipped days are respected", () => {
  const r = rule("daily", "2026-10-01", { end: "2026-10-05", skip: ["2026-10-03"] });
  assert.equal(core.occursOn(r, "2026-10-03"), false);
  assert.equal(core.occursOn(r, "2026-10-05"), true);
  assert.equal(core.occursOn(r, "2026-10-06"), false);
});

test("addTask rejects empty text and unknown frequencies become one-off tasks", () => {
  const days = {}, rules = [];
  assert.equal(core.addTask(days, rules, "2026-10-02", "   ", null), false);
  assert.equal(core.addTask(days, rules, "2026-10-02", "one-off", "sometimes"), true);
  assert.equal(rules.length, 0);
  assert.equal(days["2026-10-02"].tasks.length, 1);
});

test("itemsFor combines one-off and repeating tasks, with per-day done state", () => {
  const days = {}, rules = [];
  core.addTask(days, rules, "2026-10-02", "write", null);
  core.addTask(days, rules, "2026-10-02", "stretch", "daily");
  let items = core.itemsFor(days, rules, "2026-10-03");
  assert.equal(items.length, 1);
  assert.equal(items[0].repeat, "daily");

  items = core.itemsFor(days, rules, "2026-10-02");
  assert.equal(items.length, 2);
  core.setDone(days, rules, "2026-10-02", items[1], true);
  assert.equal(core.itemsFor(days, rules, "2026-10-02")[1].done, true);
  assert.equal(core.itemsFor(days, rules, "2026-10-03")[0].done, false);
});

test("dayStatus: empty, open and finished days", () => {
  assert.equal(core.dayStatus([]), null);
  assert.equal(core.dayStatus([{ done: true }, { done: false }]), "busy");
  assert.equal(core.dayStatus([{ done: true }, { done: true }]), "done");
});

test("removing a one-off task prunes an otherwise empty day", () => {
  const days = {}, rules = [];
  core.addTask(days, rules, "2026-10-02", "a", null);
  core.removeItem(days, rules, "2026-10-02", core.itemsFor(days, rules, "2026-10-02")[0]);
  assert.equal("2026-10-02" in days, false);
});

test("a day with notes survives removing its last task", () => {
  const days = { "2026-10-02": { notes: "keep me", tasks: [{ text: "a", done: false }] } };
  core.removeItem(days, [], "2026-10-02", { kind: "day", index: 0 });
  assert.equal(days["2026-10-02"].notes, "keep me");
});

test("removing a repeating task only skips that day", () => {
  const days = {}, rules = [];
  core.addTask(days, rules, "2026-10-02", "daily thing", "daily");
  const item = core.itemsFor(days, rules, "2026-10-02")[0];
  core.removeItem(days, rules, "2026-10-02", item);
  assert.equal(core.itemsFor(days, rules, "2026-10-02").length, 0);
  assert.equal(core.itemsFor(days, rules, "2026-10-03").length, 1);
});

test("stopRepeating keeps the current day and ends the series after it", () => {
  const days = {}, rules = [];
  core.addTask(days, rules, "2026-10-02", "daily thing", "daily");
  core.stopRepeating(rules, "2026-10-05", rules[0].id);
  assert.equal(core.itemsFor(days, rules, "2026-10-05").length, 1);
  assert.equal(core.itemsFor(days, rules, "2026-10-06").length, 0);
});

test("search finds notes, tasks and repeating tasks, newest first", () => {
  const days = {
    "2026-10-01": { notes: "Buy MILK today", tasks: [{ text: "milk run", done: true }] },
    "2026-10-09": { notes: "", tasks: [{ text: "email boss", done: false }] },
  };
  const rules = [rule("weekly", "2026-09-01", { text: "Drink milk tea" })];
  const hits = core.search(days, rules, "milk");
  assert.deepEqual(hits.map((h) => h.kind), ["note", "task", "repeat"]);
  assert.equal(hits.length, 3);
  assert.equal(hits[0].key, "2026-10-01");
  assert.equal(hits[hits.length - 1].kind, "repeat");
  assert.deepEqual(core.search(days, rules, "   "), []);
  assert.deepEqual(core.search(days, rules, "zzz"), []);
});

test("agenda lists open one-off tasks as overdue, never missed repeats", () => {
  const days = {
    "2026-09-30": { notes: "", tasks: [{ text: "late", done: false }, { text: "finished", done: true }] },
  };
  const rules = [rule("daily", "2026-09-01", { text: "daily thing" })];
  const result = core.agenda(days, rules, "2026-10-02", { pastDays: 10, aheadDays: 2 });
  assert.equal(result.overdue.length, 1);
  assert.equal(result.overdue[0].key, "2026-09-30");
  assert.equal(result.overdue[0].items.length, 1);
  assert.equal(result.upcoming.length, 3);
  assert.equal(result.upcoming[0].key, "2026-10-02");
});

test("special periods colour weekdays only and count weekdays left", () => {
  const period = { start: "2026-10-05", end: "2026-10-16", className: "intern", label: "Internship" };
  assert.equal(core.periodFor("2026-10-07", [period]), period);
  assert.equal(core.periodFor("2026-10-10", [period]), null); // Saturday
  assert.equal(core.periodFor("2026-10-19", [period]), null); // after the end
  assert.equal(core.weekdaysBetween("2026-10-05", "2026-10-16"), 10);

  const before = core.periodCountdown(period, "2026-10-01"); // Thursday
  assert.equal(before.phase, "before");
  assert.equal(before.untilStart, 2); // Thu and Fri
  const during = core.periodCountdown(period, "2026-10-11"); // Sunday
  assert.deepEqual([during.phase, during.left, during.done, during.total], ["during", 5, 5, 10]);
  const lastDay = core.periodCountdown(period, "2026-10-16");
  assert.equal(lastDay.left, 1); // today still counts
  assert.equal(core.periodCountdown(period, "2026-10-17").phase, "after");
});

test("saved internship dates are validated and the end moment is exact", () => {
  assert.deepEqual(core.cleanPeriods(null), []); // nothing saved: no countdown
  assert.deepEqual(core.cleanPeriods([]), []); // removed on purpose
  const cleaned = core.cleanPeriods([
    { label: "Intern", start: "2026-11-02", end: "2027-01-29", finish: "17:30" },
    { label: "Backwards", start: "2027-01-01", end: "2026-01-01" },
    { start: "nope", end: "2026-01-01" },
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].finish, "17:30");
  assert.equal(core.cleanPeriods([{ start: "2026-11-02", end: "2026-11-03", finish: "25:00" }])[0].finish, "18:00");

  const end = core.sgNow(core.periodEndTime({ end: "2027-02-19", finish: "18:00" }));
  assert.deepEqual([end.year, end.month, end.day, end.hours, end.minutes], [2027, 1, 19, 18, 0]);
  assert.deepEqual(core.splitDuration(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000), { days: 2, hours: 3, minutes: 4, seconds: 5 });
  assert.deepEqual(core.splitDuration(-5000), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test("quick add reads dates, times and repeats out of the text", () => {
  const T = "2026-10-17"; // a Saturday
  const q = (s) => {
    const r = core.parseQuickAdd(s, T);
    return [r.text, r.date, r.time, r.repeat];
  };
  assert.deepEqual(q("Submit report fri 3pm"), ["Submit report", "2026-10-23", "15:00", null]);
  assert.deepEqual(q("call mom tmr"), ["call mom", "2026-10-18", null, null]);
  assert.deepEqual(q("gym every monday"), ["gym", "2026-10-19", null, "weekly"]);
  assert.deepEqual(q("standup every weekday 10:00"), ["standup", null, "10:00", "weekdays"]);
  assert.deepEqual(q("Meeting 20 oct at 2"), ["Meeting", "2026-10-20", "14:00", null]);
  assert.deepEqual(q("dentist 25/10 9:30am"), ["dentist", "2026-10-25", "09:30", null]);
  assert.deepEqual(q("exam on dec 5th"), ["exam", "2026-12-05", null, null]);
  assert.deepEqual(q("study in 2 weeks"), ["study", "2026-10-31", null, null]);
  assert.deepEqual(q("lunch at noon today"), ["lunch", "2026-10-17", "12:00", null]);
  assert.deepEqual(q("sat review"), ["review", "2026-10-17", null, null]); // today counts
  assert.deepEqual(q("next sat review"), ["review", "2026-10-24", null, null]);
  assert.deepEqual(q("party 5 jan"), ["party", "2027-01-05", null, null]); // already past this year
  assert.deepEqual(q("Buy 3 resistors"), ["Buy 3 resistors", null, null, null]); // plain numbers stay
  assert.deepEqual(q("Read Monitor manual"), ["Read Monitor manual", null, null, null]); // words containing day names stay
  assert.equal(core.parseQuickAdd("bad 31/2", T).date, null);
});

test("tasks keep an optional time and sort by it", () => {
  const days = {};
  const rules = [];
  core.addTask(days, rules, "2026-10-17", "late", null, "18:00");
  core.addTask(days, rules, "2026-10-17", "untimed", null);
  core.addTask(days, rules, "2026-10-17", "early", "daily", "08:15");
  core.addTask(days, rules, "2026-10-17", "bad time", null, "25:00");
  const items = core.itemsFor(days, rules, "2026-10-17");
  assert.deepEqual(core.byTime(items).map((i) => i.text), ["early", "late", "untimed", "bad time"]);
  assert.equal(items.find((i) => i.text === "bad time").time, null);
  assert.equal(core.formatTime("15:30"), "3:30 pm");
  assert.equal(core.formatTime("00:05"), "12:05 am");
});

test("the clock follows Singapore time whatever the device's time zone", () => {
  const ms = Date.UTC(2026, 9, 11, 23, 30, 15); // 11 Oct 23:30:15 UTC = 12 Oct 07:30:15 in Singapore
  assert.deepEqual(core.sgNow(ms), { year: 2026, month: 9, day: 12, hours: 7, minutes: 30, seconds: 15, weekday: 1 });
  assert.equal(core.sgTodayKey(ms), "2026-10-12");
  assert.equal(core.sgTodayKey(Date.UTC(2026, 11, 31, 16, 0)), "2027-01-01"); // midnight new year in Singapore
  assert.equal(core.sgTime("2026-10-12", "07:30"), Date.UTC(2026, 9, 11, 23, 30));
  assert.equal(core.periodEndTime({ end: "2027-02-19", finish: "18:00" }), Date.UTC(2027, 1, 19, 10, 0));
});

console.log(`\n${passed} passed`);
