/* Elite Renovations — progressive enhancement only.
   Every page renders and reads fine with JS disabled. */
(function () {
  'use strict';

  /* ---------- header state ---------- */
  var hdr = document.querySelector('.hdr');
  /* The real header height, for the sticky catalogue toolbar and the menu's
     top padding. It is 150–173px on a phone, not the 76px the CSS assumed. */
  var setHdrH = function () {
    if (hdr) document.documentElement.style.setProperty('--hdr-h', hdr.offsetHeight + 'px');
  };
  setHdrH();
  window.addEventListener('resize', setHdrH, { passive: true });
  window.addEventListener('load', setHdrH);
  if (hdr) {
    var solid = function () {
      var on = window.scrollY > 24;
      hdr.classList.toggle('hdr--solid', on);
      hdr.classList.toggle('hdr--over', !on);
    };
    solid();
    window.addEventListener('scroll', solid, { passive: true });
  }

  /* ---------- full-screen menu ---------- */
  var menuBtn = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu');
  if (menuBtn && menu) {
    var setMenu = function (open) {
      document.body.classList.toggle('nav-open', open);
      document.documentElement.classList.toggle('nav-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      var label = menuBtn.querySelector('.menu-btn__label');
      // the words come from the page, so an Arabic page says them in Arabic
      if (label) label.textContent = open ? (menuBtn.getAttribute('data-close-label') || 'Close') : (menuBtn.getAttribute('data-open-label') || 'Menu');
      if (open) {
        setHdrH();
        var first = menu.querySelector('a');
        if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }, 60);
      }
    };
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { setMenu(false); menuBtn.focus(); }
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  }

  /* ---------- scroll reveal ---------- */
  var targets = document.querySelectorAll('.reveal');
  if (targets.length) {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
      targets.forEach(function (t) { t.classList.add('in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      targets.forEach(function (t) { io.observe(t); });
    }
  }

  /* ---------- current year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- analytics helper (no-op until IDs are configured) ---------- */
  function track(event, params) {
    try { if (typeof window.fbq === 'function') window.fbq('track', event, params || {}); } catch (e) {}
    try { if (typeof window.gtag === 'function') window.gtag('event', event, params || {}); } catch (e) {}
  }
  window.erTrack = track;

  /* Meta/GA conversion signals on the actions that matter */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) track('Contact', { method: 'phone' });
    else if (href.indexOf('wa.me') > -1) track('Contact', { method: 'whatsapp' });
    else if (href.indexOf('mailto:') === 0) track('Contact', { method: 'email' });
  });

  /* ---------- stone catalogue: search + filter ----------
     Every stone is server-rendered; this only hides and shows. With JS off
     the full catalogue is still there, which is also what crawlers index. */
  var grid = document.querySelector('[data-stone-grid]');
  if (grid) {
    var tiles = [].slice.call(grid.querySelectorAll('[data-stone]'));
    var searchEl = document.querySelector('[data-stone-search]');
    var countEl = document.querySelector('[data-stone-count]');
    var emptyEl = document.querySelector('[data-stone-empty]');
    var chips = [].slice.call(document.querySelectorAll('[data-stone-filters] .chip'));
    var key = chips.length && chips[0].hasAttribute('data-colour') ? 'colour' : 'family';
    var active = 'all';

    /* Fold the spellings Egyptians actually type: أ/إ/آ→ا, ة→ه, ى→ي, no
       tashkeel or tatweel. جلاله and جلالة, اونيكس and أونيكس find the same stone. */
    function norm(x) {
      return String(x || '').toLowerCase()
        .replace(/[\u064B-\u0652\u0640]/g, '')
        .replace(/[\u0623\u0625\u0622]/g, '\u0627')
        .replace(/\u0629/g, '\u0647')
        .replace(/\u0649/g, '\u064A');
    }
    tiles.forEach(function (t) { t._s = norm(t.getAttribute('data-search')); });
    function apply() {
      var q = norm((searchEl && searchEl.value || '').trim());
      var words = q.split(/\s+/).filter(Boolean);
      var shown = 0;
      tiles.forEach(function (t) {
        var okCat = active === 'all' || t.getAttribute('data-' + key) === active;
        // every word must appear, in any order: "calacatta white" finds "White Calacatta"
        var okQ = !words.length || words.every(function (w) { return t._s.indexOf(w) > -1; });
        var vis = okCat && okQ;
        t.hidden = !vis;
        if (vis) shown++;
      });
      if (countEl) countEl.textContent = shown + ' ' + (shown === 1 ? (countEl.getAttribute('data-one') || 'stone') : (countEl.getAttribute('data-many') || 'stones'));
      if (emptyEl) emptyEl.hidden = shown !== 0;
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        active = c.getAttribute('data-' + key) || 'all';
        chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
        apply();
      });
    });
    if (searchEl) {
      searchEl.addEventListener('input', apply);
      searchEl.addEventListener('search', apply);
    }
    /* deep link: /catalogue/?q=galala or #granite */
    var params = new URLSearchParams(location.search);
    if (params.get('q') && searchEl) searchEl.value = params.get('q');
    var hash = location.hash.replace('#', '');
    if (hash) {
      var match = chips.filter(function (c) { return c.getAttribute('data-' + key) === hash; })[0];
      if (match) match.click();
    }
    apply();
  }

  /* ---------- prefill the enquiry form from ?service= / ?stone= ---------- */
  (function () {
    var qp = new URLSearchParams(location.search);
    var stone = qp.get('stone'), service = qp.get('service');
    var f = document.querySelector('form[data-quote-form]');
    var msg = f && f.querySelector('[name=message]');
    // the sentence comes from the page (per language); the stone's display name from ?name=
    var name = qp.get('name') || (stone || '').replace(/-/g, ' ');
    if (msg && !msg.value) {
      if (stone) msg.value = (f.getAttribute('data-prefill-stone') || 'I would like a price on {x}. ').replace('{x}', name);
      else if (service) msg.value = (f.getAttribute('data-prefill-service') || 'I am interested in {x}. ').replace('{x}', service.replace(/-/g, ' '));
    }
    var sel = f && f.querySelector('[name=service]');
    if (sel && service) {
      var flat = function (x) { return String(x || '').toLowerCase().replace(/[^a-z]/g, ''); };
      [].slice.call(sel.options).forEach(function (o) {
        if (o.getAttribute('data-slug') === service || (flat(o.value) && flat(o.value) === flat(service))) sel.value = o.value;
      });
    }
  })();

  /* ---------- enquiry form: capture first, then hand off ----------
     The old behaviour was WhatsApp-only. If the visitor's WhatsApp did not
     open — desktop without WhatsApp Web, blocked popup, closed tab — the
     enquiry was gone: nothing stored, nobody told. Now the lead is POSTed
     first and the WhatsApp hand-off is a bonus on top. If the POST fails we
     still open WhatsApp, so the enquiry survives either failure. */
  var form = document.querySelector('form[data-quote-form]');
  if (form) {
    var endpoint = form.dataset.endpoint || '';
    var sending = false;

    /* Arabic-Indic (٠-٩) and Persian (۰-۹) digits become 0-9: the office
       endpoint only reads ASCII digits and rejected a phone typed in Arabic. */
    var asciiDigits = function (x) {
      return String(x || '').replace(/[\u0660-\u0669]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
        .replace(/[\u06F0-\u06F9]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
    };
    var val = function (n) {
      var el = form.querySelector('[name=' + n + ']');
      var v = el ? el.value.trim() : '';
      return n === 'phone' ? asciiDigits(v) : v;
    };

    var waLabels = (function () {
      try { return JSON.parse(form.getAttribute('data-wa-labels') || 'null'); } catch (e) { return null; }
    })() || { title: 'New enquiry from the website', name: 'Name', phone: 'Phone', email: 'Email', area: 'Location', property: 'Property', service: 'Service', timeline: 'Timeline' };

    function waMessage() {
      var lines = [waLabels.title, ''];
      ['name', 'phone', 'email', 'area', 'property', 'service', 'timeline']
        .forEach(function (k) { if (val(k)) lines.push(waLabels[k] + ': ' + val(k)); });
      if (val('message')) lines.push('', val('message'));
      return lines.join('\n');
    }

    function waUrl() {
      return 'https://wa.me/' + form.dataset.whatsapp + '?text=' + encodeURIComponent(waMessage());
    }
    function openWhatsApp() {
      if (!form.dataset.whatsapp) return;
      window.open(waUrl(), '_blank', 'noopener');
    }

    /* `captured` says whether the office actually has the enquiry. Telling a
       visitor it is "already with us" when the POST failed is a lie at the one
       moment it matters — they stop chasing and the lead is gone. */
    function done(captured) {
      var panel = document.querySelector('[data-form-done]');
      if (!panel) return;
      panel.querySelectorAll('[data-done-if]').forEach(function (el) {
        el.hidden = (el.dataset.doneIf === 'captured') !== !!captured;
      });
      // every WhatsApp button in the panel carries the visitor's full enquiry,
      // so one tap recovers it even if the pop-up was blocked
      if (form.dataset.whatsapp) {
        panel.querySelectorAll('a[href*="wa.me"]').forEach(function (a) { a.href = waUrl(); });
      }
      panel.hidden = false;
      form.hidden = true;
      panel.setAttribute('tabindex', '-1');
      panel.focus();
      panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;

      var ok = true;
      form.querySelectorAll('[required], input[type=email]').forEach(function (input) {
        var field = input.closest('.field');
        var raw = input.value.trim();
        var valid;
        if (input.type === 'email') valid = raw === '' || input.checkValidity();
        else if (input.name === 'phone') valid = asciiDigits(raw).replace(/\D/g, '').length >= 8;
        else valid = raw !== '' && input.checkValidity();
        if (field) field.classList.toggle('invalid', !valid);
        input.setAttribute('aria-invalid', String(!valid));
        if (!valid && ok) { ok = false; input.focus(); }
      });
      if (!ok) return;

      track('Lead', {
        content_category: val('service') || 'general',
        content_name: val('area') || 'unspecified'
      });

      var btn = form.querySelector('[type=submit]');
      var label = btn ? btn.textContent : '';
      sending = true;
      // The label comes from the page so an Arabic form says it in Arabic.
      if (btn) { btn.disabled = true; btn.textContent = btn.getAttribute('data-sending') || 'Sending…'; }

      var restore = function () {
        sending = false;
        if (btn) { btn.disabled = false; btn.textContent = label; }
      };

      if (!endpoint) { restore(); openWhatsApp(); done(false); return; }

      var payload = {
        name: val('name'), phone: val('phone'), email: val('email'),
        area: val('area'), property: val('property'), service: val('service'),
        timeline: val('timeline'), message: val('message'),
        _gotcha: val('_gotcha'),
        source: window.location.host + window.location.pathname
      };

      // Do not let a slow network hold the visitor: hand off after 6 seconds
      // regardless, and let the POST finish in the background.
      var handedOff = false;
      var handOff = function (captured, late) {
        if (handedOff) return;
        handedOff = true;
        restore();
        // A pop-up opened six seconds after the tap is blocked by Safari; on
        // that path the panel's WhatsApp button (prefilled) does the job.
        if (!late) openWhatsApp();
        done(captured);
      };
      // A hand-off forced by the timeout has NOT been confirmed captured.
      var timer = setTimeout(function () { handOff(false, true); }, 6000);

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.ok ? r.json().catch(function () { return {}; }) : null;
      }).then(function (res) {
        clearTimeout(timer);
        // a bare {ok:true} is the honeypot answer, not a stored lead
        handOff(!!(res && (res.stored || res.emailed)));
      }).catch(function () { clearTimeout(timer); handOff(false); });
    });

    form.querySelectorAll('[required]').forEach(function (input) {
      input.addEventListener('input', function () {
        var f = input.closest('.field');
        if (f && f.classList.contains('invalid') && input.value.trim() !== '') f.classList.remove('invalid');
      });
    });
  }
})();

/* --------------------- before / after sliders --------------------- */
(function () {
  var nodes = document.querySelectorAll('[data-ba]');
  if (!nodes.length) return;
  nodes.forEach(function (fig) {
    var clip = fig.querySelector('.ba-slide__clip');
    var range = fig.querySelector('.ba-slide__range');
    var handle = fig.querySelector('.ba-slide__handle');
    if (!clip || !range) return;
    function set(v) {
      clip.style.setProperty('--x', v + '%');
      if (handle) handle.style.left = v + '%';
    }
    set(range.value);
    range.addEventListener('input', function () { set(range.value); });
    // dragging anywhere on the image, not just the 20px handle
    var box = fig.querySelector('.ba-slide__box');
    var dragging = false;
    function at(e) {
      var r = box.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      var v = Math.max(0, Math.min(100, (x / r.width) * 100));
      range.value = v; set(v);
    }
    box.addEventListener('pointerdown', function (e) { dragging = true; at(e); box.setPointerCapture(e.pointerId); });
    box.addEventListener('pointermove', function (e) { if (dragging) at(e); });
    box.addEventListener('pointerup', function () { dragging = false; });
    box.addEventListener('pointercancel', function () { dragging = false; });
  });
})();

/* ----------------------------- slideshows ------------------------- */
(function () {
  var shows = document.querySelectorAll('[data-show]');
  if (!shows.length) return;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  shows.forEach(function (fig) {
    var frames = [].slice.call(fig.querySelectorAll('.show__f'));
    var dots = [].slice.call(fig.querySelectorAll('.show__dot'));
    if (frames.length < 2) return;
    var i = 0, timer = null, gap = parseInt(fig.dataset.interval, 10) || 3800;
    function go(n) {
      frames[i].classList.remove('is-on'); if (dots[i]) { dots[i].classList.remove('is-on'); dots[i].removeAttribute('aria-current'); }
      i = (n + frames.length) % frames.length;
      frames[i].classList.add('is-on'); if (dots[i]) { dots[i].classList.add('is-on'); dots[i].setAttribute('aria-current', 'true'); }
    }
    function play() { if (still || timer) return; timer = setInterval(function () { go(i + 1); }, gap); }
    function stop() { clearInterval(timer); timer = null; }
    dots.forEach(function (d, n) { d.addEventListener('click', function () { stop(); go(n); }); });
    fig.addEventListener('mouseenter', stop);
    fig.addEventListener('mouseleave', play);
    fig.addEventListener('focusin', stop);
    fig.addEventListener('focusout', play);
    // only run while on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { e.isIntersecting ? play() : stop(); });
      }, { threshold: 0.25 }).observe(fig);
    } else { play(); }
  });
})();

/* --------- clips play when they reach the screen, not before ---------
   preload="none" keeps them off the wire until they matter; this starts
   them on intersection and pauses them again on the way out, so a page of
   ten walkthroughs costs one clip's bandwidth rather than ten. */
(function () {
  var vids = document.querySelectorAll('video[data-lazyplay]');
  if (!vids.length || !('IntersectionObserver' in window)) return;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (still) return;
        // 'metadata', not 'auto': auto kept downloading every clip to the end
        // after it scrolled away (16 MB on one scroll of the home page)
        if (v.preload === 'none') v.preload = 'metadata';
        var play = v.play();
        if (play && play.catch) play.catch(function () { /* autoplay refused: poster stands */ });
      } else if (!v.paused) { v.pause(); }
    });
  }, { threshold: 0.35 });
  [].forEach.call(vids, function (v) { io.observe(v); });
})();
