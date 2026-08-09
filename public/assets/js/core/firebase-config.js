export const FIREBASE_CONFIG = Object.freeze({apiKey:'AIzaSyBlcFhBTaJ9so8MlCLa_JTtUpQxCbEwuzU',authDomain:'floorstock-6ac2d.firebaseapp.com',projectId:'floorstock-6ac2d',storageBucket:'floorstock-6ac2d.firebasestorage.app',messagingSenderId:'920762414422',appId:'1:920762414422:web:8d6dbc7069d4088defd2f7',measurementId:'G-61NRS4WT8Q'});
globalThis.FIREBASE_CONFIG=FIREBASE_CONFIG;
export function isFirebaseEmulatorEnabled(){
  try{
    const host=String(location.hostname||'').toLowerCase();
    const query=new URLSearchParams(location.search||'');
    return (host==='127.0.0.1'||host==='localhost') && query.get('emulator')==='1';
  }catch(_){ return false; }
}
