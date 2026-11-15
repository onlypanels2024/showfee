// ShowFee: tells a ShowFee user's phone straight away when a client sends a booking request.
// Runs in Google Cloud (project showfee-app, europe-west1) whenever a document is created in requests/.
// It reads the new request, finds the owner's phones in devices/{uid} and sends a data message
// (the app turns it into the notification). Phones that no longer exist are removed from the list.
const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

functions.cloudEvent('notifyOwner', async (event) => {
  const path = String(event.subject || '').replace(/^documents\//, '');
  if (!/^requests\/[^/]+$/.test(path)) return;
  const snap = await db.doc(path).get();
  if (!snap.exists) return;
  const r = snap.data();
  if (r.status !== 'new' || !r.owner) return;

  const devRef = db.doc('devices/' + r.owner);
  const dev = await devRef.get();
  const tokens = dev.exists ? (dev.data().tokens || []).filter((t) => typeof t === 'string' && t) : [];
  if (!tokens.length) {
    console.log('no phones for owner', r.owner);
    return;
  }
  let when = String(r.date || '');
  try {
    when = new Date(r.date + 'T12:00:00Z').toLocaleDateString('en-GB',
      { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch (e) { /* keep the plain date */ }

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data: { type: 'booking_request', id: snap.id, name: String(r.name || '').slice(0, 80), when },
    android: { priority: 'high', ttl: 24 * 60 * 60 * 1000 },
  });
  const gone = [];
  res.responses.forEach((x, i) => {
    const code = x.error && x.error.code;
    if (!x.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code || '')) gone.push(tokens[i]);
  });
  if (gone.length) await devRef.update({ tokens: admin.firestore.FieldValue.arrayRemove(...gone) });
  console.log('request', snap.id, 'sent', res.successCount, 'failed', res.failureCount, 'removed', gone.length);
});
