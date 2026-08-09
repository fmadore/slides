/* =============================================================================
   deck.js — the reusable engine for the Africa Multiple / Bayreuth deck.

   This file is GENERIC. You should not need to edit it per talk. Each deck
   only edits index.html: its slides, and the `window.DECK_CONFIG` block near
   the top of that file (presenter, talk metadata, contact links).

   What it does, in order:
     • fills every [data-contact] slot with icon links from DECK_CONFIG
     • initialises reveal.js (custom nav, no stock chrome) with plugins
     • builds the running head (current section) and persistent footer
     • builds the auto table-of-contents overlay from [data-toc] sections
     • keeps everything in sync on each slide change

   Keyboard:  ←/→ navigate · T table of contents · O overview · F fullscreen
              S speaker notes · ? help · Esc closes overlays
   ============================================================================= */
(function () {
  "use strict";

  var CFG = window.DECK_CONFIG || {};
  CFG.links = CFG.links || {};

  /* ---- engine UI strings, language-aware (from <html lang>; default English).
     Add a language by extending I18N; decks opt in via <html lang="xx">. -------- */
  var LANG = (CFG.lang || document.documentElement.lang || "en").slice(0, 2).toLowerCase();
  var I18N = {
    en: { contents: "Contents", overview: "overview", close: "close", prev: "Previous slide", next: "Next slide", tocOpen: "Open table of contents", tocAria: "Table of contents", closeAria: "Close",
          imageViewer: "Image viewer", imageClose: "Close image", imageView: "View image full screen", imagePrev: "Previous image", imageNext: "Next image",
          embedLoading: "Loading file…", embedError: "Could not load the file.", embedSource: "View the source",
          frameUnavailable: "Live view unavailable — it needs a network connection.", frameOpen: "Open the site" },
    fr: { contents: "Sommaire", overview: "aperçu", close: "fermer", prev: "Diapo précédente", next: "Diapo suivante", tocOpen: "Ouvrir le sommaire", tocAria: "Sommaire", closeAria: "Fermer",
          imageViewer: "Visionneuse d’images", imageClose: "Fermer l’image", imageView: "Afficher l’image en plein écran", imagePrev: "Image précédente", imageNext: "Image suivante",
          embedLoading: "Chargement du fichier…", embedError: "Impossible de charger le fichier.", embedSource: "Voir la source",
          frameUnavailable: "Aperçu en direct indisponible — une connexion réseau est requise.", frameOpen: "Ouvrir le site" }
  };
  var STR = I18N[LANG] || I18N.en;

  /* Dev-mode flags: ?check outlines overflow + shows fit scales; ?no-fit (or
     ?audit) disables auto-fitting so authored overflow is visible raw. */
  var CHECK_MODE = /[?&](check|audit)\b/.test(location.search);
  var NO_FIT = /[?&](no-fit|audit)\b/.test(location.search);
  var PRINT = /[?&]print-pdf\b/.test(location.search);

  // Folder this script lives in (e.g. .../shared/) so engine assets resolve no
  // matter how deep the talk page sits. Captured while currentScript is valid.
  var SCRIPT_BASE = (function () {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName("script");
      for (var i = 0; i < all.length; i++) if (/deck\.js(\?|$)/.test(all[i].src)) { s = all[i]; break; }
    }
    return s && s.src ? s.src.replace(/[^\/]*$/, "") : "";
  })();

  /* ---- inline icons (stroke icons inherit currentColor; ORCID keeps its mark) */
  var ICON = {
    prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    toc:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><line x1="9" y1="6" x2="20" y2="6"/><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"/><line x1="9" y1="12" x2="20" y2="12"/><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/><line x1="9" y1="18" x2="20" y2="18"/></svg>',
    close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    github:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
    globe:'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.2"/><path d="M3 12h18M12 2.8c2.6 2.6 3.9 6.2 3.9 9.2s-1.3 6.6-3.9 9.2c-2.6-2.6-3.9-6.2-3.9-9.2S9.4 5.4 12 2.8z"/></svg>',
    mail: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="2.2"/><path d="M3 6.5l9 6 9-6"/></svg>',
    orcid:'<svg viewBox="0 0 256 256" aria-hidden="true"><circle cx="128" cy="128" r="128" fill="#A6CE39"/><g fill="#fff"><path d="M86.3 186.2H70.9V79.1h15.4v107.1z"/><path d="M108.9 79.1h41.6c39.6 0 57 28.3 57 53.6 0 27.5-21.5 53.6-56.8 53.6h-41.8V79.1zm15.4 93.3h24.5c34.9 0 42.9-26.5 42.9-39.7 0-21.5-13.7-39.7-43.7-39.7h-23.7v79.4z"/><circle cx="78.6" cy="56.8" r="10.1"/></g></svg>',
    linkedin:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
  };

  function elem(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function tidyUrl(u) {
    return String(u || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  }

  /* ---- contact links from DECK_CONFIG.links, into every [data-contact] slot */
  function contactHTML() {
    var L = CFG.links, out = [];
    function row(href, icon, label) {
      return '<a href="' + href + '" target="_blank" rel="noopener"><span class="ico">' + icon + "</span><span>" + label + "</span></a>";
    }
    if (L.github)  out.push(row(L.github, ICON.github, tidyUrl(L.github).replace(/^github\.com\//, "")));
    if (L.website) out.push(row(L.website, ICON.globe, tidyUrl(L.website)));
    if (L.orcid)   out.push(row(L.orcid, ICON.orcid, tidyUrl(L.orcid).replace(/^orcid\.org\//, "")));
    if (L.linkedin)out.push(row(L.linkedin, ICON.linkedin, tidyUrl(L.linkedin).replace(/^linkedin\.com\/in\//, "")));
    if (L.email)   out.push(row("mailto:" + L.email, ICON.mail, L.email));
    return out.join("");
  }
