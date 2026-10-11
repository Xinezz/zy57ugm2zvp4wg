/* lockin.js - the Lock-In Room extras around the focus timer (focus.js):
   link a session to a task or project, session notes, a distraction list, ambient sounds,
   custom presets, an end-of-session reflection that updates the task/project, and focus reports. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const today = LifeData.todayKey();
  const NOTES_DRAFT = "lockinNotesDraft"; // this device only, until the session is saved

  /* ---------- linking a session to a task or project ---------- */

  function linkOptions() {
    const select = $("focusLink");
    const keep = select.value;
    const days = LifeData.load("days");
    const rules = LifeData.load("rules");
    const tasks = PlannerCore.itemsFor(days, rules, today).filter((t) => !t.done);
    const projects = LifeData.load("projects").filter((p) => p.status !== "done");

    select.replaceChildren(h("option", { value: "" }, "Nothing linked"));
    if (tasks.length) {
      select.appendChild(h("optgroup", { label: "Today's tasks" }, tasks.map((t) =>
        h("option", { value: t.kind === "day" ? `day:${t.index}` : `rule:${t.ruleId}` }, t.text))));
    }
    if (projects.length) {
      select.appendChild(h("optgroup", { label: "Workshop projects" }, projects.map((p) =>
        h("option", { value: `project:${p.id}` }, p.title || "Untitled project"))));
    }
    if ([...select.options].some((o) => o.value === keep)) select.value = keep;
  }

  function describeLink(value) {
    if (!value) return null;
    const [kind, ref] = value.split(":");
    if (kind === "project") {
      const p = LifeData.load("projects").find((x) => x.id === ref);
      return p ? { kind, project: p, text: p.title } : null;
    }
    const days = LifeData.load("days");
    const rules = LifeData.load("rules");
    const item = PlannerCore.itemsFor(days, rules, today).find((t) =>
      (kind === "day" && t.kind === "day" && String(t.index) === ref) || (kind === "rule" && t.kind === "rule" && t.ruleId === ref));
    return item ? { kind: "task", item, text: item.text } : null;
  }

  $("focusLink").addEventListener("change", () => {
    const link = describeLink($("focusLink").value);
    if (link) $("focusTask").value = link.text;
  });

  /* ---------- session notes (draft kept until the session is saved) ---------- */

  try { $("sessionNotes").value = localStorage.getItem(NOTES_DRAFT) || ""; } catch {}
  $("sessionNotes").addEventListener("input", (e) => {
    try { localStorage.setItem(NOTES_DRAFT, e.target.value); } catch {}
  });

  /* ---------- distraction list ---------- */

  let distractions = LifeData.load("distractions");

  function renderParked() {
    const open = distractions.filter((d) => !d.done);
    $("parkCount").textContent = open.length ? `${open.length} parked` : "";
    $("parkList").replaceChildren(...(open.length ? open.map((d) =>
      h("li", { class: "list-item" },
        h("span", { class: "grow" }, d.text),
        h("button", { type: "button", class: "chip small-chip", title: "Add to today's tasks", onclick: () => {
          const days = LifeData.load("days");
          days[today] = days[today] || { notes: "", tasks: [] };
          days[today].tasks = days[today].tasks || [];
          days[today].tasks.push({ text: d.text, done: false });
          LifeData.save("days", days);
          d.done = true;
          saveParked();
          linkOptions();
          showToast("Added to today's tasks.");
        } }, "To tasks"),
        h("button", { type: "button", class: "icon-btn", "aria-label": `Remove "${d.text}"`, onclick: () => { d.done = true; saveParked(); } }, "✕"),
      )) : [h("li", { class: "empty-note" }, "Nothing parked. Your mind is clear.")]));
  }

  function saveParked() {
    distractions = distractions.filter((d) => !d.done || d.date === today).slice(-200);
    LifeData.save("distractions", distractions);
    renderParked();
  }

  function park() {
    const text = $("parkInput").value.trim();
    if (!text) return;
    distractions.push({ id: LifeData.uid("d"), text, date: today, done: false });
    $("parkInput").value = "";
    saveParked();
  }

  $("parkAdd").addEventListener("click", park);
  $("parkInput").addEventListener("keydown", (e) => { if (e.key === "Enter") park(); });

  /* ---------- ambient sound (generated, no audio files) ---------- */

  const SOUNDS = [
    { id: "rain", label: "Rain" },
    { id: "waves", label: "Ocean waves" },
    { id: "brown", label: "Brown noise" },
    { id: "fire", label: "Fireplace" },
  ];
  let audio = null;
  let master = null;
  let playing = null;
  let nodes = [];
  let crackleTimer = null;

  function noiseBuffer(ctx, type) {
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (type === "brown") {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  function source(buffer) {
    const s = audio.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start();
    nodes.push(s);
    return s;
  }

  function lfo(target, rate, depth, base) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = rate;
    gain.gain.value = depth;
    target.value = base;
    osc.connect(gain).connect(target);
    osc.start();
    nodes.push(osc);
  }

  function stopAmbient() {
    nodes.forEach((n) => { try { n.stop(); } catch {} });
    nodes = [];
    clearInterval(crackleTimer);
    playing = null;
  }

  function startAmbient(id) {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createGain();
      master.connect(audio.destination);
    }
    if (audio.state === "suspended") audio.resume();
    stopAmbient();
    master.gain.value = Number($("ambientVolume").value) / 100 * 0.6;
    const white = noiseBuffer(audio, "white");
    const brown = noiseBuffer(audio, "brown");

    if (id === "rain") {
      const band = audio.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1800;
      band.Q.value = 0.6;
      const level = audio.createGain();
      level.gain.value = 0.5;
      source(white).connect(band).connect(level).connect(master);
      const low = audio.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 400;
      source(brown).connect(low).connect(master);
    } else if (id === "waves") {
      const low = audio.createBiquadFilter();
      low.type = "lowpass";
      lfo(low.frequency, 0.09, 500, 700);
      const swell = audio.createGain();
      lfo(swell.gain, 0.09, 0.45, 0.55);
      source(brown).connect(low).connect(swell).connect(master);
    } else if (id === "brown") {
      const low = audio.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 600;
      source(brown).connect(low).connect(master);
    } else if (id === "fire") {
      const low = audio.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 350;
      const rumble = audio.createGain();
      rumble.gain.value = 0.8;
      source(brown).connect(low).connect(rumble).connect(master);
      crackleTimer = setInterval(() => {
        if (Math.random() > 0.55) return;
        const pop = audio.createBufferSource();
        pop.buffer = white;
        const high = audio.createBiquadFilter();
        high.type = "highpass";
        high.frequency.value = 1500 + Math.random() * 2500;
        const env = audio.createGain();
        const t = audio.currentTime;
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.25 + Math.random() * 0.35, t + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.06);
        pop.connect(high).connect(env).connect(master);
        pop.start(t, Math.random() * 2);
        pop.stop(t + 0.12);
      }, 90);
    }
    playing = id;
  }

  function renderAmbient() {
    $("ambientBtns").replaceChildren(...SOUNDS.map((s) =>
      h("button", { type: "button", class: "chip ambient-btn", "aria-pressed": String(playing === s.id), onclick: () => {
        if (playing === s.id) stopAmbient(); else startAmbient(s.id);
        renderAmbient();
      } }, s.label)));
  }

  $("ambientVolume").addEventListener("input", (e) => {
    if (master) master.gain.value = Number(e.target.value) / 100 * 0.6;
  });

  /* ---------- custom presets ---------- */

  let presets = LifeData.load("focusPresets");

  function applyPreset(focus, rest) {
    const f = $("focusMinutes");
    const r = $("restMinutes");
    f.value = focus;
    r.value = rest;
    f.dispatchEvent(new Event("change"));
    r.dispatchEvent(new Event("change"));
  }

  function renderPresets() {
    $("customPresets").replaceChildren(...presets.map((p) =>
      h("span", { class: "custom-preset" },
        h("button", { type: "button", class: "preset-btn", onclick: () => applyPreset(p.focus, p.rest) }, `${p.focus} / ${p.rest}`),
        h("button", { type: "button", class: "icon-btn", "aria-label": `Remove preset ${p.focus} / ${p.rest}`, onclick: () => {
          presets = presets.filter((x) => x !== p);
          LifeData.save("focusPresets", presets);
          renderPresets();
        } }, "✕"))));
  }

  $("savePreset").addEventListener("click", () => {
    const focus = Number($("focusMinutes").value);
    const rest = Number($("restMinutes").value);
    if ([25, 50, 90].includes(focus) && rest === { 25: 5, 50: 10, 90: 20 }[focus]) {
      showToast("That one is already a quick pick.");
      return;
    }
    if (presets.some((p) => p.focus === focus && p.rest === rest)) {
      showToast("You already saved that preset.");
      return;
    }
    presets.push({ id: LifeData.uid("fp"), focus, rest });
    presets = presets.slice(-6);
    LifeData.save("focusPresets", presets);
    renderPresets();
    showToast(`Saved ${focus} / ${rest} as a preset.`);
  });

  /* ---------- end of session: reflection ---------- */

  let pending = null;

  document.addEventListener("focus:end", (event) => {
    const { minutes, early, start } = event.detail;
    const link = describeLink($("focusLink").value);
    pending = { minutes, early, start, link, task: $("focusTask").value.trim() || (link ? link.text : "") };

    $("reflectHeading").textContent = early ? "Session finished early" : "Session complete";
    $("reflectSummary").textContent = `${minutes} minute${minutes === 1 ? "" : "s"} locked in${pending.task ? ` on "${pending.task}"` : ""}.`;
    $("reflectText").value = "";
    $("reflectDoneRow").hidden = !(link && link.kind === "task");
    $("reflectLogRow").hidden = !(link && link.kind === "project");
    if (link && link.kind === "task") $("reflectDoneLabel").textContent = `Mark "${link.text}" as done`;
    if (link && link.kind === "project") $("reflectLogLabel").textContent = `Add this to ${link.text}'s progress log`;
    $("reflectDialog").showModal();
    $("reflectText").focus();
  });

  function saveSession(withReflection) {
    if (!pending) return;
    const accomplished = withReflection ? $("reflectText").value.trim() : "";
    const log = LifeData.load("focusLog");
    const entry = {
      id: LifeData.uid("f"),
      date: today,
      start: pending.start,
      minutes: pending.minutes,
      early: pending.early,
      task: pending.task,
      link: $("focusLink").value || "",
      projectId: pending.link && pending.link.kind === "project" ? pending.link.project.id : null,
      accomplished,
      notes: $("sessionNotes").value.trim(),
    };
    log.push(entry);
    LifeData.save("focusLog", log);

    const link = pending.link;
    if (withReflection && link && link.kind === "task" && $("reflectDone").checked) {
      const days = LifeData.load("days");
      const rules = LifeData.load("rules");
      PlannerCore.setDone(days, rules, today, link.item, true);
      LifeData.save("days", days);
      LifeData.save("rules", rules);
      $("focusLink").value = "";
    }
    if (withReflection && link && link.kind === "project" && $("reflectLog").checked) {
      const projects = LifeData.load("projects");
      const p = projects.find((x) => x.id === link.project.id);
      if (p) {
        p.logs = p.logs || [];
        p.logs.unshift({ id: LifeData.uid("l"), date: today, text: `Focus session (${pending.minutes} min)${accomplished ? `: ${accomplished}` : ""}` });
        LifeData.save("projects", projects);
      }
    }

    $("sessionNotes").value = "";
    try { localStorage.removeItem(NOTES_DRAFT); } catch {}
    pending = null;
    $("reflectDialog").close();
    linkOptions();
    renderReports();
    LifeData.checkAchievements();
    if (window.SiteNav) SiteNav.refreshLevel();
  }

  $("reflectSave").addEventListener("click", () => saveSession(true));
  $("reflectSkip").addEventListener("click", () => saveSession(false));
  $("reflectDialog").addEventListener("cancel", (e) => { e.preventDefault(); saveSession(false); });
  $("finishBtn").addEventListener("click", () => window.FocusTimer && FocusTimer.finishEarly());

  /* ---------- reports ---------- */

  function renderReports() {
    const log = LifeData.load("focusLog");
    const keys = LifeCore.lastNDays(today, 7);
    const week = log.filter((s) => s.date >= keys[0]);
    const todayStats = LifeCore.focusOn(log, today);
    const weekMinutes = week.reduce((s, x) => s + (x.minutes || 0), 0);
    const counted = LifeCore.countedSessions(week);
    const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

    $("reportStats").replaceChildren(
      h("div", { class: "stat" }, h("strong", {}, fmt(todayStats.minutes)), h("span", {}, "locked in today")),
      h("div", { class: "stat" }, h("strong", {}, String(todayStats.sessions)), h("span", {}, "sessions today")),
      h("div", { class: "stat" }, h("strong", {}, fmt(weekMinutes)), h("span", {}, "this week")),
      h("div", { class: "stat" }, h("strong", {}, counted.length ? `${Math.round(weekMinutes / Math.max(1, week.length))}m` : "-"), h("span", {}, "average session")),
    );

    const perDay = keys.map((k) => LifeCore.focusOn(log, k).minutes);
    const max = Math.max(30, ...perDay);
    $("reportChart").replaceChildren(...keys.map((k, i) =>
      h("div", { class: `chart-col${k === today ? " is-today" : ""}`, title: `${LifeData.prettyDate(k)}: ${perDay[i]} min` },
        h("div", { class: "chart-bars" }, h("div", { class: "chart-bar", style: `height:${(perDay[i] / max) * 100}%` })),
        h("span", { class: "chart-day" }, LifeData.prettyDate(k, { weekday: "short" }).slice(0, 2)),
      )));

    const bySubject = {};
    week.forEach((s) => {
      const name = s.task || "Unlabelled sessions";
      bySubject[name] = (bySubject[name] || 0) + (s.minutes || 0);
    });
    const top = Object.entries(bySubject).sort((a, b) => b[1] - a[1]).slice(0, 5);
    $("reportTop").replaceChildren(...(top.length ? top.map(([name, m]) =>
      h("li", { class: "list-item" }, h("span", { class: "grow" }, name), h("span", { class: "when" }, fmt(m))))
      : [h("li", { class: "empty-note" }, "Finish a session and it shows up here.")]));

    const recent = log.slice(-5).reverse();
    $("reportRecent").replaceChildren(...(recent.length ? recent.map((s) =>
      h("li", { class: "list-item" },
        h("span", { class: "when" }, LifeData.prettyDate(s.date, { day: "numeric", month: "short" })),
        h("span", { class: "grow" }, `${s.task || "Focus"}${s.accomplished ? ` — ${s.accomplished}` : ""}`),
        h("span", { class: "when" }, `${s.minutes}m`)))
      : [h("li", { class: "empty-note" }, "No sessions yet.")]));
  }

  linkOptions();
  renderParked();
  renderAmbient();
  renderPresets();
  renderReports();
  window.addEventListener("pagehide", stopAmbient);
})();
