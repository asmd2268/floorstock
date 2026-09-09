/* The master's view of the nightly upkeep: whether it is on, whether it is only
   reporting, what it did last time, and a way to run it now.

   Deliberately not a switch alone. Upkeep that deletes rows while nobody is
   watching has to be readable after the fact, or it is indistinguishable from
   upkeep that never ran — and the reason it starts in dry run is so these
   numbers can be read for a few days before anything is actually removed. */

/* The build this file was served as.

   Three times today a screenshot showed behaviour that the deployed code no
   longer had, and each time it cost a round trip to work out that the page was
   simply running an older copy. Every module is served with a content hash in
   its URL, so the file can state which one it is: one glance at the panel — or
   at a screenshot of it — settles "is this the current build?" without asking
   anybody to open developer tools. */
const BUILD = (function () {
  const match = /[?&]v=([0-9a-f]+)/.exec(String(import.meta.url || ''));
  return match ? match[1] : 'unstamped';
})();
console.info('[floorstock] upkeep panel build', BUILD);

function isMaster() {
  return !!(globalThis.CU && globalThis.CU.master === true);
}

/* Bounded on this side too. A panel must never be able to sit on "Checking…"
   because something below it never answered — whatever the reason, after this
   long the honest thing to show is a message and a way to try again. */
const CALL_TIMEOUT_MS = 20000;

function callFunction(name, data) {
  if (typeof globalThis.fsCallFunction !== 'function') {
    return Promise.reject(new Error('The secure function service is still loading.'));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('the request timed out / انتهت مهلة الطلب'));
    }, CALL_TIMEOUT_MS);
    globalThis.fsCallFunction(name, data || {}).then(
      (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } },
      (error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } },
    );
  });
}

/* dom-utils publishes fsEsc, but a panel that renders before it would throw and
   leave "Checking…" on screen for good. */
function escapeText(value) {
  return globalThis.fsEsc ? escapeText(value) : String(value == null ? '' : value);
}

function describeChange(change) {
  const where = change.tenantId ? `${change.tenantId}: ` : '';
  if (change.job === 'archive') return `${where}${change.doc} — ${change.added} report(s) filed`;
  return `${where}${change.doc} — ${change.removed} row(s) ${change.action === 'delete' ? 'in a whole expired month' : 'removed'}`;
}

export async function renderScheduledUpkeep() {
  const host = document.getElementById('scheduled-upkeep');
  if (!host) return;
  if (!isMaster()) { host.innerHTML = ''; return; }
  host.innerHTML = `<div class="fhint">Checking the nightly upkeep… / جارٍ فحص الصيانة الليلية…<br/><span class="upkeep-build">build ${escapeText(BUILD)}</span></div>`;
  try {
    await drawScheduledUpkeep(host);
  } catch (error) {
    /* The panel writes "Checking…" and then draws. Anything thrown in between
       used to leave that message on screen permanently, which reads as a hang
       rather than a fault. */
    console.error('Nightly upkeep panel failed to draw', error);
    host.innerHTML = `<div class="fhint">The nightly upkeep panel could not be drawn — ${escapeText(String(error && error.message || error))}. `
      + '<button class="btn bg bsm" type="button" data-upkeep="retry">Try again / إعادة المحاولة</button>'
      + `<br/><span class="upkeep-build">build ${escapeText(BUILD)}</span></div>`;
  }
}

async function drawScheduledUpkeep(host) {

  let status;
  try {
    status = await callFunction('upkeepStatus');
  } catch (error) {
    /* Said plainly, and retryable. A freshly created Cloud Function answers
       "internal" for the first seconds of its life while it starts, which is
       exactly when a master opens this panel for the first time — so the message
       has to offer the obvious next move rather than look like a verdict. */
    console.warn('Nightly upkeep status unavailable', error);
    host.innerHTML = `<div class="fhint">The nightly upkeep could not be reached — ${escapeText(String(error && error.message || error))}. `
      + '<button class="btn bg bsm" type="button" data-upkeep="retry">Try again / إعادة المحاولة</button>'
      + `<br/>تعذّر الوصول إلى الصيانة الليلية.<br/><span class="upkeep-build">build ${escapeText(BUILD)}</span></div>`;
    return;
  }

  const settings = (status && status.settings) || {};
  const last = (status && status.lastRun) || null;
  const state = !settings.enabled
    ? { label: 'Off / متوقفة', tone: 'off', why: 'Nothing runs on a schedule. / لا شيء يعمل تلقائياً.' }
    : settings.dryRun
      ? { label: 'Reporting only / تقرير فقط', tone: 'dry', why: 'It works out what it would remove and changes nothing. / تحسب ما ستحذفه ولا تغيّر شيئاً.' }
      : { label: 'On / تعمل', tone: 'on', why: 'Runs nightly and applies what it finds. / تعمل ليلياً وتطبّق ما تجده.' };

  const changes = (last && last.changes) || [];
  const failures = (last && last.failures) || [];
  const lastLine = last
    ? `Last run ${escapeText(new Date(last.finishedAt).toLocaleString())} · ${last.dryRun ? 'reported' : 'applied'} ${changes.length} change(s)`
      + (failures.length ? ` · <b style="color:var(--rdl)">${failures.length} failed</b>` : '')
    : 'It has not run yet. / لم تعمل بعد.';

  host.innerHTML = `
    <div class="storage-upkeep-head">
      <div>
        <b>🌙 Nightly upkeep / الصيانة الليلية</b>
        <span class="upkeep-state upkeep-${state.tone}">${escapeText(state.label)}</span>
        <div class="fhint">${escapeText(state.why)}</div>
        <div class="fhint">${lastLine}</div>
        <div class="fhint upkeep-build">build ${escapeText(BUILD)}</div>
      </div>
      <div class="fl g8">
        <button class="btn bg bsm" type="button" data-upkeep="run">Run now / شغّلها الآن</button>
        <button class="btn ${settings.enabled ? 'bg' : 'bs'} bsm" type="button" data-upkeep="toggle">${settings.enabled ? 'Turn off / إيقاف' : 'Turn on / تشغيل'}</button>
        ${settings.enabled ? `<button class="btn ${settings.dryRun ? 'bs' : 'bg'} bsm" type="button" data-upkeep="dry">${settings.dryRun ? 'Apply for real / تطبيق فعلي' : 'Report only / تقرير فقط'}</button>` : ''}
      </div>
    </div>
    ${changes.length ? `<details class="storage-upkeep-detail"><summary>What it ${last.dryRun ? 'would change' : 'changed'} / التفاصيل</summary><ul>`
      + changes.slice(0, 40).map((change) => `<li>${escapeText(describeChange(change))}</li>`).join('')
      + (changes.length > 40 ? `<li>…${changes.length - 40} more</li>` : '') + '</ul></details>' : ''}
    ${failures.length ? '<div class="fhint" style="color:var(--rdl)">' + failures.map((f) => escapeText(`${f.job}: ${f.error}`)).join('<br/>') + '</div>' : ''}`;
}

let installed = false;
export function installScheduledUpkeepPanel() {
  if (installed) return;
  const host = document.getElementById('scheduled-upkeep');
  if (!host) return;
  installed = true;
  host.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-upkeep]');
    if (!button) return;
    button.disabled = true;
    try {
      const action = button.getAttribute('data-upkeep');
      if (action === 'retry') {
        await renderScheduledUpkeep();
        return;
      }
      if (action === 'run') {
        const result = await callFunction('runUpkeepNow');
        const run = (result && result.run) || {};
        globalThis.toast(run.skipped
          ? 'The nightly upkeep is turned off. / الصيانة الليلية متوقفة.'
          : `${run.dryRun ? 'Reported' : 'Applied'} ${(run.changes || []).length} change(s).`, run.skipped ? 'info' : 'succ');
      } else {
        const status = await callFunction('upkeepStatus');
        const settings = (status && status.settings) || {};
        if (action === 'toggle') {
          /* Turning it on always starts in reporting mode, whatever it was set
             to before — nothing should begin deleting on the strength of one
             click. */
          await callFunction('setUpkeepSettings', settings.enabled ? { enabled: false } : { enabled: true, dryRun: true });
        } else if (action === 'dry') {
          const applyingNow = settings.dryRun;
          if (applyingNow) {
            const confirmed = await globalThis.uiConfirm(
              'From now on the nightly upkeep will actually remove what it reports: staff activity past 400 days, delivered department notices past 180, duplicated rows, and closed Crash Cart reports older than six months (filed into monthly records, not deleted).\n\n'
              + 'Records, orders, the controlled register and custody are never touched.\n\n'
              + 'ستبدأ الصيانة الليلية بالحذف الفعلي لما تُبلغ عنه. السجلات والطلبات وسجل المخدرات والعهد لا تُمسّ إطلاقاً.',
              { okText: 'Apply for real / تطبيق فعلي' },
            );
            if (!confirmed) { globalThis.toast('Nothing was changed.', 'info'); return; }
          }
          await callFunction('setUpkeepSettings', { dryRun: !settings.dryRun });
        }
      }
      await renderScheduledUpkeep();
    } catch (error) {
      console.error('Nightly upkeep action failed', error);
      globalThis.toast(`The nightly upkeep could not be changed — ${String(error && error.message || error)}`, 'err');
    } finally {
      button.disabled = false;
    }
  });
}

Object.assign(globalThis, { renderScheduledUpkeep, installScheduledUpkeepPanel });
