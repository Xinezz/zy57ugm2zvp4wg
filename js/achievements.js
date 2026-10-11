/* achievements.js - the Achievements page: level and XP, milestone badges,
   custom badges for real accomplishments, skills and personal bests. */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const today = LifeData.todayKey();
  const BADGE_ICONS = ["trophy", "medal", "star", "rocket", "bolt", "heart", "code", "chip", "gear", "wrench", "book", "music", "flag", "sun"];

  /* Two-click delete: the first click arms the button, the second confirms. */
  function armDelete(button, run) {
    if (button.classList.contains("armed")) { run(); return; }
    button.classList.add("armed");
    button.textContent = "Click again to delete";
    setTimeout(() => { button.classList.remove("armed"); button.textContent = "Delete"; }, 3000);
  }

  function render() {
    LifeData.checkAchievements();
    const d = LifeData.all();
    renderLevel(d);
    renderAchievements(d);
    renderBadges(d);
    renderSkills(d);
    renderBests(d);
    if (window.SiteNav) SiteNav.refreshLevel();
  }

  function renderLevel(d) {
    const xp = LifeCore.computeXp(d);
    $("levelNumber").textContent = xp.level;
    $("levelTitle").textContent = `Level ${xp.level}`;
    $("levelXp").textContent = `${xp.total} XP`;
    $("levelBar").style.width = `${Math.round(xp.progress * 100)}%`;
    $("levelNext").textContent = `${xp.needed - xp.current} XP to level ${xp.level + 1}`;

    const lines = xp.lines.filter((l) => l.count > 0);
    $("xpList").replaceChildren(...(lines.length ? lines.map((l) =>
      h("li", { class: "list-item" },
        h("span", { class: "grow" }, l.source),
        h("span", { class: "muted" }, `${l.count} × ${l.each}`),
        h("strong", { class: "xp-amount" }, `${l.xp} XP`)))
      : [h("li", { class: "empty-note" }, "Finish a task, write a reflection or complete a focus session to earn your first XP.")]));
  }

  function badgeCard({ iconName, title, description, date, locked, progress, onclick }) {
    const card = h(onclick ? "button" : "div", {
      class: `ach${locked ? " is-locked" : ""}`,
      type: onclick ? "button" : null,
      onclick,
    },
    LifeData.icon(iconName),
    h("span", { class: "ach-text" },
      h("strong", {}, title),
      h("span", { class: "muted" }, description),
      progress ? h("span", { class: "bar ach-bar" }, h("span", { style: `width:${progress}%` })) : null,
      date ? h("span", { class: "when" }, LifeData.prettyDate(date, { day: "numeric", month: "short", year: "numeric" })) : null));
    return card;
  }

  function renderAchievements(d) {
    const list = LifeCore.achievements(d);
    const unlocked = list.filter((a) => a.unlocked);
    $("achCount").textContent = `${unlocked.length} / ${list.length} unlocked`;
    const sorted = [...unlocked, ...list.filter((a) => !a.unlocked)];
    $("achGrid").replaceChildren(...sorted.map((a) => badgeCard({
      iconName: a.icon,
      title: a.title,
      description: a.unlocked || a.target === 1 ? a.description : `${a.description} (${a.value}/${a.target})`,
      date: a.unlocked ? d.achievementDates[a.id] : null,
      locked: !a.unlocked,
      progress: !a.unlocked && a.target > 1 ? Math.round((a.value / a.target) * 100) : 0,
    })));
  }

  function renderBadges(d) {
    const badges = d.badges.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $("badgeGrid").replaceChildren(...(badges.length ? badges.map((b) => badgeCard({
      iconName: b.icon, title: b.title, description: b.description || "", date: b.date, onclick: () => openBadge(b),
    })) : [h("p", { class: "empty-note" }, "No custom badges yet.")]));
  }

  function renderSkills(d) {
    const groups = {};
    d.skills.forEach((s) => { (groups[s.category || "General"] = groups[s.category || "General"] || []).push(s); });
    $("skillAreas").replaceChildren(...Object.keys(groups).map((g) => h("option", { value: g })));
    const names = Object.keys(groups).sort();
    $("skillGroups").replaceChildren(...(names.length ? names.map((g) =>
      h("div", { class: "skill-group" },
        h("h3", { class: "section-title" }, `${g} `, h("span", { class: "muted" }, `Lv ${groups[g].length}`)),
        h("div", { class: "skill-tags" }, groups[g]
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .map((s) => h("button", { type: "button", class: "tag clickable", title: s.note || LifeData.prettyDate(s.date), onclick: () => openSkill(s) }, s.name)))))
      : [h("p", { class: "empty-note" }, "No skills logged yet.")]));
  }

  function renderBests(d) {
    $("bestList").replaceChildren(...LifeCore.personalBests(d).map((b) =>
      h("li", { class: "list-item" },
        h("span", { class: "grow" }, b.title),
        h("strong", { class: b.value ? "best-value" : "muted" }, b.value || "Not yet"),
        b.date ? h("span", { class: "when" }, LifeData.prettyDate(b.date, { day: "numeric", month: "short" })) : null)));
  }

  /* ---------- custom badges ---------- */

  let editingBadge = null;
  let chosenIcon = "trophy";

  function renderIconPicker() {
    $("bIcons").replaceChildren(...BADGE_ICONS.map((name) => {
      const button = h("button", { type: "button", class: "icon-choice", role: "radio", "aria-checked": String(name === chosenIcon), "aria-label": name, onclick: () => { chosenIcon = name; renderIconPicker(); } });
      button.appendChild(LifeData.icon(name));
      return button;
    }));
  }

  function openBadge(badge) {
    editingBadge = badge || null;
    $("badgeDialogTitle").textContent = badge ? "Edit badge" : "New badge";
    $("bTitle").value = badge ? badge.title : "";
    $("bDescription").value = badge ? badge.description || "" : "";
    $("bDate").value = badge ? badge.date : today;
    chosenIcon = badge ? badge.icon : "trophy";
    $("bDelete").hidden = !badge;
    renderIconPicker();
    $("badgeDialog").showModal();
    $("bTitle").focus();
  }

  $("addBadge").addEventListener("click", () => openBadge(null));

  $("bSave").addEventListener("click", () => {
    const title = $("bTitle").value.trim();
    if (!title) { $("bTitle").focus(); showToast("Give the badge a name."); return; }
    const badges = LifeData.load("badges");
    const data = { title, description: $("bDescription").value.trim(), date: $("bDate").value || today, icon: chosenIcon };
    if (editingBadge) {
      const found = badges.find((b) => b.id === editingBadge.id);
      if (found) Object.assign(found, data);
    } else {
      badges.push({ id: LifeData.uid("b"), ...data });
      showToast(`Badge earned: ${title}! +${LifeCore.XP.badge} XP`);
    }
    LifeData.save("badges", badges);
    $("badgeDialog").close();
    render();
  });

  $("bDelete").addEventListener("click", (e) => armDelete(e.currentTarget, () => {
    LifeData.save("badges", LifeData.load("badges").filter((b) => b.id !== editingBadge.id));
    $("badgeDialog").close();
    render();
  }));

  /* ---------- skills ---------- */

  let editingSkill = null;

  function openSkill(skill) {
    editingSkill = skill || null;
    $("skillDialogTitle").textContent = skill ? "Edit skill" : "Log a skill";
    $("sName").value = skill ? skill.name : "";
    $("sCategory").value = skill ? skill.category || "" : "";
    $("sDate").value = skill ? skill.date : today;
    $("sNote").value = skill ? skill.note || "" : "";
    $("sDelete").hidden = !skill;
    $("skillDialog").showModal();
    $("sName").focus();
  }

  $("addSkill").addEventListener("click", () => openSkill(null));

  $("sSave").addEventListener("click", () => {
    const name = $("sName").value.trim();
    if (!name) { $("sName").focus(); showToast("Name the skill first."); return; }
    const skills = LifeData.load("skills");
    const data = { name, category: $("sCategory").value.trim() || "General", date: $("sDate").value || today, note: $("sNote").value.trim() };
    if (editingSkill) {
      const found = skills.find((s) => s.id === editingSkill.id);
      if (found) Object.assign(found, data);
    } else {
      skills.push({ id: LifeData.uid("s"), ...data });
      const level = skills.filter((s) => s.category === data.category).length;
      showToast(`${data.category} levelled up to Lv ${level}! +${LifeCore.XP.skill} XP`);
    }
    LifeData.save("skills", skills);
    $("skillDialog").close();
    render();
  });

  $("sDelete").addEventListener("click", (e) => armDelete(e.currentTarget, () => {
    LifeData.save("skills", LifeData.load("skills").filter((s) => s.id !== editingSkill.id));
    $("skillDialog").close();
    render();
  }));

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $(b.dataset.close).close()));

  render();
})();
