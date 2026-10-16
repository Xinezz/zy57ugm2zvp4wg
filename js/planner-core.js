/* planner-core.js - the planner's data rules, with no DOM access so it can be tested in Node.

   days:  { "YYYY-MM-DD": { notes: string, tasks: [{ text, done, time? }] } }
   rules: [{ id, text, freq, start, end, skip: [keys], done: { key: true }, time? }]
          freq is "daily" | "weekdays" | "weekly" | "monthly"; time is "HH:MM" (optional)
   item:  { kind: "day", index, text, done, repeat: null, time }
        | { kind: "rule", ruleId, text, done, repeat: freq, time }                   */

(function (root) {
  const FREQUENCIES = ["daily", "weekdays", "weekly", "monthly"];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function dateKey(year, monthIndex, day) {
    return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return { y, m, d };
  }

  function weekdayOf(key) {
    const { y, m, d } = parseKey(key);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function addDays(key, n) {
    const { y, m, d } = parseKey(key);
    const date = new Date(Date.UTC(y, m - 1, d + n));
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  function isWeekendKey(key) {
    const dow = weekdayOf(key);
    return dow === 0 || dow === 6;
  }

  function occursOn(rule, key) {
    if (key < rule.start) return false;
    if (rule.end && key > rule.end) return false;
    if (rule.skip && rule.skip.includes(key)) return false;

    switch (rule.freq) {
      case "daily":
        return true;
      case "weekdays": {
        const dow = weekdayOf(key);
        return dow >= 1 && dow <= 5;
      }
      case "weekly":
        return weekdayOf(key) === weekdayOf(rule.start);
      case "monthly": {
        const { y, m, d } = parseKey(key);
        const wanted = Math.min(parseKey(rule.start).d, daysInMonth(y, m));
        return d === wanted;
      }
      default:
        return false;
    }
  }

  function itemsFor(days, rules, key) {
    const items = [];
    const entry = days[key];
    if (entry && entry.tasks) {
      entry.tasks.forEach((task, index) => {
        items.push({ kind: "day", index, text: task.text, done: !!task.done, repeat: null, time: task.time || null });
      });
    }
    rules.forEach((rule) => {
      if (occursOn(rule, key)) {
        items.push({
          kind: "rule",
          ruleId: rule.id,
          text: rule.text,
          done: !!(rule.done && rule.done[key]),
          repeat: rule.freq,
          time: rule.time || null,
        });
      }
    });
    return items;
  }

  /** "done" when every item is finished, "busy" when any is open, null for an empty day. */
  function dayStatus(items) {
    if (items.length === 0) return null;
    return items.every((item) => item.done) ? "done" : "busy";
  }

  function ensureDay(days, key) {
    if (!days[key]) days[key] = { notes: "", tasks: [] };
    if (!days[key].tasks) days[key].tasks = [];
    return days[key];
  }

  function pruneDay(days, key) {
    const entry = days[key];
    if (entry && (!entry.tasks || entry.tasks.length === 0) && !entry.notes) delete days[key];
  }

  function newRuleId() {
    return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function addTask(days, rules, key, text, repeat, time) {
    const clean = (text || "").trim();
    if (!clean) return false;
    const at = TIME_RE.test(time || "") ? { time } : {};
    if (repeat && FREQUENCIES.includes(repeat)) {
      rules.push({ id: newRuleId(), text: clean, freq: repeat, start: key, end: null, skip: [], done: {}, ...at });
    } else {
      ensureDay(days, key).tasks.push({ text: clean, done: false, ...at });
    }
    return true;
  }

  /* ---------- Quick add: "Submit report fri 3pm", "gym every monday", "call mom tmr" ---------- */

  const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const WD = "(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)";
  const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  const wdIndex = (word) => WEEKDAY_NAMES.findIndex((w) => w.startsWith(word.toLowerCase().slice(0, 3)));

  /** The next date falling on weekday `idx` (0 = Sunday), counting today unless `strict`. */
  function nextWeekday(todayKey, idx, strict) {
    let diff = (idx - weekdayOf(todayKey) + 7) % 7;
    if (diff === 0 && strict) diff = 7;
    return addDays(todayKey, diff);
  }

  /** A real calendar date in the coming year: dates already past this year roll on to next year. */
  function futureDate(todayKey, month, day, year) {
    let y = year || parseKey(todayKey).y;
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(y, month)) return null;
    let key = `${y}-${pad(month)}-${pad(day)}`;
    if (!year && key < todayKey) {
      y += 1;
      if (day > daysInMonth(y, month)) return null;
      key = `${y}-${pad(month)}-${pad(day)}`;
    }
    return key;
  }

  /**
   * Reads dates, times and repeats out of a typed task and returns what's left as the task text.
   * Dates: today, tonight, tomorrow/tmr, day after tomorrow, mon..sun, next fri, next week,
   *        in 3 days / in 2 weeks, 20 oct, oct 20, 20/10 (day/month), 2026-10-20.
   * Times: 3pm, 3:30pm, 15:00, at 3 (1-7 means afternoon), noon.
   * Repeats: daily / every day, every weekday / weekdays, every monday / weekly, monthly.
   * Returns { text, date (or null), time (or null), repeat (or null), found: [matched words] }.
   */
  function parseQuickAdd(input, todayKey) {
    let text = ` ${String(input || "")} `;
    let date = null;
    let time = null;
    let repeat = null;
    const found = [];

    // Finds the first match, lets `use` read it (returning false rejects it) and removes the words.
    function take(re, use) {
      const m = text.match(re);
      if (!m) return false;
      if (use(m) === false) return false;
      found.push(m[0].trim());
      text = text.slice(0, m.index) + " " + text.slice(m.index + m[0].length);
      return true;
    }

    // repeats
    take(/\s(?:every\s+day|daily)(?=\s)/i, () => { repeat = "daily"; })
      || take(/\s(?:every\s+weekday|weekdays)(?=\s)/i, () => { repeat = "weekdays"; })
      || take(new RegExp(`\\severy\\s+${WD}(?=\\s)`, "i"), (m) => { repeat = "weekly"; date = nextWeekday(todayKey, wdIndex(m[1]), false); })
      || take(/\s(?:weekly|every\s+week)(?=\s)/i, () => { repeat = "weekly"; })
      || take(/\s(?:monthly|every\s+month)(?=\s)/i, () => { repeat = "monthly"; });

    // dates
    if (!date) {
      take(/\s(?:the\s+)?day\s+after\s+tomorrow(?=\s)/i, () => { date = addDays(todayKey, 2); })
        || take(/\s(?:today|tonight)(?=\s)/i, () => { date = todayKey; })
        || take(/\s(?:tomorrow|tmrw?|tmr)(?=\s)/i, () => { date = addDays(todayKey, 1); })
        || take(/\sin\s+(\d{1,3})\s+(days?|weeks?)(?=\s)/i, (m) => { date = addDays(todayKey, Number(m[1]) * (/^w/i.test(m[2]) ? 7 : 1)); })
        || take(/\snext\s+week(?=\s)/i, () => { date = nextWeekday(todayKey, 1, true); })
        || take(new RegExp(`\\snext\\s+${WD}(?=\\s)`, "i"), (m) => { date = nextWeekday(todayKey, wdIndex(m[1]), true); })
        || take(new RegExp(`\\s(?:on\\s+)?${WD}(?=\\s)`, "i"), (m) => { date = nextWeekday(todayKey, wdIndex(m[1]), false); })
        || take(new RegExp(`\\s(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON}(?:\\s+(\\d{4}))?(?=\\s)`, "i"), (m) => {
          date = futureDate(todayKey, MONTH_NAMES.indexOf(m[2].toLowerCase().slice(0, 3)) + 1, Number(m[1]), m[3] && Number(m[3]));
          if (!date) return false;
        })
        || take(new RegExp(`\\s(?:on\\s+)?${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?=\\s)`, "i"), (m) => {
          date = futureDate(todayKey, MONTH_NAMES.indexOf(m[1].toLowerCase().slice(0, 3)) + 1, Number(m[2]), m[3] && Number(m[3]));
          if (!date) return false;
        })
        || take(/\s(\d{4})-(\d{2})-(\d{2})(?=\s)/, (m) => {
          date = futureDate(todayKey, Number(m[2]), Number(m[3]), Number(m[1]));
          if (!date) return false;
        })
        || take(/\s(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?=\s)/, (m) => {
          const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : null;
          date = futureDate(todayKey, Number(m[2]), Number(m[1]), year); // day/month, as in Singapore
          if (!date) return false;
        });
    }

    // times
    take(/\s(?:at\s+|@\s*)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)(?=\s)/i, (m) => {
      let h = Number(m[1]);
      if (h < 1 || h > 12) return false;
      if (/pm/i.test(m[3]) && h !== 12) h += 12;
      if (/am/i.test(m[3]) && h === 12) h = 0;
      time = `${pad(h)}:${m[2] || "00"}`;
    })
      || take(/\s(?:at\s+|@\s*)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, (m) => { time = `${pad(Number(m[1]))}:${m[2]}`; })
      || take(/\s(?:at\s+)?noon(?=\s)/i, () => { time = "12:00"; })
      || take(/\s(?:at|@)\s*(\d{1,2})(?=\s)/i, (m) => {
        let h = Number(m[1]);
        if (h > 23) return false;
        if (h >= 1 && h <= 7) h += 12; // "at 3" almost always means the afternoon
        time = `${pad(h)}:00`;
      });

    text = text
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s+(?:on|at|by|due|for)$/i, "")
      .replace(/^(?:on|at|by)\s+/i, "")
      .trim();
    return { text, date, time, repeat, found };
  }

  /** "15:30" -> "3:30 pm" */
  function formatTime(time) {
    if (!TIME_RE.test(time || "")) return "";
    const [h, m] = time.split(":").map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "am" : "pm"}`;
  }

  /** Timed items first, earliest first; untimed ones keep their order after them. */
  function byTime(items) {
    return items
      .map((item, i) => ({ item, i }))
      .sort((a, b) => {
        const ta = a.item.time || "99:99";
        const tb = b.item.time || "99:99";
        return ta < tb ? -1 : ta > tb ? 1 : a.i - b.i;
      })
      .map((x) => x.item);
  }

  function setDone(days, rules, key, item, done) {
    if (item.kind === "day") {
      const task = days[key] && days[key].tasks[item.index];
      if (task) task.done = !!done;
      return;
    }
    const rule = rules.find((r) => r.id === item.ruleId);
    if (!rule) return;
    rule.done = rule.done || {};
    if (done) rule.done[key] = true; else delete rule.done[key];
  }

  /** Removes a one-off task, or skips just this day of a repeating one. */
  function removeItem(days, rules, key, item) {
    if (item.kind === "day") {
      if (days[key]) days[key].tasks.splice(item.index, 1);
      pruneDay(days, key);
      return;
    }
    const rule = rules.find((r) => r.id === item.ruleId);
    if (!rule) return;
    rule.skip = rule.skip || [];
    if (!rule.skip.includes(key)) rule.skip.push(key);
    if (rule.done) delete rule.done[key];
  }

  /** Ends a repeating task after the given day (that day keeps its occurrence). */
  function stopRepeating(rules, key, ruleId) {
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) rule.end = key;
  }

  function snippet(text, query, radius = 28) {
    const at = text.toLowerCase().indexOf(query);
    if (at < 0 || text.length <= radius * 2) return text;
    const start = Math.max(0, at - radius);
    const end = Math.min(text.length, at + query.length + radius);
    return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
  }

  /** Finds notes and tasks containing the query. Newest dates first. */
  function search(days, rules, query, limit = 30) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return [];
    const hits = [];

    Object.keys(days).forEach((key) => {
      const entry = days[key];
      if (entry.notes && entry.notes.toLowerCase().includes(q)) {
        hits.push({ key, kind: "note", text: snippet(entry.notes.replace(/\s+/g, " "), q) });
      }
      (entry.tasks || []).forEach((task) => {
        if (task.text.toLowerCase().includes(q)) {
          hits.push({ key, kind: "task", text: task.text, done: !!task.done });
        }
      });
    });

    rules.forEach((rule) => {
      if (rule.text.toLowerCase().includes(q)) {
        hits.push({ key: rule.start, kind: "repeat", text: rule.text, repeat: rule.freq });
      }
    });

    hits.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
    return hits.slice(0, limit);
  }

  /** Unfinished one-off tasks from past days, plus every task from today onward. */
  function agenda(days, rules, todayKey, options = {}) {
    const pastDays = options.pastDays ?? 60;
    const aheadDays = options.aheadDays ?? 14;
    const overdue = [];
    const upcoming = [];

    for (let n = pastDays; n >= 1; n--) {
      const key = addDays(todayKey, -n);
      const open = itemsFor(days, rules, key).filter((item) => item.kind === "day" && !item.done);
      if (open.length) overdue.push({ key, items: open });
    }
    for (let n = 0; n <= aheadDays; n++) {
      const key = addDays(todayKey, n);
      const items = itemsFor(days, rules, key);
      if (items.length) upcoming.push({ key, items });
    }
    return { overdue, upcoming };
  }

  /* ---------- Singapore time ----------
     The whole site follows Singapore time (UTC+8, no daylight saving), whatever time zone
     the device is set to. Shifting a timestamp by 8 hours and reading its UTC fields gives
     the wall clock in Singapore. */

  const SG_OFFSET_MS = 8 * 60 * 60 * 1000;

  /** The Singapore date and time at `ms` (default now). month is 0-11, weekday 0 = Sunday. */
  function sgNow(ms = Date.now()) {
    const d = new Date(ms + SG_OFFSET_MS);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      day: d.getUTCDate(),
      hours: d.getUTCHours(),
      minutes: d.getUTCMinutes(),
      seconds: d.getUTCSeconds(),
      weekday: d.getUTCDay(),
    };
  }

  /** Today's date key ("YYYY-MM-DD") in Singapore. */
  function sgTodayKey(ms = Date.now()) {
    const t = sgNow(ms);
    return dateKey(t.year, t.month, t.day);
  }

  /** The timestamp of a Singapore date and "HH:MM" time. */
  function sgTime(key, hhmm = "00:00") {
    const { y, m, d } = parseKey(key);
    const [hh, mm] = hhmm.split(":").map(Number);
    return Date.UTC(y, m - 1, d, hh, mm) - SG_OFFSET_MS;
  }

  /* ---------- Special periods (e.g. an internship) ---------- */

  // Date ranges whose weekdays get their own calendar color and a countdown, saved under
  // "plannerPeriods". PERIODS are the original internship dates: they're saved for people who used
  // the site before dates could be set (see data.js); new visitors start with none.
  const PERIODS = [
    { start: "2026-10-05", end: "2027-02-19", finish: "18:00", className: "intern", label: "Internship" },
  ];

  const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  /** Saved periods made safe to use: nothing saved means none, bad entries are dropped. */
  function cleanPeriods(saved) {
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((p) => p && KEY_RE.test(p.start) && KEY_RE.test(p.end) && p.start <= p.end)
      .map((p) => ({
        start: p.start,
        end: p.end,
        finish: TIME_RE.test(p.finish) ? p.finish : "18:00",
        className: "intern",
        label: String(p.label || "Internship").slice(0, 40),
      }));
  }

  /** The exact moment a period ends: its last day at the finishing time, Singapore time. */
  function periodEndTime(period) {
    return sgTime(period.end, period.finish || "18:00");
  }

  /** Milliseconds left split into days, hours, minutes and seconds (never negative). */
  function splitDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    };
  }

  /** The period a weekday falls in, or null (weekends never belong to a period). */
  function periodFor(key, periods = PERIODS) {
    if (isWeekendKey(key)) return null;
    return periods.find((p) => key >= p.start && key <= p.end) || null;
  }

  /** Weekdays from `fromKey` to `toKey`, both included. */
  function weekdaysBetween(fromKey, toKey) {
    let count = 0;
    for (let key = fromKey; key <= toKey; key = addDays(key, 1)) {
      if (!isWeekendKey(key)) count++;
    }
    return count;
  }

  /**
   * Where today sits in a period: "before" (with weekdays until it starts), "during"
   * (weekdays left, today included) or "after". Also the total and finished weekdays.
   */
  function periodCountdown(period, todayKey) {
    const total = weekdaysBetween(period.start, period.end);
    if (todayKey < period.start) {
      return { phase: "before", total, done: 0, left: total, untilStart: weekdaysBetween(todayKey, addDays(period.start, -1)) };
    }
    if (todayKey > period.end) return { phase: "after", total, done: total, left: 0 };
    const left = weekdaysBetween(todayKey, period.end);
    return { phase: "during", total, done: total - left, left };
  }

  const api = {
    sgNow, sgTodayKey, sgTime,
    parseQuickAdd, formatTime, byTime, nextWeekday,
    PERIODS, cleanPeriods, periodEndTime, splitDuration, periodFor, weekdaysBetween, periodCountdown,
    FREQUENCIES, dateKey, parseKey, weekdayOf, addDays, isWeekendKey,
    occursOn, itemsFor, dayStatus, addTask, setDone, removeItem, stopRepeating,
    pruneDay, ensureDay, search, agenda,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PlannerCore = api;
})(typeof window !== "undefined" ? window : globalThis);
