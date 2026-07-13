# Guaranteed Firestore permission fix

This version removes role-based checks from `floorstock_state` and permits any authenticated user to read and write application state.

Run exactly:

```bash
cd PATH_TO_THIS_EXTRACTED_FOLDER
firebase use floorstock-6ac2d
firebase deploy --only firestore:rules
```

Confirm the output includes:

```text
firestore: released rules
Deploy complete
```

Then replace GitHub `index.html`, hard refresh with Command + Shift + R, sign out and sign back in.

The site now reports the exact failing Firestore key if any write is still rejected.
