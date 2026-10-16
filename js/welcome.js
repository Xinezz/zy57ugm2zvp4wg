/* welcome.js - a one-minute welcome tour for new visitors on the Today page: what the site is,
   their name and what they're planning for, an optional countdown (internship, semester...), and
   their first task. People who already have data never see it; index.html#welcome replays it. */

(() => {
  "use strict";

  const replay = location.hash === "#welcome";
  if (LifeData.profile().onboardedAt && !replay) return;

  const today = LifeData.todayKey();
  const GOALS = [
    { id: "study", label: "Study", example: "Review lecture notes tmr 8pm" },
    { id: "work", label: "Internship or work", example: "Prepare for stand-up every weekday 9:30am" },
    { id: "projects", label: "Personal projects", example: "Sketch my project idea sat" },
    { id: "fitness", label: "Fitness", example: "Gym every monday 6pm" },
    { id: "habits", label: "Habits", example: "Read 10 pages daily 10pm" },
    { id: "hustle", label: "Side hustle", example: "Post an update fri 7pm" },
  ];
  const TOUR = [
    { icon: "sun", name: "Today", text: "Your tasks, progress ring, streak and countdowns." },
    { icon: "flag", name: "Calendar", text: "Month and week views. Colour-coded days." },
    { icon: "moon", name: "Focus", text: "The Lock-In Room: a timer, ambient sounds and Spotify." },
    { icon: "wrench", name: "Projects", text: "A board for everything you're building." },
    { icon: "star", name: "Me", text: "Journal, notes, achievements, timeline and settings." },
  ];

  const profile = LifeData.profile();
  const chosen = new Set(profile.goals || []);
  let step = 0;

  const dialog = h("dialog", { class: "welcome", "aria-labelledby": "welcomeTitle" });
  document.body.appendChild(dialog);

  const dots = () => h("div", { class: "welcome-dots", "aria-hidden": "true" },
    [0, 1, 2, 3].map((i) => h("span", { class: i === step ? "is-on" : i < step ? "is-done" : "" })));

  const goTo = (n) => { step = n; draw(); };

  function stepHero() {
    return [
      h("img", { class: "welcome-logo", src: "assets/notes-icon.gif", alt: "" }),
      h("h2", { id: "welcomeTitle" }, "Welcome to Mission Control"),
      h("p", { class: "welcome-lead" }, "One place to plan your days, lock in and focus, build your projects, reflect, and watch yourself level up."),
      h("div", { class: "welcome-features" },
        [["calendar", "Plan", "Tasks that understand “fri 3pm”"], ["moon", "Focus", "A timer that keeps you locked in"], ["rocket", "Build", "Projects from idea to done"], ["trophy", "Grow", "XP, streaks and achievements"]]
          .map(([icon, title, text]) => h("div", { class: "welcome-feature" }, LifeData.icon(icon === "calendar" ? "flag" : icon), h("strong", {}, title), h("span", {}, text)))),
      h("div", { class: "welcome-actions" },
        h("button", { type: "button", class: "big-btn", onclick: () => goTo(1) }, "Set it up · 1 minute"),
        h("a", { class: "welcome-link", href: "me.html#account" }, "I already use this on another device → sign in")),
    ];
  }

  function stepAbout() {
    const name = h("input", { type: "text", class: "field", id: "welcomeName", maxlength: "40", placeholder: "Your name", value: profile.name || "", autocomplete: "nickname" });
    return [
      h("h2", { id: "welcomeTitle" }, "First, a little about you"),
      h("label", { class: "label" }, "What should I call you?", name),
      h("p", { class: "welcome-q" }, "What are you planning for? Pick any."),
      h("div", { class: "welcome-chips" }, GOALS.map((g) => h("button", {
        type: "button",
        class: "chip",
        "aria-pressed": String(chosen.has(g.id)),
        onclick: (e) => {
          if (chosen.has(g.id)) chosen.delete(g.id); else chosen.add(g.id);
          e.currentTarget.setAttribute("aria-pressed", String(chosen.has(g.id)));
        },
      }, g.label))),
      h("div", { class: "welcome-actions" },
        h("button", { type: "button", class: "big-btn secondary", onclick: () => goTo(0) }, "Back"),
        h("button", { type: "button", class: "big-btn", onclick: () => { profile.name = name.value.trim().slice(0, 40); goTo(2); } }, "Next")),
    ];
  }

  function stepCountdown() {
    const saved = PlannerCore.cleanPeriods(Store.read("plannerPeriods", null))[0];
    const label = h("input", { type: "text", class: "field", maxlength: "40", value: saved ? saved.label : (chosen.has("study") && !chosen.has("work") ? "Semester" : "Internship") });
    const start = h("input", { type: "date", class: "field", value: saved ? saved.start : "" });
    const end = h("input", { type: "date", class: "field", value: saved ? saved.end : "" });
    const finish = h("input", { type: "time", class: "field", value: saved ? saved.finish : "18:00" });
    const error = h("p", { class: "welcome-error", "aria-live": "polite" });
    return [
      h("h2", { id: "welcomeTitle" }, "Counting down to something?"),
      h("p", {}, "An internship, a semester, exam season... Its weekdays turn magenta on your calendar, and Today counts down to the last day, to the second."),
      h("div", { class: "welcome-form" },
        h("label", { class: "label" }, "Name", label),
        h("label", { class: "label" }, "First day", start),
        h("label", { class: "label" }, "Last day", end),
        h("label", { class: "label" }, "Last day finishes at", finish)),
      error,
      h("div", { class: "welcome-actions" },
        h("button", { type: "button", class: "big-btn secondary", onclick: () => goTo(1) }, "Back"),
        h("button", { type: "button", class: "big-btn secondary", onclick: () => {
          if (Store.read("plannerPeriods", null) === null) Store.write("plannerPeriods", []);
          goTo(3);
        } }, "Skip"),
        h("button", { type: "button", class: "big-btn", onclick: () => {
          if (!start.value || !end.value) { error.textContent = "Pick both the first and the last day, or skip this step."; return; }
          if (end.value < start.value) { error.textContent = "The last day can't be before the first day."; return; }
          Store.write("plannerPeriods", PlannerCore.cleanPeriods([{ label: label.value.trim() || "Countdown", start: start.value, end: end.value, finish: finish.value || "18:00" }]));
          goTo(3);
        } }, "Save")),
    ];
  }

  function stepFirstTask() {
    const input = h("input", { type: "text", class: "field", maxlength: "200", placeholder: "e.g. call mom tmr 7pm", autocomplete: "off" });
    const hint = h("p", { class: "quick-hint", "aria-live": "polite" });
    const preview = () => {
      const p = LifeData.previewQuickAdd(input.value);
      hint.textContent = input.value.trim() && p.parsed.text ? `→ "${p.parsed.text}" · ${LifeData.describeWhen(p)}` : "";
    };
    input.addEventListener("input", preview);
    const examples = GOALS.filter((g) => chosen.has(g.id)).concat(chosen.size ? [] : GOALS.slice(0, 3)).slice(0, 3);
    return [
      h("h2", { id: "welcomeTitle" }, "Add your first task"),
      h("p", {}, "Type it the way you'd say it. Dates, times and repeats are picked up for you."),
      input,
      hint,
      h("div", { class: "welcome-chips" }, examples.map((g) => h("button", { type: "button", class: "chip", onclick: () => { input.value = g.example; preview(); input.focus(); } }, g.example))),
      h("p", { class: "welcome-q" }, "Your five tabs:"),
      h("ul", { class: "welcome-tour" }, TOUR.map((t) => h("li", {}, LifeData.icon(t.icon), h("strong", {}, t.name), h("span", {}, t.text)))),
      h("p", { class: "welcome-tip" }, "Tip: press Ctrl + K (or tap 🔍) on any page to jump anywhere or add a task."),
      h("div", { class: "welcome-actions" },
        h("button", { type: "button", class: "big-btn secondary", onclick: () => goTo(2) }, "Back"),
        h("button", { type: "button", class: "big-btn", onclick: () => finish(input.value) }, "Let's go!")),
    ];
  }

  function draw() {
    const steps = [stepHero, stepAbout, stepCountdown, stepFirstTask];
    dialog.replaceChildren(
      h("button", { type: "button", class: "welcome-skip", onclick: () => finish("") }, step === 0 ? "Skip tour" : "Skip"),
      dots(),
      h("div", { class: "welcome-step" }, steps[step]()));
    const first = dialog.querySelector(".welcome-step input");
    if (first) first.focus();
  }

  function finish(firstTask) {
    profile.goals = [...chosen];
    if (!profile.onboardedAt) profile.onboardedAt = LifeData.nowIso();
    LifeData.save("profile", profile);
    if (Store.read("plannerPeriods", null) === null) Store.write("plannerPeriods", []);
    if (firstTask && firstTask.trim()) LifeData.quickAdd(firstTask);
    dialog.close();
    dialog.remove();
    if (replay) history.replaceState(null, "", location.pathname);
    if (window.TodayPage) TodayPage.refresh();
    if (typeof Celebrate !== "undefined") Celebrate.confetti({ count: 140 });
    showToast(profile.name ? `You're all set, ${profile.name}!` : "You're all set!");
  }

  dialog.addEventListener("cancel", (e) => { e.preventDefault(); finish(""); });
  draw();
  dialog.showModal();
})();
