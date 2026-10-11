/* nav.js - the top menu bar on every page. On narrow screens it folds into a "Menu" button.
   Shows your level when LifeCore and LifeData are loaded. */

(() => {
  "use strict";

  const PAGES = [
    { href: "index.html", label: "Home", icon: "M3 11l9-8 9 8v10h-6v-6H9v6H3z" },
    { href: "planner.html", label: "Planner", icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4" },
    { href: "focus.html", label: "Lock-In", icon: "M12 3a9 9 0 1 0 9 9M12 7v5l3 3" },
    { href: "workshop.html", label: "Workshop", icon: "M14 6l4 4-9 9H5v-4zM13 7l4 4" },
    { href: "journal.html", label: "Journal", icon: "M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2zM6 17h13" },
    { href: "vault.html", label: "Vault", icon: "M4 6h16v13H4zM8 6V4h8v2M12 11v4M10 13h4" },
    { href: "achievements.html", label: "Achievements", icon: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6" },
    { href: "timeline.html", label: "Timeline", icon: "M12 3v18M12 7h6M12 12H6M12 17h6" },
    { href: "gallery.html", label: "Gallery", icon: "M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4" },
  ];

  const path = location.pathname.split("/").pop() || "index.html";
  const current = path === "museum.html" ? "gallery.html" : path;

  const icon = (d) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.setAttribute("aria-label", "Main menu");

  const links = PAGES.map((p) => {
    const here = p.href === current ? ' aria-current="page"' : "";
    return `<a class="site-link" href="${p.href}"${here}>${icon(p.icon)}<span>${p.label}</span></a>`;
  }).join("");

  nav.innerHTML = `
    <a class="site-brand" href="index.html" aria-label="Home"><img src="assets/notes-icon.gif" alt=""><span>Mission Control</span></a>
    <button type="button" class="site-menu-btn" aria-expanded="false" aria-controls="siteLinks">${icon("M4 7h16M4 12h16M4 17h16")}<span>Menu</span></button>
    <div class="site-links" id="siteLinks">${links}</div>
    <a class="site-level" href="achievements.html" hidden title="Your level"><span class="site-level-num"></span><span class="site-level-bar"><span></span></span></a>
  `;

  const loader = document.getElementById("loader");
  if (loader && loader.parentNode === document.body) loader.after(nav);
  else document.body.prepend(nav);
  document.body.classList.add("has-site-nav");

  const menuBtn = nav.querySelector(".site-menu-btn");
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) && nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });

  // While locked in to a focus session, the menu doesn't let you wander off.
  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (link && document.body.classList.contains("locked-in")) {
      event.preventDefault();
      if (typeof showToast === "function") showToast("Pause the timer to leave the Lock-In Room.");
    }
  });

  /** Updates the level badge (call again after earning XP). */
  function refreshLevel() {
    if (typeof LifeCore === "undefined" || typeof LifeData === "undefined") return;
    const xp = LifeCore.computeXp(LifeData.all());
    const badge = nav.querySelector(".site-level");
    badge.hidden = false;
    badge.querySelector(".site-level-num").textContent = `Lv ${xp.level}`;
    badge.querySelector(".site-level-bar span").style.width = `${Math.round(xp.progress * 100)}%`;
    badge.setAttribute("aria-label", `Level ${xp.level}, ${xp.current} of ${xp.needed} XP to the next level`);
    badge.title = `Level ${xp.level} · ${xp.current}/${xp.needed} XP to level ${xp.level + 1}`;
  }

  window.SiteNav = { refreshLevel };
  refreshLevel();
})();
