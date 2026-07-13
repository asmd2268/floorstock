# Required deployment

The error `Missing or insufficient permission` was caused by a mismatch between the Firestore document names used by the website and the names permitted by the old Firestore rules.

## Install

1. Replace the current GitHub `index.html` with this folder's `index.html`.
2. Open Terminal in this extracted folder.
3. Run:

```bash
firebase use floorstock-6ac2d
firebase deploy --only firestore:rules
```

4. Wait for `Deploy complete`.
5. Hard-refresh the website with `Command + Shift + R`.
6. Sign out and sign in again.

## Colours

- Blue columns: warehouse quantities and expiry dates.
- Green columns: controlled-pharmacy quantities and expiry dates.
