(function(){
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) return;
  document.documentElement.classList.add('js');

  // scroll reveals
  var add = function(sel, cls){ document.querySelectorAll(sel).forEach(function(e,i){ e.classList.add('rv'); if (cls) e.classList.add(typeof cls==='function'?cls(e,i):cls); }); };
  add('.who p');
  add('.rows .copy');
  add('.rows .vis', function(e){ return e.closest('.row').classList.contains('flip') ? 'from-l' : 'from-r'; });
  add('.more h2'); add('.more figure'); add('.trust .two>div'); add('.cta');
  document.querySelectorAll('.more figure').forEach(function(f,i){ f.style.transitionDelay = (i*0.12)+'s'; });
  document.querySelectorAll('.trust .two>div').forEach(function(f,i){ f.style.transitionDelay = (i*0.15)+'s'; });
  var els = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); if (e.target.closest('.more figure')) setTimeout(function(){ e.target.style.transitionDelay=''; }, 1200); } }); }, {rootMargin:'0px 0px -10% 0px'});
    els.forEach(function(e){ io.observe(e); });
  } else els.forEach(function(e){ e.classList.add('in'); });

  // job names: endless scroll
  var jobs = document.querySelector('.jobs');
  if (jobs) {
    var lane = document.createElement('div'); lane.className = 'lane';
    while (jobs.firstChild) lane.appendChild(jobs.firstChild);
    jobs.appendChild(lane);
    var copy = lane.cloneNode(true); copy.setAttribute('aria-hidden','true'); jobs.appendChild(copy);
    jobs.classList.add('mq');
  }

  // ShowFee's own background: a faint diary where days light up as booked, then turn green when paid
  (function(){
    var hero = document.querySelector('.hero'); if (!hero) return;
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var first = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    var cal = document.createElement('div'); cal.className = 'cal'; cal.setAttribute('aria-hidden','true');
    var html = '<div class="cal-m">' + now.toLocaleString('en-GB', {month:'long'}) + '</div><div class="cal-g">';
    'MTWTFSS'.split('').forEach(function(d){ html += '<span class="cal-h">' + d + '</span>'; });
    for (var i = 0; i < 35; i++){ var n = i - first + 1; html += '<span class="cal-d' + (n === now.getDate() ? ' today' : '') + '">' + (n >= 1 && n <= days ? n : '') + '</span>'; }
    cal.innerHTML = html + '</div>'; hero.insertBefore(cal, hero.firstChild);
    var cells = [].slice.call(cal.querySelectorAll('.cal-d')).filter(function(c){ return c.textContent; }), vis = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function(e){ vis = e[0].isIntersecting; }).observe(hero);
    function step(){
      if (!vis || document.hidden) return;
      var free = cells.filter(function(c){ return !c.className.match(/booked|paid/); });
      if (cal.querySelectorAll('.booked,.paid').length >= 7 || !free.length) return;
      var c = free[Math.floor(Math.random() * free.length)];
      c.classList.add('booked');
      setTimeout(function(){ c.classList.remove('booked'); c.classList.add('paid'); }, 1800 + Math.random() * 1200);
      setTimeout(function(){ c.classList.remove('paid'); }, 6500 + Math.random() * 2500);
    }
    step(); setTimeout(step, 400); setTimeout(step, 900); setInterval(step, 1100);
  })();

  // ===== Further down the page =====

  // quiet line drawings, one per section
  (function(){
    function el(parent, cls, html){ if (!parent) return null; var d = document.createElement('div'); d.className = 'deco ' + cls; d.setAttribute('aria-hidden','true'); d.innerHTML = html || ''; parent.appendChild(d); return d; }
    var svg = function(vb, inner){ return '<svg viewBox="' + vb + '">' + inner + '</svg>'; };
    var rows = document.querySelectorAll('.rows .row');
    // 1. €1,450 counting down to €0
    var eu = el(rows[0] && rows[0].querySelector('.copy'), 'euro', '€1,450');
    if (eu) {
      var on = false, t0 = 0;
      new IntersectionObserver(function(e){ var was = on; on = e[0].isIntersecting; if (on && !was){ t0 = performance.now(); requestAnimationFrame(tick); } }).observe(eu.parentNode);
      function tick(now){
        var e = (now - t0) / 1000, cyc = e % 10, p = Math.min(1, cyc / 5.5), v = Math.round(1450 * (1 - (1 - Math.pow(1 - p, 3))) / 10) * 10;
        eu.textContent = '€' + v.toLocaleString('en-GB'); eu.classList.toggle('zero', v === 0);
        if (on) requestAnimationFrame(tick);
      }
    }
    // 2. tap ripple behind the phone
    el(rows[1] && rows[1].querySelector('.vis'), 'ripple', '<i></i><i></i><i></i>');
    // 3. envelope gliding
    el(rows[2] && rows[2].querySelector('.copy'), 'env', svg('0 0 60 42', '<rect x="2" y="2" width="56" height="38" rx="5"/><path d="M3 5l27 19L57 5"/>'));
    // 4. invoice lines drawing themselves
    el(rows[3] && rows[3].querySelector('.copy'), 'lines', svg('0 0 150 120', '<path d="M10 14h70"/><path d="M10 34h130"/><path d="M10 52h130"/><path d="M10 70h100"/><path d="M80 96h60"/><path d="M80 104h60"/>'));
    // 5. four tiny icons for the four cards
    var mw = document.querySelector('.more .wrap'), icons = [
      svg('0 0 30 30', '<rect x="4" y="6" width="22" height="20" rx="3"/><path d="M4 12h22M10 3v6M20 3v6"/>'),
      svg('0 0 30 30', '<path d="M5 25V15M12 25V9M19 25v-8M26 25V5"/>'),
      svg('0 0 30 30', '<circle cx="15" cy="10" r="5"/><path d="M5 27c1-6 5-9 10-9s9 3 10 9"/>'),
      svg('0 0 30 30', '<path d="M21 4a11 11 0 1 0 5 15A9 9 0 0 1 21 4z"/>')], pos = [['56%','-6px'],['68%','26px'],['80%','-2px'],['91%','30px']];
    if (mw) icons.forEach(function(s, i){ var d = el(mw, 'ic', s); d.style.left = pos[i][0]; d.style.top = pos[i][1]; });
    // 6. padlock clicking shut
    var lk = el(document.querySelector('.trust .two>div'), 'lock', svg('0 0 46 58', '<path class="shackle" d="M12 26V16a11 11 0 0 1 22 0v10"/><rect x="5" y="26" width="36" height="28" rx="6"/><path d="M23 37v7"/>'));
    // 7. download arrow
    el(document.querySelector('.cta'), 'dl', svg('0 0 54 54', '<g class="arrow"><path d="M27 6v26"/><path d="M17 23l10 10 10-10"/></g><path d="M8 38v8h38v-8"/>'));
  })();

  // screenshots in "everything else": how far each one can scroll
  function pans(){ document.querySelectorAll('.more .crop').forEach(function(cr){ var im = cr.querySelector('img'); if (!im) return;
    var d = im.offsetHeight - cr.clientHeight + 8; im.style.setProperty('--pan', (d > 0 ? -d : 0) + 'px'); }); }
  document.querySelectorAll('.more .crop img').forEach(function(im){ if (im.complete) pans(); else im.addEventListener('load', pans); });
  addEventListener('resize', pans);

  // phones tilt towards the mouse (computers only)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.rows .device').forEach(function(d){
      d.addEventListener('mousemove', function(e){ var r = d.getBoundingClientRect(), x = (e.clientX-r.left)/r.width-.5, y = (e.clientY-r.top)/r.height-.5;
        d.style.transform = 'perspective(900px) rotateY('+(x*14)+'deg) rotateX('+(-y*10)+'deg) translateY(-4px)'; });
      d.addEventListener('mouseleave', function(){ d.style.transform = ''; });
    });
  }
})();
