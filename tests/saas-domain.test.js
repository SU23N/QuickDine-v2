import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {normalizeRestaurant,normalizePlan,subscriptionState,requireSubscription,nextPeriod,renewalPeriod,invoicePlan,PILOT_PLAN} from '../functions/saas-domain.js';
import {validSignature,capturedPaymentMatches} from '../functions/billing-domain.js';
import {seedDemo,addRestaurant,addInvoice,recordDemoPayment,placeDemoOrder} from '../src/demo/model.js';
test('restaurant onboarding normalizes owner identity and rejects unsafe branding URLs and IDs',()=>{
 const value=normalizeRestaurant({restaurantId:'yash-bagbahara',name:' Yash ',ownerEmail:' OWNER@Example.com ',tableCount:20,accentColor:'#7f1d1d'});
 assert.equal(value.name,'Yash');assert.equal(value.ownerEmail,'owner@example.com');assert.equal(value.restaurantId,'yash-bagbahara');
 for(const extra of [{restaurantId:'../other'},{tableCount:0},{tableCount:101},{logoUrl:'javascript:alert(1)'},{accentColor:'red'}])assert.throws(()=>normalizeRestaurant({...value,...extra}));
});
test('plan prices and usage limits are server-normalized integers',()=>{
 const value=normalizePlan(PILOT_PLAN);assert.equal(value.pricePaise,0);assert.equal(value.currency,'INR');
 for(const extra of [{pricePaise:-1},{pricePaise:1.2},{maxStaff:0},{maxTables:101},{maxMonthlyOrders:'lots'},{interval:'week'},{trialDays:31}])assert.throws(()=>normalizePlan({...PILOT_PLAN,...extra}));
});
test('subscriptions expire by the server clock and suspended access cannot place orders',()=>{
 const now=1000;assert.equal(subscriptionState({status:'trial',currentPeriodEnd:1001},now),'trial');
 assert.equal(subscriptionState({status:'active',currentPeriodEnd:1000},now),'expired');
 assert.equal(subscriptionState({status:'suspended',currentPeriodEnd:9999},now),'suspended');
 assert.throws(()=>requireSubscription(null,now));assert.throws(()=>requireSubscription({status:'active',currentPeriodEnd:999},now));
});
test('monthly and annual renewal periods clamp calendar month ends and preserve already-paid access',()=>{
 const jan=Date.parse('2026-01-31T10:00:00Z');assert.equal(new Date(nextPeriod(jan,'month')).toISOString(),'2026-02-28T10:00:00.000Z');
 const leap=Date.parse('2024-02-29T10:00:00Z');assert.equal(new Date(nextPeriod(leap,'year')).toISOString(),'2025-02-28T10:00:00.000Z');
 assert.equal(renewalPeriod({status:'active',planId:'pilot',currentPeriodEnd:5000},'pilot','month',1000).startsAt,5000);
 assert.equal(renewalPeriod({status:'active',planId:'growth',currentPeriodEnd:5000},'pilot','month',1000).startsAt,1000);
});
test('invoices capture trusted plan prices and limits instead of mutable client amounts',()=>{
 const plan=normalizePlan({...PILOT_PLAN,pricePaise:99900});const invoice=invoicePlan('pilot',plan);plan.pricePaise=1;plan.maxStaff=99;
 assert.equal(invoice.amountPaise,99900);assert.equal(invoice.limits.maxStaff,5);assert.throws(()=>invoicePlan('pilot',{...plan,enabled:false}));
});
test('gateway verification rejects forged signatures and payments with wrong capture status, amount or currency',()=>{
 const secret='test-only-secret',message='order_demo|pay_demo',signature=createHmac('sha256',secret).update(message).digest('hex');
 assert.equal(validSignature(message,signature,secret),true);assert.equal(validSignature(message,'f'.repeat(64),secret),false);assert.equal(validSignature(message,'short',secret),false);
 const invoice={amountPaise:99900},payment={id:'pay_demo',order_id:'order_demo',amount:99900,currency:'INR',status:'captured'};
 assert.equal(capturedPaymentMatches(payment,invoice,'order_demo'),true);
 for(const extra of [{status:'authorized'},{amount:1},{currency:'USD'},{order_id:'order_other'}])assert.equal(capturedPaymentMatches({...payment,...extra},invoice,'order_demo'),false);
});
test('review workspace keeps each restaurant menu and order scope separate and gates inactive subscriptions',()=>{
 const model=seedDemo(),rid='yash-bagbahara',dish=model.menus[rid][0];
 const input={requestId:crypto.randomUUID(),mode:'table',tableId:'7',items:[{id:dish.id,qty:1}],expectedTotalPaise:dish.pricePaise};
 const order=placeDemoOrder(model,rid,input);assert.equal(order.restaurantId,rid);assert.equal(model.orders.filter(o=>o.restaurantId==='chhattisgarh-family-dhaba').length,0);
 assert.equal(placeDemoOrder(model,rid,input).id,order.id);assert.equal(model.orders.length,1);
 model.subscriptions[rid].status='suspended';assert.throws(()=>placeDemoOrder(model,rid,{...input,requestId:crypto.randomUUID()}));
});
test('review onboarding and renewal validate plan limits and reject duplicate payment references',()=>{
 const model=seedDemo();assert.throws(()=>addRestaurant(model,{restaurantId:'new-dhaba',name:'New',ownerEmail:'owner@example.test',tableCount:30,planId:'pilot'}));
 const id=addRestaurant(model,{restaurantId:'new-dhaba',name:'New',ownerEmail:'owner@example.test',tableCount:10,planId:'pilot'});assert.equal(model.restaurants.find(r=>r.id===id).acceptingOrders,false);
 const invoice=addInvoice(model,id,'growth');recordDemoPayment(model,invoice.id,'test-receipt');assert.equal(model.subscriptions[id].status,'active');assert.equal(invoice.status,'paid');
 const next=addInvoice(model,id,'growth');assert.throws(()=>recordDemoPayment(model,next.id,'test-receipt'));
});
