import { createHmac,timingSafeEqual } from 'node:crypto';
export function validSignature(message,signature,secret) {
  if(typeof message !== "string"&&!Buffer.isBuffer(message))return false;
  if(typeof signature!=='string' || !/^[a-f0-9]{64}$/i.test(signature) || typeof secret!=='string' || !secret) return false;
  const expected=createHmac('sha256',secret).update(message).digest();
  return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
export function capturedPaymentMatches(payment,invoice,orderId) {
  return payment?.status==='captured' && payment.order_id===orderId && payment.currency==='INR' && Number.isInteger(payment.amount) && payment.amount===invoice.amountPaise;
}
