  /* ---- live iframes: lazy-load + offline fallback -------------------------
     Every .site-frame-view iframe is converted to reveal's data-src form so it
     loads only when its slide becomes visible (and unloads after). A useful
     fallback stays until the user opens the live surface or an owned app
     sends its declared readiness message. Load events are not evidence. ------ */
  function lazifyFrames() {
    document.querySelectorAll(".reveal .slides .site-frame-view > iframe[src]").forEach(function (f) {
      if (!f.hasAttribute("data-src")) f.setAttribute("data-src", f.getAttribute("src"));
      f.removeAttribute("src");
    });
  }
  function initFrameFallbacks() {
    var frames = document.querySelectorAll(".reveal .slides iframe");
    if (!frames.length) return;
    var fallbackTimers = new WeakMap();
    // A load event also fires for blocked/error documents. Only an explicit
    // application handshake establishes readiness; the user may opt into an
    // unverified live surface through the overlay's button.
    window.addEventListener("message", function (event) {
      frames.forEach(function (f) {
        var type = f.getAttribute("data-ready-message");
        var url = new URL(f.getAttribute("data-src") || f.src, location.href);
        if (type && event.source === f.contentWindow && event.origin === url.origin &&
            event.data && event.data.type === type && leafSlideFor(f) === Reveal.getCurrentSlide()) {
          f.setAttribute("data-frame-ready", "");
          clearTimeout(fallbackTimers.get(f));
          hideFallback(f);
        }
      });
    });
    function fallbackFor(f) {
      var view = f.parentElement;
      var fb = view.querySelector(".frame-fallback, .viz-fallback, .amrc-fallback");
      if (!fb) {
        var openLink = f.closest(".site-frame") && f.closest(".site-frame").querySelector(".site-frame-open");
        var href = f.getAttribute("data-fallback-href") || (openLink && openLink.getAttribute("href")) || f.getAttribute("data-src") || "";
        fb = elem('<div class="frame-fallback" role="status"><p></p></div>');
        fb.querySelector("p").textContent = LANG === "fr" ? "Ce site utilise une connexion réseau." : "This website uses a network connection.";
        if (href) {
          var link = document.createElement("a");
          link.href = href;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = STR.frameOpen + " ↗";
          fb.appendChild(link);
        }
        var show = document.createElement("button");
        show.type = "button";
        show.className = "frame-show";
        show.textContent = LANG === "fr" ? "Afficher le site ici" : "Show the site here";
        show.addEventListener("click", function () {
          clearTimeout(fallbackTimers.get(f));
          fb.hidden = true;
          f.style.visibility = "";
          if (f.getAttribute("data-src")) f.src = f.getAttribute("data-src");
          f.focus();
        });
        fb.appendChild(show);
        fb.hidden = true;
        view.appendChild(fb);
      }
      return fb;
    }
    function hideFallback(f) {
      var fb = f.parentElement.querySelector(".frame-fallback, .viz-fallback, .amrc-fallback");
      if (fb) fb.hidden = true;
      f.style.visibility = "";
    }
    function watchCurrent() {
      frames.forEach(function (f) {
        clearTimeout(fallbackTimers.get(f));
        fallbackTimers.delete(f);
        f.removeAttribute("data-frame-ready");
      });
      var cur = Reveal.getCurrentSlide();
      if (!cur) return;
      cur.querySelectorAll("iframe").forEach(function (f) {
        var fallback = fallbackFor(f);
        fallback.hidden = false;
        if (fallback.matches("img")) f.style.visibility = "hidden";
        var timer = setTimeout(function () {
          fallbackTimers.delete(f);
          if (!f.hasAttribute("data-frame-ready") && Reveal.getCurrentSlide() === cur) {
            var text = fallback.querySelector("p");
            if (text && fallback.classList.contains("frame-fallback")) text.textContent = STR.frameUnavailable;
          }
        }, 8000);
        fallbackTimers.set(f, timer);
      });
    }
    Reveal.on("slidechanged", watchCurrent);
    if (!Reveal.isPrintView()) watchCurrent();
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
