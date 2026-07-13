# Stock quantity restoration and out-of-stock separation

This build restores the exact quantities and expiry dates from `narcotic-master-stock.xlsx`:

- A: MOH code
- B: NUPCO code
- C: medicine name
- D: warehouse system balance
- E: warehouse outside-system balance
- F: first warehouse expiry
- G: quantity linked to the second warehouse expiry
- H: second warehouse expiry
- I: minimum
- J: maximum
- L: pharmacy controlled-custody quantity
- M: pharmacy controlled-custody expiry

The inpatient department workbook remains separate and does not overwrite warehouse or pharmacy quantities.

## Deployment
Replace the current GitHub `index.html` with this file, then hard-refresh the site with Command + Shift + R.

No Cloud Functions redeployment is required for this correction.
