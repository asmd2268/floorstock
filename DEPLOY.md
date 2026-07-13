# Controlled pharmacy officer role

1. Upload `index.html` to GitHub and replace the current file.
2. Deploy the updated Cloud Function because a new role was added:

```bash
cd ~/Downloads/floorstock-controlled-pharmacy-role
cd functions
npm install
cd ..
firebase use floorstock-6ac2d
firebase deploy --only functions,firestore:rules
```

3. Refresh the website with Command + Shift + R.
4. Sign in as the Master pharmacy account.
5. Users → Add User → choose:
   `Pharmacy controlled & psychotropic medicines officer`

Permissions:
- Controlled pharmacy officer: manages lists for all departments, edits pharmacy custody stock, accepts/rejects warehouse deliveries, dispenses.
- Warehouse officer: edits warehouse stock and sends to pharmacy.
- Each can view the other party's stock read-only.
- Department and normal pharmacy accounts have read/print access only on this module.
