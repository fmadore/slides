  /* ---- live iframes: lazy-load + offline fallback -------------------------
     Every .site-frame-view iframe is converted to reveal's data-src form so it
     loads only when its slide becomes visible (and unloads after).

     A live frame shows the site directly: there is no opt-in step, and the
     frame bar's Open link is the way out. What stays is what is a real
     safeguard. A load event is not evidence (it also fires for blocked and
     error documents), so the engine asks two other questions:
       · Is the site reachable at all? A no-cors request to the frame's URL
         rejects when the network is down or the request is blocked; while it
         is pending, the frame's notice stays up, and if it fails the notice
         says so and keeps its persistent external link. A frame that cannot
         load degrades to a readable ruled fallback, never a blank box.
       · May an authored saved view give way? An author's own saved view
         (img.frame-fallback, or a .frame-fallback / .viz-fallback /
         .amrc-fallback holding one) is evidence the author chose to keep. It
         gives way only when the embed sends its declared readiness message
         (data-ready-message, origin- and source-checked), or when the iframe
         declares data-frame-trusted for this page's origin (an empty value
         trusts any origin) and the site is reachable. Otherwise the saved
         view is what the room sees — which is right for a site that refuses
         to be framed here. */
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
    var activation = new WeakMap();
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
    function frameURL(f) { return f.getAttribute("data-src") || f.getAttribute("src") || ""; }
    var FALLBACK = ".frame-fallback, .viz-fallback, .amrc-fallback";
    function anyFallback(f) { return f.parentElement.querySelector(FALLBACK); }
    function isTrusted(f) {
      if (!f.hasAttribute("data-frame-trusted")) return false;
      var v = f.getAttribute("data-frame-trusted").trim();
      return v === "" || v === location.origin;
    }
    /* The generated notice: a ruled paper-ground fallback with the persistent
       external link. It covers the frame only while the site is being reached
       or once it has proved unreachable. */
    function generatedFallback(f) {
      var view = f.parentElement;
      var openLink = f.closest(".site-frame") && f.closest(".site-frame").querySelector(".site-frame-open");
      var href = f.getAttribute("data-fallback-href") || (openLink && openLink.getAttribute("href")) || frameURL(f);
      var fb = elem('<div class="frame-fallback" data-frame-notice role="status"><p></p></div>');
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
      return fb;
    }
    function hideFallback(f) {
      var fb = anyFallback(f);
      if (fb) fb.hidden = true;
      f.style.visibility = "";
    }
    function markUnavailable(fb) {
      var text = fb.querySelector("p");
      if (text && fb.classList.contains("frame-fallback")) text.textContent = STR.frameUnavailable;
    }
    function watchCurrent() {
      frames.forEach(function (f) {
        clearTimeout(fallbackTimers.get(f));
        fallbackTimers.delete(f);
        activation.delete(f);
        f.removeAttribute("data-frame-ready");
      });
      var cur = Reveal.getCurrentSlide();
      if (!cur) return;
      cur.querySelectorAll("iframe").forEach(function (f) {
        var token = {};
        activation.set(f, token);
        var fallback = anyFallback(f) || generatedFallback(f);
        var generated = fallback.hasAttribute("data-frame-notice");
        if (generated) fallback.querySelector("p").textContent = STR.frameLoading;
        fallback.hidden = false;
        if (fallback.matches("img")) f.style.visibility = "hidden";
        var handshake = f.hasAttribute("data-ready-message");
        // Reachability decides whether the frame may show; a saved view the
        // author kept gives way only on a handshake or a trust declaration.
        var mayShow = generated ? !handshake : (!handshake && isTrusted(f));
        var url = frameURL(f);
        var current = function () { return activation.get(f) === token && Reveal.getCurrentSlide() === cur; };
        var fail = function () {
          if (!current() || f.hasAttribute("data-frame-ready")) return;
          markUnavailable(fallback);
        };
        if (navigator.onLine === false || !url) fail();
        else fetch(new URL(url, location.href).href, { mode: "no-cors", cache: "no-store", credentials: "omit" })
          .then(function () { if (current() && mayShow) hideFallback(f); }, fail);
        var timer = setTimeout(function () {
          fallbackTimers.delete(f);
          if (!f.hasAttribute("data-frame-ready") && current() && !fallback.hidden && (generated || handshake)) fail();
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
