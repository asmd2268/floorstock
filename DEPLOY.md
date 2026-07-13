# Deployment

1. Replace your GitHub `index.html` with this file.
2. From this folder run:

```bash
firebase use floorstock-6ac2d
firebase deploy --only functions,firestore:rules
```

3. Hard refresh with Command + Shift + R.
4. Create the role **Pharmacy controlled & psychotropic medicines officer** from Users.
5. Open Controlled & Psychotropic Medicines and import `narcotic.xlsx`.

The Excel mapping is A MOH, B NUPCO, C name, D warehouse system balance, E warehouse outside-system balance, F first warehouse expiry, G second batch quantity, H second batch expiry, I min, J max, L pharmacy quantity, M pharmacy expiry.
