# Final permission fix

The previous rules depended on `master == true`. If that field was missing or false,
Firebase rejected the controlled-stock restore even for a Pharmacy account.

These rules allow controlled-module documents for these roles:

- `pharmacy`
- `controlled_pharmacy`
- `warehouse`

The website UI still determines which fields each role can edit.

## Required deployment

Run from this extracted folder:

```bash
firebase use floorstock-6ac2d
firebase deploy --only firestore:rules
```

Then hard-refresh with `Command + Shift + R`, sign out, and sign in again.
