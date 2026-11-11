/* =============================================================================
   zmo.js — the ZMO brand skin's behaviours.
   Built to <shared/brands/zmo/zmo.js> by tools/build-shared.mjs; a ZMO deck
   loads it after deck.js. It does nothing unless <body data-brand="zmo">.

   1. Band titles. The PPT title placeholder shrinks a title that would wrap
      ("shrink text on overflow"); the band holds one 32 pt line. This does
      the same: it measures each band title's text against the band's width
      with a canvas — so it works on slides reveal has not laid out yet — and
      steps the size down to fit, to a floor of 20 pt, below which a title
      wraps to two lines rather than shrinking further.
   2. Folios. Each slide is stamped data-zmo-folio, which zmo.css prints
      before the URL at the foot. The numbering is the engine's own (see
      shared/src/deck/02-chrome.js): counted slides 01…N, annexe slides
      (data-visibility="uncounted") A01, A02 …, slides reveal removes
      (data-visibility="hidden") skipped, every slide of a vertical stack
      sharing its stack's number. CSS counters would not do: reveal hides and
      reorders slides, and the print view rewraps them.
   3. Sparse card rows. A row of cards stretched to the foot of the text
      area whose fullest card's content fills under 60% of it sets its
      content just above centre, by one shared amount so the row's headings
      stay level. (A lone callout centres in CSS alone.)
   ============================================================================= */
(function () {
  "use strict";

  if (!document.body || document.body.getAttribute("data-brand") !== "zmo") return;

  /* ---- 1. band titles ----------------------------------------------------- */
  var FLOOR = 36;   /* px on the 1280 × 720 canvas ≈ 20 pt */
  var measure = document.createElement("canvas").getContext("2d");

  function fit(title) {
    title.style.removeProperty("font-size");
    var style = getComputedStyle(title);
    var size = parseFloat(style.fontSize);
    var room = parseFloat(style.width) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (!size || !room) return;
    measure.font = style.fontStyle + " " + style.fontWeight + " " + size + "px " + style.fontFamily;
    var width = measure.measureText(title.textContent.replace(/\s+/g, " ").trim()).width;
    if (width > room) title.style.fontSize = Math.max(FLOOR, Math.floor(size * room / width)) + "px";
  }

  function fitAll() {
    document.querySelectorAll(".reveal .slides section .slide-title").forEach(fit);
  }

  /* ---- 2. folios ----------------------------------------------------------- */
  function pad2(n) { return String(n).padStart(2, "0"); }

  function stampFolios() {
    var tops = document.querySelectorAll(".reveal .slides > section, .reveal .slides > .pdf-page > section");
    var counted = 0, annexe = 0;
    Array.prototype.forEach.call(tops, function (sec) {
      var vis = sec.getAttribute("data-visibility");
      if (vis === "hidden") return;
      var folio = vis === "uncounted" ? "A" + pad2(++annexe) : pad2(++counted);
      var leaves = sec.querySelectorAll(":scope > section");
      (leaves.length ? Array.prototype.slice.call(leaves) : [sec]).forEach(function (leaf) {
        leaf.setAttribute("data-zmo-folio", folio);
      });
    });
  }

  /* ---- 3. sparse card rows -------------------------------------------------
     zmo.css gives every .cols.cards column two zero-basis flex spacers
     (::before and ::after) whose grow factors come from --zmo-above and
     --zmo-below, 0 by default. Here a sparse row gets factors that put the
     same height above every card's content, just under half the free height
     of the fullest card, so the headings stay level. Spacers with no basis
     add nothing to a card's own height, so this can never push a slide into
     the engine's auto-fit, whichever runs first. */
  var FILL = 0.6;     /* a row fuller than this keeps its top anchoring      */
  var RISE = 0.45;    /* share of the free height put above the content      */

  // The height a box's content takes: the bounds of everything in it, bare
  // text included (the spacers are pseudo-elements, so they drop out),
  // brought back from screen to layout pixels so any scale on the slide
  // drops out too.
  var range = document.createRange();
  function contentHeight(box) {
    range.selectNodeContents(box);
    var r = range.getBoundingClientRect(), b = box.getBoundingClientRect();
    return b.height ? r.height * box.offsetHeight / b.height : 0;
  }

  function balance(slide) {
    if (!slide) return;
    slide.querySelectorAll(".cols.cards").forEach(function (row) {
      var cards = Array.prototype.filter.call(row.children, function (col) {
        col.style.removeProperty("--zmo-above");
        col.style.removeProperty("--zmo-below");
        return col.classList.contains("col") && col.offsetHeight > 0;
      });
      // Cards on one visual line form a row (six cards wrap to two).
      var lines = {};
      cards.forEach(function (card) {
        var key = Math.round(card.offsetTop);
        (lines[key] = lines[key] || []).push(card);
      });
      Object.keys(lines).forEach(function (key) {
        var line = lines[key], fullest = 0, inner = Infinity;
        var info = line.map(function (card) {
          var cs = getComputedStyle(card);
          var room = card.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          var h = contentHeight(card);
          fullest = Math.max(fullest, h);
          inner = Math.min(inner, room);
          return { card: card, free: room - h };
        });
        if (!(inner > 0) || fullest / inner >= FILL) return;
        var above = (inner - fullest) * RISE;
        info.forEach(function (it) {
          it.card.style.setProperty("--zmo-above", above.toFixed(1));
          it.card.style.setProperty("--zmo-below", Math.max(0, it.free - above).toFixed(1));
        });
      });
    });
  }

  function balanceCurrent() {
    if (window.Reveal && Reveal.getCurrentSlide) balance(Reveal.getCurrentSlide());
  }
  function balancePages() {
    document.querySelectorAll(".reveal .slides .pdf-page > section").forEach(balance);
  }

  /* ---- wiring -------------------------------------------------------------- */
  stampFolios();
  var fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(fitAll);

  if (window.Reveal && Reveal.on) {
    // reveal queues listeners added before it initialises.
    Reveal.on("ready", function () {
      stampFolios();
      balanceCurrent();
      fontsReady.then(balanceCurrent);
    });
    Reveal.on("slidechanged", balanceCurrent);
    Reveal.on("pdf-ready", function () {
      balancePages();
      fontsReady.then(balancePages);
    });
  }
})();
