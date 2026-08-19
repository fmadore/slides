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

  /* ---- per-page imprint (PDF export only) --------------------------------- */
  /* On screen one persistent footer is right: it updates as you move. On paper
     there is nothing to update — every page is final and needs its own folio,
     so each printed page gets an imprint of its own instead. */
  function buildPrintImprints() {
    var pages = document.querySelectorAll(".reveal .slides .pdf-page");
    if (!pages.length) return;
    var total = String(pages.length).padStart(2, "0");
    var title = escapeHTML(CFG.talkShort || CFG.talkTitle || "");
    if (CFG.venue) title += " · " + escapeHTML(CFG.venue);
    Array.prototype.forEach.call(pages, function (page, i) {
      if (page.querySelector(".pdf-imprint")) return;
      var field = fieldOf(page.querySelector("section"));
      var mark = elem(
        '<div class="pdf-imprint' + (field ? " on-dark" : "") + '"' +
          (field === "deep" ? ' data-field="deep"' : "") + ' aria-hidden="true">' +
          '<span class="pi-title">' + title + "</span>" +
          '<span class="pi-folio">' + String(i + 1).padStart(2, "0") +
            "<span> / </span>" + total + "</span>" +
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
