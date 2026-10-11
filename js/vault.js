/* vault.js - the Knowledge Vault: searchable notes by category and tag, with code snippets,
   linked to Workshop projects (the link shows on both sides). */

(() => {
  "use strict";

  const CATEGORIES = [
    { id: "electronics", label: "Arduino & electronics" },
    { id: "coding", label: "Coding & snippets" },
    { id: "troubleshooting", label: "Troubleshooting" },
    { id: "formulas", label: "Engineering formulas" },
    { id: "interview", label: "Interview prep" },
    { id: "resources", label: "Useful resources" },
    { id: "other", label: "Other" },
  ];
  const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || { label: "Other" }).label;
  const $ = (id) => document.getElementById(id);

  let notes = LifeData.load("vault");
  const projects = LifeData.load("projects");
  let filter = { query: "", category: "", tag: "" };
  let viewingId = null;
  let editingId = null;
  let deleteTimer = null;

  const save = () => {
    LifeData.save("vault", notes);
    LifeData.checkAchievements();
    if (window.SiteNav) SiteNav.refreshLevel();
  };

  /** Shows note text with ``` code blocks as monospace boxes and links clickable. Never uses innerHTML. */
  function renderBody(text, target) {
    target.replaceChildren();
    const parts = String(text || "").split(/```/);
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        const code = part.replace(/^[a-z0-9+#-]*\n/i, "").replace(/\n$/, "");
        target.appendChild(h("pre", { class: "code" }, h("code", {}, code)));
        return;
      }
      part.split(/\n{2,}/).forEach((para) => {
        if (!para.trim()) return;
        const p = h("p", {});
        para.split(/(https?:\/\/[^\s)]+)/).forEach((bit, j) => {
          if (j % 2 === 1) p.appendChild(h("a", { href: bit, target: "_blank", rel: "noopener noreferrer" }, bit));
          else p.appendChild(document.createTextNode(bit));
        });
        target.appendChild(p);
      });
    });
    if (!target.childNodes.length) target.appendChild(h("p", { class: "empty-note" }, "This note is empty."));
  }

  const preview = (text) => String(text || "").replace(/```[\s\S]*?```/g, "[code]").replace(/\s+/g, " ").trim().slice(0, 140);

  /* ---------- sidebar and grid ---------- */

  function renderSide() {
    const counts = {};
    notes.forEach((n) => { counts[n.category] = (counts[n.category] || 0) + 1; });
    const item = (id, label, count) => h("li", {},
      h("button", { type: "button", class: "cat-btn", "aria-pressed": String(filter.category === id), onclick: () => { filter.category = filter.category === id ? "" : id; render(); } },
        h("span", {}, label), h("span", { class: "kanban-count" }, String(count))));
    $("categories").replaceChildren(item("", "All notes", notes.length), ...CATEGORIES.map((c) => item(c.id, c.label, counts[c.id] || 0)));

    const tags = [...new Set(notes.flatMap((n) => n.tags || []))].sort();
    $("tagCloud").replaceChildren(...(tags.length ? tags.map((t) =>
      h("button", { type: "button", class: "tag clickable", "aria-pressed": String(filter.tag === t), onclick: () => { filter.tag = filter.tag === t ? "" : t; render(); } }, t))
      : [h("span", { class: "empty-note" }, "Tags you add appear here.")]));
  }

  function renderGrid() {
    const found = LifeCore.searchVault(notes, filter);
    const active = [filter.category && catLabel(filter.category), filter.tag && `#${filter.tag}`, filter.query && `"${filter.query}"`].filter(Boolean);
    $("resultCount").textContent = `${found.length} note${found.length === 1 ? "" : "s"}${active.length ? ` · ${active.join(" · ")}` : ""}`;

    $("noteGrid").replaceChildren(...(found.length ? found.map((n) => {
      const linked = (n.projectIds || []).map((id) => projects.find((p) => p.id === id)).filter(Boolean);
      return h("article", { class: "note-card", tabindex: "0", onclick: () => openView(n.id), onkeydown: (e) => { if (e.key === "Enter") openView(n.id); } },
        h("div", { class: "note-cat" }, catLabel(n.category)),
        h("h3", { class: "note-title" }, n.title || "Untitled note"),
        h("p", { class: "note-preview" }, preview(n.body) || "No text yet."),
        h("div", { class: "note-foot" },
          (n.tags || []).slice(0, 4).map((t) => h("span", { class: "tag" }, t)),
          linked.length ? h("span", { class: "linked" }, `Linked: ${linked.map((p) => p.title || "project").join(", ")}`) : null,
        ));
    }) : [h("div", { class: "card empty-vault" },
      h("p", {}, notes.length ? "No notes match that search." : "Your vault is empty. Save your first note: an Arduino trick, a code snippet, a formula or an interview answer."),
      notes.length ? null : h("button", { type: "button", class: "chip", onclick: () => openEdit(null) }, "Write the first note"))]));
  }

  function render() {
    renderSide();
    renderGrid();
  }

  $("vaultSearch").addEventListener("input", (e) => { filter.query = e.target.value; renderGrid(); });

  /* ---------- reading a note ---------- */

  function openView(id) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    viewingId = id;
    $("viewTitle").textContent = n.title || "Untitled note";
    $("viewMeta").replaceChildren(
      h("span", { class: "tag" }, catLabel(n.category)),
      ...(n.tags || []).map((t) => h("span", { class: "tag" }, t)),
      h("span", { class: "muted" }, `Updated ${LifeData.prettyDate(LifeCore.keyOfIso(n.updatedAt || n.createdAt))}`),
    );
    renderBody(n.body, $("viewBody"));
    const linked = (n.projectIds || []).map((pid) => projects.find((p) => p.id === pid)).filter(Boolean);
    $("viewProjects").replaceChildren(...(linked.length ? linked.map((p) =>
      h("li", { class: "list-item" },
        h("a", { class: "grow", href: `workshop.html#${encodeURIComponent(p.id)}` }, p.title || "Untitled project"),
        h("span", { class: "tag" }, LifeCore.STATUS_LABELS[p.status] || p.status)))
      : [h("li", { class: "empty-note" }, "Not linked to a project yet. Edit the note to link one.")]));
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
    $("noteView").showModal();
  }

  $("noteView").addEventListener("close", () => { history.replaceState(null, "", location.pathname); });
  $("viewEdit").addEventListener("click", () => { $("noteView").close(); openEdit(viewingId); });

  /* ---------- writing a note ---------- */

  function openEdit(id) {
    const n = id ? notes.find((x) => x.id === id) : null;
    editingId = n ? n.id : null;
    disarmDelete();
    $("editHeading").textContent = n ? "Edit note" : "New note";
    $("nTitle").value = n ? n.title : "";
    $("nCategory").replaceChildren(...CATEGORIES.map((c) => h("option", { value: c.id }, c.label)));
    $("nCategory").value = n ? n.category : filter.category || "electronics";
    $("nTags").value = n ? (n.tags || []).join(", ") : filter.tag || "";
    $("nBody").value = n ? n.body : "";
    $("nError").hidden = true;
    $("nDelete").hidden = !n;
    const chosen = new Set(n ? n.projectIds || [] : []);
    $("nProjects").replaceChildren(...(projects.length ? projects.map((p) =>
      h("label", { class: "pick" },
        h("input", { type: "checkbox", value: p.id, checked: chosen.has(p.id) }),
        h("span", {}, p.title || "Untitled project")))
      : [h("p", { class: "empty-note" }, "No Workshop projects yet. Create one in the Workshop to link it here.")]));
    $("noteEdit").showModal();
    $("nTitle").focus();
  }

  $("nSave").addEventListener("click", () => {
    const title = $("nTitle").value.trim();
    const body = $("nBody").value;
    if (!title && !body.trim()) {
      $("nError").textContent = "Give the note a title or some text first.";
      $("nError").hidden = false;
      return;
    }
    const fields = {
      title: title || "Untitled note",
      category: $("nCategory").value,
      tags: $("nTags").value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10),
      body,
      projectIds: [...$("nProjects").querySelectorAll("input:checked")].map((i) => i.value),
      updatedAt: LifeData.nowIso(),
    };
    if (editingId) {
      Object.assign(notes.find((x) => x.id === editingId), fields);
    } else {
      const note = { id: LifeData.uid("v"), createdAt: LifeData.nowIso(), ...fields };
      notes.unshift(note);
      editingId = note.id;
    }
    save();
    $("noteEdit").close();
    render();
    openView(editingId);
  });

  function disarmDelete() {
    clearTimeout(deleteTimer);
    deleteTimer = null;
    $("nDelete").textContent = "Delete";
    $("nDelete").classList.remove("armed");
  }

  $("nDelete").addEventListener("click", () => {
    if (!deleteTimer) {
      $("nDelete").textContent = "Click again to delete";
      $("nDelete").classList.add("armed");
      deleteTimer = setTimeout(disarmDelete, 4000);
      return;
    }
    disarmDelete();
    notes = notes.filter((x) => x.id !== editingId);
    save();
    $("noteEdit").close();
    render();
  });

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => $(b.dataset.close).close()));
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
  $("newNoteBtn").addEventListener("click", () => openEdit(null));

  render();
  const wanted = decodeURIComponent(location.hash.slice(1));
  if (wanted && notes.some((n) => n.id === wanted)) openView(wanted);
})();
