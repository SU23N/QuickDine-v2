import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));

test('core production deployment resolves without optional gateway credentials', async () => {
  process.env.GCLOUD_PROJECT = 'demo-quickdine';
  for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']) {
    delete process.env[key];
  }
  const { loadStack } = require(`${root}functions/node_modules/firebase-functions/lib/runtime/loader.js`);
  const { resolveParams } = require('firebase-tools/lib/deploy/functions/params.js');
  const manifest = await loadStack(`${root}functions`);
  const params = manifest.params ?? [];
  assert.equal(params.some(p => p.name.startsWith('RAZORPAY_')), false,
    'The CLI resolves global params before applying the core function selection.');
  const core = Object.entries(manifest.endpoints).filter(([name]) => !name.startsWith('billing'));
  assert.ok(core.length > 0);
  for (const [name, endpoint] of core) {
    assert.equal((endpoint.secretEnvironmentVariables ?? []).length, 0, name);
  }
  for (const name of ['billingCreateCheckout', 'billingVerifyCheckout']) {
    assert.deepEqual(manifest.endpoints[name].secretEnvironmentVariables.map(s => s.key),
      ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']);
  }
  assert.deepEqual(manifest.endpoints.billingWebhook.secretEnvironmentVariables.map(s => s.key),
    ['RAZORPAY_WEBHOOK_SECRET']);
  await resolveParams({ params, firebaseConfig: { projectId: 'demo-quickdine' },
    userEnvs: {}, codebase: 'default', nonInteractive: true, isEmulator: false });
});
