import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from '../lib/jwt.js';
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
} from '../lib/totp.js';
import {
  initializePrivateStorage,
  resolveSafeStoragePath,
  storePrivateBuffer,
} from '../engines/storage.engine.js';
import { generateBurnedWatermarkedPreview } from '../engines/watermark.engine.js';
import { verifyPaystackSignature } from '../engines/paystack.engine.js';
import { env } from '../config/env.js';

/**
 * PHASE 5: ENTERPRISE SECURITY, CRYPTOGRAPHY & CONTENT PROTECTION VERIFICATION SUITE
 */
async function runVerificationSuite(): Promise<void> {
  console.log('====================================================================');
  console.log('ICX STUDIOS — PHASE 5 PRODUCTION SECURITY & ENGINE VERIFICATION');
  console.log('====================================================================');

  // 1. Verify Private Storage Isolation & Path Traversal Defense (NF-01)
  await initializePrivateStorage();
  let traversalBlocked = false;
  try {
    resolveSafeStoragePath('../../etc/passwd');
  } catch {
    traversalBlocked = true;
  }
  assert.equal(
    traversalBlocked,
    true,
    'Path traversal outside PRIVATE_STORAGE_ROOT must be strictly blocked'
  );
  console.log('[PASS] 1. Private Storage Path Traversal Protection (NF-01)');

  // 2. Verify 24h Expiring Clean File HMAC Token Integrity & Tamper Rejection (PE-10, NF-01)
  const signed = createSignedDownloadToken({
    userId: crypto.randomUUID(),
    targetType: 'edit_order',
    targetId: crypto.randomUUID(),
    photoId: 'zip',
  });
  const verified = verifySignedDownloadToken(signed.token);
  assert.ok(verified, 'Valid 24h signed token must verify');
  assert.equal(verified.photoId, 'zip');

  // Attempt to tamper with targetId inside the base64url token
  const decodedRaw = Buffer.from(signed.token, 'base64url').toString('utf8');
  const tamperedRaw = decodedRaw.replace(':zip:', `:${crypto.randomUUID()}:`);
  const tamperedToken = Buffer.from(tamperedRaw, 'utf8').toString('base64url');
  const tamperedCheck = verifySignedDownloadToken(tamperedToken);
  assert.equal(
    tamperedCheck,
    null,
    'Tampered download token or manipulated ID must be rejected immediately'
  );
  console.log('[PASS] 2. 24-Hour HMAC Clean Download Token & Manipulated ID Rejection (PE-10)');

  // 3. Verify Paystack Webhook HMAC-SHA512 Cryptographic Signature Enforcement (NF-03)
  const sampleWebhookBody = Buffer.from(
    JSON.stringify({
      event: 'charge.success',
      data: { reference: 'icx_test_ref_001', amount: 7000000, status: 'success' },
    }),
    'utf8'
  );
  const validSig = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(sampleWebhookBody)
    .digest('hex');

  assert.equal(
    verifyPaystackSignature(sampleWebhookBody, validSig),
    true,
    'Authentic Paystack HMAC-SHA512 signature must pass'
  );
  assert.equal(
    verifyPaystackSignature(sampleWebhookBody, 'forged_signature_hex'),
    false,
    'Forged Paystack webhook signature must be rejected'
  );
  console.log('[PASS] 3. Paystack Webhook HMAC-SHA512 Signature Verification (NF-03)');

  // 4. Verify RFC 6238 Two-Factor Authentication (TOTP) Engine (AC-06)
  const totpSecret = generateTotpSecret();
  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  const validCode = generateTotpCode(totpSecret, currentCounter);
  assert.equal(verifyTotpCode(totpSecret, validCode), true, 'Valid TOTP code must pass');
  assert.equal(verifyTotpCode(totpSecret, '000000'), false, 'Invalid TOTP code must fail');
  console.log('[PASS] 4. RFC 6238 2FA TOTP Verification for Admin & Editor Accounts (AC-06)');

  // 5. Verify Sharp Server-Side Burned-in Watermark & 1,200px Long-Edge Cap (NF-02, PE-06)
  const syntheticHighResSource = await sharp({
    create: {
      width: 2400,
      height: 1600,
      channels: 3,
      background: { r: 42, g: 52, b: 57 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const sourceKey = await storePrivateBuffer(
    'originals',
    'verify/highres_test.jpg',
    syntheticHighResSource
  );
  const watermarked = await generateBurnedWatermarkedPreview(
    sourceKey,
    'verify/preview_test.jpg'
  );

  assert.equal(
    watermarked.width,
    1200,
    'Preview width must be scaled down to max 1,200px long edge'
  );
  assert.equal(
    watermarked.height,
    800,
    'Preview aspect ratio must be preserved (800px height)'
  );
  console.log(
    `[PASS] 5. Sharp Server-Side Burned Watermark Engine (${watermarked.width}x${watermarked.height} <= 1,200px long edge) (NF-02)`
  );

  console.log('====================================================================');
  console.log('ALL PHASE 5 SECURITY & ENGINE VERIFICATION CHECKS PASSED.');
  console.log('====================================================================');
}

runVerificationSuite().catch((err) => {
  console.error('[FAIL] Verification suite failed:', err);
  process.exit(1);
});

