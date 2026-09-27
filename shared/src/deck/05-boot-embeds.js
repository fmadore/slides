  /* ---- boot --------------------------------------------------------------- */
  /* Chrome that doesn't depend on slide content — safe to run before init. */
  function decorateChrome() {
    if (CFG.talkTitle && !document.title.trim()) document.title = CFG.talkTitle;
    injectFilters();   // make url(#duo-green) / url(#duo-navy) available deck-wide
  }

  /* Per-slide decoration: fill every [data-contact] slot from DECK_CONFIG. */
  function decorateSlides() {
    document.querySelectorAll("[data-contact]").forEach(function (slot) {
      slot.classList.add("contact");
      slot.innerHTML = contactHTML();
    });
  }

  /* Load any [data-embed-src] / [data-skill-src] panel from its vendored file
     and syntax-highlight it. Generic: optional data-error-message overrides the
     failure text, optional data-source-url adds a link to the original.
     Loading / success / failure states are exposed accessibly (aria-busy,
     role=status/alert), and the slide is re-fitted once the embed resolves. */
  function loadFileEmbeds() {
    return Promise.all(Array.from(document.querySelectorAll("[data-embed-src], [data-skill-src]")).map(function (panel) {
      var code = panel.querySelector("code");
      if (!code) return;
      var src = panel.getAttribute("data-embed-src") || panel.getAttribute("data-skill-src");
      panel.setAttribute("aria-busy", "true");
      panel.setAttribute("role", "status");
      code.textContent = STR.embedLoading;
      return fetch(src)
        .then(function (r) { if (!r.ok) throw r.status; return r.text(); })
        .then(function (text) {
          code.textContent = text;
          var hp = (typeof Reveal !== "undefined" && Reveal.getPlugin) ? Reveal.getPlugin("highlight") : null;
          var hl = window.hljs || (hp && hp.hljs);
          if (hl) {
            delete code.dataset.highlighted;
            code.classList.remove("hljs");
            try { hl.highlightElement(code); } catch (e) {}
          }
          panel.removeAttribute("aria-busy");
          // A loaded panel is a scroll region again (initScrollRegions).
          if (panel.matches(SCROLL_REGIONS)) panel.setAttribute("role", "region");
          else panel.removeAttribute("role");
          refitAfterLoad(panel);
        })
        .catch(function () {
          var msg = panel.getAttribute("data-error-message") || STR.embedError;
          var url = panel.getAttribute("data-source-url");
          code.textContent = msg + (url ? " — " + STR.embedSource + ": " + url : "");
          panel.removeAttribute("aria-busy");
          panel.setAttribute("role", "alert");
          refitAfterLoad(panel);
        });
    }));
  }

  /* ---- scroll regions: reachable from the keyboard -----------------------
     A panel that scrolls its own content — .scroll-panel, or any per-deck
     scroller that opts in with data-scroll-region="its name" — was somewhere
     a mouse wheel could reach and a keyboard could not: nothing in it takes
     focus (WCAG 2.1.1). Each becomes a named, focusable region. While one has
     focus the vertical arrows scroll it rather than reaching reveal, but
     Left/Right, Page Up/Down and Space still drive the deck — those are what
     presenter remotes send, so a panel clicked mid-talk can never capture the
     clicker. Focus is released when the slide changes, so a panel the room
     can no longer see never keeps the keys. */
  var SCROLL_REGIONS = ".scroll-panel, [data-scroll-region]";
  function initScrollRegions() {
    var regions = document.querySelectorAll(".reveal .slides :is(" + SCROLL_REGIONS + ")");
    if (!regions.length) return;
    regions.forEach(function (region) {
      if (!region.hasAttribute("tabindex")) region.setAttribute("tabindex", "0");
      if (!region.hasAttribute("aria-label") && !region.hasAttribute("aria-labelledby")) {
        region.setAttribute("aria-label", region.getAttribute("data-scroll-region") || STR.scrollRegion);
      }
      // A file embed still loading holds role=status; it takes region on load.
      if (!region.hasAttribute("role")) region.setAttribute("role", "region");
      region.addEventListener("keydown", function (e) {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.stopPropagation();
      });
    });
    Reveal.on("slidechanged", function () {
      var active = document.activeElement;
      if (active && active.matches && active.matches(SCROLL_REGIONS)) active.blur();
    });
  }
