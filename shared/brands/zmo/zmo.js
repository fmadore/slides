/* =============================================================================
   zmo.js — the ZMO brand skin's one behaviour.
   Built to <shared/brands/zmo/zmo.js> by tools/build-shared.mjs; a ZMO deck
   loads it after deck.js. It does nothing unless <body data-brand="zmo">.

   The PPT title placeholder shrinks a title that would wrap ("shrink text on
   overflow"); the band holds one 32 pt line. This does the same: it measures
   each band title's text against the band's width with a canvas — so it works
   on slides reveal has not laid out yet — and steps the size down to fit, to a
   floor of 20 pt, below which a title wraps to two lines rather than shrinking
   further.
   ============================================================================= */
(function () {
  "use strict";

  if (!document.body || document.body.getAttribute("data-brand") !== "zmo") return;

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

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitAll);
})();
