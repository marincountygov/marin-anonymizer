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

  // MarinOS banner menu: refresh from the published catalog so new apps
  // appear automatically. If the fetch fails, the static links in index.html
  // remain in place as a fallback. Cache the catalog for six hours.
  const marinosMenuPanel = document.querySelector("#marinos-menu-panel");
  if (marinosMenuPanel) {
    const CATALOG_URL = "https://marincountygov.github.io/marin-os/catalog.json";
    const CACHE_KEY = "marinos-catalog-cache-v2";
    const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

    function readCatalogCache() {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.entries) || typeof parsed.fetchedAt !== "number") return null;
        if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
        return parsed.entries;
      } catch {
        return null;
      }
    }

    function writeCatalogCache(entries) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ entries, fetchedAt: Date.now() }));
      } catch {
        // Storage unavailable; fetching again on the next load is acceptable.
      }
    }

    function renderMarinosMenu(entries) {
      if (!Array.isArray(entries)) return;
      const current = window.location.href;
      const items = entries.filter((entry) => entry && entry.url && entry.name && !current.startsWith(entry.url));
      if (!items.length) return;

      const allLink = marinosMenuPanel.querySelector(".marinos-menu__all");
      marinosMenuPanel.querySelectorAll("a:not(.marinos-menu__all)").forEach((link) => link.remove());

      const links = items
        .map((entry) => {
          const icon =
            entry.icon && entry.icon.viewBox && entry.icon.markup
              ? `<span class="marinos-menu__icon" aria-hidden="true"><svg viewBox="${entry.icon.viewBox}">${entry.icon.markup}</svg></span>`
              : "";
          return `<a href="${entry.url}">${icon}${entry.name}</a>`;
        })
        .join("");

      if (allLink) allLink.insertAdjacentHTML("beforebegin", links);
      else marinosMenuPanel.insertAdjacentHTML("beforeend", links);
    }

    const cachedEntries = readCatalogCache();
    if (cachedEntries) {
      renderMarinosMenu(cachedEntries);
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      fetch(CATALOG_URL, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bad response"))))
        .then((entries) => {
          writeCatalogCache(entries);
          renderMarinosMenu(entries);
        })
        .catch(() => {
          // Leave the page's static banner links as-is.
        })
        .finally(() => clearTimeout(timeout));
    }
  }

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
