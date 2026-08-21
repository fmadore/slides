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
    var fallbackTimers = new WeakMap();
    frames.forEach(function (f) {
      f.addEventListener("load", function () {
        f.setAttribute("data-frame-loaded", "");
        clearTimeout(fallbackTimers.get(f));
        fallbackTimers.delete(f);
        hideFallback(f);
      });
    });
    function fallbackFor(f) {
      var view = f.parentElement;
      var fb = view.querySelector(".frame-fallback");
      if (!fb) {
        var openLink = f.closest(".site-frame") && f.closest(".site-frame").querySelector(".site-frame-open");
        var href = f.getAttribute("data-fallback-href") || (openLink && openLink.getAttribute("href")) || f.getAttribute("data-src") || "";
        fb = elem('<div class="frame-fallback" role="status"><p></p></div>');
        fb.querySelector("p").textContent = STR.frameUnavailable;
        if (href) {
          var link = document.createElement("a");
          link.href = href;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = STR.frameOpen + " ↗";
          fb.appendChild(link);
        }
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
      frames.forEach(function (f) {
        clearTimeout(fallbackTimers.get(f));
        fallbackTimers.delete(f);
      });
      var cur = Reveal.getCurrentSlide();
      if (!cur) return;
      cur.querySelectorAll(".site-frame-view > iframe").forEach(function (f) {
        if (f.hasAttribute("data-frame-loaded")) return;
        var timer = setTimeout(function () {
          fallbackTimers.delete(f);
          if (!f.hasAttribute("data-frame-loaded") && Reveal.getCurrentSlide() === cur) {
            fallbackFor(f).hidden = false;
          }
        }, 8000);
        fallbackTimers.set(f, timer);
      });
    }
    Reveal.on("slidechanged", watchCurrent);
    watchCurrent();
  }

  /* ---- syntax highlighting (plugin-independent) --------------------------- */
  /* Highlight every <pre><code> with the slim global from
     shared/highlight.min.js (~40 KB), which is what every deck loads instead of
     reveal's 921 KB bundled highlight plugin — that plugin is not vendored and
     the engine registers no highlighter. A deck with no code slides simply
     drops the script tag and this becomes a no-op. The data-highlighted guard
     is hljs's own mark, so a second pass never re-highlights a block. */
  function highlightAll() {
    var hl = window.hljs;
    if (!hl) return;
    document.querySelectorAll(".reveal .slides pre code").forEach(function (code) {
      if (code.dataset.highlighted) return;
      try { hl.highlightElement(code); } catch (e) {}
    });
  }
