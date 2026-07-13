# Deploy Floorstock secure user management

Run these commands from the folder containing `firebase.json`:

```bash
npm install -g firebase-tools
firebase login
firebase use floorstock-6ac2d
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```

After deployment, upload the updated `index.html` to the repository root and deploy the web app as usual.

The first Master profile must already exist at:
`users/wFfPz93UmENhuStee7PkxAi0NOI3`

Required fields:
- `role`: `pharmacy`
- `active`: `true`
- `master`: `true`
- `email`: `almftres@hotmail.com`
