# Custodian role removed

Changes:
- Removed `Department controlled-custody viewer` from the Add User role list.
- Removed the `custodian` role from front-end validation and Firebase function payload handling.
- Existing users whose Firestore role is still `custodian` are treated as normal `department` users at login.
- JavaScript syntax verified.

Deployment:
Replace the repository `index.html`, commit, and push.
For full cleanup, update any existing Firestore user documents with role `custodian` to role `department`.
