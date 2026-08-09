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
