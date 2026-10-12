import { DomainError } from './domain.js';

const fail = (message, code = 'invalid-argument') => { throw new DomainError(message, code); };
export const STAFF_ROLES = ['owner', 'kitchen', 'waiter'];
export function validId(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{1,47}$/.test(value);
}
export function text(value, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail('Enter a valid text value.');
  return value.trim();
}
export function emailAddress(value) {
  const email = text(value, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
  return email;
}
export function safeUrl(value) {
  const url = text(value, 1000);
  if (!url) return '';
  try { if (new URL(url).protocol === 'https:') return url; } catch { /* Reject malformed URLs. */ }
  fail('Use a complete HTTPS URL.');
}
export function normalizeProfile(input) {
  const name = text(input?.name, 120, true);
  const accentColor = input?.accentColor || '#7f1d1d';
  if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) fail('Choose a valid brand colour.');
  return { name, nameHi: text(input?.nameHi, 120), phone: text(input?.phone, 20), address: text(input?.address, 300), logoUrl: safeUrl(input?.logoUrl), websiteUrl: safeUrl(input?.websiteUrl), accentColor };
}
export function normalizeRestaurant(input) {
  if (!validId(input?.restaurantId)) fail('Use a restaurant ID with 2–48 lowercase letters, numbers and hyphens.');
  const tableCount = Number(input?.tableCount ?? 20);
  if (!Number.isInteger(tableCount) || tableCount < 1 || tableCount > 100) fail('Choose 1–100 tables.');
  return { restaurantId: input.restaurantId, ownerEmail: emailAddress(input.ownerEmail), tableCount, ...normalizeProfile(input) };
}
export function normalizePlan(input) {
  if (!validId(input?.id)) fail('Choose a valid plan ID.');
  const limits = {};
  for (const [key, max] of [['maxTables',100], ['maxStaff',100], ['maxMonthlyOrders',100000]]) {
    const n = Number(input[key]);
    if (!Number.isInteger(n) || n < 1 || n > max) fail(`Enter a valid ${key}.`);
    limits[key] = n;
  }
  const pricePaise = Number(input.pricePaise);
  if (!Number.isInteger(pricePaise) || pricePaise < 0 || pricePaise > 10000000) fail('Enter a valid plan price in paise.');
  const interval = input.interval || 'month';
  if (!['month','year'].includes(interval)) fail('Choose monthly or annual billing.');
  const trialDays = Number(input.trialDays ?? 14);
  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 30) fail('Trial must be 0–30 days.');
  return { name: text(input.name,80,true), description: text(input.description,300), pricePaise, interval, trialDays, enabled: input.enabled === true, currency:'INR', ...limits };
}
export function millis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value?.seconds != null) return value.seconds * 1000;
  return 0;
}
export function subscriptionState(subscription, now = Date.now()) {
  if (!subscription) return 'unconfigured';
  if (['suspended','cancelled'].includes(subscription.status)) return subscription.status;
  if (!['trial','active'].includes(subscription.status)) return 'expired';
  return millis(subscription.currentPeriodEnd) > now ? subscription.status : 'expired';
}
export function requireSubscription(subscription, now = Date.now()) {
  if (!['trial','active'].includes(subscriptionState(subscription, now))) fail('Online ordering is currently unavailable. Please contact the restaurant.', 'failed-precondition');
  return subscription;
}
export function monthKey(now = Date.now()) {
  return new Date(now + 330 * 60000).toISOString().slice(0,7);
}
export function nextPeriod(start, interval) {
  const date = new Date(start), day = date.getUTCDate();
  date.setUTCDate(1);
  if (interval === 'year') date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  const last = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,last));
  return date.getTime();
}
export function renewalPeriod(current, planId, interval, now = Date.now()) {
  const start = current?.status === 'active' && current?.planId === planId ? Math.max(now,millis(current.currentPeriodEnd)) : now;
  return { startsAt:start, endsAt:nextPeriod(start,interval) };
}
export function invoicePlan(planId, plan) {
  if (!validId(planId) || !plan || plan.enabled !== true) fail('This plan is not available.','failed-precondition');
  return { planId, planName:plan.name, amountPaise:plan.pricePaise, interval:plan.interval, currency:'INR', limits:{maxTables:plan.maxTables,maxStaff:plan.maxStaff,maxMonthlyOrders:plan.maxMonthlyOrders} };
}
export const PILOT_PLAN = { id:'pilot', name:'Pilot', description:'14-day restaurant pilot. Publish your paid plans from the platform console.', pricePaise:0, interval:'month', trialDays:14, maxTables:20, maxStaff:5, maxMonthlyOrders:1000, enabled:true };
