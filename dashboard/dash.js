// ShowFee web dashboard (every plan): shows the copy of a user's bookings that the ShowFee app keeps
// in dash/{uid} once they switch it on (Settings › Web dashboard), and lets them add and change things.
// Each change is written to dash/{uid}/ops; the phone (the main copy) applies it and sends back a fresh copy.
// "?demo=1" shows sample data and keeps changes in the page only.

const FB_VERSION = '11.1.0';
const $ = (id) => document.getElementById(id);
const demo = new URLSearchParams(location.search).get('demo') === '1';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CONFIRMED = 0, PENCILLED = 1, CANCELLED = 2;

let auth = null, authMod = null, fs = null, db = null, uid = null;
let PHONE = null, RAW = null, D = null, fmt = null, today = 0, calMonth = null, bkFilter = 'upcoming';
let pending = [];            // changes sent from this page that the phone hasn't applied yet
let phoneAt = null;          // when the phone last sent a copy
const EXPENSE_CATEGORIES = ['Fuel & transport', 'Outfits & costumes', 'Hair & make-up', 'Backing tracks & music',
  'Equipment', 'Lessons & training', 'Promotion', 'Food & drinks', 'Other'];

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
  const d = { ...raw };
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
  d.clients = [...(d.clients || [])];
  d.expenses = [...(d.expenses || [])];
  d.payments = [...(d.payments || [])];
  d.terms = d.terms || 0;
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
  return `<div class="db-row db-click" data-gig="${esc(g.id)}" tabindex="0" role="button">${dateChip(g.day)}<div class="db-row-main"><b>${esc(g.client)}</b><span>${esc(what || niceDay(g.day))}</span></div>${right}</div>`;
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
  $('bkTable').tBodies[0].innerHTML = list.length ? list.map((g) => `<tr class="db-click" data-gig="${esc(g.id)}" tabindex="0"><td>${esc(niceDay(g.day))}${g.start >= 0 ? '<br><span class="muted">' + time(g.start) + '</span>' : ''}</td>
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
    const evs = (byDay[n] || []).map((g) => `<div class="ev ${g.status === PENCILLED ? 'pen' : g.status === CANCELLED ? 'can' : ''}" data-gig="${esc(g.id)}" role="button" tabindex="0" title="${esc(g.client + (g.event ? ' · ' + g.event : ''))}">${g.start >= 0 ? time(g.start) + ' ' : ''}${esc(g.client)}</div>`).join('');
    html += `<div class="day${d.getMonth() !== m ? ' other' : ''}${n === today ? ' today' : ''}" data-day="${n}" title="Add a ${esc(D.one)} on ${esc(niceDay(n))}"><span class="num">${d.getDate()}</span>${evs}</div>`;
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
  $('clTable').tBodies[0].innerHTML = list.length ? list.map((c) => `<tr class="db-click" data-client="${esc(c.name)}" tabindex="0"><td><b>${esc(c.name)}</b></td>
    <td class="muted">${esc(c.email || '–')}</td><td class="muted">${esc(c.phone || '–')}</td>
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
  $('exTable').tBodies[0].innerHTML = rows.length ? rows.map((e) => `<tr class="db-click" data-exp="${esc(e.id)}" tabindex="0"><td>${esc(niceDay(e.day))}</td><td>${esc(e.note || '–')}</td>
    <td class="muted">${esc(e.category || '')}</td><td class="r">${money(e.cents)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">No expenses yet.</td></tr>';
}

function render() {
  document.querySelectorAll('[data-many-cap]').forEach((e) => (e.textContent = cap(D.many)));
  document.querySelectorAll('[data-one]').forEach((e) => (e.textContent = D.one));
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
  if (!calMonth) { const t = dateOf(today); calMonth = new Date(t.getFullYear(), t.getMonth(), 1); }
  PHONE = typeof raw === 'string' ? raw : JSON.stringify(raw);
  phoneAt = updated;
  rebuild();
  $('whoName').textContent = D.name || email || '';
  syncLine();
  show('app');
}

/** The phone's copy plus the changes it hasn't applied yet (ones it has applied are listed in "applied"). */
function rebuild() {
  if (!PHONE) return;
  RAW = JSON.parse(PHONE);
  const done = new Set(RAW.applied || []);
  pending = pending.filter((o) => !(o.doc && done.has(o.doc)));
  for (const op of pending) applyOp(RAW, op);
  refresh();
  syncLine();
}

/** Works out the numbers again and redraws every page (and the open panel). */
function refresh() {
  D = prepare(RAW);
  render();
  if (drawer.redraw) drawer.redraw();
}

// ---------------------------------------------------------------- changes
// A change ("op") is { t: type, d: details }. The same rules are used here (to show it straight away) and on the
// phone (app/WebDash.java), which is the main copy. New records get a "ref" until the phone gives them an id.
const newRef = () => 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sameId = (a, b) => String(a) === String(b);
const realId = (id) => (RAW && RAW.refs && RAW.refs[id] != null ? RAW.refs[id] : id);

function ensureClient(raw, name, email) {
  if (!name) return;
  raw.clients = raw.clients || [];
  const c = raw.clients.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!c) raw.clients.push({ id: 'n' + name.toLowerCase(), name, email: email || '' });
  else if (email) c.email = email;
}

function applyOp(raw, op) {
  const d = op.d || {};
  raw.gigs = raw.gigs || []; raw.payments = raw.payments || []; raw.expenses = raw.expenses || []; raw.clients = raw.clients || [];
  if (op.t === 'gig') {
    const fields = { client: d.client, event: d.event, notes: d.notes, gig_day: d.gig_day, due_day: d.due_day,
      fee_cents: d.fee_cents, status: d.status, start_min: d.start_min };
    const g = raw.gigs.find((x) => sameId(x.id, realId(d.id ?? d.ref)));
    if (g) Object.assign(g, fields); else raw.gigs.push({ id: d.ref, ...fields });
    ensureClient(raw, d.client, d.email);
  } else if (op.t === 'gigDel') {
    const id = realId(d.id);
    raw.gigs = raw.gigs.filter((x) => !sameId(x.id, id));
    raw.payments = raw.payments.filter((x) => !sameId(x.gig_id, id));
    for (const e of raw.expenses) if (sameId(e.gig_id, id)) delete e.gig_id;
  } else if (op.t === 'pay') {
    raw.payments.push({ id: d.ref, gig_id: realId(d.gig), cents: d.cents, day: d.day, note: d.note || '' });
  } else if (op.t === 'payDel') {
    raw.payments = raw.payments.filter((x) => !sameId(x.id, realId(d.id)));
  } else if (op.t === 'client') {
    const c = d.id != null ? raw.clients.find((x) => sameId(x.id, realId(d.id))) : null;
    if (c) {
      if (c.name !== d.name) for (const g of raw.gigs) if (g.client.toLowerCase() === c.name.toLowerCase()) g.client = d.name;
      Object.assign(c, { name: d.name, email: d.email, phone: d.phone, notes: d.notes });
    } else {
      if (d.old && d.old !== d.name) for (const g of raw.gigs) if (g.client.toLowerCase() === d.old.toLowerCase()) g.client = d.name;
      raw.clients.push({ id: d.ref, name: d.name, email: d.email, phone: d.phone, notes: d.notes });
    }
  } else if (op.t === 'clientDel') {
    raw.clients = raw.clients.filter((x) => !sameId(x.id, realId(d.id)));
  } else if (op.t === 'exp') {
    const e = raw.expenses.find((x) => sameId(x.id, realId(d.id ?? d.ref)));
    const fields = { day: d.day, cents: d.cents, category: d.category, note: d.note };
    if (d.gig != null && d.gig !== '') fields.gig_id = realId(d.gig);
    if (e) { Object.assign(e, fields); if (fields.gig_id == null) delete e.gig_id; } else raw.expenses.push({ id: d.ref, ...fields });
  } else if (op.t === 'expDel') {
    raw.expenses = raw.expenses.filter((x) => !sameId(x.id, realId(d.id)));
  }
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

/** Shows the change straight away and sends it to the phone. */
async function send(op, msg) {
  pending.push(op);
  applyOp(RAW, op);
  refresh();
  syncLine();
  toast(msg);
  if (demo) {   // pretend the phone takes it in a moment later
    setTimeout(() => { const p = JSON.parse(PHONE); applyOp(p, op); PHONE = JSON.stringify(p); pending = pending.filter((x) => x !== op); phoneAt = new Date(); rebuild(); }, 1500);
    return;
  }
  try {
    const ref = fs.doc(fs.collection(db, 'dash', uid, 'ops'));
    op.doc = ref.id;   // known before writing, so the list of waiting changes never counts it twice
    await fs.setDoc(ref, { t: op.t, d: op.d, at: fs.serverTimestamp() });
  } catch (e) {
    console.error(e);
    pending = pending.filter((x) => x !== op);
    toast('That didn’t save – check your internet connection and try again.');
    syncLine();
  }
}

/** The line under your name: is the phone up to date? */
function syncLine() {
  const el = $('synced'), when = phoneAt ? phoneAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  if (pending.length) {
    const old = pending.some((o) => o.sentAt && Date.now() - o.sentAt > 60000);
    el.textContent = old ? 'Saved – your phone will update when it’s online' : 'Sending to your phone…';
    el.className = 'db-sync pending';
  } else {
    el.textContent = when ? 'Up to date with your phone · ' + when : '';
    el.className = 'db-sync';
  }
  $('syncNote').innerHTML = pending.length
    ? '<b>Saved.</b> Your phone picks up changes made here within a few seconds when it’s online.'
    : 'Click any ' + esc(D ? D.one : 'booking') + ', client or expense to change it. Changes go straight to your phone.';
}

// ---------------------------------------------------------------- the side panel
const drawer = { redraw: null };
const toCents = (v) => Math.round(parseFloat(String(v).replace(',', '.')) * 100);
const dayFromInput = (v) => { const [y, m, d] = v.split('-').map(Number); return dayOf(new Date(y, m - 1, d)); };
const inputDay = (n) => { const d = dateOf(n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const minFromInput = (v) => { if (!v) return -1; const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const cents2 = (c) => ((c || 0) / 100).toFixed(2);

function openDrawer(title, html, onReady) {
  $('dTitle').textContent = title;
  $('dBody').innerHTML = html;
  $('drawer').hidden = false;
  document.body.classList.add('db-noscroll');
  if (onReady) onReady();
  const f = $('dBody').querySelector('input:not([type=hidden]),select,textarea');
  if (f && matchMedia('(min-width: 761px)').matches) f.focus();
}
function closeDrawer() {
  $('drawer').hidden = true;
  drawer.redraw = null;
  document.body.classList.remove('db-noscroll');
}
const field = (label, input, hint = '') => `<label class="db-field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
const err = (form, msg) => { const e = form.querySelector('.db-err'); e.textContent = msg; e.hidden = !msg; };

function askDelete(btn, question, yes) {
  const box = btn.parentElement;
  box.innerHTML = `<p class="db-confirm">${question}</p><div class="db-actions"><button type="button" class="db-danger" data-yes>Yes, delete</button><button type="button" class="db-ghost" data-no>Cancel</button></div>`;
  box.querySelector('[data-yes]').addEventListener('click', yes);
  box.querySelector('[data-no]').addEventListener('click', () => drawer.redraw && drawer.redraw());
}

/** "You already have Bob's Bar at 21:00 on this day" – or '' when the day is free. */
function clashText(day, exceptId) {
  const l = D.gigs.filter((x) => x.day === day && x.status !== CANCELLED && !sameId(x.id, exceptId));
  if (!l.length) return '';
  const names = l.slice(0, 3).map((x) => x.client + (x.start >= 0 ? ' at ' + time(x.start) : '') + (x.status === PENCILLED ? ' (pencilled in)' : ''));
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  return `You already have ${list}${l.length > 3 ? ' and ' + (l.length - 3) + ' more' : ''} on this day`;
}

// ---- a booking
function gigPanel(id, presetDay) {
  const isNew = id == null;
  const g = isNew ? null : D.gigs.find((x) => sameId(x.id, id));
  if (!isNew && !g) return closeDrawer();
  const day = isNew ? (presetDay ?? today) : g.day;
  const names = [...new Set([...D.clients.map((c) => c.name), ...D.gigs.map((x) => x.client)])].sort((a, b) => a.localeCompare(b));
  const status = isNew ? CONFIRMED : g.status;
  const pays = isNew ? [] : D.payments.filter((p) => sameId(p.gig_id, g.id)).sort((a, b) => b.day - a.day);
  const html = `<form id="gigForm" class="db-form" novalidate>
    ${field('Client', `<input name="client" list="clientList" required maxlength="80" value="${esc(isNew ? '' : g.client)}" autocomplete="off"><datalist id="clientList">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>`)}
    ${field('What is it? <em>(optional)</em>', `<input name="event" maxlength="120" placeholder="e.g. Wedding reception" value="${esc(isNew ? '' : g.event)}">`)}
    <div class="db-two">
      ${field('Date', `<input type="date" name="day" required value="${inputDay(day)}">`)}
      ${field('Start time <em>(optional)</em>', `<input type="time" name="start" value="${isNew ? '' : time(g.start)}">`)}
    </div>
    <p class="db-warn" id="gClash" hidden></p>
    <div class="db-two">
      ${field('Fee (' + esc(D.currency || 'EUR') + ')', `<input name="fee" inputmode="decimal" required value="${isNew ? '' : cents2(g.fee)}" placeholder="0.00">`)}
      ${field('Payment due', `<input type="date" name="due" value="${isNew ? '' : inputDay(g.due)}">`, isNew ? (D.terms ? `${D.terms} days after the date, unless you change it` : 'On the day, unless you change it') : '')}
    </div>
    <div class="db-field"><span>Status</span><div class="db-seg db-seg-wide" id="gStatus">
      <button type="button" data-s="0" class="${status === CONFIRMED ? 'on' : ''}">Confirmed</button><button type="button" data-s="1" class="${status === PENCILLED ? 'on' : ''}">Pencilled in</button><button type="button" data-s="2" class="${status === CANCELLED ? 'on' : ''}">Cancelled</button></div></div>
    ${field('Notes <em>(optional)</em>', `<textarea name="notes" rows="3" maxlength="2000">${esc(isNew ? '' : g.notes)}</textarea>`)}
    <p class="db-err" hidden></p>
    <div class="db-actions"><button class="db-btn" type="submit">${isNew ? 'Add ' + esc(D.one) : 'Save changes'}</button><button class="db-ghost" type="button" data-close>Cancel</button></div>
  </form>
  ${isNew ? '' : `<div class="db-sub">
    <h3>Payments</h3>
    <div class="db-paysum"><span>Fee <b>${money(g.fee)}</b></span><span>Received <b>${money(g.paid)}</b></span><span>Still owed <b class="${g.balance ? 'owe' : ''}">${money(g.balance)}</b></span></div>
    ${pays.length ? `<div class="db-list">${pays.map((p) => `<div class="db-row"><div class="db-row-main"><b>${money(p.cents)}</b><span>${esc(niceDay(p.day))}${p.note ? ' · ' + esc(p.note) : ''}</span></div><button type="button" class="db-x" data-pay="${esc(p.id)}" aria-label="Remove this payment" title="Remove this payment">×</button></div>`).join('')}</div>` : '<p class="db-empty">No payments yet.</p>'}
    <form id="payForm" class="db-form db-payform" novalidate>
      <div class="db-three">
        ${field('Amount', `<input name="amount" inputmode="decimal" value="${g.balance ? cents2(g.balance) : ''}" placeholder="0.00">`)}
        ${field('Date received', `<input type="date" name="day" value="${inputDay(today)}">`)}
        ${field('How <em>(optional)</em>', `<input name="note" maxlength="80" placeholder="Cash, Revolut…">`)}
      </div>
      <p class="db-err" hidden></p>
      <div class="db-actions"><button class="db-btn db-btn-sm" type="submit">Record payment</button>${g.balance ? `<button class="db-ghost" type="button" id="paidFull">Paid in full (${money(g.balance)})</button>` : ''}</div>
    </form>
  </div>
  <div class="db-sub db-del"><button type="button" class="db-danger-link" id="delGig">Delete this ${esc(D.one)}</button></div>`}`;
  drawer.redraw = () => gigPanel(isNew ? null : realId(g.id));
  if (isNew) drawer.redraw = null;
  openDrawer(isNew ? 'New ' + D.one : g.client, html, () => {
    let st = status;
    const f = $('gigForm');
    const clash = () => { const t = f.day.value ? clashText(dayFromInput(f.day.value), isNew ? null : g.id) : ''; $('gClash').textContent = t; $('gClash').hidden = !t; };
    f.day.addEventListener('input', clash); f.day.addEventListener('change', clash); clash();
    f.querySelectorAll('#gStatus button').forEach((b) => b.addEventListener('click', () => {
      st = Number(b.dataset.s); f.querySelectorAll('#gStatus button').forEach((x) => x.classList.toggle('on', x === b));
    }));
    f.querySelector('[data-close]').addEventListener('click', closeDrawer);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const client = f.client.value.trim(), fee = toCents(f.fee.value || '0');
      if (!client) return err(f, 'Add the client’s name.');
      if (!f.day.value) return err(f, 'Choose the date.');
      if (!(fee >= 0)) return err(f, 'The fee should be a number, like 250 or 250.00.');
      const gd = dayFromInput(f.day.value);
      const due = f.due.value ? dayFromInput(f.due.value) : gd + (isNew ? (D.terms || 0) : 0);
      const d = { client, event: f.event.value.trim(), notes: f.notes.value.trim(), gig_day: gd, due_day: due,
        fee_cents: fee, status: st, start_min: minFromInput(f.start.value) };
      if (isNew) d.ref = newRef(); else d.id = realId(g.id);
      send({ t: 'gig', d }, isNew ? cap(D.one) + ' added' : 'Changes saved');
      if (isNew) closeDrawer();
    });
    if (isNew) return;
    const pf = $('payForm');
    pf.addEventListener('submit', (e) => {
      e.preventDefault();
      const cents = toCents(pf.amount.value);
      if (!(cents > 0)) return err(pf, 'Enter the amount you received.');
      send({ t: 'pay', d: { ref: newRef(), gig: realId(g.id), cents, day: pf.day.value ? dayFromInput(pf.day.value) : today, note: pf.note.value.trim() } }, 'Payment recorded');
    });
    const full = $('paidFull');
    if (full) full.addEventListener('click', () => send({ t: 'pay', d: { ref: newRef(), gig: realId(g.id), cents: g.balance, day: today, note: '' } }, 'Marked as paid in full'));
    $('dBody').querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () =>
      send({ t: 'payDel', d: { id: realId(b.dataset.pay) } }, 'Payment removed')));
    $('delGig').addEventListener('click', (e) => askDelete(e.target, `Delete this ${esc(D.one)} and its payments? This can’t be undone.`, () => {
      send({ t: 'gigDel', d: { id: realId(g.id) } }, cap(D.one) + ' deleted'); closeDrawer();
    }));
  });
}

// ---- a client
function clientPanel(name) {
  const isNew = name == null;
  const raw = isNew ? null : (D.clients.find((c) => c.name.toLowerCase() === name.toLowerCase()) || { name });
  const gigs = isNew ? [] : D.gigs.filter((g) => g.client.toLowerCase() === name.toLowerCase());
  const html = `<form id="clForm" class="db-form" novalidate>
    ${field('Name', `<input name="name" required maxlength="80" value="${esc(isNew ? '' : raw.name)}">`)}
    ${field('Email <em>(optional)</em>', `<input type="email" name="email" maxlength="120" value="${esc(isNew ? '' : raw.email || '')}">`)}
    ${field('Phone <em>(optional)</em>', `<input type="tel" name="phone" maxlength="40" value="${esc(isNew ? '' : raw.phone || '')}">`)}
    ${field('Notes <em>(optional)</em>', `<textarea name="notes" rows="3" maxlength="2000">${esc(isNew ? '' : raw.notes || '')}</textarea>`)}
    <p class="db-err" hidden></p>
    <div class="db-actions"><button class="db-btn" type="submit">${isNew ? 'Add client' : 'Save changes'}</button><button class="db-ghost" type="button" data-close>Cancel</button></div>
  </form>
  ${isNew ? '' : `<div class="db-sub"><h3>${esc(cap(D.many))}</h3>${gigs.length ? `<div class="db-list">${[...gigs].reverse().slice(0, 12).map((g) => row(g, `<span class="db-amt">${money(g.fee)}</span>`)).join('')}</div>` : `<p class="db-empty">No ${esc(D.many)} yet.</p>`}
    <div class="db-actions"><button type="button" class="db-ghost" id="clNewGig">+ New ${esc(D.one)} for ${esc(raw.name)}</button></div></div>
    <div class="db-sub db-del">${gigs.length ? `<p class="db-small">To delete this client, delete their ${esc(D.many)} first.</p>` : `<button type="button" class="db-danger-link" id="delCl">Delete this client</button>`}</div>`}`;
  drawer.redraw = isNew ? null : () => clientPanel(raw.name);
  openDrawer(isNew ? 'New client' : raw.name, html, () => {
    const f = $('clForm');
    f.querySelector('[data-close]').addEventListener('click', closeDrawer);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const nm = f.name.value.trim();
      if (!nm) return err(f, 'Add the client’s name.');
      const clash = D.clients.find((c) => c.name.toLowerCase() === nm.toLowerCase());
      if (clash && (isNew || !sameId(clash.id, raw.id))) return err(f, 'You already have a client called ' + clash.name + '.');
      const d = { name: nm, email: f.email.value.trim(), phone: f.phone.value.trim(), notes: f.notes.value.trim() };
      if (isNew || raw.id == null) d.ref = newRef(); else d.id = realId(raw.id);
      if (!isNew) d.old = raw.name;   // lets the phone find them by name too
      send({ t: 'client', d }, isNew ? 'Client added' : 'Changes saved');
      if (isNew) closeDrawer(); else drawer.redraw = () => clientPanel(nm);
    });
    if (isNew) return;
    $('clNewGig').addEventListener('click', () => { gigPanel(null); $('gigForm').client.value = raw.name; });
    $('dBody').querySelectorAll('[data-gig]').forEach((x) => x.addEventListener('click', () => gigPanel(x.dataset.gig)));
    const del = $('delCl');
    if (del) del.addEventListener('click', (e) => askDelete(e.target, 'Delete ' + esc(raw.name) + ' from your clients?', () => {
      send({ t: 'clientDel', d: { id: realId(raw.id) } }, 'Client deleted'); closeDrawer();
    }));
  });
}

// ---- an expense
function expensePanel(id) {
  const isNew = id == null;
  const e = isNew ? null : D.expenses.find((x) => sameId(x.id, id));
  if (!isNew && !e) return closeDrawer();
  const cat = isNew ? EXPENSE_CATEGORIES[0] : e.category || 'Other';
  const recent = [...D.gigs].filter((g) => g.day <= today + 60).reverse().slice(0, 40);
  const html = `<form id="exForm" class="db-form" novalidate>
    <div class="db-two">
      ${field('Amount (' + esc(D.currency || 'EUR') + ')', `<input name="amount" inputmode="decimal" required value="${isNew ? '' : cents2(e.cents)}" placeholder="0.00">`)}
      ${field('Date', `<input type="date" name="day" value="${inputDay(isNew ? today : e.day)}">`)}
    </div>
    ${field('Category', `<select name="category">${[...new Set([...EXPENSE_CATEGORIES, cat])].map((c) => `<option${c === cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`)}
    ${field('What for? <em>(optional)</em>', `<input name="note" maxlength="120" value="${esc(isNew ? '' : e.note || '')}" placeholder="e.g. Fuel to Mdina">`)}
    ${field('For a ' + esc(D.one) + ' <em>(optional)</em>', `<select name="gig"><option value="">Not linked</option>${recent.map((g) => `<option value="${esc(g.id)}"${!isNew && sameId(e.gig_id, g.id) ? ' selected' : ''}>${esc(niceDay(g.day) + ' · ' + g.client)}</option>`).join('')}</select>`)}
    <p class="db-err" hidden></p>
    <div class="db-actions"><button class="db-btn" type="submit">${isNew ? 'Add expense' : 'Save changes'}</button><button class="db-ghost" type="button" data-close>Cancel</button></div>
  </form>
  ${isNew ? '' : '<div class="db-sub db-del"><button type="button" class="db-danger-link" id="delEx">Delete this expense</button></div>'}`;
  drawer.redraw = null;
  openDrawer(isNew ? 'New expense' : 'Expense', html, () => {
    const f = $('exForm');
    f.querySelector('[data-close]').addEventListener('click', closeDrawer);
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const cents = toCents(f.amount.value);
      if (!(cents > 0)) return err(f, 'Enter how much it cost.');
      const d = { day: f.day.value ? dayFromInput(f.day.value) : today, cents, category: f.category.value, note: f.note.value.trim(),
        gig: f.gig.value ? realId(f.gig.value) : null };
      if (isNew) d.ref = newRef(); else d.id = realId(e.id);
      send({ t: 'exp', d }, isNew ? 'Expense added' : 'Changes saved');
      closeDrawer();
    });
    if (isNew) return;
    $('delEx').addEventListener('click', (ev) => askDelete(ev.target, 'Delete this expense?', () => {
      send({ t: 'expDel', d: { id: realId(e.id) } }, 'Expense deleted'); closeDrawer();
    }));
  });
}

function wireEditing() {
  document.addEventListener('click', (e) => {
    if (!D || !$('drawer').hidden && $('drawer').contains(e.target)) return;
    const gig = e.target.closest('[data-gig]'), cl = e.target.closest('[data-client]'), ex = e.target.closest('[data-exp]'), day = e.target.closest('[data-day]');
    if (gig) return gigPanel(gig.dataset.gig);
    if (cl) return clientPanel(cl.dataset.client);
    if (ex) return expensePanel(ex.dataset.exp);
    if (day) return gigPanel(null, Number(day.dataset.day));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('drawer').hidden) closeDrawer();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.db-click,[data-gig]') && $('drawer').hidden) { e.preventDefault(); e.target.click(); }
  });
  document.querySelectorAll('[data-new-gig]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); gigPanel(null); }));
  $('newClient').addEventListener('click', () => clientPanel(null));
  $('newExpense').addEventListener('click', () => expensePanel(null));
  $('dClose').addEventListener('click', closeDrawer);
  $('dBg').addEventListener('click', closeDrawer);
  setInterval(() => { if (pending.length) syncLine(); }, 15000);
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
    v: 1, terms: 0, name: 'Maria Borg', currency: 'EUR', one: 'gig', many: 'gigs', gigs,
    payments: [{ id: 1, gig_id: 1, cents: 45000, day: t - 40, note: 'Bank transfer' }, { id: 2, gig_id: 2, cents: 25000, day: t - 15, note: 'Cash' },
      { id: 3, gig_id: 3, cents: 20000, day: t - 12, note: 'Revolut' }, { id: 4, gig_id: 10, cents: 30000, day: t - 60 }, { id: 5, gig_id: 12, cents: 65000, day: t - 95 }],
    clients: [{ id: 1, name: 'Hilton Malta', email: 'events@hilton.example', phone: '+356 2138 3383' }, { id: 2, name: 'Joanna & Mark', email: 'joanna.mark@example.com', phone: '+356 9912 3456' },
      { id: 3, name: 'Café del Mar' }, { id: 4, name: 'Radisson Blu' }, { id: 5, name: "Bob's Bar" }, { id: 6, name: 'Sofia & Alex', email: 'sofia@example.com' }, { id: 7, name: 'Corinthia' }],
    expenses: [{ id: 1, day: t - 1, cents: 2500, category: 'Fuel & transport', note: 'Fuel to Mdina', gig_id: 4 }, { id: 2, day: t - 1, cents: 6000, category: 'Hair & make-up', note: '' },
      { id: 3, day: t - 30, cents: 12000, category: 'Outfits & costumes', note: 'Red dress' }, { id: 4, day: t - 50, cents: 30000, category: 'Equipment', note: 'New microphone' }],
  };
}

// ---------------------------------------------------------------- sign-in and loading
async function start() {
  wire();
  wireEditing();
  if (demo) {
    $('signout').hidden = true;
    return showData(sample(), new Date(), '');
  }
  try {
    const app = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`);
    authMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`);
    fs = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`);
    const fb = app.initializeApp(window.SHOWFEE_FIREBASE);
    auth = authMod.getAuth(fb);
    db = fs.getFirestore(fb);
    let stop = [];
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
    authMod.onAuthStateChanged(auth, (user) => {
      stop.forEach((f) => f()); stop = [];
      pending = []; RAW = null; closeDrawer();
      if (!user) { uid = null; $('whoName').textContent = ''; return show('signin'); }
      uid = user.uid;
      show('loading');
      $('whoName').textContent = user.email || '';
      $('synced').textContent = '';
      // The copy from the phone: redrawn whenever the phone sends a new one.
      stop.push(fs.onSnapshot(fs.doc(db, 'dash', user.uid), (snap) => {
        if (!snap.exists()) { $('emptyEmail').textContent = user.email || 'this account'; return show('empty'); }
        const d = snap.data();
        showData(d.data, d.updated && d.updated.toDate ? d.updated.toDate() : null, user.email);
      }, (e) => { console.error(e); show('error'); }));
      // Changes still waiting for the phone (also ones made on another computer).
      stop.push(fs.onSnapshot(fs.query(fs.collection(db, 'dash', user.uid, 'ops'), fs.orderBy('at')), (snap) => {
        const mine = new Map(pending.filter((o) => o.doc).map((o) => [o.doc, o]));
        const unsent = pending.filter((o) => !o.doc);
        const waiting = snap.docs.map((x) => {
          const v = x.data(), o = mine.get(x.id) || { t: v.t, d: v.d, doc: x.id };
          o.sentAt = v.at && v.at.toMillis ? v.at.toMillis() : Date.now();
          return o;
        });
        const before = pending.length;
        pending = [...waiting, ...unsent];
        if (pending.length !== before) rebuild();
      }, (e) => console.error(e)));
    });
  } catch (e) {
    console.error(e);
    show('error');
  }
}

start();
