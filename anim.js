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

  // siteto.fit-style background: faint grid, dotted payment lines drawing from a € coin to a green tick
  (function(){
    var hero = document.querySelector('.hero'); if (!hero) return;
    var c = document.createElement('canvas'); c.className = 'flow'; c.setAttribute('aria-hidden','true'); hero.insertBefore(c, hero.firstChild);
    if (!c.getContext) return;
    var x = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), W, H, R = [], vis = true;
    function size(){ var r = c.getBoundingClientRect(); W = r.width; H = r.height; c.width = W*dpr; c.height = H*dpr; x.setTransform(dpr,0,0,dpr,0,0); }
    size(); addEventListener('resize', size);
    function rnd(a,b){ return a + Math.random()*(b-a); }
    function make(t){
      var narrow = W < 860, x0 = narrow ? W*.04 : W*.55, x1 = W*.96, y0 = narrow ? H*.64 : H*.08, y1 = narrow ? H*.97 : H*.92;
      var a = {x:rnd(x0,x1), y:rnd(y0,y1)}, b, n = 0;
      do { b = {x:rnd(x0,x1), y:rnd(y0,y1)}; n++; } while (Math.hypot(b.x-a.x, b.y-a.y) < Math.min(W,H)*.3 && n < 20);
      var dx = b.x-a.x, dy = b.y-a.y, bend = rnd(-.45,.45);
      var c1 = {x:a.x+dx*.25-dy*bend, y:a.y+dy*.25+dx*bend}, c2 = {x:a.x+dx*.75+dy*bend, y:a.y+dy*.75-dx*bend};
      var pts = [], prev = a, len = 0;
      for (var i = 0; i <= 160; i++){ var u = i/160, v = 1-u;
        var p = {x:v*v*v*a.x+3*v*v*u*c1.x+3*v*u*u*c2.x+u*u*u*b.x, y:v*v*v*a.y+3*v*v*u*c1.y+3*v*u*u*c2.y+u*u*u*b.y};
        len += Math.hypot(p.x-prev.x, p.y-prev.y); p.l = len; pts.push(p); prev = p; }
      return {pts:pts, len:len, t0:t, dur:rnd(2.6,4), hold:rnd(1.6,2.4)};
    }
    function at(r,d){ var p = r.pts; for (var i = 1; i < p.length; i++) if (p[i].l >= d) return p[i]; return p[p.length-1]; }
    function coin(px,py,al){ x.globalAlpha = al; x.strokeStyle = '#28beff'; x.lineWidth = 2; x.fillStyle = '#0b1433';
      x.beginPath(); x.arc(px,py,10,0,7); x.fill(); x.stroke();
      x.fillStyle = '#28beff'; x.font = '700 11px Poppins,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('€',px,py+.5); }
    function tick(px,py,al,sc){ x.globalAlpha = al; x.fillStyle = '#2ecc71'; x.beginPath(); x.arc(px,py,11*sc,0,7); x.fill();
      x.strokeStyle = '#06210f'; x.lineWidth = 2.6; x.lineCap = 'round'; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(px-5*sc,py); x.lineTo(px-1.5*sc,py+3.6*sc); x.lineTo(px+5*sc,py-3.6*sc); x.stroke(); }
    function grid(){ x.globalAlpha = .06; x.strokeStyle = '#ffffff'; x.lineWidth = 1; var g = 56; x.beginPath();
      for (var gx = W%g/2; gx < W; gx += g){ x.moveTo(gx,0); x.lineTo(gx,H); } for (var gy = 0; gy < H; gy += g){ x.moveTo(0,gy); x.lineTo(W,gy); } x.stroke(); }
    function frame(now){
      var t = now/1000; x.clearRect(0,0,W,H); grid();
      var want = W < 860 ? 2 : 5; while (R.length < want) R.push(make(t - rnd(0,.4)));
      for (var k = R.length-1; k >= 0; k--){
        var r = R[k], e = t-r.t0, p = Math.min(1, e/r.dur), fade = Math.max(0, Math.min(1, 1-(e-r.dur-r.hold)/.8));
        if (fade <= 0){ R.splice(k,1); continue; }
        var d = r.len*(1-Math.pow(1-p,3));
        for (var s = 0; s < d; s += 14){ var q = at(r,s); x.globalAlpha = .55*fade; x.fillStyle = s < d-50 ? '#8f6bff' : '#28beff'; x.beginPath(); x.arc(q.x,q.y,2.3,0,7); x.fill(); }
        coin(r.pts[0].x, r.pts[0].y, fade*.9);
        if (p < 1){ var h = at(r,d); x.globalAlpha = fade; x.fillStyle = '#28beff'; x.shadowColor = '#28beff'; x.shadowBlur = 14; x.beginPath(); x.arc(h.x,h.y,4,0,7); x.fill(); x.shadowBlur = 0; }
        else { var b = r.pts[r.pts.length-1], pop = Math.min(1,(e-r.dur)/.35); tick(b.x, b.y, fade*.9, pop < 1 ? .6+.55*Math.sin(pop*Math.PI/2) : 1); }
      }
      x.globalAlpha = 1; if (vis) requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function(e){ var was = vis; vis = e[0].isIntersecting; if (vis && !was) requestAnimationFrame(frame); }).observe(hero);
    requestAnimationFrame(frame);
  })();

  // ===== Further down the page =====

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
