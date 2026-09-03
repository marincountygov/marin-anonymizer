(() => {
  "use strict";

  const menuToggle = document.querySelector("#menu-toggle");
  const navigation = document.querySelector("#app-nav");
  const menuQuery = window.matchMedia("(max-width: 720px)");

  function closeResponsiveMenu() {
    menuToggle?.setAttribute("aria-expanded", "false");
    navigation?.removeAttribute("data-open");
  }

  if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") !== "true";
      menuToggle.setAttribute("aria-expanded", String(open));
      if (open) navigation.setAttribute("data-open", "true");
      else navigation.removeAttribute("data-open");
    });

    navigation.addEventListener("click", (event) => {
      if (event.target instanceof HTMLAnchorElement && menuQuery.matches) {
        closeResponsiveMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
        closeResponsiveMenu();
        menuToggle.focus();
      }
    });

    menuQuery.addEventListener("change", (event) => {
      if (!event.matches) closeResponsiveMenu();
    });
  }

  document.querySelectorAll(".menu").forEach((menu) => {
    const toggle = menu.querySelector(":scope > .menu-toggle");
    const panel = menu.querySelector(":scope > .menu-panel");
    if (!(toggle instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;

    function closeMenuPanel() {
      toggle.setAttribute("aria-expanded", "false");
      panel.hidden = true;
    }

    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      document.querySelectorAll(".menu-toggle[aria-expanded='true']").forEach((otherToggle) => {
        if (otherToggle === toggle) return;
        otherToggle.setAttribute("aria-expanded", "false");
        const otherPanel = otherToggle.closest(".menu")?.querySelector(":scope > .menu-panel");
        if (otherPanel instanceof HTMLElement) otherPanel.hidden = true;
      });
      toggle.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    });

    panel.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a, button")) closeMenuPanel();
    });

    document.addEventListener("click", (event) => {
      if (toggle.getAttribute("aria-expanded") === "true" && event.target instanceof Node && !menu.contains(event.target)) {
        closeMenuPanel();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        closeMenuPanel();
        toggle.focus();
      }
    });
  });

  const tabSections = Array.from(document.querySelectorAll("[data-tab-section]"));
  if (tabSections.length) {
    const tabNames = [...new Set(tabSections.map((section) => section.dataset.tabSection).filter(Boolean))];

    function showTabFromHash() {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const activeName = tabNames.includes(hash) ? hash : tabNames[0];

      tabSections.forEach((section) => {
        section.hidden = section.dataset.tabSection !== activeName;
      });

      navigation?.querySelectorAll('a[href^="#"]').forEach((link) => {
        if (link.getAttribute("href") === `#${activeName}`) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    }

    showTabFromHash();
    window.addEventListener("hashchange", showTabFromHash);
  }
})();
