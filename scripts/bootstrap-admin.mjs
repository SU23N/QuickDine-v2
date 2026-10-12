import {createRequire} from 'node:module';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const [projectId,email]=process.argv.slice(2);
if(!projectId||!email||!email.includes('@')) throw Error('Usage: node scripts/bootstrap-admin.mjs PROJECT_ID ADMIN_EMAIL (with trusted application-default credentials)');
initializeApp({projectId,credential:applicationDefault()});
let user;
try{user=await getAuth().getUserByEmail(email);}catch(e){if(e.code!=='auth/user-not-found')throw e;user=await getAuth().createUser({email});}
await getFirestore().doc(`platformAdmins/${user.uid}`).set({active:true,email:user.email,createdAt:new Date()},{merge:true});
console.log(JSON.stringify({projectId,adminUid:user.uid,email:user.email,role:'platform-admin',next:'Use password reset from the app sign-in screen to set your password.'}));
