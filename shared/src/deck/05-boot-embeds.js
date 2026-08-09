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
    document.querySelectorAll("[data-embed-src], [data-skill-src]").forEach(function (panel) {
      var code = panel.querySelector("code");
      if (!code) return;
      var src = panel.getAttribute("data-embed-src") || panel.getAttribute("data-skill-src");
      panel.setAttribute("aria-busy", "true");
      panel.setAttribute("role", "status");
      code.textContent = STR.embedLoading;
      fetch(src)
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
          panel.removeAttribute("role");
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
    });
  }
