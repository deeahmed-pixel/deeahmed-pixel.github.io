/* Itmam Finishing & Supply — progressive enhancement only.
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
  /* v5: every page carries a quick quotation form (the strip above the
     footer), and some carry two. Each form gets its own handler and its own
     thank-you panel — the panel that sits next to it, not the first one on
     the page. */
  document.querySelectorAll('form[data-quote-form]').forEach(function (form) {
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
      var panel = (form.parentElement && form.parentElement.querySelector('[data-form-done]')) || document.querySelector('[data-form-done]');
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
      // where this visit came from (first page, Google/Facebook/…): see the end of this file
      if (window.itmVisit) { var vi = window.itmVisit({}); for (var vk in vi) payload[vk] = vi[vk]; }

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
  });
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


/* ------------------------- v5: mega menus -------------------------
   Desktop: open on hover (with a short grace period so a diagonal mouse
   path does not close it), on keyboard focus, and on tap. First tap on a
   touch screen opens the menu; a second tap follows the link. Escape and a
   click outside close it. */
(function () {
  var items = [].slice.call(document.querySelectorAll('.nav__item[data-mega]'));
  if (!items.length) return;
  var timer = null;
  function closeAll(except) {
    items.forEach(function (li) {
      if (li !== except) { li.classList.remove('is-open'); var a = li.querySelector('.nav__link'); if (a) a.setAttribute('aria-expanded', 'false'); }
    });
  }
  function open(li) {
    clearTimeout(timer); closeAll(li);
    li.classList.add('is-open');
    var a = li.querySelector('.nav__link'); if (a) a.setAttribute('aria-expanded', 'true');
  }
  var finePointer = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  items.forEach(function (li) {
    var link = li.querySelector('.nav__link');
    if (finePointer) {
      li.addEventListener('mouseenter', function () { clearTimeout(timer); timer = setTimeout(function () { open(li); }, 90); });
      li.addEventListener('mouseleave', function () { clearTimeout(timer); timer = setTimeout(function () { li.classList.remove('is-open'); if (link) link.setAttribute('aria-expanded', 'false'); }, 220); });
    }
    li.addEventListener('focusin', function () { open(li); });
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) { li.classList.remove('is-open'); if (link) link.setAttribute('aria-expanded', 'false'); } });
    if (link) link.addEventListener('click', function (e) {
      if (!finePointer && !li.classList.contains('is-open')) { e.preventDefault(); open(li); }
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.nav__item[data-mega]')) closeAll(); });
})();

/* --------------------- v5: gallery filters + viewer -----------------
   The gallery shows every curated photograph; chips filter it by trade or
   place without a page load, and a tap opens a full-screen viewer with
   keyboard and swipe navigation. Works as a plain grid of links (each
   opens the image) with JS off. */
(function () {
  var gal = document.querySelector('[data-gal]');
  if (!gal) return;
  var grid = gal.querySelector('.gal__grid');
  var all = [].slice.call(gal.querySelectorAll('.gal__i'));
  var count = gal.querySelector('[data-gal-count]');
  var more = gal.querySelector('[data-gal-more]');
  var PAGE = 60, shown = PAGE, filter = '*';
  function visible() { return all.filter(function (a) { return filter === '*' || (' ' + a.getAttribute('data-tags') + ' ').indexOf(' ' + filter + ' ') > -1; }); }
  function render() {
    var v = visible();
    all.forEach(function (a) { a.hidden = true; });
    v.slice(0, shown).forEach(function (a) { a.hidden = false; var im = a.querySelector('img[data-src]'); if (im) { im.src = im.getAttribute('data-src'); im.removeAttribute('data-src'); } });
    if (count) count.textContent = (count.getAttribute('data-fmt') || '{n}').replace('{n}', v.length);
    if (more) more.hidden = v.length <= shown;
  }
  gal.querySelectorAll('[data-gal-filter]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      filter = chip.getAttribute('data-gal-filter'); shown = PAGE;
      gal.querySelectorAll('[data-gal-filter]').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      render();
      var top = gal.getBoundingClientRect().top + window.scrollY - 140;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });
  if (more) more.addEventListener('click', function () { shown += PAGE; render(); });
  var start = new URLSearchParams(location.search).get('show');
  if (start) { var c0 = gal.querySelector('[data-gal-filter="' + start.replace(/[^a-z0-9-]/g, '') + '"]'); if (c0) { c0.click(); } else { render(); } } else { render(); }

  /* viewer */
  var lb = document.querySelector('.lb');
  if (!lb) return;
  var img = lb.querySelector('.lb__stage img'), cap = lb.querySelector('.lb__cap'), pos = lb.querySelector('[data-lb-pos]');
  var list = [], i = 0, last = null;
  function show(n) {
    i = (n + list.length) % list.length;
    var a = list[i];
    img.src = a.getAttribute('href'); img.alt = a.getAttribute('data-alt') || '';
    cap.textContent = a.getAttribute('data-cap') || '';
    if (pos) pos.textContent = (i + 1) + ' / ' + list.length;
  }
  function openAt(a) {
    list = visible(); last = a; show(list.indexOf(a));
    lb.classList.add('is-open'); document.documentElement.style.overflow = 'hidden';
    lb.querySelector('.lb__close').focus();
  }
  function close() { lb.classList.remove('is-open'); document.documentElement.style.overflow = ''; img.src = ''; if (last) last.focus(); }
  grid.addEventListener('click', function (e) {
    var a = e.target.closest('.gal__i'); if (!a) return;
    e.preventDefault(); openAt(a);
  });
  var rtl = document.documentElement.dir === 'rtl';
  lb.querySelector('.lb__close').addEventListener('click', close);
  lb.querySelector('.lb__prev').addEventListener('click', function () { show(i - 1); });
  lb.querySelector('.lb__next').addEventListener('click', function () { show(i + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb__stage')) close(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(i + (rtl ? -1 : 1));
    if (e.key === 'ArrowLeft') show(i + (rtl ? 1 : -1));
  });
  var x0 = null;
  lb.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 45) show(i + ((dx < 0) !== rtl ? 1 : -1));
  });
})();

/* ----------------- v5: tap-to-play video tiles ------------------
   A page of clips shows posters only; a clip loads when it is tapped, so
   the videos page is a few hundred kilobytes, not two hundred megabytes. */
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-video]');
    if (!a || a.classList.contains('is-playing')) return;
    e.preventDefault();
    var v = document.createElement('video');
    v.src = a.getAttribute('href'); v.controls = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
    var img = a.querySelector('img'); if (img) v.poster = img.src;
    a.classList.add('is-playing');
    if (img) img.replaceWith(v); else a.appendChild(v);
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  });
})();

/* ------------- tell the office which page a WhatsApp came from -------------
   v5 added the page ADDRESS to the message ("(/ar/finishing/villas/)"), which
   the visitor sees in their own chat box and reads as a glitch. Since
   2026-10-07 a button that still carries the general greeting gets the page's
   own heading instead — "قريت صفحة «تشطيب فيلات» وعايز أسأل" — which tells the
   office the same thing in words the visitor would write. Buttons that already
   name the page (landing pages) are left alone; so is the home page. */
(function () {
  var GENERIC = /عايز أتكلم معاكم عن مشروع|I'd like to discuss a project/;
  var home = /^\/(ar\/)?$/.test(location.pathname);
  var h1 = document.querySelector('main h1, h1');
  var title = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
  if (title.length > 80) title = title.slice(0, 78).replace(/\s+\S*$/, '') + '…';
  var ar = (document.documentElement.lang || '').indexOf('ar') === 0;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="wa.me/"]');
    if (!a || home || !title || a.hasAttribute('data-noref') || a.closest('[data-form-done]')) return;
    try {
      var u = new URL(a.href);
      if (!GENERIC.test(u.searchParams.get('text') || '')) return;
      u.searchParams.set('text', ar
        ? 'السلام عليكم — قريت صفحة "' + title + '" على موقع إتمام وعايز أسأل.'
        : 'Hello Itmam — I read "' + title + '" on your website and have a question.');
      a.href = u.toString();
    } catch (err) {}
  }, true);
})();

/* ------------- quantity calculator (2026-10-07) -------------
   The cost-by-size guide answers "تشطيب شقة 100 متر بيتكلف كام" with
   quantities, never money. Rules of thumb, shown as ranges (cutting waste
   included):
     floors        area × 1.05–1.10
     ceilings      area × 1.00–1.05
     bathroom tile per bathroom: perimeter of a roughly 4:5 room (4.1 × √area) ×
                   tiled height (ceiling − 0.3 m for the false ceiling, at most
                   2.5 m) − one door (1.6 m²), × 1.05–1.10
     wall paint    area × 2.5–3.5 × (ceiling ÷ 3 m), less the tiled bathroom walls
     skirting      wall length ≈ area × 2.5–3.5 ÷ 3, less the bathrooms, about 7 m
                   of kitchen wall behind cabinets and ~0.9 m per door (a door
                   for every ~12 m²), × 1.05
   Kept in step with the worked examples on /guides/apartment-finishing-cost-by-size/.
   "Send" writes the result into the quote form's message box and takes the
   visitor there, so the quantities arrive with the enquiry. */
(function () {
  document.querySelectorAll('[data-qcalc]').forEach(function (box) {
    var L = {};
    try { L = JSON.parse(box.getAttribute('data-labels') || '{}'); } catch (e) {}
    var get = function (n, d) {
      var el = box.querySelector('[name=' + n + ']');
      var v = el ? parseFloat(String(el.value).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x0660; }).replace(',', '.')) : NaN;
      return isFinite(v) && v > 0 ? v : d;
    };
    var r5 = function (x) { return Math.max(0, Math.round(x / 5) * 5); };
    var range = function (a, b, unit) {
      if (r5(a) === r5(b)) return L.about + ' ' + r5(a) + ' ' + unit;
      return (L.from ? L.from + ' ' : '') + r5(a) + ' ' + L.to + ' ' + r5(b) + ' ' + unit;
    };
    var lastText = '';
    box.querySelector('.qc__go').addEventListener('click', function () {
      var A = get('area', 0);
      var err = box.querySelector('.qc__err'), out = box.querySelector('.qc__out');
      if (!A || A < 20) { err.hidden = false; out.hidden = true; return; }
      err.hidden = true;
      var h = Math.min(Math.max(get('height', 3), 2.4), 6);
      var b = Math.round(get('baths', 0)), ba = get('bathArea', 5);
      var bathPerim = 4.1 * Math.sqrt(ba);
      var bathWall = Math.max(0, bathPerim * Math.min(h - 0.3, 2.5) - 1.6) * b;
      var notSkirted = b * bathPerim + 7 + A / 12 * 0.9;   // bathrooms, kitchen cabinets, doors
      var rows = [
        [L.floor, range(A * 1.05, A * 1.10, L.m2)],
        [L.paint, range(Math.max(0, A * 2.5 * h / 3 - bathWall), Math.max(0, A * 3.5 * h / 3 - bathWall), L.m2)],
        [L.ceil, range(A, A * 1.05, L.m2)],
        [L.bathTiles, b ? range(bathWall * 1.05, bathWall * 1.10, L.m2) : '—'],
        [L.skirt, range(Math.max(0, A * 2.5 / 3 - notSkirted) * 1.05, Math.max(0, A * 3.5 / 3 - notSkirted) * 1.05, L.m)]
      ];
      var tb = out.querySelector('tbody');
      tb.innerHTML = '';
      rows.forEach(function (r) {
        var tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
        th.scope = 'row'; th.textContent = r[0]; td.textContent = r[1];
        tr.appendChild(th); tr.appendChild(td); tb.appendChild(tr);
      });
      lastText = L.msg + ' — ' + L.sArea + ' ' + A + ' ' + L.m2 + L.sep + L.sHeight + ' ' + h + ' ' + L.unitM + L.sep + L.sBaths + ' ' + b + ' × ' + ba + ' ' + L.m2 + ':\n' +
        rows.map(function (r) { return '• ' + r[0] + ': ' + r[1]; }).join('\n');
      var wa = box.querySelector('.qc__wa');
      if (wa) wa.href = 'https://wa.me/' + box.getAttribute('data-wa') + '?text=' + encodeURIComponent(lastText);
      out.hidden = false;
    });
    box.querySelector('.qc__send').addEventListener('click', function (e) {
      var form = document.querySelector('#quote form[data-quote-form]') || document.querySelector('form[data-quote-form]');
      var msg = form && form.querySelector('[name=message]');
      if (!form || !msg || !lastText) return;
      e.preventDefault();
      msg.value = lastText + (msg.value ? '\n\n' + msg.value : '');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var name = form.querySelector('[name=name]');
      if (name) setTimeout(function () { name.focus({ preventScroll: true }); }, 500);
    });
  });
})();

/* ------------- tile and paint calculators (2026-10-07) -------------
   /guides/tile-calculator/ and /guides/paint-calculator/. Quantities only,
   never money (Dee: quantity figures are fine).
   Tiles:  floor = length × width; walls = 2 × (length + width) × tiling height
           − 1.6 m² per door. To buy = net × (1 + wastage). Tiles = to buy ÷ one
           tile's area, rounded up; cartons = to buy ÷ m² per carton, rounded up
           (only if typed). Skirting (floor) = perimeter − 0.9 m per door.
   Paint:  room walls = 2 × (length + width) × height − 1.8 m² per door − 1.5 m²
           per window; flat walls = area × 2.5–3.5 × height ÷ 3 (the cost-by-size
           rule); ceiling = floor area. Litres = area × coats ÷ coverage; primer =
           area ÷ coverage, one coat. */
(function () {
  var counted = function (n, sing, pl) { return n + ' ' + (pl && n >= 3 && n <= 10 ? pl : sing); };
  var digits = function (s) { return String(s).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x0660; }).replace(',', '.'); };
  var setup = function (box, solve) {
    var L = {};
    try { L = JSON.parse(box.getAttribute('data-labels') || '{}'); } catch (e) {}
    var field = function (n) { return box.querySelector('[name=' + n + ']'); };
    var num = function (n, d) { var el = field(n); var v = el ? parseFloat(digits(el.value)) : NaN; return isFinite(v) && v >= 0 && el.value !== '' ? v : d; };
    var mode = function () { var r = box.querySelector('.qc__mode input:checked'); return r ? r.value : ''; };
    var sync = function () {
      var m = mode(), size = field('size');
      box.querySelectorAll('[data-only]').forEach(function (el) {
        var o = el.getAttribute('data-only');
        el.hidden = o === 'own' ? !(size && size.value === 'own') : o.split(' ').indexOf(m) < 0;
      });
    };
    box.addEventListener('change', sync);
    sync();
    var r1 = function (x) { return Math.round(x * 10) / 10; };
    var lastText = '';
    box.querySelector('.qc__go').addEventListener('click', function () {
      var res = solve({ L: L, num: num, mode: mode(), field: field, r1: r1 });
      var err = box.querySelector('.qc__err'), out = box.querySelector('.qc__out');
      if (!res) { err.hidden = false; out.hidden = true; return; }
      err.hidden = true;
      var tb = out.querySelector('tbody');
      tb.innerHTML = '';
      res.rows.forEach(function (r) {
        var tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
        th.scope = 'row'; th.textContent = r[0]; td.textContent = r[1];
        tr.appendChild(th); tr.appendChild(td); tb.appendChild(tr);
      });
      lastText = L.msg + ' — ' + res.input + ':\n' + res.rows.map(function (r) { return '• ' + r[0] + ': ' + r[1]; }).join('\n');
      var wa = box.querySelector('.qc__wa');
      if (wa) wa.href = 'https://wa.me/' + box.getAttribute('data-wa') + '?text=' + encodeURIComponent(lastText);
      out.hidden = false;
    });
    box.querySelector('.qc__send').addEventListener('click', function (e) {
      var form = document.querySelector('#quote form[data-quote-form]') || document.querySelector('form[data-quote-form]');
      var msg = form && form.querySelector('[name=message]');
      if (!form || !msg || !lastText) return;
      e.preventDefault();
      msg.value = lastText + (msg.value ? '\n\n' + msg.value : '');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var nm = form.querySelector('[name=name]');
      if (nm) setTimeout(function () { nm.focus({ preventScroll: true }); }, 500);
    });
  };

  document.querySelectorAll('[data-tcalc]').forEach(function (box) {
    setup(box, function (c) {
      var L = c.L, len = c.num('len', 0), wid = c.num('wid', 0);
      if (!len || !wid) return null;
      var wall = c.mode === 'wall', doors = Math.round(c.num('doors', 0));
      var hgt = c.num('hgt', 2.5);
      var net = wall ? Math.max(0, 2 * (len + wid) * hgt - doors * 1.6) : len * wid;
      var waste = parseFloat(c.field('waste').value) / 100;
      var size = c.field('size').value, tw, th;
      if (size === 'own') { tw = c.num('ow', 0); th = c.num('oh', 0); if (!tw || !th) return null; }
      else { tw = parseFloat(size.split('x')[0]); th = parseFloat(size.split('x')[1]); }
      var buy = net * (1 + waste), tileA = tw * th / 10000;
      var carton = c.num('carton', 0);
      var rows = [
        [L.net, c.r1(net) + ' ' + L.m2],
        [L.buy, c.r1(buy) + ' ' + L.m2],
        [L.tiles, counted(Math.ceil(buy / tileA - 1e-9), L.tileU, L.tilePl) + ' (' + tw + ' × ' + th + ')']
      ];
      if (carton) rows.push([L.cartons, counted(Math.ceil(buy / carton - 1e-9), L.cartonU, L.cartonPl)]);
      if (!wall) rows.push([L.skirt, c.r1(Math.max(0, 2 * (len + wid) - doors * 0.9)) + ' ' + L.m]);
      return { rows: rows, input: (wall ? L.wall : L.floor) + L.sep + len + ' × ' + wid + (wall ? ' × ' + hgt : '') + ' ' + L.u + L.sep + Math.round(waste * 100) + '%' };
    });
  });

  /* Building materials: red brick 25×12×6 cm with 1 cm joints → 1 ÷ (0.26 ×
     0.07) ≈ 55 bricks per m² of half-brick wall, twice that for one brick, +5%
     waste. Mortar = wall volume − brick volume, +20% waste. Plaster mortar =
     area × thickness × 1.15; tile bed × 1.10. Sand ≈ mortar volume; cement =
     sand × the mix (kg per m³ of sand), in 50 kg bags. */
  document.querySelectorAll('[data-mcalc]').forEach(function (box) {
    setup(box, function (c) {
      var L = c.L, m = c.mode, rows = [], input, mortar, mix;
      var r2 = function (x) { return Math.round(x * 100) / 100; };
      if (m === 'bricks') {
        var len = c.num('len', 0), hgt = c.num('hgt', 3);
        if (!len || !hgt) return null;
        var area = Math.max(0, len * hgt - c.num('open', 0));
        var full = c.field('wtype').value === 'full', per = (full ? 2 : 1) / (0.26 * 0.07);
        var bricks = Math.ceil(area * per * 1.05);
        mortar = Math.max(0, area * (full ? 0.25 : 0.12) - area * per * 0.0018) * 1.2;
        mix = c.num('mixB', 250);
        rows.push([L.wall, c.r1(area) + ' ' + L.m2], [L.brick, bricks > 10 ? bricks.toLocaleString('en') + ' ' + L.brickU : counted(bricks, L.brickU, L.brickPl)]);
        input = L.bricks + L.sep + len + ' × ' + hgt + ' ' + L.u + L.sep + (full ? L.full : L.half);
      } else {
        var A = c.num('area', 0);
        if (!A) return null;
        var bed = m === 'bed', th = bed ? c.num('thickB', 3) : c.num('thickP', 2.5);
        mortar = A * th / 100 * (bed ? 1.10 : 1.15);
        mix = c.num('mixP', 300);
        input = (bed ? L.bed : L.plaster) + L.sep + A + ' ' + L.m2 + L.sep + th + ' ' + L.cm;
      }
      var cement = mortar * mix;
      rows.push([L.mortar, r2(mortar) + ' ' + L.m3], [L.sand, r2(mortar) + ' ' + L.m3],
        [L.cement, Math.round(cement).toLocaleString('en') + ' ' + L.kg + ' ≈ ' + counted(Math.ceil(cement / 50 - 1e-9), L.bag, L.bagPl)]);
      return { rows: rows, input: input + L.sep + mix + ' ' + L.kg + '/' + L.m3 };
    });
  });

  document.querySelectorAll('[data-pcalc]').forEach(function (box) {
    setup(box, function (c) {
      var L = c.L, flat = c.mode === 'flat', h = c.num('hgt', 3);
      var coats = Math.max(1, Math.round(c.num('coats', 2))), cover = c.num('cover', 10) || 10;
      var ceilOn = c.field('ceil').checked, primerOn = c.field('primer').checked;
      var wLo, wHi, ceil, input;
      if (flat) {
        var A = c.num('area', 0);
        if (!A) return null;
        wLo = A * 2.5 * h / 3; wHi = A * 3.5 * h / 3; ceil = A;
        input = L.flat + L.sep + A + ' ' + L.m2 + L.sep + h + ' ' + L.u;
      } else {
        var len = c.num('len', 0), wid = c.num('wid', 0);
        if (!len || !wid) return null;
        wLo = wHi = Math.max(0, 2 * (len + wid) * h - Math.round(c.num('doors', 0)) * 1.8 - Math.round(c.num('wins', 0)) * 1.5);
        ceil = len * wid;
        input = L.room + L.sep + len + ' × ' + wid + ' × ' + h + ' ' + L.u;
      }
      var show = function (lo, hi, unit, d) {
        var f = function (x) { return d ? Math.round(x) : Math.round(x * 10) / 10; };
        return f(lo) === f(hi) ? f(lo) + ' ' + unit : (L.from ? L.from + ' ' : '') + f(lo) + ' ' + L.to + ' ' + f(hi) + ' ' + unit;
      };
      var tLo = wLo + (ceilOn ? ceil : 0), tHi = wHi + (ceilOn ? ceil : 0);
      var rows = [[L.walls, show(wLo, wHi, L.m2, true)]];
      if (ceilOn) rows.push([L.ceilA, show(ceil, ceil, L.m2, true)]);
      rows.push([L.total, show(tLo, tHi, L.m2, true)]);
      rows.push([L.paint, show(tLo * coats / cover, tHi * coats / cover, L.l, tHi * coats / cover >= 20) + ' (' + coats + ' × ' + cover + ' ' + L.m2 + '/' + L.lp + ')']);
      if (primerOn) rows.push([L.prim, show(tLo / cover, tHi / cover, L.l, tHi / cover >= 20)]);
      return { rows: rows, input: input + L.sep + coats + ' × ' + cover + ' ' + L.m2 + '/' + L.lp };
    });
  });
})();

/* ------------- where enquiries come from (2026-10-07) -------------
   The site had no analytics, and most enquiries never touch the form: people
   tap WhatsApp or call. The first page of a visit and its source (Google,
   Facebook, a utm tag…) are remembered for the tab, sent with the quote form,
   and every WhatsApp / phone / email tap sends one small beacon to the same
   endpoint. The office's table then says which pages and which searches bring
   enquiries. Nothing personal is sent: page paths and the visit source only. */
(function () {
  var body = document.body;
  var LEAD = body && body.getAttribute('data-lead');
  var VISIT = null;
  try { VISIT = JSON.parse(sessionStorage.getItem('itm_visit') || 'null'); } catch (e) {}
  if (!VISIT) {
    var q = new URLSearchParams(location.search);
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    if (ref && ref === location.hostname.replace(/^www\./, '')) ref = '';
    var src = q.get('utm_source') || '';
    if (!src) {
      if (q.get('gclid') || q.get('gbraid') || q.get('wbraid')) src = 'google-ads';
      else if (q.get('fbclid')) src = 'facebook';
      else if (/(^|\.)google\./.test(ref)) src = 'google';
      else if (/(^|\.)bing\.com$/.test(ref)) src = 'bing';
      else if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(ref)) src = 'facebook';
      else if (/(^|\.)instagram\.com$/.test(ref)) src = 'instagram';
      else if (/(^|\.)(chatgpt\.com|openai\.com)$/.test(ref)) src = 'chatgpt';
      else if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(ref)) src = 'whatsapp';
      else src = ref || 'direct';
    }
    VISIT = { landing: location.pathname, src: src.toLowerCase().slice(0, 60), ref: ref,
      utm_medium: q.get('utm_medium') || '', utm_campaign: q.get('utm_campaign') || '' };
    try { sessionStorage.setItem('itm_visit', JSON.stringify(VISIT)); } catch (e) {}
  }
  var visit = function (extra) {
    var o = { page: location.pathname, lang: document.documentElement.lang || '',
      device: window.matchMedia && window.matchMedia('(max-width: 820px)').matches ? 'mobile' : 'desktop' };
    for (var k in VISIT) o[k] = VISIT[k];
    for (var j in extra) o[j] = extra[j];
    return o;
  };
  window.itmVisit = visit;   // the quote form adds this to its payload

  if (!LEAD) return;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a || a.closest('[data-form-done]')) return;   // the thank-you panel's WhatsApp follows a form already counted
    var href = a.getAttribute('href') || '';
    var kind = href.indexOf('wa.me/') > -1 ? 'whatsapp' : href.indexOf('tel:') === 0 ? 'phone' : href.indexOf('mailto:') === 0 ? 'email' : '';
    if (!kind) return;
    var data = JSON.stringify(visit({ event: 'tap', kind: kind }));
    try { if (navigator.sendBeacon && navigator.sendBeacon(LEAD, data)) return; } catch (err) {}
    try { fetch(LEAD, { method: 'POST', body: data, keepalive: true, mode: 'no-cors' }); } catch (err) {}
  });
})();


/* Area pages tell the quote forms where the visitor is looking (2026-10-07):
   the location box starts filled in, the visitor can still change it. */
(function () {
  var a = document.querySelector('[data-page-area]');
  if (!a) return;
  var v = a.getAttribute('data-page-area');
  document.querySelectorAll('form[data-quote-form] input[name="area"]').forEach(function (i) { if (!i.value) i.value = v; });
})();
