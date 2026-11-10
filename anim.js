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

  // floating booking cards: Owed -> Paid
  var hero = document.querySelector('.hero');
  var items = [['Wedding','€450'],['DJ set','€300'],['Photo shoot','€220'],['PT session','€40'],['Tutoring','€35'],['Make-up','€90'],['Corporate gig','€600'],['Dog walking','€25'],['Hair & styling','€120'],['Birthday party','€250']];
  var fx = document.createElement('div'); fx.className = 'fx'; fx.setAttribute('aria-hidden','true'); hero.insertBefore(fx, hero.firstChild);
  var n = 0, visible = true, spots = [];
  function spot(){
    var W = hero.clientWidth, H = hero.clientHeight, narrow = W < 860, x, y, tries = 0;
    do {
      x = narrow ? (Math.random() < .5 ? 1 + Math.random()*6 : 60 + Math.random()*30) : 56 + Math.random()*34;
      y = narrow ? 64 + Math.random()*30 : 10 + Math.random()*78;
      tries++;
    } while (tries < 15 && spots.some(function(s){ return Math.abs(s[0]-x) < 18 && Math.abs(s[1]-y) < 12; }));
    return [x, y];
  }
  function chip(){
    if (!visible || document.hidden) return;
    var it = items[n++ % items.length], p = spot(), c = document.createElement('div');
    c.className = 'chip'; c.style.left = p[0]+'%'; c.style.top = p[1]+'%';
    c.innerHTML = '<i>€</i><span><b>'+it[0]+'</b> · '+it[1]+'</span><span class="st">Owed</span>';
    fx.appendChild(c); spots.push(p);
    var over = c.offsetLeft + c.offsetWidth - (hero.clientWidth - 12); if (over > 0) c.style.left = Math.max(8, c.offsetLeft - over) + 'px';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ c.classList.add('on'); }); });
    setTimeout(function(){ c.classList.add('paid'); c.querySelector('i').textContent = '✓'; c.querySelector('.st').textContent = 'Paid'; }, 1500 + Math.random()*700);
    setTimeout(function(){ c.classList.add('off'); }, 4200);
    setTimeout(function(){ c.remove(); spots.splice(spots.indexOf(p), 1); }, 5400);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function(e){ visible = e[0].isIntersecting; }).observe(hero);
  chip(); setTimeout(chip, 700); setInterval(chip, hero.clientWidth < 860 ? 2200 : 1300);

  // "you got paid" notification on the hero phone
  var phone = document.querySelector('.hero .device');
  if (phone) {
    var notes = [['Payment received','Joanna &amp; Mark paid €450 for the wedding ✓'],['Invoice sent','Invoice #024 sent to The Grand Hotel'],['Reminder ready','Bob\'s Bar is 7 days late – tap to send a friendly reminder'],['Payment received','Bright Events paid €300 by PayPal ✓']];
    var box = document.createElement('div'); box.className = 'note'; box.setAttribute('aria-hidden','true'); phone.appendChild(box);
    var k = 0;
    function show(){
      if (!visible || document.hidden) return;
      var m = notes[k++ % notes.length];
      box.innerHTML = '<img src="assets/logo-180.png" alt=""><div><b>ShowFee · now</b>'+m[1]+'</div>';
      box.classList.add('on'); setTimeout(function(){ box.classList.remove('on'); }, 3200);
    }
    setTimeout(show, 1800); setInterval(show, 5000);
  }

  // ===== Further down the page =====

  // cards that float beside the phone in each section, flipping when "paid"
  var rowSets = [
    {cls:'', items:[['Radisson Blu','€400','Overdue','late'],['Joanna & Mark','€900','Owed'],['Bob\'s Bar','€150','Owed']], done:'Paid'},
    {cls:'blue', items:[['PayPal','€300','Link sent'],['Revolut','€120','Link sent'],['Stripe','€450','Link sent']], done:'Paid'},
    {cls:'late', items:[['Bob\'s Bar','7 days late','Late'],['Radisson Blu','12 days late','Late']], done:'Reminder sent'},
    {cls:'blue', items:[['Invoice #024','€450','Creating PDF'],['Invoice #025','€300','Creating PDF']], done:'Sent'}
  ];
  document.querySelectorAll('.rows .row').forEach(function(row, ri){
    var vis = row.querySelector('.vis'), dev = vis.firstElementChild, set = rowSets[ri]; if (!set) return;
    var on = false, i = 0, side = 0;
    new IntersectionObserver(function(e){ on = e[0].isIntersecting; }, {threshold:.25}).observe(vis);
    function spawn(){
      if (!on || document.hidden) return;
      var it = set.items[i++ % set.items.length], s = document.createElement('div'); s.className = 'side';
      var cls = it[3] || set.cls;
      s.innerHTML = '<div class="chip '+cls+'"><i>'+(cls==='late'?'!':'€')+'</i><span><b>'+it[0]+'</b> · '+it[1]+'</span><span class="st">'+it[2]+'</span></div>';
      vis.appendChild(s);
      var c = s.firstChild, vr = vis.getBoundingClientRect(), dr = dev.getBoundingClientRect(), w = c.offsetWidth, h = c.offsetHeight;
      var left = (side++ % 2 === 0) ? dr.left - vr.left - w * .55 : dr.right - vr.left - w * .45;
      var top = dr.top - vr.top + dr.height * (.18 + Math.random() * .6);
      var pageLeft = vr.left + left; if (pageLeft < 8) left += 8 - pageLeft; if (vr.left + left + w > innerWidth - 8) left -= vr.left + left + w - innerWidth + 8;
      s.style.left = left + 'px'; s.style.top = top + 'px';
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ c.classList.add('on'); }); });
      setTimeout(function(){ c.classList.remove('late','blue'); c.classList.add('paid'); c.querySelector('i').textContent = '✓'; c.querySelector('.st').textContent = set.done; }, 1600);
      setTimeout(function(){ c.classList.add('off'); }, 4000);
      setTimeout(function(){ s.remove(); }, 5200);
    }
    setInterval(spawn, 2600 + ri * 150);
  });

  // PAID stamp on the invoice
  var paper = document.querySelector('.rows .paper');
  if (paper) {
    var st = document.createElement('div'); st.className = 'stamp'; st.textContent = 'PAID'; st.setAttribute('aria-hidden','true'); paper.appendChild(st);
    new IntersectionObserver(function(e){ st.classList.toggle('go', e[0].isIntersecting); }, {threshold:.4}).observe(paper);
    st.addEventListener('animationiteration', function(){ setTimeout(function(){ paper.classList.remove('thud'); void paper.offsetWidth; paper.classList.add('thud'); }, 400); });
    setTimeout(function(){ paper.classList.add('thud'); }, 0);
  }

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
