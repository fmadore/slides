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
