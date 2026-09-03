/* Elite Renovations — progressive enhancement only.
   Every page renders and reads fine with JS disabled. */
(function () {
  'use strict';

  /* ---------- header state ---------- */
  var hdr = document.querySelector('.hdr');
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
      menuBtn.setAttribute('aria-expanded', String(open));
      var label = menuBtn.querySelector('.menu-btn__label');
      if (label) label.textContent = open ? 'Close' : 'Menu';
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

    function apply() {
      var q = (searchEl && searchEl.value || '').trim().toLowerCase();
      var shown = 0;
      tiles.forEach(function (t) {
        var okCat = active === 'all' || t.getAttribute('data-' + key) === active;
        var okQ = !q || (t.getAttribute('data-search') || '').indexOf(q) > -1;
        var vis = okCat && okQ;
        t.hidden = !vis;
        if (vis) shown++;
      });
      if (countEl) countEl.textContent = shown + (shown === 1 ? ' stone' : ' stones');
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
    var msg = document.querySelector('form[data-quote-form] [name=message]');
    if (msg && !msg.value) {
      if (stone) msg.value = 'I would like a price on ' + stone.replace(/-/g, ' ') + '. ';
      else if (service) msg.value = 'I am interested in ' + service.replace(/-/g, ' ') + '. ';
    }
    var sel = document.querySelector('form[data-quote-form] [name=service]');
    if (sel && service) {
      [].slice.call(sel.options).forEach(function (o) {
        if (o.value.toLowerCase().replace(/[^a-z]/g, '') === service.replace(/[^a-z]/g, '')) sel.value = o.value;
      });
    }
  })();

  /* ---------- quote form ---------- */
  var form = document.querySelector('form[data-quote-form]');
  if (form) {
    form.addEventListener('submit', function (e) {
      var ok = true;
      form.querySelectorAll('[required]').forEach(function (input) {
        var field = input.closest('.field');
        var valid = input.value.trim() !== '' && input.checkValidity();
        if (field) field.classList.toggle('invalid', !valid);
        if (!valid && ok) { ok = false; input.focus(); }
      });
      if (!ok) { e.preventDefault(); return; }
      track('Lead', {
        content_category: (form.querySelector('[name=service]') || {}).value || 'general',
        content_name: (form.querySelector('[name=area]') || {}).value || 'unspecified'
      });
      /* No backend wired yet — see README "Connecting the form".
         Falls back to a prefilled WhatsApp message so no enquiry is lost. */
      if (form.getAttribute('action') === '#whatsapp') {
        e.preventDefault();
        var g = function (n) { var el = form.querySelector('[name=' + n + ']'); return el ? el.value.trim() : ''; };
        var msg = 'New enquiry — ' + document.title.split('|')[0].trim() + '\n\n'
          + 'Name: ' + g('name') + '\n'
          + 'Phone: ' + g('phone') + '\n'
          + 'Location: ' + g('area') + '\n'
          + 'Property: ' + g('property') + '\n'
          + 'Service: ' + g('service') + '\n'
          + 'Timeline: ' + g('timeline') + '\n\n'
          + g('message');
        window.open('https://wa.me/' + form.dataset.whatsapp + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      }
    });
    form.querySelectorAll('[required]').forEach(function (input) {
      input.addEventListener('input', function () {
        var f = input.closest('.field');
        if (f && f.classList.contains('invalid') && input.value.trim() !== '') f.classList.remove('invalid');
      });
    });
  }
})();
