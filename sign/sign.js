// ShowFee contract signing page: the client reads a contract a ShowFee user sent them and signs it.
// Link format: showfee.app/sign/?c=<contract id>   ("?c=demo" shows a sample that saves nothing, for previews.)
// The contract id is long and random, so only people who were given the link can open it.

const FB_VERSION = '11.1.0';
const $ = (id) => document.getElementById(id);
const id = (new URLSearchParams(location.search).get('c') || '').trim();
const demo = id === 'demo' || id === 'demo-signed';

let doc = null, db = null, fs = null, inked = false;

function show(which) {
  for (const s of ['loading', 'missing', 'void', 'error', 'contract']) $(s).hidden = s !== which;
}

const when = (d) => d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const asDate = (v) => !v ? null : v.toDate ? v.toDate() : new Date(v);

function fill() {
  document.querySelectorAll('[data-performer]').forEach((e) => (e.textContent = doc.performer));
  document.querySelectorAll('[data-initial]').forEach((e) => (e.textContent = doc.performer.charAt(0).toUpperCase()));
  document.title = doc.title + ' – ' + doc.performer;
  $('title').textContent = doc.title;
  $('text').textContent = doc.text;
  $('pSig').src = doc.performerSig;
  $('pSig').alt = 'Signature of ' + doc.performer;
  $('pWhen').textContent = 'Signed ' + when(asDate(doc.performerAt));
  $('ref').textContent = id;
  if (doc.status === 'signed') showSigned();
}

function showSigned() {
  $('cSig').src = doc.clientSig;
  $('cSig').alt = 'Signature of ' + doc.clientName;
  $('cName').textContent = doc.clientName;
  $('cWhen').textContent = 'Signed ' + when(asDate(doc.clientAt));
  $('cSigBox').hidden = false;
  $('form').hidden = true;
  $('after').hidden = false;
  $('signedNote').hidden = false;
  $('lead').textContent = 'contract signed';
}

// ---- signature pad
const pad = $('pad');
const ctx = pad.getContext('2d');
let drawing = false, last = null;

function sizePad() {
  const r = pad.getBoundingClientRect();
  const k = window.devicePixelRatio || 1;
  pad.width = Math.round(r.width * k);
  pad.height = Math.round(r.height * k);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
  inked = false;
}
const point = (e) => { const r = pad.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
pad.addEventListener('pointerdown', (e) => { drawing = true; last = point(e); pad.setPointerCapture(e.pointerId); e.preventDefault(); });
pad.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = point(e);
  ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  last = p; inked = true; $('formErr').hidden = true;
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => pad.addEventListener(t, () => (drawing = false)));
$('clear').addEventListener('click', sizePad);

// The signature as a small PNG (kept well under the size the database allows).
function signatureImage() {
  const out = document.createElement('canvas');
  out.width = 480; out.height = 150;
  const o = out.getContext('2d');
  o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height);
  o.drawImage(pad, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

function fail(msg) { $('formErr').textContent = msg; $('formErr').hidden = false; }

async function sign(e) {
  e.preventDefault();
  const name = $('name').value.trim();
  if (!name) return fail('Please type your full name.');
  if (!inked) return fail('Please sign in the box.');
  if (!$('agree').checked) return fail('Please tick the box to agree to the contract.');
  const sig = signatureImage();
  $('signBtn').disabled = true; $('signBtn').textContent = 'Signing…';
  try {
    if (!demo) {
      await fs.updateDoc(fs.doc(db, 'contracts', id), { status: 'signed', clientName: name, clientSig: sig, clientAt: fs.serverTimestamp() });
    }
    Object.assign(doc, { status: 'signed', clientName: name, clientSig: sig, clientAt: new Date() });
    showSigned();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    $('signBtn').disabled = false; $('signBtn').textContent = 'Sign contract';
    fail(navigator.onLine === false ? 'No internet connection. Please try again.'
      : 'This contract couldn’t be signed. It may have been signed or cancelled already – reload the page to check.');
  }
}

function demoDoc() {
  const blank = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="150"><rect width="480" height="150" fill="#fff"/><path d="M40 110c30-60 50-70 60-40s-10 50 10 20 40-60 56-24-4 44 20 12 28-36 44-8 20 16 44-4 60-20 100-4" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/></svg>');
  const d = {
    status: 'sent', title: 'Booking agreement', performer: 'Maria Borg', performerSig: blank,
    performerAt: new Date(Date.now() - 3600e3),
    text: 'This agreement is between Maria Borg ("the performer") and Sofia Marchetti & Alex Duval ("the client").\n\n'
      + 'The performer will provide their services for the Wedding at Villa Serena, Mdina on Saturday 12 June 2027, starting at 19:30.\n\n'
      + 'Fee: €1,200.00. A deposit of €300.00 is due by 1 February 2027 to confirm the date. The balance is due on the day of the booking unless agreed otherwise in writing.\n\n'
      + 'Cancellation: if the client cancels, any deposit paid is not refundable. If the performer cannot attend because of illness or an emergency, all money paid for this booking will be refunded.\n\n'
      + 'The client will provide safe access, a suitable space and power where needed.\n\n'
      + 'By signing below, both parties agree to these terms.'
  };
  if (id === 'demo-signed') Object.assign(d, { status: 'signed', clientName: 'Sofia Marchetti', clientSig: blank, clientAt: new Date() });
  return d;
}

async function load() {
  if (!demo && !/^[A-Za-z0-9_-]{16,40}$/.test(id)) return show('missing');
  try {
    if (demo) {
      doc = demoDoc();
    } else {
      const app = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`);
      fs = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`);
      db = fs.getFirestore(app.initializeApp(window.SHOWFEE_FIREBASE));
      const snap = await fs.getDoc(fs.doc(db, 'contracts', id));
      if (!snap.exists()) return show('missing');
      doc = snap.data();
    }
    if (doc.status === 'void') {
      document.querySelectorAll('[data-performer]').forEach((e) => (e.textContent = doc.performer));
      return show('void');
    }
    fill();
    show('contract');
    sizePad();
    window.addEventListener('resize', () => { if (!inked) sizePad(); });
    $('form').addEventListener('submit', sign);
    $('form').addEventListener('input', () => { $('formErr').hidden = true; });
    $('save').addEventListener('click', () => window.print());
  } catch (e) {
    console.error(e);
    show(e && e.code === 'permission-denied' ? 'missing' : 'error');
  }
}

load();
