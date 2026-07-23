/* =============================================================================
   deck.js — the reusable engine for the Africa Multiple / Bayreuth deck.

   This file is GENERIC. You should not need to edit it per talk. Each deck
   only edits index.html: its slides, and the `window.DECK_CONFIG` block near
   the top of that file (presenter, talk metadata, contact links).

   What it does, in order:
     • fills every [data-contact] slot with icon links from DECK_CONFIG
     • initialises reveal.js (custom nav, no stock chrome) with plugins
     • builds the running head (current section) and persistent footer
     • builds the auto table-of-contents overlay from [data-toc] sections
     • keeps everything in sync on each slide change

   Keyboard:  ←/→ navigate · T table of contents · O overview · F fullscreen
              S speaker notes · ? help · Esc closes overlays
   ============================================================================= */
(function () {
  "use strict";

  var CFG = window.DECK_CONFIG || {};
  CFG.links = CFG.links || {};

  /* ---- engine UI strings, language-aware (from <html lang>; default English).
     Add a language by extending I18N; decks opt in via <html lang="xx">. -------- */
  var LANG = (CFG.lang || document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  var I18N = {
    en: { contents: "Contents", overview: "overview", close: "close", prev: "Previous slide", next: "Next slide", tocOpen: "Open table of contents", tocAria: "Table of contents", closeAria: "Close",
          imageViewer: "Image viewer", imageClose: "Close image", imageView: "View image full screen", imagePrev: "Previous image", imageNext: "Next image",
          embedLoading: "Loading file…", embedError: "Could not load the file.", embedSource: "View the source",
          frameUnavailable: "Live view unavailable — it needs a network connection.", frameOpen: "Open the site" },
    fr: { contents: "Sommaire", overview: "aperçu", close: "fermer", prev: "Diapo précédente", next: "Diapo suivante", tocOpen: "Ouvrir le sommaire", tocAria: "Sommaire", closeAria: "Fermer",
          imageViewer: "Visionneuse d’images", imageClose: "Fermer l’image", imageView: "Afficher l’image en plein écran", imagePrev: "Image précédente", imageNext: "Image suivante",
          embedLoading: "Chargement du fichier…", embedError: "Impossible de charger le fichier.", embedSource: "Voir la source",
          frameUnavailable: "Aperçu en direct indisponible — une connexion réseau est requise.", frameOpen: "Ouvrir le site" }
  };
  var STR = I18N[LANG] || I18N.en;

  /* Dev-mode flags: ?check outlines overflow + shows fit scales; ?no-fit (or
     ?audit) disables auto-fitting so authored overflow is visible raw. */
  var CHECK_MODE = /[?&](check|audit)\b/.test(location.search);
  var NO_FIT = /[?&](no-fit|audit)\b/.test(location.search);
  var PRINT = /[?&]print-pdf\b/.test(location.search);

  // Folder this script lives in (e.g. .../shared/) so engine assets resolve no
  // matter how deep the talk page sits. Captured while currentScript is valid.
  var SCRIPT_BASE = (function () {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName("script");
      for (var i = 0; i < all.length; i++) if (/deck\.js(\?|$)/.test(all[i].src)) { s = all[i]; break; }
    }
    return s && s.src ? s.src.replace(/[^\/]*$/, "") : "";
  })();

  /* ---- inline icons (stroke icons inherit currentColor; ORCID keeps its mark) */
  var ICON = {
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    toc:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><line x1="9" y1="6" x2="20" y2="6"/><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"/><line x1="9" y1="12" x2="20" y2="12"/><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/><line x1="9" y1="18" x2="20" y2="18"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    github:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
    globe:'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M3 12h18M12 2.8c2.6 2.6 3.9 6.2 3.9 9.2s-1.3 6.6-3.9 9.2c-2.6-2.6-3.9-6.2-3.9-9.2S9.4 5.4 12 2.8z"/></svg>',
    mail: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.2"/><path d="M3 6.5l9 6 9-6"/></svg>',
    orcid:'<svg viewBox="0 0 256 256" aria-hidden="true"><circle cx="128" cy="128" r="128" fill="#A6CE39"/><g fill="#fff"><path d="M86.3 186.2H70.9V79.1h15.4v107.1z"/><path d="M108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7 0-21.5-13.7-39.7-43.7-39.7h-23.7v79.4z"/><circle cx="78.6" cy="56.8" r="10.1"/></g></svg>',
    linkedin:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
  };

  function elem(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function tidyUrl(u) {
    return String(u || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  }

  /* ---- contact links from DECK_CONFIG.links, into every [data-contact] slot */
  function contactHTML() {
    var L = CFG.links, out = [];
    function row(href, icon, label) {
      return '<a href="' + href + '" target="_blank" rel="noopener"><span class="ico">' + icon + "</span><span>" + label + "</span></a>";
    }
    if (L.github)  out.push(row(L.github, ICON.github, tidyUrl(L.github).replace(/^github\.com\//, "")));
    if (L.website) out.push(row(L.website, ICON.globe, tidyUrl(L.website)));
    if (L.orcid)   out.push(row(L.orcid, ICON.orcid, tidyUrl(L.orcid).replace(/^orcid\.org\//, "")));
    if (L.linkedin)out.push(row(L.linkedin, ICON.linkedin, tidyUrl(L.linkedin).replace(/^linkedin\.com\/in\//, "")));
    if (L.email)   out.push(row("mailto:" + L.email, ICON.mail, L.email));
    return out.join("");
  }

  /* ---- footer (single persistent element, updated per slide) -------------- */
  var footer, counterCur, counterTot, btnPrev, btnNext;
  function buildFooter(reveal) {
    var amLogo = CFG.logoMark || (SCRIPT_BASE + "logo-africamultiple.png");
    footer = elem(
      '<div class="deck-footer">' +
        '<div class="foot-left">' +
          (CFG.logoMark === false ? "" : '<a class="foot-logo" href="https://www.africamultiple.uni-bayreuth.de/en/index.html" target="_blank" rel="noopener" style="display:flex"><img src="' + amLogo + '" alt="Africa Multiple — Cluster of Excellence"></a>') +
          '<span class="foot-title"><b>' + (CFG.talkShort || CFG.talkTitle || "") + "</b>" +
            (CFG.venue ? " · " + CFG.venue : "") + "</span>" +
        "</div>" +
        '<div class="deck-nav">' +
          '<span class="counter"><span class="cur">1</span><span> / </span><span class="tot">1</span></span>' +
          '<button class="deck-btn prev" title="' + STR.prev + ' (←)" aria-label="' + STR.prev + '">' + ICON.prev + "</button>" +
          '<button class="deck-btn next" title="' + STR.next + ' (→)" aria-label="' + STR.next + '">' + ICON.next + "</button>" +
          '<button class="deck-btn toc-btn" title="' + STR.tocAria + ' (T)" aria-label="' + STR.tocOpen + '">' + ICON.toc + "<span>" + STR.contents + "</span></button>" +
        "</div>" +
      "</div>"
    );
    reveal.appendChild(footer);
    counterCur = footer.querySelector(".counter .cur");
    counterTot = footer.querySelector(".counter .tot");
    btnPrev = footer.querySelector(".prev");
    btnNext = footer.querySelector(".next");
    btnPrev.addEventListener("click", function () { Reveal.prev(); });
    btnNext.addEventListener("click", function () { Reveal.next(); });
    footer.querySelector(".toc-btn").addEventListener("click", toggleTOC);
  }

  /* ---- running head (current section, like a book) ------------------------ */
  var runhead, runSec;
  var HERO = ["cover", "section", "closing", "statement", "media"];
  function buildRunhead(reveal) {
    runhead = elem('<div class="deck-runhead" aria-hidden="true"><span class="rh-sec"></span></div>');
    reveal.appendChild(runhead);
    runSec = runhead.querySelector(".rh-sec");
  }
  /* The running section is the latest section title / [data-toc] at or before the
     current slide — resolved by scanning forward so TOC jumps stay correct. */
  function sectionLabelFor(h) {
    var hSlides = Reveal.getHorizontalSlides(), label = "";
    for (var i = 0; i <= h && i < hSlides.length; i++) {
      var sec = hSlides[i];
      if (sec.classList.contains("section")) {
        var t = sec.querySelector("h2");
        label = (t ? t.textContent : sec.getAttribute("data-toc") || label).trim();
      } else if (sec.getAttribute("data-toc")) {
        label = sec.getAttribute("data-toc");
      }
    }
    return label;
  }

  /* ---- table-of-contents overlay ------------------------------------------ */
  var overlay, tocItems = [];
  function buildTOC(reveal) {
    var hSlides = Reveal.getHorizontalSlides();
    var entries = [];
    hSlides.forEach(function (sec, h) {
      var label = sec.getAttribute("data-toc");
      if (label) entries.push({ h: h, label: label });
    });
    if (!entries.length) return; // no TOC requested

    var rows = entries.map(function (e, i) {
      var n = String(i + 1).padStart(2, "0");
      var folio = String(e.h + 1).padStart(2, "0");
      return '<li><button class="toc-item" data-h="' + e.h + '">' +
               '<span class="toc-num">' + n + "</span>" +
               '<span class="toc-label">' + e.label + "</span>" +
               '<span class="toc-dots" aria-hidden="true"></span>' +
               '<span class="toc-folio">' + folio + "</span>" +
             "</button></li>";
    }).join("");

    overlay = elem(
      '<div class="toc-overlay" role="dialog" aria-modal="true" aria-label="' + STR.tocAria + '">' +
        '<div class="toc-panel">' +
          '<button class="toc-close" aria-label="' + STR.closeAria + '">' + ICON.close + "</button>" +
          '<div class="toc-head"><div>' +
            '<div class="toc-eyebrow">' + (CFG.tocEyebrow || STR.contents) + "</div>" +
            '<h2 class="toc-title">' + (CFG.talkTitle || "Overview") + "</h2>" +
          "</div></div>" +
          '<ul class="toc-list">' + rows + "</ul>" +
          '<div class="toc-foot"><span>' + (CFG.presenter || "") +
            "</span><span><kbd>T</kbd> " + STR.contents.toLowerCase() + " &nbsp; <kbd>O</kbd> " + STR.overview + " &nbsp; <kbd>Esc</kbd> " + STR.close + "</span></div>" +
        "</div>" +
      "</div>"
    );
    reveal.appendChild(overlay);
    tocItems = Array.prototype.slice.call(overlay.querySelectorAll(".toc-item"));
    tocItems.forEach(function (btn) {
      btn.addEventListener("click", function () {
        Reveal.slide(parseInt(btn.getAttribute("data-h"), 10), 0);
        closeTOC();
      });
    });
    overlay.querySelector(".toc-close").addEventListener("click", closeTOC);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeTOC(); });
    setDialogHidden(overlay, true);
  }
  /* Keep an overlay's accessibility state in sync with its visual state:
     `inert` (with aria-hidden fallback) while closed, interactive while open. */
  function setDialogHidden(dialog, hiddenState) {
    if (!dialog) return;
    if ("inert" in dialog) dialog.inert = hiddenState;
    if (hiddenState) dialog.setAttribute("aria-hidden", "true");
    else dialog.removeAttribute("aria-hidden");
  }
  /* Focus an element once its dialog is actually visible: the overlays fade in
     via a visibility transition, and focus() is a no-op while the computed
     visibility is still hidden (the first frame after the class flips). */
  function focusWhenVisible(el) {
    if (!el) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.focus(); }); });
  }
  var tocLastFocus = null;
  function openTOC()  {
    if (!overlay) return;
    tocLastFocus = document.activeElement;
    overlay.classList.add("open");
    setDialogHidden(overlay, false);
    markCurrentTOC();
    // Move focus into the dialog (current entry if any, else the first).
    focusWhenVisible(overlay.querySelector(".toc-item.current") || overlay.querySelector(".toc-item"));
  }
  function closeTOC() {
    if (!overlay) return;
    overlay.classList.remove("open");
    setDialogHidden(overlay, true);
    if (tocLastFocus && tocLastFocus.focus) tocLastFocus.focus(); // restore focus to the trigger
    tocLastFocus = null;
  }
  function toggleTOC(){ if (overlay) (overlay.classList.contains("open") ? closeTOC() : openTOC()); }
  /* While the TOC is open, keys must act on the DIALOG, never on the deck
     behind it: Tab is trapped inside, arrows move between entries, Escape
     closes, and everything else is stopped before reveal's own key handler.
     Runs in the capture phase on document so it wins over Reveal. */
  function tocKeydown(e) {
    if (!overlay || !overlay.classList.contains("open")) return;
    if (e.key === "Tab") { trapTOCFocus(e); e.stopPropagation(); return; }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeTOC(); return; }
    var f = Array.prototype.slice.call(
      overlay.querySelectorAll(".toc-item")
    ).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    var idx = f.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); if (f.length) f[(idx + 1 + f.length) % f.length].focus(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); if (f.length) f[(idx - 1 + f.length) % f.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); if (f.length) f[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); if (f.length) f[f.length - 1].focus(); }
    // Whatever the key, never let it drive the presentation behind the dialog.
    e.stopPropagation();
  }
  /* Keep Tab inside the open dialog (simple focus trap). */
  function trapTOCFocus(e) {
    if (e.key !== "Tab" || !overlay || !overlay.classList.contains("open")) return;
    var f = Array.prototype.slice.call(
      overlay.querySelectorAll(".toc-close, .toc-item")
    ).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !overlay.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !overlay.contains(a))) { e.preventDefault(); first.focus(); }
  }
  function markCurrentTOC() {
    if (!overlay) return;
    var h = Reveal.getIndices().h;
    var active = null;
    tocItems.forEach(function (btn) {
      var bh = parseInt(btn.getAttribute("data-h"), 10);
      if (bh <= h) active = btn;
      btn.classList.remove("current");
      btn.removeAttribute("aria-current");
    });
    if (active) { active.classList.add("current"); active.setAttribute("aria-current", "page"); }
  }

  /* ---- per-slide sync ----------------------------------------------------- */
  var DARK = ["section", "closing", "media"];
  function update() {
    var cur = Reveal.getCurrentSlide();
    var hCount = Reveal.getHorizontalSlides().length;
    var h = Reveal.getIndices().h;
    if (counterCur) counterCur.textContent = String(h + 1).padStart(2, "0");
    if (counterTot) counterTot.textContent = String(hCount).padStart(2, "0");
    if (btnPrev) btnPrev.disabled = Reveal.isFirstSlide();
    if (btnNext) btnNext.disabled = Reveal.isLastSlide();

    var darkAttr = cur && cur.getAttribute("data-footer");
    var isDark = darkAttr ? darkAttr === "dark"
      : !!(cur && DARK.some(function (c) { return cur.classList.contains(c); }));
    if (footer) footer.classList.toggle("on-dark", isDark);
    var vp = document.querySelector(".reveal-viewport");
    if (vp) vp.classList.toggle("deck-dark", isDark);

    // Running head: the current section on content slides; hidden on title pages.
    if (runhead) {
      var isHero = !!(cur && HERO.some(function (c) { return cur.classList.contains(c); }));
      runhead.hidden = isHero;
      if (!isHero && runSec) runSec.textContent = sectionLabelFor(h);
    }
    markCurrentTOC();
    fitSlide(cur);
    animateCounts(cur);
  }

  /* ---- auto-fit: scale a slide's content down ONLY if it overflows the safe
     area (gold-rule clearance on hero slides; footer reserve below). Slides that
     already fit are never touched; an overflowing one is wrapped in an absolutely
     placed .fit box and scaled to fit. Runs once per slide, after webfonts settle
     so the measurement is real — and again (forced) when delayed content such as
     an image or a file embed resolves and changes the slide's height.

     Fitting is VISIBLE, not silent: every fitted slide carries data-fit with the
     applied scale; a scale below FIT_WARN logs a warning; below FIT_FAIL the
     slide is stamped data-fit-fail (a validation failure) unless the author
     explicitly allows it with a data-fit-allow attribute on the <section>.
     ?no-fit / ?audit disables fitting entirely so raw overflow can be seen. --- */
  var FIT_WARN = 0.95, FIT_FAIL = 0.90;
  var fitReady = !(document.fonts && document.fonts.ready);
  var FIT_SEEN = (typeof WeakSet === "function") ? new WeakSet() : null;
  /* Layouts that centre content vertically: their .fit box spans the whole safe
     area and keeps the content centred while it scales. */
  var CENTERED = ["cover", "section", "statement", "closing", "metric", "center", "balance"];
  function unwrapFit(sec) {
    var fit = sec.querySelector(":scope > .fit");
    if (!fit) return;
    while (fit.firstChild) sec.insertBefore(fit.firstChild, fit);
    sec.removeChild(fit);
    sec.removeAttribute("data-fit");
    sec.removeAttribute("data-fit-fail");
  }
  function fitSlide(sec, force) {
    if (!sec || !fitReady || NO_FIT) return;
    if (!force && FIT_SEEN && FIT_SEEN.has(sec)) return;
    if (force) unwrapFit(sec);
    else if (sec.querySelector(":scope > .fit")) { if (FIT_SEEN) FIT_SEEN.add(sec); return; }
    var cs = getComputedStyle(sec);
    var padT = parseFloat(cs.paddingTop) || 0, padB = parseFloat(cs.paddingBottom) || 0;
    var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    var hasRule = sec.classList.contains("section") || sec.classList.contains("closing");  // gold plate-rule at top
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var clearance = hasRule ? 1.8 * rem : 0;   // breathing room below the gold plate-rule
    var kids = [].slice.call(sec.children).filter(function (c) {
      if (c.nodeName === "ASIDE" || (c.classList && c.classList.contains("fit")) || c.offsetParent === null) return false;
      var pos = getComputedStyle(c).position;   // leave absolutely-placed decor (QR, media fill) in place
      return pos !== "absolute" && pos !== "fixed";
    });
    if (!kids.length) { if (FIT_SEEN) FIT_SEEN.add(sec); return; }
    var topMost = Infinity, botMost = -Infinity, leftMost = Infinity, rightMost = -Infinity;
    kids.forEach(function (c) {
      topMost = Math.min(topMost, c.offsetTop);
      botMost = Math.max(botMost, c.offsetTop + c.offsetHeight);
      leftMost = Math.min(leftMost, c.offsetLeft);
      rightMost = Math.max(rightMost, c.offsetLeft + c.offsetWidth);
    });
    var H = botMost - topMost, W = rightMost - leftMost;
    var boxTop = padT + clearance;
    var safeH = sec.clientHeight - boxTop - padB;
    var safeW = sec.clientWidth - padL - padR;
    var needFit = (H > safeH + 3) || (W > safeW + 3) || (hasRule && topMost < boxTop - 3);
    if (needFit && safeH > 40 && H > 0) {
      var k = Math.max(0.55, Math.min(1, safeH / H, W > 0 ? safeW / W : 1));
      var centered = CENTERED.some(function (c) { return sec.classList.contains(c); });
      var fit = document.createElement("div");
      fit.className = "fit";
      while (kids.length) fit.appendChild(kids.shift());
      sec.insertBefore(fit, sec.firstChild);
      fit.style.cssText = "position:absolute;top:" + boxTop + "px;left:" + padL + "px;right:" + padR +
        "px;margin:0;display:flex;flex-direction:column;" +
        (centered
          ? "bottom:" + padB + "px;justify-content:center;transform-origin:center center;"
          : "transform-origin:top left;") +
        "transform:scale(" + k.toFixed(4) + ");";
      sec.setAttribute("data-fit", k.toFixed(3));
      if (k < FIT_FAIL && !sec.hasAttribute("data-fit-allow")) {
        sec.setAttribute("data-fit-fail", k.toFixed(3));
        console.error("deck: slide " + slideRef(sec) + " auto-fitted to ×" + k.toFixed(3) +
          " (below the " + FIT_FAIL + " readability threshold). Trim the slide or add data-fit-allow.");
      } else if (k < FIT_WARN) {
        console.warn("deck: slide " + slideRef(sec) + " auto-fitted to ×" + k.toFixed(3) + " — consider trimming it.");
      }
    }
    if (FIT_SEEN) FIT_SEEN.add(sec);
    if (checkModeUpdate) checkModeUpdate();
  }
  function slideRef(sec) {
    var hSlides = Reveal.getHorizontalSlides ? Reveal.getHorizontalSlides() : [];
    var i = hSlides.indexOf(sec);
    var title = sec.querySelector("h1, h2, h3");
    return "#" + (i >= 0 ? i + 1 : "?") + (title ? " (“" + title.textContent.trim().slice(0, 40) + "”)" : "");
  }
  /* Re-fit a slide when late-loading content (images, embeds, iframes) changes
     its measured height after the first pass. */
  function refitAfterLoad(el) {
    var sec = el && el.closest ? el.closest(".slides > section") : null;
    if (!sec || !fitReady) return;
    if ((FIT_SEEN && FIT_SEEN.has(sec)) || sec.querySelector(":scope > .fit")) fitSlide(sec, true);
  }

  /* ---- duotone filters (Move 2): inject the green/navy duotone SVG filters
     once so any deck can drop class="duotone" or a .plate figure and reference
     url(#duo-green) without hand-pasting the filter into every index.html. ---- */
  function injectFilters() {
    if (document.getElementById("duo-green")) return;
    var DESAT = '<feColorMatrix type="matrix" values="0.33 0.34 0.33 0 0  0.33 0.34 0.33 0 0  0.33 0.34 0.33 0 0  0 0 0 1 0"></feColorMatrix>';
    var svg = elem(
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
        '<filter id="duo-green" color-interpolation-filters="sRGB">' + DESAT +
          '<feComponentTransfer><feFuncR type="table" tableValues="0.03 0.93"></feFuncR><feFuncG type="table" tableValues="0.17 0.95"></feFuncG><feFuncB type="table" tableValues="0.12 0.91"></feFuncB></feComponentTransfer>' +
        '</filter>' +
        '<filter id="duo-navy" color-interpolation-filters="sRGB">' + DESAT +
          '<feComponentTransfer><feFuncR type="table" tableValues="0.02 0.90"></feFuncR><feFuncG type="table" tableValues="0.05 0.93"></feFuncG><feFuncB type="table" tableValues="0.20 0.99"></feFuncB></feComponentTransfer>' +
        '</filter>' +
      '</svg>'
    );
    document.body.appendChild(svg);
  }

  /* ---- figures that count (Move 3): animate any [data-count] numeral up from
     zero when its slide arrives. Opt-in per element; the element's authored text
     is the exact final value (so "14,700+", "28.1M", ranges all render right).
       data-count="14700"            target number
       data-count-decimals="1"       fixed decimals during the roll (default 0)
       data-count-prefix / -suffix   glued on each frame (e.g. "+", "M", "×")
     Stilled entirely under prefers-reduced-motion. ----------------------------- */
  var REDUCE = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function animateCounts(slide) {
    if (!slide || typeof requestAnimationFrame !== "function") return;
    // Hold the final value (no roll) when motion is unwanted or frames won't run:
    // reduced-motion, the PDF export, or a hidden tab (rAF is paused there, so a
    // rolling numeral would otherwise stick at 0).
    var still = REDUCE || document.hidden || PRINT;
    slide.querySelectorAll("[data-count]").forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      if (isNaN(target)) return;
      var dec = parseInt(el.getAttribute("data-count-decimals") || "0", 10) || 0;
      var pre = el.getAttribute("data-count-prefix") || "";
      var suf = el.getAttribute("data-count-suffix") || "";
      var done = el.getAttribute("data-count-text");
      if (done === null) { done = el.textContent; el.setAttribute("data-count-text", done); }
      if (still) {
        if (el._countRAF) { cancelAnimationFrame(el._countRAF); el._countRAF = null; }
        if (el._countTO) { clearTimeout(el._countTO); el._countTO = null; }
        el.textContent = done; return;
      }
      if (el._countRAF) return;   // a roll is already running — never reset it back to 0
      var loc = document.documentElement.lang || "en";   // group digits in the deck's language
      function fmt(v) { return pre + v.toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; }
      var dur = 900, t0 = null;
      function tick(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));   // ease-out-cubic
        if (p < 1) el._countRAF = requestAnimationFrame(tick);
        else { el.textContent = done; el._countRAF = null; if (el._countTO) { clearTimeout(el._countTO); el._countTO = null; } }
      }
      // Safety net: if frames stop arriving (tab hidden mid-roll), force the
      // final value so a numeral can never be left reading 0. setTimeout still
      // fires when rAF is throttled.
      el._countTO = setTimeout(function () { if (el._countRAF) { cancelAnimationFrame(el._countRAF); el._countRAF = null; } el.textContent = done; }, dur + 600);
      el.textContent = fmt(0);
      el._countRAF = requestAnimationFrame(tick);
    });
  }

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

  /* ---- image lightbox: view a figure/screenshot full-screen ----------------
     Fully keyboard-operable: every zoomable image is a focusable control that
     opens with Enter/Space; the dialog focuses its close button, traps Tab,
     navigates with the arrow keys, closes with Escape, and returns focus to
     the originating image. hidden/inert state mirrors the visual state. ------ */
  var lightbox, lbImg;
  function buildLightbox() {
    var imgs = document.querySelectorAll(
      ".reveal .slides .shot, .reveal .slides .site-frame-view > img"
    );
    if (!imgs.length) return;
    lightbox = elem(
      '<div class="deck-lightbox" role="dialog" aria-modal="true" aria-label="' + STR.imageViewer + '">' +
        '<button class="lightbox-close" aria-label="' + STR.imageClose + '">' + ICON.close + "</button>" +
        '<figure class="lightbox-figure"><img alt=""><figcaption></figcaption></figure>' +
      "</div>"
    );
    document.body.appendChild(lightbox);
    setDialogHidden(lightbox, true);
    lbImg = lightbox.querySelector("img");
    var lbCap = lightbox.querySelector("figcaption");
    var lbClose = lightbox.querySelector(".lightbox-close");
    var list = Array.prototype.slice.call(imgs);  // navigation order across the deck
    var curIdx = -1, lbLastFocus = null;
    function showAt(i) {
      curIdx = (i + list.length) % list.length;
      var img = list[curIdx];
      var alt = img.getAttribute("alt") || "";
      lbImg.setAttribute("src", img.currentSrc || img.src);
      lbImg.setAttribute("alt", alt);
      lbCap.textContent = alt;
      lbCap.style.display = alt ? "" : "none";
      if (!lightbox.classList.contains("open")) {
        lbLastFocus = document.activeElement;
        lightbox.classList.add("open");
        setDialogHidden(lightbox, false);
        focusWhenVisible(lbClose);
      }
    }
    function closeLightbox() {
      lightbox.classList.remove("open");
      setDialogHidden(lightbox, true);
      lbImg.removeAttribute("src");
      curIdx = -1;
      // Return focus to the image that opened the viewer.
      if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
      lbLastFocus = null;
    }
    list.forEach(function (img, i) {
      img.classList.add("is-zoomable");
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      var alt = img.getAttribute("alt") || "";
      img.setAttribute("aria-label", STR.imageView + (alt ? ": " + alt : ""));
      img.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        showAt(i);
      });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); e.stopPropagation();
          showAt(i);
        }
      });
    });
    lightbox.addEventListener("click", closeLightbox); // backdrop, image, or close button
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) return;
      // Tab stays available so the dialog is keyboard-traversable — trap it inside.
      if (e.key === "Tab") {
        e.preventDefault(); e.stopPropagation();
        lbClose.focus();
        return;
      }
      e.stopPropagation(); // never drive the deck behind the lightbox
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); showAt(curIdx + 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); showAt(curIdx - 1); }
    }, true);
  }

  /* ---- live iframes: lazy-load + offline fallback -------------------------
     Every .site-frame-view iframe is converted to reveal's data-src form so it
     loads only when its slide becomes visible (and unloads after). If a frame
     has not loaded within a grace period of its slide becoming active — no
     network, or the site refuses framing — a fallback note with the original
     link appears instead of a silent white box. -------------------------------- */
  function lazifyFrames() {
    document.querySelectorAll(".reveal .slides .site-frame-view > iframe[src]").forEach(function (f) {
      if (!f.hasAttribute("data-src")) f.setAttribute("data-src", f.getAttribute("src"));
      f.removeAttribute("src");
    });
  }
  function initFrameFallbacks() {
    var frames = document.querySelectorAll(".reveal .slides .site-frame-view > iframe");
    if (!frames.length) return;
    frames.forEach(function (f) {
      f.addEventListener("load", function () { f.setAttribute("data-frame-loaded", ""); hideFallback(f); });
    });
    function fallbackFor(f) {
      var view = f.parentElement;
      var fb = view.querySelector(".frame-fallback");
      if (!fb) {
        var openLink = f.closest(".site-frame") && f.closest(".site-frame").querySelector(".site-frame-open");
        var href = f.getAttribute("data-fallback-href") || (openLink && openLink.getAttribute("href")) || f.getAttribute("data-src") || "";
        fb = elem('<div class="frame-fallback" role="status"><p>' + STR.frameUnavailable + "</p>" +
          (href ? '<a href="' + href + '" target="_blank" rel="noopener">' + STR.frameOpen + " ↗</a>" : "") + "</div>");
        fb.hidden = true;
        view.appendChild(fb);
      }
      return fb;
    }
    function hideFallback(f) {
      var fb = f.parentElement.querySelector(".frame-fallback");
      if (fb) fb.hidden = true;
    }
    function watchCurrent() {
      var cur = Reveal.getCurrentSlide();
      if (!cur) return;
      cur.querySelectorAll(".site-frame-view > iframe").forEach(function (f) {
        if (f.hasAttribute("data-frame-loaded")) return;
        setTimeout(function () {
          if (!f.hasAttribute("data-frame-loaded") && Reveal.getCurrentSlide() === cur) {
            fallbackFor(f).hidden = false;
          }
        }, 8000);
      });
    }
    Reveal.on("slidechanged", watchCurrent);
    watchCurrent();
  }

  /* ---- syntax highlighting (plugin-independent) --------------------------- */
  /* Highlight every <pre><code> with whichever hljs is present: the slim global
     from shared/highlight.min.js, or the copy inside reveal's highlight plugin.
     A deck can therefore drop the 921 KB bundled plugin and load the slim build
     instead — this fills the gap. A no-op when the reveal plugin already ran
     (it sets data-highlighted), so it's safe to keep in either configuration. */
  function highlightAll() {
    var hp = (typeof Reveal !== "undefined" && Reveal.getPlugin) ? Reveal.getPlugin("highlight") : null;
    var hl = window.hljs || (hp && hp.hljs);
    if (!hl) return;
    document.querySelectorAll(".reveal .slides pre code").forEach(function (code) {
      if (code.dataset.highlighted) return;
      try { hl.highlightElement(code); } catch (e) {}
    });
  }

  /* ---- dev-only slide check (?check): outline any slide whose content spills
     past the fixed 1280×720 canvas, and make auto-fitting VISIBLE — the banner
     shows the applied data-fit scale for the current slide, amber below the
     warning threshold, red below the failure threshold. Combine with ?no-fit
     (or use ?audit, which implies both) to see authored overflow before any
     scaling is applied. ------------------------------------------------------- */
  var checkModeUpdate = null;
  function enableCheckMode() {
    var banner = elem('<div class="deck-overflow-banner" style="position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:90;font:600 11px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;padding:6px 11px;border-radius:4px;background:#c0392b;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);pointer-events:none">Slide overflows 1280×720</div>');
    banner.hidden = true;
    document.body.appendChild(banner);
    function check() {
      var s = Reveal.getCurrentSlide();
      if (!s) return;
      var fitted = s.hasAttribute("data-fit");
      var k = fitted ? parseFloat(s.getAttribute("data-fit")) : 1;
      // A fitted slide's layout boxes are unscaled (transforms don't change
      // scrollHeight), so the raw overflow test only applies to unfitted slides.
      var over = !fitted && (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1);
      var fail = s.hasAttribute("data-fit-fail") || (fitted && k < FIT_FAIL && !s.hasAttribute("data-fit-allow"));
      var warn = fitted && k < FIT_WARN;
      var msg = "", color = "#c0392b";
      if (over) msg = NO_FIT ? "Authored overflow (fitting disabled)" : "Slide overflows 1280×720";
      else if (fitted) {
        msg = "Auto-fitted ×" + k.toFixed(3) + (fail ? " — below " + FIT_FAIL : warn ? " — below " + FIT_WARN : "");
        color = fail ? "#c0392b" : warn ? "#b9770e" : "#1e8449";
      }
      var outline = over || fail ? "#c0392b" : warn ? "#b9770e" : "";
      s.style.outline = outline ? "3px solid " + outline : "";
      s.style.outlineOffset = outline ? "-3px" : "";
      banner.textContent = msg;
      banner.style.background = color;
      banner.hidden = !msg;
    }
    checkModeUpdate = check;
    Reveal.on("slidechanged", check);
    check();
  }

  function init() {
    var reveal = document.querySelector(".reveal");
    decorateChrome();
    lazifyFrames();   // live iframes load only when their slide becomes visible

    Reveal.initialize({
      width: 1280, height: 720, margin: 0,
      minScale: 0.2, maxScale: 2.0,
      // Never switch to reveal 6's scroll view on narrow screens: the theme is
      // designed around a scaled 1280×720 canvas, and the automatic scroll mode
      // (≤435 px wide) clips two-column slides on portrait phones.
      scrollActivationWidth: null,
      center: false, hash: true,
      controls: false, progress: true, slideNumber: false,
      transition: CFG.transition || "fade",
      transitionSpeed: "default",
      backgroundTransition: "fade",
      overview: true, touch: true, keyboard: true,
      // PDF export (?print-pdf): one printed page per slide. Reveal's default
      // is Infinity, so any slide even 1px over the page height spilled onto
      // extra pages — the "one slide, several pages" bug. The house style is a
      // fixed 1280×720 screen per slide, so a hard cap of 1 is always right.
      pdfSeparateFragments: false, pdfMaxPagesPerSlide: 1,
      plugins: revealPlugins()
    }).then(function () {
      decorateSlides();   // fill [data-contact] slots
      buildFooter(reveal);
      buildRunhead(reveal);
      buildTOC(reveal);
      loadFileEmbeds();
      buildLightbox();
      initFrameFallbacks();
      highlightAll();   // highlight code via global hljs (works without the bundled plugin)
      update();
      // Late-loading media (lazy data-src images, embeds) can change a slide's
      // height after the first fit pass — re-fit the slide when they arrive.
      // Images only: iframes are reloaded by the browser whenever the fit
      // wrapper reparents them, so refitting on iframe load would loop.
      document.querySelector(".slides").addEventListener("load", function (e) {
        if (e.target && e.target.nodeName === "IMG") refitAfterLoad(e.target);
      }, true);
      // If the tab hides mid-roll, rAF freezes; snap any counting numeral to its
      // final value so none is ever left reading a partial count (or 0).
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) return;
        document.querySelectorAll("[data-count]").forEach(function (el) {
          if (el._countRAF) { cancelAnimationFrame(el._countRAF); el._countRAF = null; }
          if (el._countTO) { clearTimeout(el._countTO); el._countTO = null; }
          var done = el.getAttribute("data-count-text");
          if (done !== null) el.textContent = done;
        });
      });
      if (CHECK_MODE) enableCheckMode();

      // Defensive relayout: recompute the scale once the window and webfonts
      // have settled, in case the deck initialised before it had real size.
      window.addEventListener("load", function () { Reveal.layout(); fitReady = true; fitSlide(Reveal.getCurrentSlide()); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { Reveal.layout(); fitReady = true; fitSlide(Reveal.getCurrentSlide()); });

      // PDF export (?print-pdf): every slide prints, so every slide needs the
      // overflow fit — not just the current one. Re-fit them all (force: the
      // pass may re-run once fonts settle or after reveal builds its
      // .pdf-page layout, whichever lands last).
      if (PRINT) {
        var fitAllPages = function () {
          if (!fitReady || !document.querySelector(".reveal .pdf-page")) return;
          document.querySelectorAll(".reveal .pdf-page > section").forEach(function (s) { fitSlide(s, true); });
        };
        Reveal.on("pdf-ready", fitAllPages);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAllPages);
      }

      Reveal.addKeyBinding({ keyCode: 84, key: "T", description: "Table of contents" }, toggleTOC);
      // While the TOC dialog is open, all keys act on the dialog (capture phase,
      // before reveal's own handler): Esc closes, arrows move, Tab is trapped.
      document.addEventListener("keydown", tocKeydown, true);
    });

    Reveal.on("slidechanged", update);
    Reveal.on("overviewshown", function () { if (footer) footer.style.opacity = "0"; });
    Reveal.on("overviewhidden", function () { if (footer) footer.style.opacity = ""; });
  }

  function revealPlugins() {
    var p = [];
    if (window.RevealHighlight) p.push(RevealHighlight);
    if (window.RevealNotes) p.push(RevealNotes);
    if (window.RevealZoom) p.push(RevealZoom);
    if (window.RevealSearch) p.push(RevealSearch);
    return p;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
