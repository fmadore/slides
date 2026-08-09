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
