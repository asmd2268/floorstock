# PharmOrder — GitHub-ready build

## Included
- Pharmacy Employee role: edit/print any request; other pharmacy pages are read-only.
- Inpatient Pharmacy Supervisor role: same operational access as Pharmacy Director, except Users.
- One Master user client-side enforcement and Master test-role switch without logout.
- Master actions/prints remain attributed to the actual Master user in audit fields.
- No department is selected by default in Inventory or Import.
- Bulk Refrigerated / LASA / High Alert classification.
- Full-page department inventory with bulk shelf movement and bulk expiry entry.
- Fulfilled request receiving flow that adds received expiry batches to the department.
- Crash Cart module with multiple carts per department, stock/expiry batches, opening reports, consumed quantities, reason, old/new seal, pharmacy close/replacement, and print restrictions.
- Controlled medicines hospital name, approval mark, QR/barcode, current and near-expiry printing.
- Separate Narcotic and Psychotropic print/handover options.
- Min/Max hidden from non-warehouse controlled screens.

## Upload to GitHub
Replace the repository `index.html` with this file and commit/push.

## Important Firebase backend note
The front-end supports the new roles. Your Firebase callable function that creates users and your Firestore security rules must also allow these role strings:
- `pharmacy_staff`
- `inpatient_supervisor`

For secure enforcement, Firestore rules should prevent `pharmacy_staff` from writing outside requests, print/audit fields, and crash-cart workflows. Client-side restrictions alone are not security boundaries.
