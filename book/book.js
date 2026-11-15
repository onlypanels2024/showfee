// ShowFee public booking page: shows a ShowFee user's free dates and sends them a booking request.
// Link formats: showfee.app/book/?u=<name>  (showfee.app/book/<name> is forwarded here by 404.html)
// "?u=demo" shows a sample page that sends nothing, for previews.

const FB_VERSION = '11.1.0';
const $ = (id) => document.getElementById(id);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const slug = (new URLSearchParams(location.search).get('u') || '').trim().toLowerCase();
const demo = slug === 'demo';

let page = null, picked = null, db = null, fs = null;
const today = new Date(); today.setHours(0, 0, 0, 0);
let view = new Date(today.getFullYear(), today.getMonth(), 1);
const lastMonth = new Date(today.getFullYear(), today.getMonth() + 12, 1);

const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const nice = (d) => DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();

function show(id) {
  for (const s of ['loading', 'missing', 'closed', 'error', 'form', 'sent']) $(s).hidden = s !== id;
}

function fill() {
  const first = page.name.split(' ')[0];
  document.querySelectorAll('[data-name]').forEach((e) => (e.textContent = page.name));
  document.querySelectorAll('[data-first]').forEach((e) => (e.textContent = first));
  document.querySelectorAll('[data-tagline]').forEach((e) => (e.textContent = page.tagline || ''));
  document.querySelectorAll('[data-initial]').forEach((e) => (e.textContent = page.name.charAt(0).toUpperCase()));
  document.title = 'Book ' + page.name + ' – ShowFee';
  brand(page.brand);
  // Extra questions are written by the ShowFee user in the app (e.g. "Event", "Venue", "Service"), any number up to 6.
  const box = $('extras');
  box.textContent = '';
  questions().forEach((q, i) => {
    const l = document.createElement('label');
    l.textContent = q;
    const inp = document.createElement('input');
    inp.name = 'q' + i;
    inp.maxLength = 200;
    l.appendChild(inp);
    box.appendChild(l);
  });
}

// ShowFee Business: the user's logo, colour, light/dark page, and whether "Powered by ShowFee" shows.
function brand(b) {
  if (!b || typeof b !== 'object') return;
  const body = document.body;
  body.classList.add('bk-branded');
  if (/^#[0-9a-fA-F]{6}$/.test(b.color || '')) {
    body.style.setProperty('--bk-accent', b.color);
    const n = parseInt(b.color.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, bl = n & 255;
    body.style.setProperty('--bk-on-accent', (r * 299 + g * 587 + bl * 114) / 1000 > 150 ? '#14161c' : '#ffffff');
  }
  if (b.theme === 'light') body.classList.add('bk-light');
  if (typeof b.logo === 'string' && b.logo.startsWith('data:image/')) {
    document.querySelectorAll('.bk-avatar').forEach((a) => {
      a.textContent = '';
      const img = document.createElement('img');
      img.src = b.logo;
      img.alt = '';
      a.appendChild(img);
      a.classList.add('has-logo');
    });
  }
  // Business pages usually show a business name ("Maria's Photography"), so use it in full
  document.querySelectorAll('[data-first]').forEach((e) => (e.textContent = page.name));
  if (b.powered === false) {
    $('powered').hidden = true;
    document.title = 'Book ' + page.name;
  }
}

function questions() { return Array.isArray(page.fields) ? page.fields : []; }

function available(d) {
  if (d <= today) return false;                                   // from tomorrow onwards
  const wd = d.getDay() === 0 ? 7 : d.getDay();                   // 1 = Monday … 7 = Sunday
  if (Array.isArray(page.days) && page.days.length && !page.days.includes(wd)) return false;
  return !(page.busy || []).includes(iso(d));
}

function drawMonth() {
  $('month').textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
  $('prev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
  $('next').disabled = view >= lastMonth;
  const box = $('days');
  box.textContent = '';
  const lead = (view.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) box.appendChild(document.createElement('span'));
  const count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  for (let n = 1; n <= count; n++) {
    const d = new Date(view.getFullYear(), view.getMonth(), n);
    if (available(d)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = n;
      b.setAttribute('aria-label', nice(d));
      b.setAttribute('aria-pressed', String(picked && iso(picked) === iso(d)));
      b.addEventListener('click', () => { picked = d; drawMonth(); $('picked').textContent = nice(d) + ' · Your details'; $('formErr').hidden = true; });
      box.appendChild(b);
    } else {
      const s = document.createElement('span');
      s.className = 'off';
      s.textContent = n;
      s.setAttribute('aria-label', nice(d) + ', not available');
      box.appendChild(s);
    }
  }
}

function error(msg) { const e = $('formErr'); e.textContent = msg; e.hidden = false; }

async function send(ev) {
  ev.preventDefault();
  const f = ev.target, v = (k) => (f.elements[k].value || '').trim();
  if (!picked) { error('Please pick a date first.'); $('days').querySelector('button')?.focus(); return; }
  if (!v('name')) { error('Please add your name.'); f.elements.name.focus(); return; }
  if (!v('contact')) { error('Please add an email or phone number so they can reply.'); f.elements.contact.focus(); return; }
  $('formErr').hidden = true;
  $('send').disabled = true;
  $('send').textContent = 'Sending…';
  const req = { slug, owner: page.uid, date: iso(picked), name: v('name'), contact: v('contact'),
                ask: questions(), answers: questions().map((q, i) => v('q' + i)), message: v('message'), status: 'new' };
  try {
    if (demo) await new Promise((r) => setTimeout(r, 700));
    else await fs.addDoc(fs.collection(db, 'requests'), { ...req, created: fs.serverTimestamp() });
    $('sentText').textContent = 'Thanks, ' + req.name.split(' ')[0] + '. ' + (page.brand ? page.name : page.name.split(' ')[0]) + ' has your request for '
      + nice(picked) + ' and will reply to you at ' + req.contact + '.';
    show('sent');
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    error('Your request couldn’t be sent. Check your internet connection and try again.');
    $('send').disabled = false;
    $('send').textContent = 'Send booking request';
  }
}

// A made-up sample logo for previews only (not a real business)
function demoLogo() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/>'
    + '<circle cx="50" cy="44" r="22" fill="none" stroke="#0f6b5c" stroke-width="6"/><circle cx="50" cy="44" r="9" fill="#0f6b5c"/>'
    + '<rect x="24" y="74" width="52" height="7" rx="3.5" fill="#d9a441"/></svg>';
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

async function load() {
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) return show('missing');
  try {
    if (demo) {
      const busy = [3, 4, 9, 17, 23].map((n) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n)));
      page = { uid: 'demo', name: 'Gary Falzon', tagline: 'Singer · Malta', accepting: true, days: [1, 2, 3, 4, 5, 6, 7], busy,
               fields: ['Event', 'Venue'] };
      // Preview other questions: ?u=demo&fields=Service|Hair length   (or fields=none)
      const fq = new URLSearchParams(location.search).get('fields');
      if (fq !== null) page.fields = fq === 'none' ? [] : fq.split('|');
      // Preview ShowFee Business branding: &color=0f6b5c&theme=light&logo=1&powered=0
      const q = new URLSearchParams(location.search);
      if (q.get('color') || q.get('theme') || q.get('logo') || q.get('powered')) {
        page.brand = { color: q.get('color') ? '#' + q.get('color') : undefined, theme: q.get('theme') || 'dark',
          logo: q.get('logo') ? demoLogo() : undefined, powered: q.get('powered') !== '0' };
      }
      const nq = new URLSearchParams(location.search).get('name');
      if (nq) { page.name = nq; page.tagline = new URLSearchParams(location.search).get('tag') || ''; }
    } else {
      if (!window.SHOWFEE_FIREBASE) throw new Error('Booking pages are not switched on yet');
      const app = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`);
      fs = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`);
      db = fs.getFirestore(app.initializeApp(window.SHOWFEE_FIREBASE));
      const snap = await fs.getDoc(fs.doc(db, 'pages', slug));
      if (!snap.exists()) return show('missing');
      page = snap.data();
    }
    fill();
    if (!page.accepting) return show('closed');
    drawMonth();
    $('prev').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); drawMonth(); });
    $('next').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); drawMonth(); });
    $('form').addEventListener('submit', send);
    $('form').addEventListener('input', () => { $('formErr').hidden = true; });
    show('form');
  } catch (e) {
    console.error(e);
    show('error');
  }
}

load();
