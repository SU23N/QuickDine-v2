import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { db,adminAuth,options,hash,requireUid,requirePlatformAdmin,requireOwnerOrAdmin,isPlatformAdmin,roleFor,restaurantRef,translate,audit } from './context.js';
import { normalizeRestaurant,normalizePlan,normalizeProfile,emailAddress,text,validId,invoicePlan,renewalPeriod,millis,requireSubscription,PILOT_PLAN,STAFF_ROLES } from './saas-domain.js';

function callable(handler) { return onCall(options,async request => { try { return await handler(request); } catch(e) { translate(e); } }); }
async function ownerAccount(email) {
  try { return await adminAuth.getUserByEmail(email); }
  catch(e) { if (e.code !== 'auth/user-not-found') throw e; return await adminAuth.createUser({email,disabled:false}); }
}
async function setupLink(email) { return await adminAuth.generatePasswordResetLink(email); }
const now = () => Timestamp.now();
function requestKey(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(value)) throw new HttpsError('invalid-argument','Use a valid request ID.');
  return value;
}
export const savePlan = callable(async request => {
  const uid = await requirePlatformAdmin(request), input = request.data;
  const plan = normalizePlan(input);
  await db.doc(`plans/${input.id}`).set({...plan,updatedAt:now()},{merge:true});
  await audit('plan.saved',uid,null,{planId:input.id});
  return {id:input.id};
});
export const createRestaurant = callable(async request => {
  const actor = await requirePlatformAdmin(request), input = normalizeRestaurant(request.data), rid = input.restaurantId;
  const planId = request.data.planId || 'pilot';
  if (!validId(planId)) throw new HttpsError('invalid-argument','Invalid plan.');
  const planSnap = await db.doc(`plans/${planId}`).get();
  const plan = planSnap.data();
  if (!plan?.enabled || input.tableCount > plan.maxTables) throw new HttpsError('failed-precondition','Choose an enabled plan with enough tables.');
  // Accounts are created without a shared or default password; owners set their own password.
  const account = await ownerAccount(input.ownerEmail);
  const root = restaurantRef(rid), at = now();
  await db.runTransaction(async tx => {
    if ((await tx.get(root)).exists) throw new HttpsError('already-exists','This restaurant ID is already in use.');
    const {restaurantId,ownerEmail,tableCount,...profile} = input;
    tx.create(root,{...profile,tableCount,status:'active',acceptingOrders:false,openingTime:'10:00',closingTime:'22:00',orderingAccessUntil:Timestamp.fromMillis(at.toMillis()+plan.trialDays*86400000),serviceAccessState:'active',createdAt:at});
    tx.create(db.doc(`tenantAccounts/${rid}`),{ownerUid:account.uid,ownerEmail,createdBy:actor,createdAt:at});
    tx.create(db.doc(`subscriptions/${rid}`),{planId,planName:plan.name,status:'trial',currentPeriodStart:at,currentPeriodEnd:Timestamp.fromMillis(at.toMillis()+plan.trialDays*86400000),limits:{maxTables:plan.maxTables,maxStaff:plan.maxStaff,maxMonthlyOrders:plan.maxMonthlyOrders},tableCount:input.tableCount,staffCount:1,pricePaise:plan.pricePaise,interval:plan.interval,updatedAt:at});
    const member = {uid:account.uid,email:ownerEmail,role:'owner',active:true,restaurantId:rid,restaurantName:profile.name,createdAt:at};
    tx.set(root.collection('staff').doc(account.uid),member);
    tx.set(db.doc(`memberships/${account.uid}/restaurants/${rid}`),member);
    for(let n=1;n<=tableCount;n++) tx.set(root.collection('tables').doc(String(n)),{active:true});
  });
  await audit('restaurant.created',actor,rid,{ownerUid:account.uid,planId});
  return {restaurantId:rid,ownerUid:account.uid,ownerEmail:input.ownerEmail,setupLink:await setupLink(input.ownerEmail)};
});
export const updateRestaurantProfile = callable(async request => {
  const rid = request.data?.restaurantId, root = restaurantRef(rid), uid = await requireOwnerOrAdmin(request,rid);
  const profile = normalizeProfile(request.data);
  await root.update({...profile,updatedAt:now()});
  await audit('restaurant.branding.updated',uid,rid);
  return {success:true};
});
export const setRestaurantStatus = callable(async request => {
  const uid = await requirePlatformAdmin(request), root = restaurantRef(request.data?.restaurantId);
  if (!['active','suspended'].includes(request.data?.status)) throw new HttpsError('invalid-argument','Choose active or suspended.');
  await root.update({status:request.data.status,...(request.data.status==='suspended'?{acceptingOrders:false}:{}),updatedAt:now()});
  await audit('restaurant.status.changed',uid,root.id,{status:request.data.status});
  return {success:true};
});
export const setSubscriptionStatus = callable(async request => {
  const uid = await requirePlatformAdmin(request), rid = restaurantRef(request.data?.restaurantId).id;
  if (!['suspended','cancelled','active'].includes(request.data?.status)) throw new HttpsError('invalid-argument','Invalid subscription status.');
  await db.runTransaction(async tx => {
    const ref = db.doc(`subscriptions/${rid}`), snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found','Subscription not found.');
    if(request.data.status==='active' && millis(snap.data().currentPeriodEnd)<=Date.now()) throw new HttpsError('failed-precondition','Renew the expired subscription with an invoice first.');
    tx.update(ref,{status:request.data.status,updatedAt:now()});
    tx.update(restaurantRef(rid),{serviceAccessState:request.data.status==='active'?'active':'paused'});
  });
  await audit('subscription.status.changed',uid,rid,{status:request.data.status});
  return {success:true};
});
export const createSubscriptionInvoice = callable(async request => {
  const rid = restaurantRef(request.data?.restaurantId).id, uid = await requireOwnerOrAdmin(request,rid);
  const planId = request.data?.planId, key = requestKey(request.data?.requestId);
  const ref = db.doc(`invoices/${hash(`${rid}:${uid}:${key}`)}`);
  await db.runTransaction(async tx => {
    const prior = await tx.get(ref);
    if(prior.exists) {
      if(prior.data().planId!==planId) throw new HttpsError('already-exists','Request already used for another plan.');
      return;
    }
    if(!validId(planId)) throw new HttpsError('invalid-argument','Invalid plan.');
    const plan = (await tx.get(db.doc(`plans/${planId}`))).data();
    const snapshot = invoicePlan(planId,plan);
    const root = restaurantRef(rid), restaurant = await tx.get(root);
    if(!restaurant.exists) throw new HttpsError('not-found','Restaurant not found.');
    const tables = await tx.get(root.collection('tables').where('active','==',true));
    const staff = await tx.get(root.collection('staff').where('active','==',true));
    if(tables.size>plan.maxTables || staff.size>plan.maxStaff) throw new HttpsError('failed-precondition','This plan is below the current table/staff count. Reduce those counts first.');
    const at=now();
    tx.create(ref,{...snapshot,restaurantId:rid,restaurantName:restaurant.data().name,createdBy:uid,status:'unpaid',createdAt:at,expiresAt:Timestamp.fromMillis(at.toMillis()+7*86400000)});
  });
  return {invoiceId:ref.id};
});
// Called after an administrator records a received payment, or after gateway verification.
export async function settleInvoice(invoiceId, payment, actorUid) {
  if(typeof invoiceId!=='string' || !/^[a-f0-9]{64}$/.test(invoiceId)) throw new HttpsError('invalid-argument','Invalid invoice.');
  const ref=db.doc(`invoices/${invoiceId}`), paymentRef=db.doc(`subscriptionPayments/${hash(`${payment.provider}:${payment.reference}`)}`);
  return await db.runTransaction(async tx => {
    const invoiceSnap=await tx.get(ref), priorPayment=await tx.get(paymentRef);
    if(!invoiceSnap.exists) throw new HttpsError('not-found','Invoice not found.');
    const invoice=invoiceSnap.data();
    if(priorPayment.exists && priorPayment.data().invoiceId!==invoiceId) throw new HttpsError('already-exists','This payment reference is already used.');
    if(invoice.status==='paid') return {success:true,alreadyPaid:true};
    if(invoice.status!=='unpaid' || millis(invoice.expiresAt)<Date.now()) throw new HttpsError('failed-precondition','Create a new invoice; this invoice has expired.');
    if(payment.amountPaise!==invoice.amountPaise || payment.currency!=='INR') throw new HttpsError('failed-precondition','Payment does not match the invoice.');
    const rid=invoice.restaurantId, root=restaurantRef(rid), subscriptionRef=db.doc(`subscriptions/${rid}`);
    const current=(await tx.get(subscriptionRef)).data();
    const tables=await tx.get(root.collection('tables').where('active','==',true));
    const staff=await tx.get(root.collection('staff').where('active','==',true));
    if(tables.size>invoice.limits.maxTables || staff.size>invoice.limits.maxStaff) throw new HttpsError('failed-precondition','Current usage exceeds this plan. Contact the platform administrator.');
    const at=now(), period=renewalPeriod(current,invoice.planId,invoice.interval,at.toMillis());
    const held=current?.status==='suspended';
    tx.set(subscriptionRef,{planId:invoice.planId,planName:invoice.planName,status:held?'suspended':'active',pricePaise:invoice.amountPaise,interval:invoice.interval,limits:invoice.limits,tableCount:tables.size,staffCount:staff.size,currentPeriodStart:Timestamp.fromMillis(period.startsAt),currentPeriodEnd:Timestamp.fromMillis(period.endsAt),updatedAt:at,lastInvoiceId:invoiceId});
    tx.update(root,{orderingAccessUntil:Timestamp.fromMillis(period.endsAt),serviceAccessState:held?'paused':'active'});
    tx.update(ref,{status:'paid',paidAt:at,paymentReference:payment.reference,provider:payment.provider});
    tx.set(paymentRef,{invoiceId,restaurantId:rid,amountPaise:payment.amountPaise,currency:'INR',provider:payment.provider,reference:payment.reference,recordedBy:actorUid,createdAt:at});
    tx.set(db.collection('auditLog').doc(),{action:'subscription.payment.recorded',actorUid,restaurantId:rid,at,details:{invoiceId,provider:payment.provider}});
    return {success:true,endsAt:period.endsAt,held};
  });
}
export const recordSubscriptionPayment = callable(async request => {
  const actor=await requirePlatformAdmin(request), input=request.data;
  if(typeof input?.invoiceId!=='string'||!/^[a-f0-9]{64}$/.test(input.invoiceId))throw new HttpsError('invalid-argument','Invalid invoice.');
  const reference=text(input?.reference,100,true), invoice=(await db.doc(`invoices/${input?.invoiceId}`).get()).data();
  if(!invoice) throw new HttpsError('not-found','Invoice not found.');
  if(Number(input.amountPaise)!==invoice.amountPaise) throw new HttpsError('invalid-argument','Record the full invoice amount.');
  return await settleInvoice(input.invoiceId,{provider:'manual',reference,amountPaise:invoice.amountPaise,currency:'INR'},actor);
});
export const activateFreeSubscription = callable(async request => {
  const id=request.data?.invoiceId;
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new HttpsError('invalid-argument','Invalid invoice.');
  const invoice=(await db.doc(`invoices/${id}`).get()).data();
  if(!invoice)throw new HttpsError('not-found','Invoice not found.');
  const uid=await requireOwnerOrAdmin(request,invoice.restaurantId);
  if(invoice.amountPaise!==0)throw new HttpsError('failed-precondition','This invoice requires a verified payment.');
  return await settleInvoice(id,{provider:'free',reference:id,amountPaise:0,currency:'INR'},uid);
});
export const manageRestaurantStaff = callable(async request => {
  const input=request.data, rid=restaurantRef(input?.restaurantId).id, actor=await requireOwnerOrAdmin(request,rid);
  const platform=await isPlatformAdmin(actor);
  const email=emailAddress(input.email), role=input.role,active=input.active!==false;
  if(!STAFF_ROLES.includes(role) || (!platform && role==='owner')) throw new HttpsError('permission-denied','Owners can manage kitchen and waiter access; platform admins manage owners.');
  const root=restaurantRef(rid);
  const existing=await root.collection('staff').where('email','==',email).limit(1).get();
  const beforeSub=(await db.doc(`subscriptions/${rid}`).get()).data();if(active)requireSubscription(beforeSub);
  if(active&&existing.empty){const count=await root.collection('staff').where('active','==',true).limit(beforeSub.limits.maxStaff+1).get();if(count.size>=beforeSub.limits.maxStaff)throw new HttpsError('resource-exhausted','The staff limit for this plan has been reached.');}
  const account=active?await ownerAccount(email):await adminAuth.getUserByEmail(email), ref=root.collection('staff').doc(account.uid);
  if(account.uid===actor && !active) throw new HttpsError('failed-precondition','You cannot remove your own access.');
  await db.runTransaction(async tx => {
    const sub=(await tx.get(db.doc(`subscriptions/${rid}`))).data();
    if(active)requireSubscription(sub);
    const restaurant=(await tx.get(root)).data(), prior=(await tx.get(ref)).data();
    const members=await tx.get(root.collection('staff').where('active','==',true));
    if(!restaurant) throw new HttpsError('not-found','Restaurant not found.');
    if(!platform && prior?.role==='owner') throw new HttpsError('permission-denied','Only the platform admin can edit owners.');
    const remainingOwners=members.docs.filter(x=>x.id!==account.uid&&x.data().role==='owner').length;
    if(prior?.active && prior.role==='owner' && (!active || role!=='owner') && !remainingOwners) throw new HttpsError('failed-precondition','Keep at least one active owner.');
    if(active && !prior?.active && members.size>=sub.limits.maxStaff) throw new HttpsError('resource-exhausted','The staff limit for this plan has been reached.');
    const data={uid:account.uid,email,role,active,restaurantId:rid,restaurantName:restaurant.name,updatedAt:now()};
    if(sub)tx.update(db.doc(`subscriptions/${rid}`),{staffCount:members.size+(active&&!prior?.active?1:!active&&prior?.active?-1:0),updatedAt:now()});
    tx.set(ref,data,{merge:true});
    tx.set(db.doc(`memberships/${account.uid}/restaurants/${rid}`),data,{merge:true});
  });
  await audit('staff.access.changed',actor,rid,{targetUid:account.uid,role,active});
  return {uid:account.uid,email,setupLink:active?await setupLink(email):null};
});
export const manageRestaurantTables = callable(async request => {
  const rid=restaurantRef(request.data?.restaurantId).id, actor=await requireOwnerOrAdmin(request,rid), count=Number(request.data?.count);
  if(!Number.isInteger(count)||count<1||count>100) throw new HttpsError('invalid-argument','Choose 1–100 tables.');
  const root=restaurantRef(rid);
  await db.runTransaction(async tx=>{
    const subscription=(await tx.get(db.doc(`subscriptions/${rid}`))).data();
    requireSubscription(subscription);
    if(count>subscription.limits.maxTables) throw new HttpsError('resource-exhausted','The table limit for this plan has been reached.');
    const old=await tx.get(root.collection('tables'));
    tx.update(db.doc(`subscriptions/${rid}`),{tableCount:count,updatedAt:now()});
    tx.update(root,{tableCount:count});
    for(const doc of old.docs) if(Number(doc.id)>count) tx.update(doc.ref,{active:false});
    for(let n=1;n<=count;n++) tx.set(root.collection('tables').doc(String(n)),{active:true});
  });
  await audit('tables.updated',actor,rid,{count});
  return {success:true};
});
export const seedPilotPlan = callable(async request => {
  const uid=await requirePlatformAdmin(request), plan=normalizePlan(PILOT_PLAN), ref=db.doc('plans/pilot');
  await db.runTransaction(async tx=>{if(!(await tx.get(ref)).exists)tx.create(ref,{...plan,updatedAt:now()});});
  await audit('platform.pilot.initialized',uid,null);
  return {success:true};
});
