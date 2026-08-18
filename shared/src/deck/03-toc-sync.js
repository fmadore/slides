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
  /* The dark fields split into two registers by luminance (see the on-dark
     token block in the theme). The footer and the viewport live outside the
     slide, so they cannot inherit the slide's register — deck.js mirrors it
     onto them as data-field="deep". Everything else dark stays on the bright
     defaults, which are safe on any field. */
  function isDeepField(el) {
    if (!el) return false;
    if (el.classList.contains("section")) return el.classList.contains("navy");
    return el.classList.contains("closing") || el.classList.contains("media");
  }
  /* null on a paper slide, else the register the chrome over it must use.
     The live footer and the printed imprint both read it, so a slide can never
     be dark for one and light for the other. */
  function fieldOf(el) {
    if (!el) return null;
    var attr = el.getAttribute("data-footer");
    var dark = attr ? attr === "dark"
      : DARK.some(function (c) { return el.classList.contains(c); });
    if (!dark) return null;
    return isDeepField(el) ? "deep" : "bright";
  }
  function update() {
    var cur = Reveal.getCurrentSlide();
    var hCount = Reveal.getHorizontalSlides().length;
    var h = Reveal.getIndices().h;
    if (counterCur) counterCur.textContent = String(h + 1).padStart(2, "0");
    if (counterTot) counterTot.textContent = String(hCount).padStart(2, "0");
    if (btnPrev) btnPrev.disabled = Reveal.isFirstSlide();
    if (btnNext) btnNext.disabled = Reveal.isLastSlide();

    var field = fieldOf(cur);
    var isDark = !!field;
    var isDeep = field === "deep";
    var vp = document.querySelector(".reveal-viewport");
    [footer, vp].forEach(function (el) {
      if (!el) return;
      el.classList.toggle(el === footer ? "on-dark" : "deck-dark", isDark);
      if (isDeep) el.setAttribute("data-field", "deep");
      else el.removeAttribute("data-field");
    });

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
