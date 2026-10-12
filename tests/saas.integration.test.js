import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
let server,app,db,admin,owner,other;
const realFetch=globalThis.fetch;
async function account(email){const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'Test-account-123!',returnSecureToken:true})});const value=await r.json();assert.ok(value.idToken);return {uid:value.localId,token:value.idToken,email};}
async function call(name,user,data){const r=await fetch(`http://127.0.0.1:5001/demo-quickdine/asia-south1/${name}`,{method:'POST',headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${user.token}`}:{})},body:JSON.stringify({data})});return await r.json();}
function restaurant(rid='saas-yash',email=owner.email){return {restaurantId:rid,name:'Yash Test',nameHi:'यश टेस्ट',ownerEmail:email,tableCount:7,planId:'pilot',accentColor:'#7f1d1d'};}
before(async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('Only run against emulators.');
 process.env.RAZORPAY_KEY_ID='rzp_test_fixture';process.env.RAZORPAY_KEY_SECRET='test-secret-only';process.env.RAZORPAY_WEBHOOK_SECRET='webhook-test-only';
 const {startCallableServer}=await import('./helpers/callable-server.js');server=await startCallableServer();app=initializeApp({projectId:'demo-quickdine'},'saas-integration');db=getFirestore(app);
});
after(async()=>{globalThis.fetch=realFetch;await new Promise(resolve=>server.close(resolve));await deleteApp(app);});
beforeEach(async()=>{
 globalThis.fetch=realFetch;
 for(const name of ['restaurants','subscriptions','tenantAccounts','plans','invoices','subscriptionPayments','platformAdmins','memberships','auditLog'])await db.recursiveDelete(db.collection(name));
 [admin,owner,other]=await Promise.all([account(`admin-${crypto.randomUUID()}@example.test`),account(`owner-${crypto.randomUUID()}@example.test`),account(`other-${crypto.randomUUID()}@example.test`)]);
 await db.doc(`platformAdmins/${admin.uid}`).set({active:true});
 assert.ok((await call('seedPilotPlan',admin,{})).result);
});
test('only platform admins onboard restaurants; onboarding creates separate owner memberships and starts paused',async()=>{
 assert.equal((await call('createRestaurant',owner,restaurant())).error.status,'PERMISSION_DENIED');
 const result=await call('createRestaurant',admin,restaurant());assert.ok(result.result,JSON.stringify(result));
 assert.equal(result.result.ownerUid,owner.uid);
 assert.equal((await db.doc('restaurants/saas-yash').get()).data().acceptingOrders,false);
 assert.equal((await db.doc(`memberships/${owner.uid}/restaurants/saas-yash`).get()).data().role,'owner');
 assert.equal((await db.collection('restaurants/saas-yash/tables').get()).size,7);
 assert.equal((await call('createRestaurant',admin,restaurant())).error.status,'ALREADY_EXISTS');
 assert.ok((await call('createRestaurant',admin,restaurant('saas-other',other.email))).result);
 assert.equal((await call('updateRestaurantProfile',owner,{...restaurant(),restaurantId:'saas-other'})).error.status,'PERMISSION_DENIED');
});
test('owners cannot change plan prices, settle invoices or elevate staff roles',async()=>{
 assert.ok((await call('createRestaurant',admin,restaurant())).result);
 assert.equal((await call('savePlan',owner,{id:'bad'})).error.status,'PERMISSION_DENIED');
 assert.equal((await call('manageRestaurantStaff',owner,{restaurantId:'saas-yash',email:other.email,role:'owner'})).error.status,'PERMISSION_DENIED');
 const invoice=await call('createSubscriptionInvoice',owner,{restaurantId:'saas-yash',planId:'pilot',requestId:crypto.randomUUID()});assert.ok(invoice.result);
 assert.equal((await call('recordSubscriptionPayment',owner,{invoiceId:invoice.result.invoiceId,reference:'fake',amountPaise:0})).error.status,'PERMISSION_DENIED');
});
test('subscription invoice snapshots ignore client prices and duplicate payment references cannot renew another invoice',async()=>{
 assert.ok((await call('createRestaurant',admin,restaurant())).result);
 const plan={id:'growth',name:'Growth',pricePaise:99900,interval:'month',maxTables:40,maxStaff:10,maxMonthlyOrders:5000,trialDays:14,enabled:true};
 assert.ok((await call('savePlan',admin,plan)).result);
 const data={restaurantId:'saas-yash',planId:'growth',requestId:crypto.randomUUID(),amountPaise:1};
 const first=await call('createSubscriptionInvoice',owner,data),retry=await call('createSubscriptionInvoice',owner,data);assert.equal(first.result.invoiceId,retry.result.invoiceId);
 const invoice=(await db.doc(`invoices/${first.result.invoiceId}`).get()).data();assert.equal(invoice.amountPaise,99900);
 assert.equal((await call('recordSubscriptionPayment',admin,{invoiceId:first.result.invoiceId,reference:'receipt-1',amountPaise:1})).error.status,'INVALID_ARGUMENT');
 assert.ok((await call('recordSubscriptionPayment',admin,{invoiceId:first.result.invoiceId,reference:'receipt-1',amountPaise:99900})).result);
 const end=(await db.doc('subscriptions/saas-yash').get()).data().currentPeriodEnd.toMillis();
 assert.ok((await call('recordSubscriptionPayment',admin,{invoiceId:first.result.invoiceId,reference:'receipt-1',amountPaise:99900})).result);
 assert.equal((await db.doc('subscriptions/saas-yash').get()).data().currentPeriodEnd.toMillis(),end);
 const next=await call('createSubscriptionInvoice',owner,{...data,requestId:crypto.randomUUID()});
 assert.equal((await call('recordSubscriptionPayment',admin,{invoiceId:next.result.invoiceId,reference:'receipt-1',amountPaise:99900})).error.status,'ALREADY_EXISTS');
});
test('table and staff quotas are enforced server-side and disabled membership is authoritative',async()=>{
 assert.ok((await call('createRestaurant',admin,restaurant())).result);
 assert.equal((await call('manageRestaurantTables',owner,{restaurantId:'saas-yash',count:21})).error.status,'RESOURCE_EXHAUSTED');
 await db.doc('subscriptions/saas-yash').update({'limits.maxStaff':1});
 assert.equal((await call('manageRestaurantStaff',owner,{restaurantId:'saas-yash',email:other.email,role:'waiter'})).error.status,'RESOURCE_EXHAUSTED');
 await db.doc('subscriptions/saas-yash').update({'limits.maxStaff':2});
 assert.ok((await call('manageRestaurantStaff',owner,{restaurantId:'saas-yash',email:other.email,role:'waiter'})).result);
 assert.ok((await call('manageRestaurantStaff',owner,{restaurantId:'saas-yash',email:other.email,role:'waiter',active:false})).result);
 assert.equal((await db.doc(`memberships/${other.uid}/restaurants/saas-yash`).get()).data().active,false);
 assert.equal((await call('manageRestaurantTables',other,{restaurantId:'saas-yash',count:7})).error.status,'PERMISSION_DENIED');
});
test('inactive subscriptions and monthly order quotas reject new orders while receipts remain recoverable',async()=>{
 assert.ok((await call('createRestaurant',admin,restaurant())).result);
 await db.doc('restaurants/saas-yash').update({acceptingOrders:true,openingTime:'00:00',closingTime:'23:59'});
 await db.doc('restaurants/saas-yash/menu/paneer').set({name:'Paneer',pricePaise:22000,available:true});
 const order={restaurantId:'saas-yash',requestId:crypto.randomUUID(),mode:'table',tableId:'7',items:[{id:'paneer',qty:1}],expectedTotalPaise:22000};
 await db.doc('subscriptions/saas-yash').update({'limits.maxMonthlyOrders':1});
 const first=await call('placeOrder',other,order);assert.ok(first.result,JSON.stringify(first));
 assert.equal((await call('placeOrder',other,{...order,requestId:crypto.randomUUID()})).error.status,'RESOURCE_EXHAUSTED');
 await db.doc('subscriptions/saas-yash').update({currentPeriodEnd:new Date(Date.now()-1)});
 assert.equal((await call('placeOrder',other,{...order,requestId:crypto.randomUUID()})).error.status,'FAILED_PRECONDITION');
 assert.equal((await call('placeOrder',other,order)).result.id,first.result.id);
});
test('online billing verifies the trusted invoice, signature and captured gateway amount before activating access',async()=>{
 assert.ok((await call('createRestaurant',admin,restaurant())).result);
 assert.ok((await call('savePlan',admin,{id:'growth',name:'Growth',pricePaise:99900,interval:'month',maxTables:40,maxStaff:10,maxMonthlyOrders:5000,trialDays:14,enabled:true})).result);
 const created=await call('createSubscriptionInvoice',owner,{restaurantId:'saas-yash',planId:'growth',requestId:crypto.randomUUID()}),invoiceId=created.result.invoiceId;
 let amount=1;
 globalThis.fetch=async(url,options)=>{
  if(String(url).startsWith('https://api.razorpay.com/v1/orders'))return new Response(JSON.stringify({id:'order_test123'}),{status:200});
  if(String(url).startsWith('https://api.razorpay.com/v1/payments/'))return new Response(JSON.stringify({id:'pay_test123',order_id:'order_test123',amount,currency:'INR',status:'captured'}),{status:200});
  return realFetch(url,options);
 };
 const checkout=await call('billingCreateCheckout',owner,{invoiceId,amountPaise:1});assert.equal(checkout.result.amountPaise,99900);
 assert.equal((await call('billingCreateCheckout',other,{invoiceId})).error.status,'PERMISSION_DENIED');
 const signature=createHmac('sha256','test-secret-only').update('order_test123|pay_test123').digest('hex');
 assert.equal((await call('billingVerifyCheckout',owner,{invoiceId,orderId:'order_test123',paymentId:'pay_test123',signature:'0'.repeat(64)})).error.status,'PERMISSION_DENIED');
 assert.equal((await call('billingVerifyCheckout',owner,{invoiceId,orderId:'order_test123',paymentId:'pay_test123',signature})).error.status,'FAILED_PRECONDITION');
 amount=99900;assert.ok((await call('billingVerifyCheckout',owner,{invoiceId,orderId:'order_test123',paymentId:'pay_test123',signature})).result);
 assert.equal((await db.doc('subscriptions/saas-yash').get()).data().status,'active');
 assert.equal((await db.doc(`invoices/${invoiceId}`).get()).data().status,'paid');
});

test('free renewals preserve an administrator suspension and expired owners can still revoke staff',async()=>{
 assert.ok((await call('createRestaurant',admin,restaurant())).result);
 assert.ok((await call('manageRestaurantStaff',owner,{restaurantId:'saas-yash',email:other.email,role:'kitchen'})).result);
 await db.doc('subscriptions/saas-yash').update({currentPeriodEnd:new Date(Date.now()-1)});
 assert.ok((await call('manageRestaurantStaff',owner,{restaurantId:'saas-yash',email:other.email,role:'kitchen',active:false})).result);
 assert.equal((await db.doc('subscriptions/saas-yash').get()).data().staffCount,1);
 assert.ok((await call('setSubscriptionStatus',admin,{restaurantId:'saas-yash',status:'suspended'})).result);
 const created=await call('createSubscriptionInvoice',owner,{restaurantId:'saas-yash',planId:'pilot',requestId:crypto.randomUUID()});
 const invoiceId=created.result.invoiceId;
 assert.equal((await call('activateFreeSubscription',other,{invoiceId})).error.status,'PERMISSION_DENIED');
 const settled=await call('activateFreeSubscription',owner,{invoiceId});assert.equal(settled.result.held,true);
 const sub=(await db.doc('subscriptions/saas-yash').get()).data();assert.equal(sub.status,'suspended');assert.equal(sub.tableCount,7);assert.equal(sub.staffCount,1);
 assert.equal((await db.doc('restaurants/saas-yash').get()).data().serviceAccessState,'paused');
 assert.ok((await call('setSubscriptionStatus',admin,{restaurantId:'saas-yash',status:'active'})).result);
 assert.equal((await db.doc('subscriptions/saas-yash').get()).data().status,'active');
});
test('signed captured-payment webhooks are idempotent and reject forged or mismatched notifications',async()=>{
 assert.ok((await call('createRestaurant',admin,restaurant())).result);
 assert.ok((await call('savePlan',admin,{id:'growth',name:'Growth',pricePaise:99900,interval:'month',maxTables:40,maxStaff:10,maxMonthlyOrders:5000,trialDays:14,enabled:true})).result);
 const created=await call('createSubscriptionInvoice',owner,{restaurantId:'saas-yash',planId:'growth',requestId:crypto.randomUUID()}), invoiceId=created.result.invoiceId;
 await db.doc(`invoices/${invoiceId}`).update({gatewayOrderId:'order_webhook123'});
 async function webhook(amount,forged=false){const body=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_webhook123',order_id:'order_webhook123',amount,currency:'INR',status:'captured'}}}});const signature=forged?'0'.repeat(64):createHmac('sha256','webhook-test-only').update(body).digest('hex');return await fetch('http://127.0.0.1:5001/demo-quickdine/asia-south1/billingWebhook',{method:'POST',headers:{'Content-Type':'application/json','x-razorpay-signature':signature},body});}
 assert.equal((await webhook(99900,true)).status,401);
 assert.equal((await webhook(1)).status,400);
 assert.equal((await db.doc(`invoices/${invoiceId}`).get()).data().status,'unpaid');
 assert.equal((await webhook(99900)).status,200);
 const end=(await db.doc('subscriptions/saas-yash').get()).data().currentPeriodEnd.toMillis();
 assert.equal((await webhook(99900)).status,200);
 assert.equal((await db.doc('subscriptions/saas-yash').get()).data().currentPeriodEnd.toMillis(),end);
 assert.equal((await db.collection('subscriptionPayments').get()).size,1);
});

test('onboarding creates a new owner identity without a shared password and returns private setup',async()=>{
 const email=`new-owner-${crypto.randomUUID()}@example.test`;
 const created=await call('createRestaurant',admin,restaurant('new-owner-dhaba',email));
 assert.ok(created.result,JSON.stringify(created));assert.equal(created.result.ownerEmail,email);assert.ok(created.result.setupLink);
 const membership=(await db.doc(`memberships/${created.result.ownerUid}/restaurants/new-owner-dhaba`).get()).data();
 assert.equal(membership.role,'owner');assert.equal(membership.active,true);
 assert.equal((await db.doc('tenantAccounts/new-owner-dhaba').get()).data().ownerUid,created.result.ownerUid);
});
