import crypto from 'node:crypto';
import { withTransaction, recordAuditEvent } from '@icx/database';
import type {
  PaymentTargetType,
  PaymentType,
  EditOrderRecord,
  BookingRecord,
  RentalRecord,
} from '@icx/shared-types';
import { env } from '../config/env.js';
import { dispatchNotification } from './notification.engine.js';

export interface PaystackWebhookMetadata {
  target_type: PaymentTargetType;
  target_id: string;
  payment_type: PaymentType;
  customer_id: string;
}

/**
 * Requirement NF-03:
 * Strictly verifies the `x-paystack-signature` header against the raw request body buffer
 * using HMAC-SHA512 and timing-safe comparison.
 */
export function verifyPaystackSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined
): boolean {
  if (!rawBody || !signatureHeader) {
    return false;
  }

  const computedHash = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signatureHeader, 'utf8');
  const hashBuf = Buffer.from(computedHash, 'utf8');

  if (sigBuf.length !== hashBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuf, hashBuf);
}

/**
 * Initializes a Paystack payment checkout session in NGN kobo.
 * Status is NEVER altered by checkout creation or browser redirect; only by verified webhook.
 */
export async function initializePaystackCheckout(params: {
  email: string;
  amountInKobo: bigint | number;
  metadata: PaystackWebhookMetadata;
  callbackUrl: string;
}): Promise<{
  authorizationUrl: string;
  reference: string;
  accessCode: string;
}> {
  const reference = `icx_${params.metadata.target_type}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const amountNum = Number(params.amountInKobo);

  // If a live/test Paystack secret key is configured, call upstream Paystack API
  if (
    env.PAYSTACK_SECRET_KEY.startsWith('sk_') &&
    !env.PAYSTACK_SECRET_KEY.includes('placeholder') &&
    !env.PAYSTACK_SECRET_KEY.includes('replace_with_actual')
  ) {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          amount: amountNum,
          currency: 'NGN',
          reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata,
        }),
      });

      const body = (await response.json()) as {
        status: boolean;
        data?: {
          authorization_url: string;
          access_code: string;
          reference: string;
        };
      };

      if (body.status && body.data) {
        return {
          authorizationUrl: body.data.authorization_url,
          reference: body.data.reference,
          accessCode: body.data.access_code,
        };
      }
    } catch (err) {
      console.error('[ICX-PAYSTACK] Upstream initialize error:', err);
    }
  }

  // Self-contained Paystack checkout URL for staging/local verification
  return {
    authorizationUrl: `${params.callbackUrl}?reference=${encodeURIComponent(reference)}`,
    reference,
    accessCode: `ac_${reference}`,
  };
}

/**
 * Requirement PE-05, PE-09, PB-05, ER-06, NF-03:
 * Processes verified `charge.success` Paystack webhooks atomically inside a PostgreSQL transaction.
 * Rejects duplicate `gateway_reference` entries immediately (strict idempotency).
 */
export async function processVerifiedPaystackWebhook(payload: {
  event: string;
  data: {
    reference: string;
    amount: number; // Amount in kobo
    status: string;
    customer?: { email?: string };
    metadata?: PaystackWebhookMetadata;
  };
}): Promise<{
  status: 'processed' | 'duplicate_ignored' | 'ignored_event';
  reference: string;
}> {
  if (payload.event !== 'charge.success' || payload.data.status !== 'success') {
    return { status: 'ignored_event', reference: payload.data.reference };
  }

  const reference = String(payload.data.reference || '').trim();
  const amountPaidKobo = BigInt(payload.data.amount);
  const metadata = payload.data.metadata;

  if (!reference || !metadata?.target_type || !metadata?.target_id || !metadata?.payment_type) {
    throw new Error('MALFORMED_WEBHOOK_METADATA: Missing target_type, target_id, or payment_type');
  }

  const outcome = await withTransaction(async (client) => {
    // 1. Idempotency Check: Reject already processed gateway_reference entries immediately
    const existingPayment = await client.query(
      'SELECT id FROM payments WHERE gateway_reference = $1 LIMIT 1',
      [reference]
    );
    if (existingPayment.rowCount && existingPayment.rowCount > 0) {
      return { status: 'duplicate_ignored' as const, recipientEmail: null };
    }

    // 2. Insert immutable payment record
    await client.query(
      `INSERT INTO payments (target_type, target_id, type, amount, gateway_reference, verified_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        metadata.target_type,
        metadata.target_id,
        metadata.payment_type,
        amountPaidKobo.toString(),
        reference,
      ]
    );

    let recipientEmail: string | null = payload.data.customer?.email ?? null;

    // 3. Execute atomic domain state transitions per service type
    if (metadata.target_type === 'edit_order') {
      const orderRes = await client.query<
        EditOrderRecord & { turnaround_hours: number; customer_email: string }
      >(
        `SELECT eo.*, ep.turnaround_hours, u.email AS customer_email
         FROM edit_orders eo
         JOIN edit_packages ep ON ep.id = eo.package_id
         JOIN users u ON u.id = eo.customer_id
         WHERE eo.id = $1
         FOR UPDATE OF eo`,
        [metadata.target_id]
      );

      const order = orderRes.rows[0];
      if (!order) {
        throw new Error(`Edit order ${metadata.target_id} not found during webhook processing`);
      }
      recipientEmail = order.customer_email;

      const newAmountPaid = BigInt(order.amount_paid) + amountPaidKobo;
      const totalAmount = BigInt(order.total_amount);
      const newBalance = totalAmount > newAmountPaid ? totalAmount - newAmountPaid : 0n;
      const isFullyPaid = newBalance === 0n || metadata.payment_type === 'full' || metadata.payment_type === 'balance';

      if (metadata.payment_type === 'deposit' && !isFullyPaid) {
        // Deposit (70%) advances order to in_queue
        await client.query(
          `UPDATE edit_orders
           SET amount_paid = $1,
               balance_amount = $2,
               payment_state = 'deposit_paid',
               status = CASE WHEN status = 'awaiting_payment' THEN 'in_queue' ELSE status END,
               due_at = COALESCE(due_at, NOW() + ($3 || ' hours')::interval)
           WHERE id = $4`,
          [
            newAmountPaid.toString(),
            newBalance.toString(),
            String(order.turnaround_hours),
            order.id,
          ]
        );
      } else {
        // Balance (30%) or 100% upfront sets payment_state = 'fully_paid'
        // If paying balance or if edits are already ready, advances to 'delivered'; if 100% upfront at checkout, advances awaiting_payment -> in_queue (or delivered if specified)
        const nextStatus =
          metadata.payment_type === 'balance' || order.status === 'ready_for_review'
            ? 'delivered'
            : order.status === 'awaiting_payment'
              ? 'in_queue'
              : order.status;

        await client.query(
          `UPDATE edit_orders
           SET amount_paid = $1,
               balance_amount = 0,
               payment_state = 'fully_paid',
               status = $2,
               due_at = COALESCE(due_at, NOW() + ($3 || ' hours')::interval)
           WHERE id = $4`,
          [
            totalAmount.toString(),
            nextStatus,
            String(order.turnaround_hours),
            order.id,
          ]
        );
      }
    } else if (metadata.target_type === 'booking') {
      // Booking: Advance from awaiting_payment (or accepted) to confirmed, and mark slot as booked
      const bookingRes = await client.query<BookingRecord & { customer_email: string }>(
        `SELECT b.*, u.email AS customer_email
         FROM bookings b
         JOIN users u ON u.id = b.customer_id
         WHERE b.id = $1
         FOR UPDATE OF b`,
        [metadata.target_id]
      );
      const booking = bookingRes.rows[0];
      if (!booking) {
        throw new Error(`Booking ${metadata.target_id} not found during webhook processing`);
      }
      recipientEmail = booking.customer_email;

      await client.query(
        `UPDATE bookings
         SET status = CASE WHEN status IN ('awaiting_payment', 'accepted', 'requested') THEN 'confirmed' ELSE status END
         WHERE id = $1`,
        [booking.id]
      );

      await client.query(
        `UPDATE availability_slots
         SET status = 'booked', held_until = NULL
         WHERE id = $1`,
        [booking.slot_id]
      );
    } else if (metadata.target_type === 'rental') {
      // Rental: Advance from held to confirmed
      const rentalRes = await client.query<RentalRecord & { customer_email: string }>(
        `SELECT r.*, u.email AS customer_email
         FROM rentals r
         JOIN users u ON u.id = r.customer_id
         WHERE r.id = $1
         FOR UPDATE OF r`,
        [metadata.target_id]
      );
      const rental = rentalRes.rows[0];
      if (!rental) {
        throw new Error(`Rental ${metadata.target_id} not found during webhook processing`);
      }
      recipientEmail = rental.customer_email;

      await client.query(
        `UPDATE rentals
         SET status = 'confirmed', held_until = NULL
         WHERE id = $1`,
        [rental.id]
      );
    }

    await recordAuditEvent(
      {
        actorId: metadata.customer_id || null,
        action: 'PAYMENT_WEBHOOK_VERIFIED',
        targetEntity: metadata.target_type,
        targetId: metadata.target_id,
        details: {
          gatewayReference: reference,
          paymentType: metadata.payment_type,
          amountKobo: amountPaidKobo.toString(),
        },
      },
      client
    );

    return { status: 'processed' as const, recipientEmail };
  });

  if (outcome.status === 'processed' && outcome.recipientEmail) {
    await dispatchNotification({
      triggerId: 'NT-01',
      recipientEmail: outcome.recipientEmail,
      recipientUserId: metadata.customer_id,
      subject: `Payment Confirmed (${reference})`,
      htmlBody: `<p>Your payment of <strong>NGN ${(Number(amountPaidKobo) / 100).toLocaleString()}</strong> for <strong>${metadata.target_type.replace('_', ' ')}</strong> has been verified.</p>`,
      targetEntity: metadata.target_type,
      targetId: metadata.target_id,
    });
  }

  return { status: outcome.status, reference };
}

