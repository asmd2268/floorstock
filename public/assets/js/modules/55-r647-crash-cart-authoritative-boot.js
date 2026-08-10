/*
 * Crash Cart data must never be changed merely by opening the page.  The
 * former boot reconciler called setCrashCarts() after login, which could be
 * rejected by Firestore and also overwrite a fresh realtime snapshot.  Keep
 * this module as a no-op for backwards-compatible imports; reconciliation is
 * available only through an explicit, authorised manager action.
 */

export {};
