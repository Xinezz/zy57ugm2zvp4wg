/* me.js - the "Me" page: your profile and level, a hub for the Journal, Vault, Achievements,
   Timeline and Trophy room, and settings (account and sync, reminders, reading font, backups). */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const today = LifeData.todayKey();

  /* ---------- profile ---------- */

  function renderProfile(d) {
    const profile = d.profile;
    $("nameInput").value = profile.name || "";

    const picture = Store.readText("plannerDisplayPicture");
    const avatar = $("avatar");
    avatar.replaceChildren();
    if (picture && picture.startsWith("data:image/")) {
      avatar.appendChild(h("img", { src: picture, alt: "" }));
    } else {
      avatar.textContent = (profile.name || "?").trim().charAt(0).toUpperCase() || "?";
    }

    const xp = LifeCore.computeXp(d);
    $("profileMedal").textContent = xp.level;
    $("profileBar").style.width = `${Math.round(xp.progress * 100)}%`;
    $("profileXp").textContent = `Level ${xp.level} · ${xp.total} XP · ${xp.needed - xp.current} XP to level ${xp.level + 1}`;

    // the earliest thing you recorded, or when you joined
    const firstKey = [Object.keys(d.days).sort()[0], ...Object.keys(d.journal).sort().slice(0, 1), LifeCore.keyOfIso(profile.onboardedAt)]
      .filter(Boolean).sort()[0];
    const since = firstKey ? LifeData.prettyDate(firstKey, { month: "long", year: "numeric" }) : "";
    const keys = LifeCore.lastNDays(today, 182);
    const streak = LifeCore.activeStreak(LifeCore.activityByDay(d, keys), today);
    $("profileSub").textContent = [
      streak.current ? `🔥 ${streak.current}-day streak` : "Start a streak today",
      since ? `here since ${since}` : "",
    ].filter(Boolean).join(" · ");
  }

  $("nameInput").addEventListener("change", (e) => {
    const profile = LifeData.load("profile");
    profile.name = e.target.value.trim().slice(0, 40);
    LifeData.save("profile", profile);
    render();
    showToast(profile.name ? `Nice to meet you, ${profile.name}!` : "Name removed.");
  });

  /* ---------- hub: everything under "Me" ---------- */

  function renderHub(d) {
    const journalDone = LifeCore.entryFilled(d.journal[today]);
    const journalStreak = LifeCore.journalStreak(d.journal, today);
    const unlocked = LifeCore.achievements(d).filter((a) => a.unlocked).length;
    const total = LifeCore.achievements(d).length;
    const moments = LifeCore.timelineEvents(d, typeof UPDATE_SEEDS !== "undefined" ? UPDATE_SEEDS : []).length;
    const showcased = d.projects.filter((p) => p.museumId).length;
    const focusMinutes = d.focusLog.reduce((n, s) => n + (s.minutes || 0), 0);
    const focusHours = focusMinutes >= 60 ? `${Math.floor(focusMinutes / 60)}h ${focusMinutes % 60}m` : `${focusMinutes}m`;

    const cards = [
      { href: "journal.html", icon: "book", title: "Journal", stat: journalDone ? "Today's reflection is done ✓" : "Today's reflection is waiting", sub: journalStreak ? `${journalStreak}-day streak` : "Four quick questions a day" },
      { href: "vault.html", icon: "chip", title: "Knowledge Vault", stat: `${d.vault.length} note${d.vault.length === 1 ? "" : "s"}`, sub: "Snippets, formulas, fixes and interview prep" },
      { href: "achievements.html", icon: "trophy", title: "Achievements", stat: `${unlocked} of ${total} unlocked`, sub: `${d.skills.length} skill${d.skills.length === 1 ? "" : "s"} · ${d.badges.length} custom badge${d.badges.length === 1 ? "" : "s"}` },
      { href: "timeline.html", icon: "flag", title: "Life Timeline", stat: `${moments} moment${moments === 1 ? "" : "s"}`, sub: "Plus a time machine for any past day" },
      { href: "gallery.html", icon: "frame", title: "Trophy room", stat: `${showcased} project${showcased === 1 ? "" : "s"} on show`, sub: "The museums of updates and projects" },
      { href: "focus.html", icon: "moon", title: "Focus record", stat: `${focusHours} locked in, all time`, sub: `${d.focusLog.length} session${d.focusLog.length === 1 ? "" : "s"} · reports in the Lock-In Room` },
    ];
    $("hubGrid").replaceChildren(...cards.map((c) => {
      const card = h("a", { class: "card hub-card", href: c.href },
        LifeData.icon(c.icon),
        h("div", { class: "hub-text" },
          h("strong", {}, c.title),
          h("span", { class: "hub-stat" }, c.stat),
          h("p", {}, c.sub)));
      return card;
    }));
  }

  /* ---------- reminders ---------- */

  function renderReminders() {
    const r = Reminders.settings();
    const perm = Reminders.permission();
    const on = r.enabled && perm === "granted";
    $("notifyStatus").textContent = perm === "unsupported"
      ? "This browser can't show notifications. Reminders will appear inside the site instead."
      : perm === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser's site settings, then come back."
        : on ? "Reminders are on for this device." : "Get a nudge when tasks are due, plus a morning summary and an evening reflection reminder.";
    $("notifyOn").hidden = on || perm === "denied" || perm === "unsupported";
    $("notifyOn").textContent = r.enabled && perm !== "granted" ? "Allow notifications on this device" : "Turn on reminders";
    $("notifyTest").hidden = !on;
    $("reminderOpts").classList.toggle("is-off", !r.enabled);
    $("remTasks").checked = r.tasks;
    $("remFocus").checked = r.focus;
    $("remMorningOn").checked = !!r.morning;
    $("remMorning").value = r.morning || Reminders.DEFAULTS.morning;
    $("remEveningOn").checked = !!r.evening;
    $("remEvening").value = r.evening || Reminders.DEFAULTS.evening;
  }

  $("notifyOn").addEventListener("click", async () => {
    const result = await Reminders.enable();
    if (result === "granted") {
      showToast("Reminders are on.");
      Reminders.test();
    } else if (result === "denied") {
      showToast("Notifications were blocked. You can allow them in your browser's site settings.");
    }
    renderReminders();
  });
  $("notifyTest").addEventListener("click", () => Reminders.test());

  const saveReminders = () => {
    Reminders.save({
      tasks: $("remTasks").checked,
      focus: $("remFocus").checked,
      morning: $("remMorningOn").checked ? $("remMorning").value || Reminders.DEFAULTS.morning : "",
      evening: $("remEveningOn").checked ? $("remEvening").value || Reminders.DEFAULTS.evening : "",
    });
    renderReminders();
  };
  ["remTasks", "remFocus", "remMorningOn", "remEveningOn", "remMorning", "remEvening"].forEach((id) =>
    $(id).addEventListener("change", saveReminders));

  /* ---------- reading font ---------- */

  function renderFont() {
    const current = ReadingFont.get();
    document.querySelectorAll(".font-choice").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.font === current)));
  }
  document.querySelectorAll(".font-choice").forEach((b) => b.addEventListener("click", () => {
    ReadingFont.set(b.dataset.font);
    renderFont();
  }));

  /* ---------- backups ---------- */

  let importTimer = null;
  $("exportBtn").addEventListener("click", () => {
    const count = downloadBackup();
    $("backupStatus").textContent = `Saved ${count} item${count === 1 ? "" : "s"} to a backup file in your downloads.`;
  });
  $("importBtn").addEventListener("click", () => {
    if (!importTimer) {
      $("importBtn").textContent = "This replaces everything. Click again";
      $("importBtn").classList.add("armed");
      importTimer = setTimeout(() => {
        importTimer = null;
        $("importBtn").textContent = "Import backup";
        $("importBtn").classList.remove("armed");
      }, 4000);
      return;
    }
    clearTimeout(importTimer);
    importTimer = null;
    $("importBtn").textContent = "Import backup";
    $("importBtn").classList.remove("armed");
    $("importFile").click();
  });
  $("importFile").addEventListener("change", async () => {
    const file = $("importFile").files[0];
    $("importFile").value = "";
    if (!file) return;
    try {
      const count = await restoreBackup(file);
      $("backupStatus").textContent = `Restored ${count} item${count === 1 ? "" : "s"}. Reloading...`;
      setTimeout(() => location.reload(), 700);
    } catch (err) {
      $("backupStatus").textContent = err.message;
    }
  });

  /* ---------- start ---------- */

  function render() {
    const d = LifeData.all();
    renderProfile(d);
    renderHub(d);
  }

  render();
  renderReminders();
  renderFont();
  // jump to a settings section when linked to one (me.html#reminders)
  const target = location.hash && document.getElementById(location.hash.slice(1));
  if (target) setTimeout(() => target.scrollIntoView({ block: "start", behavior: "smooth" }), 150);
})();
