import admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';

admin.initializeApp({ projectId: 'demo-floorstock-emulator' });
const db = admin.firestore();

// Keep the role fixtures usable in the Emulator: department-scoped profiles
// must have matching directory entries before the app can load their pages.
await db.collection('floorstock_state').doc('departments').set({
  value: [
    { id: 'anesthesia', name: 'ANESTHESIA', active: true },
    { id: 'male-medical', name: 'MALE MEDICAL', active: true },
    { id: 'outpatient', name: 'OUTPATIENT DEPARTMENT', active: true },
  ],
  updatedAt: new Date().toISOString(),
}, { merge: true });

const profiles = {
  master: { role: 'master', master: true, active: true },
  pharmacy: { role: 'pharmacy', active: true },
  pharmacy_staff: { role: 'pharmacy_staff', active: true },
  inpatient_supervisor: { role: 'inpatient_supervisor', active: true, deptId: 'male-medical' },
  outpatient_pharmacy_supervisor: { role: 'outpatient_pharmacy_supervisor', active: true, deptId: 'outpatient' },
  department: { role: 'department', active: true, deptId: 'anesthesia' },
  custodian: { role: 'custodian', active: true, deptId: 'anesthesia' },
  controlled_pharmacy: { role: 'controlled_pharmacy', active: true, deptId: 'anesthesia' },
  warehouse: { role: 'warehouse', active: true },
};

const users = await admin.auth().listUsers(1000);
const now = new Date().toISOString();
for (const [role, profile] of Object.entries(profiles)) {
  const email = `test-${role}@floorstock.local`;
  const user = users.users.find((candidate) => candidate.email === email);
  if (!user) {
    console.log(`Skipping ${email}: create the Auth Emulator account first.`);
    continue;
  }
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    email,
    displayName: `Emulator ${role}`,
    ...profile,
    createdAt: now,
    updatedAt: now,
  }, { merge: true });
  console.log(`Seeded ${email} (${role})`);
}
await admin.app().delete();
