# Controlled medicines v6 deployment

1. Replace GitHub `index.html` with this file.
2. Deploy the included Firestore rules:

```bash
firebase use floorstock-6ac2d
firebase deploy --only firestore:rules
```

3. Hard-refresh with `Command + Shift + R`.

New features include multiple expiry batches, inpatient/outpatient dispensing, date-range analytics, improved bilingual print layouts, logo support, public expiry QR pages, signature names, handover records, code-selection options, and By Ali Abudahash on printouts.
