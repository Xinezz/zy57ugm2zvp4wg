/* reminders.js - gentle nudges as browser notifications, while any tab of the site is open
   (minimised is fine): timed tasks when they're due, a morning summary, an evening "time to reflect",
   and the focus timer ending. Settings live on the Me page and sync like everything else; the
   permission to show notifications is per device.
   Needs shared.js, planner-core.js, life-core.js and data.js. */

const Reminders = (() => {
  "use strict";

  const DEFAULTS = { enabled: false, tasks: true, morning: "08:00", evening: "21:00", focus: true };
  const SENT_KEY = "remindersSent"; // this device only: what was already sent today
  const CHECK_MS = 20000;
  const pad = (n) => String(n).padStart(2, "0");

  const settings = () => ({ ...DEFAULTS, ...LifeData.load("reminders") });
  const supported = () => "Notification" in window;
  const permission = () => (supported() ? Notification.permission : "unsupported");

  function save(next) {
    LifeData.save("reminders", { ...settings(), ...next });
    check();
  }

  async function enable() {
    if (!supported()) return "unsupported";
    let result = Notification.permission;
    if (result === "default") result = await Notification.requestPermission();
    if (result === "granted") save({ enabled: true });
    return result;
  }

  /** Shows a notification (through the service worker when possible, which phones need). */
  async function notify(title, body, url = "index.html", tag) {
    if (permission() !== "granted") {
      if (!document.hidden && typeof showToast === "function") showToast(`${title} \u2014 ${body}`);
      return;
    }
    const options = { body, tag, icon: "assets/icons/icon-192.png", badge: "assets/icons/icon-192.png", data: { url } };
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg) { await reg.showNotification(title, options); return; }
    } catch {}
    try {
      const n = new Notification(title, options);
      n.onclick = () => { window.focus(); location.href = url; n.close(); };
    } catch {}
  }

  /* ---------- once-a-day bookkeeping, shared by every open tab ---------- */

  function sentToday(today) {
    try {
      const s = JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
      return s.date === today ? s : { date: today, ids: [] };
    } catch { return { date: today, ids: [] }; }
  }

  /** Marks an id as sent; false if another tab (or an earlier check) already sent it. */
  function claim(id, today) {
    const s = sentToday(today);
    if (s.ids.includes(id)) return false;
    s.ids.push(id);
    try { localStorage.setItem(SENT_KEY, JSON.stringify(s)); } catch {}
    return true;
  }

  const minutesOf = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

  /** Inside [at, at + window): late page opens still get a nudge, but not hours later. */
  const due = (now, at, windowMin) => /^\d\d:\d\d$/.test(at || "") && now >= minutesOf(at) && now < minutesOf(at) + windowMin;

  function check() {
    const r = settings();
    if (!r.enabled) return;
    const today = LifeData.todayKey();
    const sg = PlannerCore.sgNow();
    const now = sg.hours * 60 + sg.minutes;
    const items = LifeCore.tasksOn(LifeData.load("days"), LifeData.load("rules"), today);

    if (r.tasks) {
      items.filter((i) => i.time && !i.done && due(now, i.time, 15)).forEach((i) => {
        const id = `task:${i.kind}:${i.kind === "day" ? i.index : i.ruleId}:${i.time}`;
        if (claim(id, today)) notify(`\u23f0 ${i.text}`, `Due at ${PlannerCore.formatTime(i.time)}`, "index.html", id);
      });
    }

    if (r.morning && due(now, r.morning, 120) && claim("morning", today)) {
      const open = items.filter((i) => !i.done);
      notify(
        "Good morning \u2600\ufe0f",
        open.length ? `${open.length} task${open.length === 1 ? "" : "s"} today: ${open.slice(0, 3).map((i) => i.text).join(", ")}${open.length > 3 ? "\u2026" : ""}` : "Nothing planned yet. What's the one thing you'll finish today?",
        "index.html", "morning");
    }

    if (r.evening && due(now, r.evening, 180) && !LifeCore.entryFilled(LifeData.load("journal")[today]) && claim("evening", today)) {
      notify("Time to reflect \ud83c\udf19", "Four quick questions to wrap up your day.", "journal.html", "evening");
    }
  }

  /** Called by the focus timer when a phase ends (only notifies when you're looking elsewhere). */
  function timerDone(phase) {
    const r = settings();
    if (!r.enabled || !r.focus || !document.hidden) return;
    if (phase === "focus") notify("Focus session complete \u2728", "Nice work. Take a short break.", "focus.html", "timer");
    else notify("Break's over", "Ready to lock in again?", "focus.html", "timer");
  }

  function test() {
    notify("Reminders are on \ud83d\udd14", "This is what a nudge looks like.", "me.html", "test");
  }

  setInterval(check, CHECK_MS);
  check();
  document.addEventListener("visibilitychange", check);

  return { settings, save, enable, permission, supported, notify, timerDone, test, check, DEFAULTS };
})();
