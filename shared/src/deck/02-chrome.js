  /* ---- footer (single persistent element, updated per slide) -------------- */
  var footer, counterCur, counterTot, btnPrev, btnNext;
  function buildFooter(reveal) {
    var amLogo = CFG.logoMark || (SCRIPT_BASE + "logo-africamultiple.png");
    footer = elem(
      '<div class="deck-footer" role="contentinfo">' +
        '<div class="foot-left">' +
          (CFG.logoMark === false ? "" : '<a class="foot-logo" href="https://www.africamultiple.uni-bayreuth.de/en/index.html" target="_blank" rel="noopener" style="display:flex"><img src="' + amLogo + '" alt="Africa Multiple — Cluster of Excellence"></a>') +
          '<span class="foot-title"><b>' + escapeHTML(CFG.talkShort || CFG.talkTitle || "") + "</b>" +
            (CFG.venue ? " · " + escapeHTML(CFG.venue) : "") + "</span>" +
        "</div>" +
        '<nav class="deck-nav" aria-label="' + escapeHTML(STR.deckNav) + '">' +
          '<span class="counter"><span class="cur">1</span><span> / </span><span class="tot">1</span></span>' +
          '<button class="deck-btn prev" title="' + STR.prev + ' (←)" aria-label="' + STR.prev + '">' + ICON.prev + "</button>" +
          '<button class="deck-btn next" title="' + STR.next + ' (→)" aria-label="' + STR.next + '">' + ICON.next + "</button>" +
          '<button class="deck-btn toc-btn" title="' + STR.tocAria + ' (T)" aria-label="' + STR.tocOpen + '">' + ICON.toc + "<span>" + STR.contents + "</span></button>" +
        "</nav>" +
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

  /* ---- counted vs annexe slides ------------------------------------------
     A deck may keep backup material after its closing slide for questions,
     marked data-visibility="uncounted" (reveal's own attribute). Reveal still
     navigates to it and it still prints, but it must never inflate the folio
     the room reads. One folio vocabulary answers that everywhere the deck
     numbers itself — footer counter, contents list, printed imprint: counted
     slides run 1…N, annexe slides take an A-series of their own, and while an
     annexe slide is on screen the live counter holds at N / N rather than
     counting past its own total. The stronger data-visibility="hidden" needs
     nothing here — reveal removes those slides at init. */
  function isUncounted(sec) {
    return !!sec && sec.getAttribute("data-visibility") === "uncounted";
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  /* The counted folio at a horizontal index: {cur, total} over the counted
     slides alone. On an annexe slide cur is the last counted slide before it. */
  function countedFolio(h) {
    var cur = 0, total = 0;
    Reveal.getHorizontalSlides().forEach(function (sec, i) {
      if (isUncounted(sec)) return;
      total++;
      if (i <= h) cur = total;
    });
    return { cur: cur || 1, total: total || 1 };
  }

  /* ---- per-page imprint (PDF export only) --------------------------------- */
  /* On screen one persistent footer is right: it updates as you move. On paper
     there is nothing to update — every page is final and needs its own folio,
     so each printed page gets an imprint of its own instead.
     The PDF is the shareable record, so annexe pages print with the rest — but
     they are uncounted, so they cannot take a number out of the deck's own
     sequence. Counted pages read NN / TT against the counted total; annexe
     pages read A01, A02 … The alternative — repeating the closing page's
     "25 / 25" across every annexe page — would read as a printing fault where
     a plainly different mark reads as a decision, and this way the reader can
     see at a glance where the talk ended. */
  function buildPrintImprints() {
    var pages = document.querySelectorAll(".reveal .slides .pdf-page");
    if (!pages.length) return;
    var counted = 0;
    Array.prototype.forEach.call(pages, function (page) {
      if (!isUncounted(page.querySelector("section"))) counted++;
    });
    var total = pad2(counted);
    var title = escapeHTML(CFG.talkShort || CFG.talkTitle || "");
    if (CFG.venue) title += " · " + escapeHTML(CFG.venue);
    var n = 0, annexe = 0;
    Array.prototype.forEach.call(pages, function (page) {
      var sec = page.querySelector("section");
      // The folios advance for every page, so a page that already carries an
      // imprint (a re-run of the pass) cannot shift the numbering behind it.
      var folio = isUncounted(sec) ? "A" + pad2(++annexe)
                                   : pad2(++n) + "<span> / </span>" + total;
      if (page.querySelector(".pdf-imprint")) return;
      var field = fieldOf(sec);
      var mark = elem(
        '<div class="pdf-imprint' + (field ? " on-dark" : "") + '"' +
          (field === "deep" ? ' data-field="deep"' : "") + ' aria-hidden="true">' +
          '<span class="pi-title">' + title + "</span>" +
          '<span class="pi-folio">' + folio + "</span>" +
        "</div>"
      );
      page.appendChild(mark);
    });
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
