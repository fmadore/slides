/* =============================================================================
   deck.js — the reusable engine for the Africa Multiple / Bayreuth deck.

   This file is GENERIC. You should not need to edit it per talk. Each deck
   only edits index.html: its slides, and the `window.DECK_CONFIG` block near
   the top of that file (presenter, talk metadata, contact links).

   What it does, in order:
     • injects the top 6-colour spectrum bar
     • draws the compass motif into cover / section / closing slides
     • fills every [data-contact] slot with icon links from DECK_CONFIG
     • initialises reveal.js (custom nav, no stock chrome) with plugins
     • builds the persistent footer (logos · talk title · counter · buttons)
     • builds the auto table-of-contents overlay from [data-toc] sections
     • keeps everything in sync on each slide change

   Keyboard:  ←/→ navigate · T table of contents · O overview · F fullscreen
              S speaker notes · ? help · Esc closes overlays
   ============================================================================= */
(function () {
  "use strict";

  var CFG = window.DECK_CONFIG || {};
  CFG.links = CFG.links || {};
  var SVGNS = "http://www.w3.org/2000/svg";

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

  /* -------------------------------------------------------------------------
     Compass motif — a refined reading of the logo's sail/compass, drawn as
     thin rays + concentric rings (currentColor) with four palette "sails".
     ------------------------------------------------------------------------- */
  function buildCompass() {
    var cx = 200, cy = 200, parts = [];
    // concentric rings, slightly offset like the mark
    parts.push('<circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".55"/>');
    parts.push('<circle cx="206" cy="196" r="134" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".40"/>');
    parts.push('<circle cx="195" cy="205" r="120" fill="none" stroke="currentColor" stroke-width="1"   opacity=".28"/>');
    // radiating hairlines (some extend beyond the rings)
    var rays = [[-58,182],[-30,168],[-9,205],[14,160],[40,150],[63,172],[120,158],[150,200],[182,150],[214,168],[250,150],[300,176]];
    rays.forEach(function (r) {
      var a = r[0] * Math.PI / 180, len = r[1];
      parts.push('<line x1="200" y1="200" x2="' + (cx + len * Math.cos(a)).toFixed(1) + '" y2="' + (cy + len * Math.sin(a)).toFixed(1) + '" stroke="currentColor" stroke-width="1" opacity=".30"/>');
    });
    // four sails (thin triangles) in the brand colours — visible on light + dark
    var sails = [
      { a: -32, len: 196, w: 18, fill: "#009260", op: .9 },   // green, up-right (the signature sail)
      { a: 58,  len: 150, w: 14, fill: "#cca352", op: .85 },  // gold, down-right
      { a: 168, len: 138, w: 12, fill: "#44b8f2", op: .8 },   // sky, left
      { a: 250, len: 120, w: 11, fill: "#f59c08", op: .82 }   // amber, down-left
    ];
    sails.forEach(function (s) {
      var a = s.a * Math.PI / 180, p = a + Math.PI / 2;
      var tx = cx + s.len * Math.cos(a), ty = cy + s.len * Math.sin(a);
      var b1x = cx + s.w * Math.cos(p), b1y = cy + s.w * Math.sin(p);
      var b2x = cx - s.w * Math.cos(p), b2y = cy - s.w * Math.sin(p);
      parts.push('<path d="M' + tx.toFixed(1) + ' ' + ty.toFixed(1) + 'L' + b1x.toFixed(1) + ' ' + b1y.toFixed(1) + 'L' + b2x.toFixed(1) + ' ' + b2y.toFixed(1) + 'Z" fill="' + s.fill + '" opacity="' + s.op + '"/>');
    });
    parts.push('<circle cx="200" cy="200" r="4.5" fill="currentColor" opacity=".7"/>');
    return '<div class="deck-compass" aria-hidden="true"><svg viewBox="0 0 400 400" xmlns="' + SVGNS + '">' + parts.join("") + "</svg></div>";
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
          '<button class="deck-btn prev" title="Previous (←)" aria-label="Previous slide">' + ICON.prev + "</button>" +
          '<button class="deck-btn next" title="Next (→)" aria-label="Next slide">' + ICON.next + "</button>" +
          '<button class="deck-btn toc-btn" title="Table of contents (T)" aria-label="Open table of contents">' + ICON.toc + "<span>Contents</span></button>" +
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

  /* ---- table-of-contents overlay ------------------------------------------ */
  var overlay, tocItems = [];
  function buildTOC(reveal) {
    var hSlides = Reveal.getHorizontalSlides();
    var entries = [];
    hSlides.forEach(function (sec, h) {
      var label = sec.getAttribute("data-toc");
      if (label) entries.push({ h: h, label: label, part: sec.getAttribute("data-toc-part") || "" });
    });
    if (!entries.length) return; // no TOC requested

    var rows = entries.map(function (e, i) {
      var n = String(i + 1).padStart(2, "0");
      return '<button class="toc-item" data-h="' + e.h + '">' +
               '<span class="toc-num">' + n + "</span>" +
               '<span class="toc-label">' + e.label + "</span>" +
               (e.part ? '<span class="toc-dur">' + e.part + "</span>" : "<span></span>") +
             "</button>";
    }).join("");

    overlay = elem(
      '<div class="toc-overlay" role="dialog" aria-modal="true" aria-label="Table of contents">' +
        '<div class="toc-panel">' +
          '<button class="toc-close" aria-label="Close">' + ICON.close + "</button>" +
          '<div class="toc-head"><div>' +
            '<div class="toc-eyebrow">' + (CFG.tocEyebrow || "Contents") + "</div>" +
            '<h2 class="toc-title">' + (CFG.talkTitle || "Overview") + "</h2>" +
          "</div></div>" +
          '<ul class="toc-list">' + rows + "</ul>" +
          '<div class="toc-foot"><span>' + (CFG.presenter || "") +
            "</span><span><kbd>T</kbd> contents &nbsp; <kbd>O</kbd> overview &nbsp; <kbd>Esc</kbd> close</span></div>" +
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
  }
  function openTOC()  { if (overlay) { overlay.classList.add("open"); markCurrentTOC(); } }
  function closeTOC() { if (overlay) overlay.classList.remove("open"); }
  function toggleTOC(){ if (overlay) (overlay.classList.contains("open") ? closeTOC() : openTOC()); }
  function markCurrentTOC() {
    if (!overlay) return;
    var h = Reveal.getIndices().h;
    var active = null;
    tocItems.forEach(function (btn) {
      var bh = parseInt(btn.getAttribute("data-h"), 10);
      if (bh <= h) active = btn;
      btn.classList.remove("current");
    });
    if (active) active.classList.add("current");
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
    markCurrentTOC();
  }

  /* ---- boot --------------------------------------------------------------- */
  /* Chrome that doesn't depend on slide content — safe to run before init. */
  function decorateChrome() {
    document.body.appendChild(elem('<div class="deck-spectrum" aria-hidden="true"></div>'));
    if (CFG.talkTitle && !document.title.trim()) document.title = CFG.talkTitle;
  }

  /* Per-slide decoration — MUST run after the Markdown plugin has converted
     [data-markdown] sections, since it replaces section.innerHTML (which would
     wipe a pre-injected compass) and only then exist the [data-contact] slots
     and the cover/section/closing classes authored inside the Markdown. */
  function decorateSlides() {
    var heroes = document.querySelectorAll(
      ".reveal .slides > section.cover, .reveal .slides > section.section, .reveal .slides > section.closing"
    );
    heroes.forEach(function (sec) {
      if (sec.getAttribute("data-compass") === "off") return;
      if (sec.querySelector(":scope > .deck-compass")) return; // idempotent
      sec.insertBefore(elem(buildCompass()), sec.firstChild);
    });
    document.querySelectorAll("[data-contact]").forEach(function (slot) {
      slot.classList.add("contact");
      slot.innerHTML = contactHTML();
    });
  }

  /* Load any [data-skill-src] panel from its vendored file and syntax-highlight it. */
  function loadSkillEmbeds() {
    document.querySelectorAll("[data-skill-src]").forEach(function (panel) {
      var code = panel.querySelector("code");
      if (!code) return;
      fetch(panel.getAttribute("data-skill-src"))
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
        })
        .catch(function () {
          code.textContent = "Could not load the file — it's open source at github.com/fmadore/iwac-mcp-server";
        });
    });
  }

  /* ---- image lightbox: click a figure/screenshot to view it full-screen --- */
  var lightbox, lbImg;
  function buildLightbox() {
    var imgs = document.querySelectorAll(
      ".reveal .slides .shot, .reveal .slides .site-frame-view > img"
    );
    if (!imgs.length) return;
    lightbox = elem(
      '<div class="deck-lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">' +
        '<button class="lightbox-close" aria-label="Close image">' + ICON.close + "</button>" +
        '<img alt="">' +
      "</div>"
    );
    document.body.appendChild(lightbox);
    lbImg = lightbox.querySelector("img");
    function closeLightbox() { lightbox.classList.remove("open"); lbImg.removeAttribute("src"); }
    imgs.forEach(function (img) {
      img.classList.add("is-zoomable");
      img.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        lbImg.setAttribute("src", img.currentSrc || img.src);
        lbImg.setAttribute("alt", img.getAttribute("alt") || "");
        lightbox.classList.add("open");
      });
    });
    lightbox.addEventListener("click", closeLightbox); // backdrop, image, or close button
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeLightbox(); }
      else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Spacebar"].indexOf(e.key) !== -1) {
        e.stopPropagation(); e.preventDefault(); // don't drive the deck behind the lightbox
      }
    }, true);
  }

  function init() {
    var reveal = document.querySelector(".reveal");
    decorateChrome();

    Reveal.initialize({
      width: 1280, height: 720, margin: 0,
      minScale: 0.2, maxScale: 2.0,
      center: false, hash: true, history: true,
      controls: false, progress: true, slideNumber: false,
      transition: CFG.transition || "fade",
      transitionSpeed: "default",
      backgroundTransition: "fade",
      overview: true, touch: true, keyboard: true,
      pdfSeparateFragments: false,
      plugins: revealPlugins()
    }).then(function () {
      decorateSlides();   // after Markdown conversion (see decorateSlides)
      buildFooter(reveal);
      buildTOC(reveal);
      loadSkillEmbeds();
      buildLightbox();
      update();

      // Defensive relayout: recompute the scale once the window and webfonts
      // have settled, in case the deck initialised before it had real size.
      window.addEventListener("load", function () { Reveal.layout(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { Reveal.layout(); });

      Reveal.addKeyBinding({ keyCode: 84, key: "T", description: "Table of contents" }, toggleTOC);
      // Esc closes the TOC before reveal's overview takes it
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && overlay && overlay.classList.contains("open")) {
          e.stopPropagation(); e.preventDefault(); closeTOC();
        }
      }, true);
    });

    Reveal.on("slidechanged", update);
    Reveal.on("overviewshown", function () { if (footer) footer.style.opacity = "0"; });
    Reveal.on("overviewhidden", function () { if (footer) footer.style.opacity = ""; });
  }

  function revealPlugins() {
    var p = [];
    if (window.RevealMarkdown) p.push(RevealMarkdown); // convert [data-markdown] first
    if (window.RevealHighlight) p.push(RevealHighlight);
    if (window.RevealNotes) p.push(RevealNotes);
    if (window.RevealZoom) p.push(RevealZoom);
    if (window.RevealSearch) p.push(RevealSearch);
    return p;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
