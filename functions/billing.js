import { onCall,onRequest,HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { db,options,requireOwnerOrAdmin,translate } from './context.js';
import { settleInvoice } from './saas.js';
import { millis } from './saas-domain.js';
import { validSignature,capturedPaymentMatches } from './billing-domain.js';
const keyId=defineSecret('RAZORPAY_KEY_ID'), keySecret=defineSecret('RAZORPAY_KEY_SECRET'), webhookSecret=defineSecret('RAZORPAY_WEBHOOK_SECRET');
const billingOptions={...options,secrets:[keyId,keySecret]};
async function invoiceFor(request) {
  const id=request.data?.invoiceId;
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)) throw new HttpsError('invalid-argument','Invalid invoice.');
  const ref=db.doc(`invoices/${id}`), invoice=(await ref.get()).data();
  if(!invoice) throw new HttpsError('not-found','Invoice not found.');
  const uid=await requireOwnerOrAdmin(request,invoice.restaurantId);
  return {id,ref,invoice,uid};
}
async function gateway(path,body) {
  const id=keyId.value(),secret=keySecret.value();
  if(!id || !secret) throw new HttpsError('failed-precondition','Online billing is not configured. Contact the platform administrator.');
  const response=await fetch(`https://api.razorpay.com/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  if(!response.ok) throw new HttpsError('unavailable','Payment provider is unavailable. Please retry.');
  return result;
}
export const billingCreateCheckout=onCall(billingOptions,async request=>{
  try {
    const {id,ref,invoice}=await invoiceFor(request);
    if(invoice.status!=='unpaid'||millis(invoice.expiresAt)<Date.now()||invoice.amountPaise<=0) throw new HttpsError('failed-precondition','Choose a current unpaid invoice for online payment.');
    let orderId=invoice.gatewayOrderId;
    if(!orderId) {
      const order=await gateway('orders',{amount:invoice.amountPaise,currency:'INR',receipt:id.slice(0,40),notes:{invoiceId:id,restaurantId:invoice.restaurantId}});
      orderId=await db.runTransaction(async tx=>{
        const current=(await tx.get(ref)).data();
        if(current.status!=='unpaid') throw new HttpsError('failed-precondition','This invoice is already settled.');
        if(current.gatewayOrderId)return current.gatewayOrderId;
        tx.update(ref,{gatewayOrderId:order.id});return order.id;
      });
    }
    return {keyId:keyId.value(),orderId,amountPaise:invoice.amountPaise,currency:'INR',description:`QuickDine ${invoice.planName}`,invoiceId:id};
  } catch(e){translate(e);}
});
export const billingVerifyCheckout=onCall(billingOptions,async request=>{
  try {
    const {id,invoice,uid}=await invoiceFor(request), data=request.data;
    if(data.orderId!==invoice.gatewayOrderId || typeof data.paymentId!=='string' || !/^pay_[a-zA-Z0-9]+$/.test(data.paymentId) || !validSignature(`${invoice.gatewayOrderId}|${data.paymentId}`,data.signature,keySecret.value())) throw new HttpsError('permission-denied','Payment signature verification failed.');
    const payment=await gateway(`payments/${data.paymentId}`);
    if(!capturedPaymentMatches(payment,invoice,invoice.gatewayOrderId)) throw new HttpsError('failed-precondition','Payment capture is pending. Your subscription will update after confirmation.');
    return await settleInvoice(id,{provider:'razorpay',reference:payment.id,amountPaise:payment.amount,currency:payment.currency},uid);
  } catch(e){translate(e);}
});
export const billingWebhook=onRequest({...options,secrets:[webhookSecret]},async(req,res)=>{
  if(req.method!=='POST'){res.status(405).send('Method not allowed');return;}
  if(!validSignature(req.rawBody,req.get('x-razorpay-signature'),webhookSecret.value())){res.status(401).send('Invalid signature');return;}
  const payment=req.body?.payload?.payment?.entity;
  if(req.body?.event!=='payment.captured'||!payment?.order_id){res.status(200).json({ignored:true});return;}
  try {
    const rows=await db.collection('invoices').where('gatewayOrderId','==',payment.order_id).limit(1).get();
    if(rows.empty){res.status(200).json({unmatched:true});return;}
    const invoice=rows.docs[0];
    if(!capturedPaymentMatches(payment,invoice.data(),payment.order_id)){res.status(400).send('Payment mismatch');return;}
    await settleInvoice(invoice.id,{provider:'razorpay',reference:payment.id,amountPaise:payment.amount,currency:payment.currency},'razorpay-webhook');
    res.status(200).json({received:true});
  } catch(e){
    if(['failed-precondition','already-exists'].includes(e.code)){
      await db.collection('billingReview').doc(payment.id).set({paymentId:payment.id,orderId:payment.order_id,reason:e.code,at:new Date()});
      res.status(200).json({reviewRequired:true});return;
    }
    console.error('Billing webhook failed',{code:e.code||'unknown'});res.status(500).send('Retry');
  }
});
