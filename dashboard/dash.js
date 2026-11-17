// ShowFee web dashboard (ShowFee Business): shows the copy of a user's bookings that the ShowFee app keeps
// in dash/{uid} once they switch it on (Settings › Web dashboard). Read-only. "?demo=1" shows sample data.

const FB_VERSION = '11.1.0';
const $ = (id) => document.getElementById(id);
const demo = new URLSearchParams(location.search).get('demo') === '1';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CONFIRMED = 0, PENCILLED = 1, CANCELLED = 2;

let auth = null, authMod = null;
let D = null, fmt = null, today = 0, calMonth = null, bkFilter = 'upcoming';

const states = ['loading', 'signin', 'empty', 'error', 'app'];
function show(id) { for (const s of states) $(s).hidden = s !== id; $('who').hidden = !(id === 'app' || id === 'empty'); }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Days are counted like the app: days since 1 Jan 1970, in the user's own time zone.
const dayOf = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
const dateOf = (n) => { const u = new Date(n * 86400000); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };
const niceDay = (n) => dateOf(n).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const time = (m) => m >= 0 ? String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') : '';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- the numbers
function prepare(raw) {
  const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
  fmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: d.currency || 'EUR' });
  const paid = {};
  for (const p of d.payments || []) paid[p.gig_id] = (paid[p.gig_id] || 0) + (p.cents || 0);
  d.gigs = (d.gigs || []).map((g) => {
    const x = { id: g.id, client: g.client || '', email: g.email || '', event: g.event || '', notes: g.notes || '',
      day: g.gig_day, due: g.due_day ?? g.gig_day, fee: g.fee_cents || 0, status: g.status ?? CONFIRMED, start: g.start_min ?? -1 };
    x.paid = paid[g.id] || 0;
    x.balance = Math.max(0, x.fee - x.paid);
    x.happened = x.day <= today;
    x.owed = x.status !== CANCELLED && x.happened && x.balance > 0;
    x.overdue = x.owed && x.due < today;
    return x;
  }).sort((a, b) => a.day - b.day || a.start - b.start);
  d.clients = d.clients || [];
  d.expenses = d.expenses || [];
  d.payments = d.payments || [];
  d.one = d.one || 'booking';
  d.many = d.many || 'bookings';
  return d;
}
const money = (c) => fmt.format((c || 0) / 100);

function pill(g) {
  if (g.status === CANCELLED) return '<span class="db-pill p-can">Cancelled</span>';
  if (g.overdue) return '<span class="db-pill p-due">Overdue</span>';
  if (g.owed) return g.paid > 0 ? '<span class="db-pill p-part">Part paid</span>' : '<span class="db-pill p-due">Not paid</span>';
  if (g.happened && g.fee > 0) return '<span class="db-pill p-ok">Paid</span>';
  return g.status === PENCILLED ? '<span class="db-pill p-pen">Pencilled in</span>' : '<span class="db-pill p-ok">Confirmed</span>';
}

function dateChip(n) {
  const d = dateOf(n);
  return `<div class="db-date"><b>${d.getDate()}</b><span>${MONTHS[d.getMonth()].slice(0, 3)}</span></div>`;
}

function row(g, right) {
  const what = [g.event, time(g.start)].filter(Boolean).join(' · ');
  return `<div class="db-row">${dateChip(g.day)}<div class="db-row-main"><b>${esc(g.client)}</b><span>${esc(what || niceDay(g.day))}</span></div>${right}</div>`;
}

// ---------------------------------------------------------------- pages
function overview() {
  const live = D.gigs.filter((g) => g.status !== CANCELLED);
  const owed = live.filter((g) => g.owed);
  const owedSum = owed.reduce((s, g) => s + g.balance, 0);
  const overdue = owed.filter((g) => g.overdue);
  const t = dateOf(today);
  const mStart = dayOf(new Date(t.getFullYear(), t.getMonth(), 1)), yStart = dayOf(new Date(t.getFullYear(), 0, 1));
  const month = live.filter((g) => g.happened && g.day >= mStart), year = live.filter((g) => g.happened && g.day >= yStart);
  const next = live.filter((g) => g.day >= today && g.day <= today + 30);
  $('hello').textContent = D.name ? ', ' + D.name.split(' ')[0] : '';
  $('tOwed').textContent = money(owedSum);
  $('tOwedSub').textContent = owed.length ? `${owed.length} ${owed.length === 1 ? D.one : D.many}` + (overdue.length ? ` · ${overdue.length} overdue` : '') : 'Nothing owed – nice!';
  $('tMonth').textContent = money(month.reduce((s, g) => s + g.fee, 0));
  $('tMonthSub').textContent = `${month.length} ${month.length === 1 ? D.one : D.many} in ${MONTHS[t.getMonth()]}`;
  $('tYear').textContent = money(year.reduce((s, g) => s + g.fee, 0));
  $('tYearSub').textContent = `${year.length} ${year.length === 1 ? D.one : D.many} in ${t.getFullYear()}`;
  $('tNext').textContent = String(next.length);
  $('tNextSub').textContent = next.length ? money(next.reduce((s, g) => s + g.fee, 0)) + ' booked' : 'Nothing booked yet';
  const up = live.filter((g) => g.day >= today).slice(0, 6);
  $('upcoming').innerHTML = up.length ? up.map((g) => row(g, `<span class="db-amt">${money(g.fee)}</span>`)).join('')
    : `<p class="db-empty">No upcoming ${esc(D.many)}.</p>`;
  const owing = [...owed].sort((a, b) => a.due - b.due).slice(0, 6);
  $('owing').innerHTML = owing.length ? owing.map((g) => row(g, `<span class="db-amt owe">${money(g.balance)}</span>`)).join('')
    : '<p class="db-empty">Everyone has paid you.</p>';
}

function bookings() {
  const q = $('bkSearch').value.trim().toLowerCase();
  let list = D.gigs;
  if (bkFilter === 'upcoming') list = list.filter((g) => g.day >= today);
  if (bkFilter === 'past') list = list.filter((g) => g.day < today).reverse();
  if (q) list = list.filter((g) => (g.client + ' ' + g.event + ' ' + g.notes).toLowerCase().includes(q));
  $('bkTable').tBodies[0].innerHTML = list.length ? list.map((g) => `<tr><td>${esc(niceDay(g.day))}${g.start >= 0 ? '<br><span class="muted">' + time(g.start) + '</span>' : ''}</td>
    <td><b>${esc(g.client)}</b>${g.email ? '<br><span class="muted">' + esc(g.email) + '</span>' : ''}</td><td class="muted">${esc(g.event)}</td>
    <td>${pill(g)}</td><td class="r">${money(g.fee)}</td><td class="r ${g.owed ? 'owe' : 'muted'}">${g.owed ? money(g.balance) : '–'}</td></tr>`).join('')
    : `<tr><td colspan="6" class="empty">No ${esc(D.many)} here.</td></tr>`;
}

function calendar() {
  const first = calMonth, y = first.getFullYear(), m = first.getMonth();
  $('calTitle').textContent = MONTHS[m] + ' ' + y;
  const startDow = (first.getDay() + 6) % 7;
  const start = dayOf(first) - startDow;
  const byDay = {};
  for (const g of D.gigs) (byDay[g.day] = byDay[g.day] || []).push(g);
  let html = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const n = start + i, d = dateOf(n);
    if (i >= 35 && d.getMonth() !== m) break;
    const evs = (byDay[n] || []).map((g) => `<div class="ev ${g.status === PENCILLED ? 'pen' : g.status === CANCELLED ? 'can' : ''}" title="${esc(g.client + (g.event ? ' · ' + g.event : ''))}">${g.start >= 0 ? time(g.start) + ' ' : ''}${esc(g.client)}</div>`).join('');
    html += `<div class="day${d.getMonth() !== m ? ' other' : ''}${n === today ? ' today' : ''}"><span class="num">${d.getDate()}</span>${evs}</div>`;
  }
  $('cal').innerHTML = html;
}

function clients() {
  const q = $('clSearch').value.trim().toLowerCase();
  const stats = {};
  for (const g of D.gigs) {
    if (g.status === CANCELLED) continue;
    const k = g.client.toLowerCase();
    const s = stats[k] || (stats[k] = { n: 0, paid: 0, owes: 0 });
    s.n++; s.paid += g.paid; if (g.owed) s.owes += g.balance;
  }
  const names = new Map(D.clients.map((c) => [c.name.toLowerCase(), c]));
  for (const g of D.gigs) if (!names.has(g.client.toLowerCase())) names.set(g.client.toLowerCase(), { name: g.client, email: g.email });
  let list = [...names.values()].map((c) => ({ ...c, ...(stats[c.name.toLowerCase()] || { n: 0, paid: 0, owes: 0 }) }))
    .sort((a, b) => b.owes - a.owes || b.n - a.n || a.name.localeCompare(b.name));
  if (q) list = list.filter((c) => (c.name + ' ' + (c.email || '') + ' ' + (c.phone || '')).toLowerCase().includes(q));
  $('clTable').tBodies[0].innerHTML = list.length ? list.map((c) => `<tr><td><b>${esc(c.name)}</b></td>
    <td class="muted">${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '–'}</td><td class="muted">${esc(c.phone || '–')}</td>
    <td class="r">${c.n}</td><td class="r">${money(c.paid)}</td><td class="r ${c.owes ? 'owe' : 'muted'}">${c.owes ? money(c.owes) : '–'}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">No clients here.</td></tr>';
}

function moneyPage() {
  const t = dateOf(today);
  const from = dayOf(new Date(t.getFullYear(), t.getMonth() - 11, 1));
  const live = D.gigs.filter((g) => g.status !== CANCELLED && g.happened && g.day >= from);
  const earned = live.reduce((s, g) => s + g.fee, 0);
  const received = D.payments.filter((p) => p.day >= from).reduce((s, p) => s + p.cents, 0);
  const ex = D.expenses.filter((e) => e.day >= from);
  const spent = ex.reduce((s, e) => s + e.cents, 0);
  $('mEarned').textContent = money(earned);
  $('mReceived').textContent = money(received);
  $('mSpent').textContent = money(spent);
  $('mNet').textContent = money(earned - spent);
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const s = new Date(t.getFullYear(), t.getMonth() - i, 1), e = new Date(t.getFullYear(), t.getMonth() - i + 1, 1);
    const a = dayOf(s), b = dayOf(e);
    months.push({ label: MONTHS[s.getMonth()].slice(0, 3), sum: live.filter((g) => g.day >= a && g.day < b).reduce((x, g) => x + g.fee, 0) });
  }
  const max = Math.max(1, ...months.map((x) => x.sum));
  $('chart').innerHTML = months.map((x) => `<div class="db-bar-col" title="${x.label}: ${money(x.sum)}"><em>${x.sum ? money(x.sum).replace(/\.00$/, '') : ''}</em><i style="height:${Math.round(x.sum / max * 170)}px"></i><span>${x.label}</span></div>`).join('');
  const rows = [...D.expenses].sort((a, b) => b.day - a.day).slice(0, 60);
  $('exTable').tBodies[0].innerHTML = rows.length ? rows.map((e) => `<tr><td>${esc(niceDay(e.day))}</td><td>${esc(e.note || '–')}</td>
    <td class="muted">${esc(e.category || '')}</td><td class="r">${money(e.cents)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">No expenses yet.</td></tr>';
}

function render() {
  document.querySelectorAll('[data-many-cap]').forEach((e) => (e.textContent = cap(D.many)));
  overview(); bookings(); calendar(); clients(); moneyPage();
}

function openTab(tab) {
  document.querySelectorAll('.db-nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('[data-page]').forEach((s) => (s.hidden = s.dataset.page !== tab));
  try { history.replaceState(null, '', '#' + tab); } catch (e) { /* ignore */ }
  window.scrollTo({ top: 0 });
}

function wire() {
  document.querySelectorAll('.db-nav button').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));
  document.querySelectorAll('#bkSeg button').forEach((b) => b.addEventListener('click', () => {
    bkFilter = b.dataset.f;
    document.querySelectorAll('#bkSeg button').forEach((x) => x.classList.toggle('on', x === b));
    bookings();
  }));
  $('bkSearch').addEventListener('input', bookings);
  $('clSearch').addEventListener('input', clients);
  $('calPrev').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); calendar(); });
  $('calNext').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); calendar(); });
  $('calToday').addEventListener('click', () => { const t = dateOf(today); calMonth = new Date(t.getFullYear(), t.getMonth(), 1); calendar(); });
  const start = location.hash.slice(1);
  if (['overview', 'bookings', 'calendar', 'clients', 'money'].includes(start)) openTab(start);
}

function showData(raw, updated, email) {
  today = dayOf(new Date());
  const t = dateOf(today);
  calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  D = prepare(raw);
  $('whoName').textContent = D.name || email || '';
  $('synced').textContent = updated ? 'Updated from your phone ' + updated.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  render();
  show('app');
}

// ---------------------------------------------------------------- sample data for previews
function sample() {
  const t = dayOf(new Date());
  let id = 0;
  const g = (client, event, off, start, fee, status = 0, email = '') => ({ id: ++id, client, email, event, notes: '', gig_day: t + off, due_day: t + off, fee_cents: fee * 100, status, start_min: start });
  const gigs = [
    g('Hilton Malta', 'Gala dinner', -40, 1200, 450, 0, 'events@hilton.example'), g('Café del Mar', 'Sunset session', -20, 1110, 250),
    g('Radisson Blu', 'Company party', -12, -1, 600), g('Joanna & Mark', 'Wedding reception, Villa Arrigo', -1, 1140, 900, 0, 'joanna.mark@example.com'),
    g("Bob's Bar", 'Friday live', 0, 1260, 150), g('Hilton Malta', 'New Year party rehearsal', 1, 1320, 800, 0, 'events@hilton.example'),
    g('Café del Mar', 'Acoustic night', 9, 1200, 200, 1), g('Radisson Blu', 'Corporate event', 25, 1170, 500),
    g("Bob's Bar", 'Karaoke special', -5, 1260, 120, 2), g('Hilton Malta', 'Summer terrace', -70, 1140, 300, 0, 'events@hilton.example'),
    g('Sofia & Alex', 'Wedding, Villa Serena', 60, 1170, 1200, 1, 'sofia@example.com'), g('Corinthia', 'Christmas lunch', -100, 780, 650),
  ];
  return {
    v: 1, name: 'Maria Borg', currency: 'EUR', one: 'gig', many: 'gigs', gigs,
    payments: [{ gig_id: 1, cents: 45000, day: t - 40 }, { gig_id: 2, cents: 25000, day: t - 15 }, { gig_id: 3, cents: 20000, day: t - 12 },
      { gig_id: 10, cents: 30000, day: t - 60 }, { gig_id: 12, cents: 65000, day: t - 95 }],
    clients: [{ name: 'Hilton Malta', email: 'events@hilton.example', phone: '+356 2138 3383' }, { name: 'Joanna & Mark', email: 'joanna.mark@example.com', phone: '+356 9912 3456' }],
    expenses: [{ day: t - 1, cents: 2500, category: 'Fuel & transport', note: 'Fuel to Mdina' }, { day: t - 1, cents: 6000, category: 'Hair & make-up', note: '' },
      { day: t - 30, cents: 12000, category: 'Outfits & costumes', note: 'Red dress' }, { day: t - 50, cents: 30000, category: 'Equipment', note: 'New microphone' }],
  };
}

// ---------------------------------------------------------------- sign-in and loading
async function start() {
  wire();
  if (demo) {
    $('signout').hidden = true;
    return showData(sample(), new Date(), '');
  }
  try {
    const app = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`);
    authMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`);
    const fs = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`);
    const fb = app.initializeApp(window.SHOWFEE_FIREBASE);
    auth = authMod.getAuth(fb);
    const db = fs.getFirestore(fb);
    const out = () => authMod.signOut(auth);
    $('signout').addEventListener('click', out);
    $('signout2').addEventListener('click', out);
    $('google').addEventListener('click', async () => {
      $('signinErr').hidden = true;
      try {
        await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider());
      } catch (e) {
        if (e && e.code === 'auth/popup-closed-by-user') return;
        $('signinErr').textContent = e && e.code === 'auth/popup-blocked'
          ? 'Your browser blocked the sign-in window. Allow pop-ups for showfee.app and try again.'
          : 'Sign-in didn’t work. Please try again.';
        $('signinErr').hidden = false;
      }
    });
    authMod.onAuthStateChanged(auth, async (user) => {
      if (!user) { $('whoName').textContent = ''; return show('signin'); }
      show('loading');
      $('whoName').textContent = user.email || '';
      $('synced').textContent = '';
      try {
        const snap = await fs.getDoc(fs.doc(db, 'dash', user.uid));
        if (!snap.exists()) { $('emptyEmail').textContent = user.email || 'this account'; return show('empty'); }
        const d = snap.data();
        showData(d.data, d.updated && d.updated.toDate ? d.updated.toDate() : null, user.email);
      } catch (e) {
        console.error(e);
        show('error');
      }
    });
  } catch (e) {
    console.error(e);
    show('error');
  }
}

start();
