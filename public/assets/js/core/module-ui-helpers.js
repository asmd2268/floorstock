/* The small pieces every legacy module needs to put something on screen: a
   toast, a modal, an audit entry, the acting user, and a stylesheet injected
   once.

   Each of these is a thin adapter over a global the app publishes elsewhere
   (`toast`, `OM`/`CM`, `auditAction`, `actualUser`), written to keep working when
   that global is not there yet. modules/51 carried its own copy of all five and
   the crash-cart block and the test-mode block both used them, which is why
   neither block could be moved out on its own: the first one to leave would have
   had to take the helpers with it or duplicate them, and duplication is what
   this file removes.

   Extracted so the blocks above them can be moved one at a time. */

import { fsE } from './dom-utils.js?v=b2909b7f46';

export function uiToast(message, kind) {
  if (typeof globalThis.toast2 === 'function') return globalThis.toast2(message, kind || 'info');
  if (typeof globalThis.toast === 'function') return globalThis.toast(message, kind || 'info');
  /* Not silence: a message nobody can see is the failure mode this project has
     spent the most time removing. */
  if (kind === 'err') console.error(message); else console.log(message);
  return undefined;
}

export function uiNow() {
  return typeof globalThis.nowISO === 'function' ? globalThis.nowISO() : new Date().toISOString();
}

/* The person actually acting — which is the signed-in Master even while they are
   testing another role, because that is who the audit trail must name. */
export function uiActor() {
  const user = (typeof globalThis.actualUser === 'function'
    ? globalThis.actualUser()
    : (globalThis.MASTER_ACTUAL || globalThis.CU || {})) || {};
  return {
    name: user.name || user.fullName || user.displayName || user.username || user.email || 'Unknown',
    user: user.username || user.email || user.id || user.uid || 'Unknown',
    id: user.id || user.uid || '',
    role: (globalThis.CU && globalThis.CU.role) || '',
  };
}

/* Never throws and never blocks the action it records: an audit entry that fails
   must not take the operation down with it. */
export function uiAudit(action, meta) {
  if (typeof globalThis.auditAction === 'function') {
    try {
      return Promise.resolve(globalThis.auditAction(action, meta || {})).catch((error) => console.error(error));
    } catch (error) {
      console.error(error);
    }
  }
  return Promise.resolve();
}

export function uiCloseModal(id) {
  if (typeof globalThis.CM === 'function') { try { globalThis.CM(id); return; } catch (error) {console.warn('CM was skipped after an error; the rest of this screen still renders.', error); /* fall through */ } }
  const node = fsE(id);
  if (node) node.classList.remove('on');
}

export function uiOpenModal(id) {
  if (typeof globalThis.OM === 'function') { try { globalThis.OM(id); return; } catch (error) {console.warn('OM was skipped after an error; the rest of this screen still renders.', error); /* fall through */ } }
  const node = fsE(id);
  if (node) node.classList.add('on');
}

/* Injects a stylesheet once, by id. Calling it again is a no-op, so a renderer
   may call it on every open without accumulating <style> elements. */
export function uiEnsureStyles(id, css) {
  if (!id || document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

Object.assign(globalThis, { uiToast, uiNow, uiActor, uiAudit, uiCloseModal, uiOpenModal, uiEnsureStyles });
