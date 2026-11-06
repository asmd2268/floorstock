/* Supplier Inventory — the no-login live page behind a department's QR
   (?view=supplier-public&dept=...&cab=...). Works like the medicine expiry
   monitor: reads public_supplier_inv/<dept> and stays live. */
import { publicPageHtml } from '../core/supplier-inventory-public-view.js?v=c2bc9a1319';
import { PUBLIC_COLLECTION } from '../core/supplier-inventory-store.js?v=525482128d';

(async function start() {
  const p = new URLSearchParams(location.search);
  if (p.get('view') !== 'supplier-public' || !p.get('dept')) return;
  const E = (id) => document.getElementById(id);
  if (E('auth')) E('auth').style.display = 'none';
  if (E('app')) E('app').style.display = 'none';
  document.body.style.cssText = 'margin:0;background:#fff;color:#111';
  document.body.innerHTML = '';
  const root = document.createElement('main');
  root.id = 'public-live-root'; root.className = 'public-live-page';
  root.innerHTML = '<h2>Loading… / جاري التحميل</h2>';
  document.body.appendChild(root);
  try { await window.waitForFirebase(); } catch (e) { root.innerHTML = '<h2>Could not initialize Firebase.</h2>'; return; }
  const tenant = p.get('tenant') || '';
  const col = tenant ? window.FB_DB.collection('tenants').doc(tenant).collection(PUBLIC_COLLECTION) : window.FB_DB.collection(PUBLIC_COLLECTION);
  const cabinetId = p.get('cab') || '';
  const unsub = col.doc(p.get('dept')).onSnapshot((snap) => {
    if (!snap.exists) { root.innerHTML = '<h2>No published list for this department yet. / لا توجد قائمة منشورة لهذا القسم بعد.</h2>'; return; }
    const d = snap.data();
    root.innerHTML = publicPageHtml(d, { cabinetId, today: new Date(), updatedLabel: d.updatedAt ? new Date(d.updatedAt).toLocaleString('en-GB') : '—' });
  }, () => { root.innerHTML = '<h2>Could not load the list. / تعذر تحميل القائمة.</h2>'; });
  window.addEventListener('pagehide', unsub);
}());

export {};
