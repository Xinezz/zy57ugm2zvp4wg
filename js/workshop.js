/* workshop.js - the Project Workshop: a board of projects being built (Backlog, In Progress,
   Testing, Completed) with milestones, notes/bugs/decisions, a progress log and links.
   Finished projects can be published straight to the Museum of Projects. */

(() => {
  "use strict";

  const { STATUS_ORDER, STATUS_LABELS, projectProgress, daysBetween } = LifeCore;
  const $ = (id) => document.getElementById(id);
  const today = LifeData.todayKey();

  let projects = LifeData.load("projects");
  let openId = null;
  let deleteTimer = null;

  const save = () => {
    LifeData.save("projects", projects);
    LifeData.checkAchievements();
    if (window.SiteNav) SiteNav.refreshLevel();
  };
  const find = (id) => projects.find((p) => p.id === id);

  function newProject(status = "backlog") {
    return {
      id: LifeData.uid("p"),
      title: "",
      status,
      description: "",
      tags: [],
      deadline: "",
      milestones: [],
      notes: [],
      logs: [],
      links: [],
      createdAt: LifeData.nowIso(),
      completedAt: null,
      museumId: null,
    };
  }

  function setStatus(project, status) {
    if (project.status === status) return;
    project.status = status;
    project.completedAt = status === "done" ? LifeData.nowIso() : null;
    project.logs.unshift({ id: LifeData.uid("l"), date: today, text: `Moved to ${STATUS_LABELS[status]}` });
  }

  function deadlineText(key) {
    if (!key) return "";
    const n = daysBetween(today, key);
    if (n < 0) return `${-n} day${n === -1 ? "" : "s"} overdue`;
    if (n === 0) return "due today";
    return `due in ${n} day${n === 1 ? "" : "s"}`;
  }

  /* ---------- the board ---------- */

  function card(project) {
    const progress = projectProgress(project);
    const ms = project.milestones || [];
    const bugs = (project.notes || []).filter((n) => n.kind === "bug" && !n.resolved).length;
    const index = STATUS_ORDER.indexOf(project.status);
    const overdue = project.deadline && project.status !== "done" && project.deadline < today;

    const move = (dir) => (event) => {
      event.stopPropagation();
      setStatus(project, STATUS_ORDER[index + dir]);
      save();
      render();
    };

    return h("article", {
      class: "project-card",
      draggable: "true",
      tabindex: "0",
      dataset: { id: project.id },
      "aria-label": `${project.title || "Untitled project"}, ${STATUS_LABELS[project.status]}`,
      onclick: () => openEditor(project.id),
      onkeydown: (e) => { if (e.key === "Enter") openEditor(project.id); },
      ondragstart: (e) => { e.dataTransfer.setData("text/plain", project.id); e.currentTarget.classList.add("dragging"); },
      ondragend: (e) => e.currentTarget.classList.remove("dragging"),
    },
      h("div", { class: "project-card-title" }, project.title || "Untitled project"),
      project.tags.length ? h("div", { class: "project-tags" }, project.tags.map((t) => h("span", { class: "tag" }, t))) : null,
      h("div", { class: "bar" }, h("span", { style: `width:${Math.round(progress * 100)}%` })),
      h("div", { class: "project-meta" },
        h("span", {}, ms.length ? `${ms.filter((m) => m.done).length}/${ms.length} milestones` : `${Math.round(progress * 100)}%`),
        bugs ? h("span", { class: "bug-count" }, `${bugs} open bug${bugs > 1 ? "s" : ""}`) : null,
        project.museumId ? h("span", { class: "published" }, "In museum") : null,
      ),
      project.deadline && project.status !== "done"
        ? h("div", { class: `project-deadline${overdue ? " overdue" : ""}` }, deadlineText(project.deadline))
        : null,
      h("div", { class: "card-moves" },
        index > 0 ? h("button", { type: "button", class: "move-btn", "aria-label": `Move to ${STATUS_LABELS[STATUS_ORDER[index - 1]]}`, onclick: move(-1) }, "◀") : h("span"),
        index < STATUS_ORDER.length - 1 ? h("button", { type: "button", class: "move-btn", "aria-label": `Move to ${STATUS_LABELS[STATUS_ORDER[index + 1]]}`, onclick: move(1) }, "▶") : h("span"),
      ),
    );
  }

  function render() {
    const board = $("board");
    board.replaceChildren();
    STATUS_ORDER.forEach((status) => {
      const items = projects.filter((p) => p.status === status);
      const column = h("section", {
        class: `kanban-col col-${status}`,
        "aria-label": STATUS_LABELS[status],
        ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add("drop-target"); },
        ondragleave: (e) => e.currentTarget.classList.remove("drop-target"),
        ondrop: (e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("drop-target");
          const project = find(e.dataTransfer.getData("text/plain"));
          if (project && project.status !== status) {
            setStatus(project, status);
            save();
            render();
          }
        },
      },
        h("header", { class: "kanban-head" },
          h("span", {}, STATUS_LABELS[status]),
          h("span", { class: "kanban-count" }, String(items.length)),
        ),
        h("div", { class: "kanban-cards" },
          items.length ? items.map(card) : h("p", { class: "empty-note" }, status === "backlog" ? "Ideas waiting to start." : "Nothing here yet."),
        ),
        status === "backlog" ? h("button", { type: "button", class: "chip add-card", onclick: () => createAndOpen("backlog") }, "+ Add project") : null,
      );
      board.appendChild(column);
    });
  }

  /* ---------- the editor ---------- */

  function createAndOpen(status) {
    const project = newProject(status);
    projects.unshift(project);
    save();
    render();
    openEditor(project.id, true);
  }

  function renderEditorLists(p) {
    const progress = projectProgress(p);
    $("pProgressBar").style.width = `${Math.round(progress * 100)}%`;
    $("pProgressText").textContent = `${Math.round(progress * 100)}% complete${p.deadline ? ` · ${deadlineText(p.deadline)}` : ""}`;

    $("pMilestones").replaceChildren(...(p.milestones.length ? p.milestones.map((m) =>
      h("li", { class: `list-item${m.done ? " is-done" : ""}` },
        h("input", { type: "checkbox", checked: m.done, "aria-label": `Milestone done: ${m.text}`, onchange: (e) => {
          m.done = e.target.checked;
          m.doneAt = m.done ? LifeData.nowIso() : null;
          if (m.done) p.logs.unshift({ id: LifeData.uid("l"), date: today, text: `Milestone reached: ${m.text}` });
          changed(p);
        } }),
        h("span", { class: "grow" }, m.text),
        m.due ? h("span", { class: "when" }, LifeData.prettyDate(m.due, { day: "numeric", month: "short" })) : null,
        h("button", { type: "button", class: "icon-btn", "aria-label": `Delete milestone ${m.text}`, onclick: () => { p.milestones = p.milestones.filter((x) => x !== m); changed(p); } }, "✕"),
      )) : [h("li", { class: "empty-note" }, "Break the project into steps you can tick off.")]));

    const kindLabel = { note: "Note", bug: "Bug", decision: "Decision" };
    $("pNotes").replaceChildren(...(p.notes.length ? p.notes.map((n) =>
      h("li", { class: `list-item note-${n.kind}${n.resolved ? " is-done" : ""}` },
        n.kind === "bug" ? h("input", { type: "checkbox", checked: n.resolved, "aria-label": "Bug fixed", title: "Fixed", onchange: (e) => { n.resolved = e.target.checked; changed(p); } }) : null,
        h("span", { class: `kind-badge kind-${n.kind}` }, kindLabel[n.kind]),
        h("span", { class: "grow" }, n.text),
        h("span", { class: "when" }, LifeData.prettyDate(n.date, { day: "numeric", month: "short" })),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Delete", onclick: () => { p.notes = p.notes.filter((x) => x !== n); changed(p); } }, "✕"),
      )) : [h("li", { class: "empty-note" }, "Record ideas, bugs to fix and why you chose each design.")]));

    const logs = p.logs.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    $("pLog").replaceChildren(...(logs.length ? logs.map((l) =>
      h("li", { class: "list-item" },
        h("span", { class: "when" }, LifeData.prettyDate(l.date, { day: "numeric", month: "short", year: "numeric" })),
        h("span", { class: "grow" }, l.text),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Delete log entry", onclick: () => { p.logs = p.logs.filter((x) => x !== l); changed(p); } }, "✕"),
      )) : [h("li", { class: "empty-note" }, "A dated diary of progress on this project.")]));

    $("pLinks").replaceChildren(...(p.links.length ? p.links.map((link) => {
      const href = safeUrl(link.url);
      return h("li", { class: "list-item" },
        href ? h("a", { class: "grow", href, target: "_blank", rel: "noopener noreferrer" }, link.label || link.url) : h("span", { class: "grow" }, `${link.label} (${link.url})`),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Delete link", onclick: () => { p.links = p.links.filter((x) => x !== link); changed(p); } }, "✕"),
      );
    }) : [h("li", { class: "empty-note" }, "GitHub repositories, CAD files, demo videos...")]));

    const notes = LifeData.load("vault").filter((n) => (n.projectIds || []).includes(p.id));
    $("pVault").replaceChildren(...(notes.length ? notes.map((n) =>
      h("li", { class: "list-item" },
        h("a", { class: "grow", href: `vault.html#${encodeURIComponent(n.id)}` }, n.title || "Untitled note"),
        h("span", { class: "tag" }, n.category || "note"),
      )) : [h("li", { class: "empty-note" }, "Link notes to this project from the Knowledge Vault.")]));

    const pub = $("pPublish");
    if (p.museumId) {
      pub.textContent = "View in museum";
      pub.disabled = false;
    } else {
      pub.textContent = "Publish to museum";
      pub.disabled = p.status !== "done";
      pub.title = p.status === "done" ? "" : "Move the project to Completed first";
    }
  }

  function changed(p) {
    save();
    renderEditorLists(p);
    render();
  }

  function openEditor(id, isNew = false) {
    const p = find(id);
    if (!p) return;
    openId = id;
    disarmDelete();
    $("pTitleHeading").textContent = isNew ? "New project" : p.title || "Project";
    $("pTitle").value = p.title;
    $("pStatus").value = p.status;
    $("pDeadline").value = p.deadline || "";
    $("pDescription").value = p.description || "";
    $("pTags").value = (p.tags || []).join(", ");
    $("pLogDate").value = today;
    ["pMilestoneText", "pMilestoneDue", "pNoteText", "pLogText", "pLinkLabel", "pLinkUrl"].forEach((f) => { $(f).value = ""; });
    renderEditorLists(p);
    $("projectDialog").showModal();
    if (isNew) $("pTitle").focus();
  }

  const current = () => find(openId);

  $("pTitle").addEventListener("input", (e) => { const p = current(); p.title = e.target.value; $("pTitleHeading").textContent = p.title || "Project"; save(); render(); });
  $("pDescription").addEventListener("input", (e) => { current().description = e.target.value; save(); });
  $("pTags").addEventListener("change", (e) => {
    current().tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12);
    changed(current());
  });
  $("pDeadline").addEventListener("change", (e) => { current().deadline = e.target.value; changed(current()); });
  $("pStatus").addEventListener("change", (e) => { setStatus(current(), e.target.value); changed(current()); });

  function addOnEnter(input, add) {
    $(input).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  }

  function addMilestone() {
    const text = $("pMilestoneText").value.trim();
    if (!text) return;
    current().milestones.push({ id: LifeData.uid("m"), text, due: $("pMilestoneDue").value || "", done: false, doneAt: null });
    $("pMilestoneText").value = "";
    $("pMilestoneDue").value = "";
    changed(current());
  }

  function addNote() {
    const text = $("pNoteText").value.trim();
    if (!text) return;
    current().notes.unshift({ id: LifeData.uid("n"), kind: $("pNoteKind").value, text, date: today, resolved: false });
    $("pNoteText").value = "";
    changed(current());
  }

  function addLog() {
    const text = $("pLogText").value.trim();
    if (!text) return;
    current().logs.unshift({ id: LifeData.uid("l"), date: $("pLogDate").value || today, text });
    $("pLogText").value = "";
    changed(current());
  }

  function addLink() {
    const url = $("pLinkUrl").value.trim();
    if (!url) return;
    current().links.push({ label: $("pLinkLabel").value.trim() || url, url });
    $("pLinkLabel").value = "";
    $("pLinkUrl").value = "";
    changed(current());
  }

  $("pMilestoneAdd").addEventListener("click", addMilestone);
  $("pNoteAdd").addEventListener("click", addNote);
  $("pLogAdd").addEventListener("click", addLog);
  $("pLinkAdd").addEventListener("click", addLink);
  addOnEnter("pMilestoneText", addMilestone);
  addOnEnter("pNoteText", addNote);
  addOnEnter("pLogText", addLog);
  addOnEnter("pLinkUrl", addLink);

  /* ---------- publish to museum ---------- */

  $("pPublish").addEventListener("click", () => {
    const p = current();
    if (p.museumId) {
      location.href = "museum.html?wing=projects";
      return;
    }
    if (p.status !== "done") return;
    const works = LifeData.load("museumProjects");
    const firstLink = p.links.find((l) => safeUrl(l.url));
    const work = {
      id: `w-${Date.now()}`,
      title: p.title || "Untitled project",
      year: String(new Date(p.completedAt || Date.now()).getFullYear()),
      medium: p.tags.join(", "),
      description: (p.description || "").slice(0, 400),
      link: firstLink ? firstLink.url : "",
      image: "",
      pixel: false,
    };
    works.push(work);
    if (!LifeData.save("museumProjects", works)) return;
    p.museumId = work.id;
    p.logs.unshift({ id: LifeData.uid("l"), date: today, text: "Published to the Museum of Projects" });
    changed(p);
    showToast("Published to the Museum of Projects. Add a picture there to finish the frame.");
  });

  /* ---------- delete (two clicks) ---------- */

  function disarmDelete() {
    clearTimeout(deleteTimer);
    deleteTimer = null;
    $("pDelete").textContent = "Delete project";
    $("pDelete").classList.remove("armed");
  }

  $("pDelete").addEventListener("click", () => {
    if (!deleteTimer) {
      $("pDelete").textContent = "Click again to delete";
      $("pDelete").classList.add("armed");
      deleteTimer = setTimeout(disarmDelete, 4000);
      return;
    }
    disarmDelete();
    projects = projects.filter((p) => p.id !== openId);
    openId = null;
    save();
    $("projectDialog").close();
    render();
  });

  /* ---------- dialog plumbing ---------- */

  $("projectDialog").addEventListener("close", () => {
    const p = current();
    if (p && !p.title.trim() && !p.description.trim() && !p.milestones.length && !p.notes.length && !p.links.length) {
      projects = projects.filter((x) => x !== p);
      save();
    }
    openId = null;
    render();
  });

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $(b.dataset.close).close()));
  $("projectDialog").addEventListener("click", (e) => { if (e.target === $("projectDialog")) $("projectDialog").close(); });
  $("newProjectBtn").addEventListener("click", () => createAndOpen("backlog"));

  render();
  LifeData.checkAchievements({ announce: false });

  const wanted = decodeURIComponent(location.hash.slice(1));
  if (wanted && find(wanted)) openEditor(wanted);
})();
