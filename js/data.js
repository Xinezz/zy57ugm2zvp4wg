/* data.js - loading and saving the life data used across pages, plus achievement unlock tracking.
   Needs shared.js (Store, showToast) and life-core.js. Every key starts with "planner" so Cloud sync
   and backups include it automatically. */

const LifeData = (() => {
  "use strict";

  const KEYS = {
    days: "plannerData",
    rules: "plannerRepeats",
    journal: "plannerJournal",
    projects: "plannerWorkshop",
    vault: "plannerVault",
    focusLog: "plannerFocusLog",
    skills: "plannerSkills",
    badges: "plannerBadges",
    countdowns: "plannerCountdowns",
    events: "plannerTimeline",
    achievementDates: "plannerAchievementDates",
    distractions: "plannerDistractions",
    focusPresets: "plannerFocusPresets",
    museumProjects: "plannerProjects",
  };

  const OBJECTS = new Set(["days", "journal", "achievementDates"]);

  function load(name) {
    const value = Store.read(KEYS[name], null);
    if (OBJECTS.has(name)) return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Array.isArray(value) ? value : [];
  }

  function save(name, value) {
    const ok = Store.write(KEYS[name], value);
    if (!ok && typeof showToast === "function") showToast("Couldn't save. Your browser storage may be full.");
    return ok;
  }

  /** Everything LifeCore needs, in one object. */
  function all() {
    const d = {};
    Object.keys(KEYS).forEach((name) => { d[name] = load(name); });
    return d;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = () => new Date().toISOString();

  function prettyDate(key, options = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
    if (!key) return "";
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, options);
  }

  /* Badge icons: fixed SVG paths (stroke drawn), so building them from markup is safe. */
  const ICONS = {
    star: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z",
    check: "M5 12.5l4.5 4.5L19 7",
    trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
    flame: "M12 21c-4 0-6-3-6-6 0-4 4-6 4-11 3 2 5 5 5 8 1-1 1.5-2 1.5-3 1.5 1.5 2.5 3.5 2.5 6 0 3-3 6-7 6z",
    book: "M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 1h13",
    moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
    wrench: "M14.5 5.5a4 4 0 0 0 5 5L12 18a2.1 2.1 0 0 1-3-3l7.5-7.5zM14.5 5.5L17 3",
    flag: "M5 21V4M5 4h11l-2 4 2 4H5",
    rocket: "M12 3c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10zM12 9.5a1.5 1.5 0 1 0 0 .1M9 16l-2 4M15 16l2 4",
    frame: "M4 4h16v16H4zM7 7h10v10H7zM7 14l3-3 3 3 2-2 2 2",
    chip: "M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
    bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
    heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
    medal: "M8 3l4 6 4-6M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 12.5l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3z",
    code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
    gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
    music: "M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z",
  };

  function icon(name) {
    const span = document.createElement("span");
    span.className = "badge-icon";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name] || ICONS.star}"/></svg>`;
    return span;
  }

  /** Records the first time each achievement is unlocked and announces new ones. */
  function checkAchievements({ announce = true } = {}) {
    if (typeof LifeCore === "undefined") return [];
    const d = all();
    const dates = d.achievementDates;
    const fresh = LifeCore.achievements(d).filter((a) => a.unlocked && !dates[a.id]);
    if (!fresh.length) return [];
    fresh.forEach((a) => { dates[a.id] = todayKey(); });
    save("achievementDates", dates);
    if (announce && typeof showToast === "function") {
      showToast(fresh.length === 1 ? `Achievement unlocked: ${fresh[0].title}!` : `${fresh.length} achievements unlocked!`);
    }
    if (typeof UiSound !== "undefined") UiSound.play("check");
    return fresh;
  }

  return { KEYS, ICONS, icon, load, save, all, todayKey, uid, nowIso, prettyDate, checkAchievements };
})();
