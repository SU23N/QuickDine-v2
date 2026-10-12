import { createHash } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError } from 'firebase-functions/v2/https';
import { DomainError, ROLES } from './domain.js';
if (!getApps().length) initializeApp();
export const db = getFirestore();
export const adminAuth = getAuth();
export const options = {region:'asia-south1',maxInstances:10,enforceAppCheck:!process.env.FIRESTORE_EMULATOR_HOST};
export const hash = value => createHash('sha256').update(value).digest('hex');
export function requireUid(request) {
  if (!request.auth) throw new HttpsError('unauthenticated','Sign in to continue.');
  return request.auth.uid;
}
export function restaurantRef(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new HttpsError('invalid-argument','Invalid restaurant.');
  return db.doc(`restaurants/${id}`);
}
export async function roleFor(uid, rid, tx) {
  const read = ref => tx ? tx.get(ref) : ref.get();
  const member = await read(db.doc(`restaurants/${rid}/staff/${uid}`));
  if (member.exists) {
    const m = member.data();
    return m?.active === true && ROLES.includes(m.role) ? m.role : null;
  }
  const legacy = (await read(db.doc(`staff/${uid}`))).data();
  return legacy?.active === true && legacy.restaurantId === rid && ROLES.includes(legacy.role) ? legacy.role : null;
}
export async function isPlatformAdmin(uid,tx) {
  const ref=db.doc(`platformAdmins/${uid}`);
  return (await (tx?tx.get(ref):ref.get())).data()?.active === true;
}
export async function requirePlatformAdmin(request) {
  const uid = requireUid(request);
  if (!await isPlatformAdmin(uid)) throw new HttpsError('permission-denied','Platform administrator access required.');
  return uid;
}
export async function requireOwnerOrAdmin(request, rid) {
  const uid = requireUid(request);
  if (!await isPlatformAdmin(uid) && await roleFor(uid,rid) !== 'owner') throw new HttpsError('permission-denied','Restaurant owner access required.');
  return uid;
}
export function translate(error) {
  if (error instanceof HttpsError) throw error;
  if (error instanceof DomainError) throw new HttpsError(error.code,error.message);
  console.error('QuickDine operation failed',{code:error.code || 'unknown'});
  throw new HttpsError('internal','Could not save. Please try again.');
}
export function audit(action,uid,rid,details={}) {
  return db.collection('auditLog').add({action,actorUid:uid,restaurantId:rid || null,details,at:new Date()});
}
