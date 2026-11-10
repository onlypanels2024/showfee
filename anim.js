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

  // follows the mouse: soft glow + a dot grid that shows up around the pointer; diary days and buttons react too
  (function(){
    var root = document.documentElement, fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    var dots = document.createElement('div'); dots.className = 'dots'; dots.setAttribute('aria-hidden','true');
    var glow = document.createElement('div'); glow.className = 'glow'; glow.setAttribute('aria-hidden','true');
    document.body.insertBefore(glow, document.body.firstChild); document.body.insertBefore(dots, document.body.firstChild);
    var tx = innerWidth * .7, ty = innerHeight * .35, x = tx, y = ty, active = !fine;
    if (fine) addEventListener('pointermove', function(e){ tx = e.clientX; ty = e.clientY; if (!active){ active = true; root.classList.add('m-on'); } }, {passive:true});
    else root.classList.add('m-on');
    document.addEventListener('mouseleave', function(){ root.classList.remove('m-on'); active = false; });
    var cells = [].slice.call(document.querySelectorAll('.cal-d')), mags = [].slice.call(document.querySelectorAll('.btn.play, nav a.nav-get'));
    function loop(t){
      if (!fine){ tx = innerWidth * (.5 + .38 * Math.sin(t / 5200)); ty = innerHeight * (.45 + .3 * Math.sin(t / 3900)); }
      x += (tx - x) * .12; y += (ty - y) * .12;
      root.style.setProperty('--mx', x.toFixed(1) + 'px'); root.style.setProperty('--my', y.toFixed(1) + 'px');
      if (fine && active) {
        cells.forEach(function(c){ var r = c.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
          var d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y), p = Math.max(0, 1 - d / 190);
          c.style.setProperty('--p', p.toFixed(2)); });
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    if (fine) mags.forEach(function(b){
      b.addEventListener('pointermove', function(e){ var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px)'; });
      b.addEventListener('pointerleave', function(){ b.style.transform = ''; });
    });
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
