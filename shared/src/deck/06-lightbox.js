  /* ---- image lightbox: view a figure/screenshot full-screen ----------------
     Fully keyboard-operable: every zoomable image is a focusable control that
     opens with Enter/Space; the dialog focuses its close button, traps Tab,
     navigates with the arrow keys, closes with Escape, and returns focus to
     the originating image. hidden/inert state mirrors the visual state. ------ */
  /* Reveal 5.2+ ships a lightbox of its own, opened by data-preview-image /
     -video / -link on any element inside .slides — the way to show a screencast
     or an on-demand live site, which this viewer (images, one <img src>) cannot.
     Two viewers must never bind one element: the enhancer below stops the click
     before it reaches reveal's delegated handler on .slides, so the native
     overlay would simply never open on an element it had also promoted. The
     author's opt-in wins, and the attribute may sit on the image or on anything
     around it, because that is what reveal's own closest() lookup reads.
     data-preview-link="false" is reveal's opt-out, so it hands the element back. */
  var PREVIEW_OWNED = '[data-preview-image], [data-preview-video],' +
    ' [data-preview-link]:not([data-preview-link="false"])';

  var lightbox, lbImg;
  function buildLightbox() {
    var imgs = Array.prototype.filter.call(
      document.querySelectorAll(".reveal .slides .shot, .reveal .slides .site-frame-view > img"),
      function (img) { return !img.closest(PREVIEW_OWNED); }
    );
    if (!imgs.length) return;
    lightbox = elem(
      '<div class="deck-lightbox" role="dialog" aria-modal="true" aria-label="' + STR.imageViewer + '">' +
        '<button class="lightbox-close" aria-label="' + STR.imageClose + '">' + ICON.close + "</button>" +
        '<figure class="lightbox-figure"><img alt=""><figcaption></figcaption></figure>' +
      "</div>"
    );
    document.body.appendChild(lightbox);
    setDialogHidden(lightbox, true);
    lbImg = lightbox.querySelector("img");
    var lbCap = lightbox.querySelector("figcaption");
    var lbClose = lightbox.querySelector(".lightbox-close");
    var list = Array.prototype.slice.call(imgs);  // navigation order across the deck
    var curIdx = -1, lbLastFocus = null;
    function showAt(i) {
      curIdx = (i + list.length) % list.length;
      var img = list[curIdx];
      var alt = img.getAttribute("alt") || "";
      lbImg.setAttribute("src", img.currentSrc || img.src);
      lbImg.setAttribute("alt", alt);
      lbCap.textContent = alt;
      lbCap.style.display = alt ? "" : "none";
      if (!lightbox.classList.contains("open")) {
        lbLastFocus = document.activeElement;
        lightbox.classList.add("open");
        setDialogHidden(lightbox, false);
        focusWhenVisible(lbClose);
      }
    }
    function closeLightbox() {
      lightbox.classList.remove("open");
      setDialogHidden(lightbox, true);
      lbImg.removeAttribute("src");
      curIdx = -1;
      // Return focus to the image that opened the viewer.
      if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus();
      lbLastFocus = null;
    }
    list.forEach(function (img, i) {
      img.classList.add("is-zoomable");
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      var alt = img.getAttribute("alt") || "";
      img.setAttribute("aria-label", STR.imageView + (alt ? ": " + alt : ""));
      img.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        showAt(i);
      });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); e.stopPropagation();
          showAt(i);
        }
      });
    });
    lightbox.addEventListener("click", closeLightbox); // backdrop, image, or close button
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) return;
      // Tab stays available so the dialog is keyboard-traversable — trap it inside.
      if (e.key === "Tab") {
        e.preventDefault(); e.stopPropagation();
        lbClose.focus();
        return;
      }
      e.stopPropagation(); // never drive the deck behind the lightbox
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); showAt(curIdx + 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); showAt(curIdx - 1); }
    }, true);
  }
