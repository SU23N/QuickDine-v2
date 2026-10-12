import {httpsCallable} from 'firebase/functions';
import {functions} from '../firebase/config';
export async function callSaas(name,data={}){if(!functions)throw Error('Connect Firebase before using the live workspace.');return (await httpsCallable(functions,name)(data)).data;}
let checkoutPromise;
function loadCheckout(){
  if(window.Razorpay)return Promise.resolve();
  if(!checkoutPromise)checkoutPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=resolve;script.onerror=()=>{checkoutPromise=null;reject(Error('Payment checkout could not load.'));};document.head.append(script);});
  return checkoutPromise;
}
export async function payInvoice(invoiceId){
  const checkout=await callSaas('billingCreateCheckout',{invoiceId});await loadCheckout();
  return await new Promise((resolve,reject)=>{
    const options={key:checkout.keyId,order_id:checkout.orderId,amount:checkout.amountPaise,currency:'INR',name:'QuickDine',description:checkout.description,handler:async result=>{try{resolve(await callSaas('billingVerifyCheckout',{invoiceId,orderId:result.razorpay_order_id,paymentId:result.razorpay_payment_id,signature:result.razorpay_signature}));}catch(e){reject(e);}},modal:{ondismiss:()=>reject(Error('Checkout closed. Your unpaid invoice remains available.'))}};
    const instance=new window.Razorpay(options);instance.on('payment.failed',()=>reject(Error('Payment failed. Please retry the invoice.')));instance.open();
  });
}
