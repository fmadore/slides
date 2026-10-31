  /* Optional process diagrams. Authored labels are the static/readable fallback;
     the SVG vocabulary is decorative and never carries unique information. */
  function initPipelines() {
    var diagrams = Array.from(document.querySelectorAll('[data-pipeline]'));
    if (!diagrams.length) return;
    var sheet = '<rect class="pipeline-paper" x="30" y="12" width="90" height="108"/>';
    var lines = [38, 54, 70, 86, 102].map(function (y, i) {
      return '<path class="pipeline-ink pipeline-draw" style="--part:' + i + '" d="M44 ' + y + 'h' + (i % 2 ? 48 : 62) + '"/>';
    }).join('');
    var art = {
      scan: '<g class="pipeline-fan"><rect class="pipeline-paper" x="16" y="24" width="90" height="108"/></g>' +
        '<g class="pipeline-fan">' + sheet + '<path class="pipeline-ink" d="M44 34h62M44 46h62M44 62h25v40H44zM80 62h26M80 76h26M80 90h26"/></g>',
      text: sheet + lines,
      entities: sheet + lines + '<g class="pipeline-mark pipeline-draw"><path d="M40 54h58M40 86h48"/></g>',
      match: '<path class="pipeline-link pipeline-draw" d="M44 30C85 30 65 72 104 72M44 72h60M44 114C85 114 65 72 104 72"/>' +
        '<g class="pipeline-paper"><rect x="4" y="18" width="40" height="24"/><rect x="4" y="60" width="40" height="24"/><rect x="4" y="102" width="40" height="24"/><rect x="104" y="50" width="40" height="44"/></g>' +
        '<path class="pipeline-ink" d="M12 30h24M12 72h24M12 114h24M112 64h24M112 78h16"/>',
      review: sheet + '<path class="pipeline-ink" d="M44 34h62M44 50h46"/>' +
        '<path class="pipeline-check pipeline-draw" d="M47 84l15 15 34-36"/>',
      table: '<rect class="pipeline-paper" x="4" y="22" width="142" height="100"/>' +
        '<path class="pipeline-ink" d="M4 46h142M54 22v100M102 22v100"/>' + [62,86,110].map(function(y,i){
          return '<path class="pipeline-ink pipeline-draw" style="--part:' + i + '" d="M14 ' + y + 'h30M64 ' + y + 'h28M112 ' + y + 'h24"/>';
        }).join(''),
      audio: Array.from({length: 20}, function (_, i) {
        var height = 16 + Math.round(64 * Math.abs(Math.sin(i * 1.7)));
        return '<path class="pipeline-ink pipeline-draw" style="--part:' + (i % 5) + '" d="M' + (8 + i * 7) + ' ' + (72 - height / 2) + 'v' + height + '"/>';
      }).join('')
    };
    diagrams.forEach(function (diagram) {
      var slide = leafSlideFor(diagram);
      var steps = Array.from(diagram.querySelectorAll('.pipeline-step'));
      // Leave unsupported compositions as complete, readable HTML rather than
      // letting automatic playback consume another widget's fragments.
      if (!slide || steps.length < 2 || steps.length > 5 ||
          slide.querySelectorAll('[data-pipeline]').length !== 1 || slide.querySelector('.fragment')) return;
      var timer = null, playing = false, advancing = false, staticMode = null;
      var controls = document.createElement('div');
      controls.className = 'pipeline-controls';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pipeline-play';
      button.textContent = STR.pipelinePlay;
      controls.appendChild(button);
      diagram.appendChild(controls);
      diagram.querySelectorAll('[data-pipeline-art]').forEach(function (slot) {
        var drawing = art[slot.getAttribute('data-pipeline-art')];
        if (!drawing) return;
        slot.setAttribute('aria-hidden', 'true');
        // Only fixed, local SVG strings enter innerHTML; never authored labels.
        slot.innerHTML = '<svg viewBox="0 0 150 144" focusable="false" aria-hidden="true">' + drawing + '</svg>';
      });
      function stop() {
        clearTimeout(timer); timer = null; playing = false;
        button.textContent = STR.pipelinePlay;
        button.setAttribute('aria-pressed', 'false');
      }
      function still() {
        return PRINT || motionPreference.matches || PARAMS.get('view') === 'scroll' ||
          (Reveal.isScrollView && Reveal.isScrollView()) ||
          msOf(getComputedStyle(diagram).getPropertyValue('--draw-run'), 560) === 0;
      }
      function refresh() {
        var nextStatic = still();
        if (nextStatic === staticMode) return;
        staticMode = nextStatic;
        stop();
        diagram.classList.toggle('pipeline-static', staticMode);
        controls.hidden = staticMode;
        steps.slice(1).forEach(function (step) {
          step.classList.toggle('fragment', !staticMode);
          step.classList.toggle('custom', !staticMode);
          if (staticMode) step.classList.remove('visible', 'current-fragment');
        });
        if (Reveal.isReady()) Reveal.sync();
      }
      function schedule() {
        timer = setTimeout(function () {
          if (!playing || document.hidden || Reveal.getCurrentSlide() !== slide || still()) { stop(); return; }
          if (steps.slice(1).every(function (step) { return step.classList.contains('visible'); })) { stop(); return; }
          advancing = true;
          Reveal.nextFragment();
          advancing = false;
          schedule();
        }, 1400);
      }
      button.addEventListener('keydown', function (event) {
        if (event.key === ' ' || event.key === 'Enter') event.stopPropagation();
      });
      button.addEventListener('click', function () {
        if (playing) { stop(); return; }
        if (still() || Reveal.getCurrentSlide() !== slide) return;
        // A pipeline owns its slide's fragments, as documented in the authoring contract.
        var indices = Reveal.getIndices(slide);
        Reveal.slide(indices.h, indices.v, -1);
        playing = true;
        button.textContent = STR.pipelinePause;
        button.setAttribute('aria-pressed', 'true');
        schedule();
      });
      Reveal.on('fragmentshown', function () { if (!advancing) stop(); });
      Reveal.on('fragmenthidden', function () { if (!advancing) stop(); });
      Reveal.on('slidechanged', stop);
      Reveal.on('overviewshown', stop);
      document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
      motionPreference.addEventListener('change', refresh);
      // Reveal toggles scroll mode on the viewport; the same observer covers
      // the deck/slide no-draw opt-out without watching fragment mutations.
      var observer = new MutationObserver(refresh);
      [document.querySelector('.reveal'), document.querySelector('.reveal-viewport'), slide].forEach(function (el) {
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['class'] });
      });
      Reveal.on('ready', refresh);
      refresh();
    });
  }
