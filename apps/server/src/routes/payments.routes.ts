import { Router, type Request, type Response } from 'express';
import { query } from '@icx/database';
import type {
  EditOrderRecord,
  BookingRecord,
  RentalRecord,
  PaymentTargetType,
  PaymentType,
} from '@icx/shared-types';
import { requireAuth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import {
  initializePaystackCheckout,
  verifyPaystackSignature,
  processVerifiedPaystackWebhook,
} from '../engines/paystack.engine.js';

export const paymentsRouter = Router();

// ============================================================================
// 1. POST /api/v1/payments/initialize (PE-04, PE-09, PB-05, ER-06)
// Initializes a Paystack transaction for deposit (70%), balance (30%), full (100%),
// booking payment, or rental hold confirmation.
// ============================================================================
paymentsRouter.post(
  '/initialize',
  requireAuth,
  rateLimiter({ scope: 'payment_init', windowSeconds: 60, maxRequests: 20 }),
  async (req: Request, res: Response): Promise<void> => {
    const { target_type, target_id, payment_type, callback_url } = req.body as {
      target_type: PaymentTargetType;
      target_id: string;
      payment_type?: PaymentType;
      callback_url?: string;
    };

    if (!target_type || !target_id) {
      res.status(400).json({
        error: 'MISSING_PAYMENT_TARGET',
        message: 'target_type and target_id are required.',
      });
      return;
    }

    try {
      const userId = req.user!.sub;
      const userEmail = req.user!.email;
      let amountInKobo = 0n;
      let resolvedPaymentType: PaymentType = payment_type || 'full';

      if (target_type === 'edit_order') {
        const orderRes = await query<EditOrderRecord>(
          'SELECT * FROM edit_orders WHERE id = $1 AND customer_id = $2 LIMIT 1',
          [target_id, userId]
        );
        const order = orderRes.rows[0];
        if (!order) {
          res.status(404).json({ error: 'ORDER_NOT_FOUND' });
          return;
        }

        if (order.payment_state === 'fully_paid') {
          res.status(400).json({
            error: 'ALREADY_FULLY_PAID',
            message: 'This editing order has already been paid in full.',
          });
          return;
        }

        if (order.payment_state === 'deposit_paid' || payment_type === 'balance') {
          resolvedPaymentType = 'balance';
          amountInKobo = BigInt(order.balance_amount);
        } else if (payment_type === 'deposit') {
          const settingsRes = await query<{ value: { deposit_percentage?: number } }>(
            "SELECT value FROM platform_settings WHERE key = 'pricing_config' LIMIT 1"
          );
          const depositPct = BigInt(
            Math.round(Number(settingsRes.rows[0]?.value?.deposit_percentage ?? 70))
          );
          resolvedPaymentType = 'deposit';
          amountInKobo = (BigInt(order.total_amount) * depositPct) / 100n;
        } else {
          resolvedPaymentType = 'full';
          amountInKobo = BigInt(order.total_amount);
        }
      } else if (target_type === 'booking') {
        const bookingRes = await query<BookingRecord>(
          'SELECT * FROM bookings WHERE id = $1 AND customer_id = $2 LIMIT 1',
          [target_id, userId]
        );
        const booking = bookingRes.rows[0];
        if (!booking) {
          res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
          return;
        }

        // PB-05: Customer pays only after the photographer accepts/confirms
        if (!['accepted', 'awaiting_payment'].includes(booking.status)) {
          res.status(400).json({
            error: 'BOOKING_NOT_AWAITING_PAYMENT',
            message: 'Payment is only unlocked after the photographer accepts your booking request.',
          });
          return;
        }

        resolvedPaymentType = 'full';
        amountInKobo = BigInt(booking.price);
      } else if (target_type === 'rental') {
        const rentalRes = await query<RentalRecord>(
          'SELECT * FROM rentals WHERE id = $1 AND customer_id = $2 LIMIT 1',
          [target_id, userId]
        );
        const rental = rentalRes.rows[0];
        if (!rental) {
          res.status(404).json({ error: 'RENTAL_NOT_FOUND' });
          return;
        }

        if (
          rental.status !== 'held' ||
          (rental.held_until && new Date(rental.held_until).getTime() <= Date.now())
        ) {
          res.status(409).json({
            error: 'RENTAL_HOLD_EXPIRED',
            message: 'Your 30-minute equipment hold has expired. Please select your dates again.',
          });
          return;
        }

        resolvedPaymentType = 'full';
        amountInKobo = BigInt(rental.total_amount);
      }

      const defaultCallback =
        callback_url ||
        `${process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000'}/dashboard`;

      const session = await initializePaystackCheckout({
        email: userEmail,
        amountInKobo,
        callbackUrl: defaultCallback,
        metadata: {
          target_type,
          target_id,
          payment_type: resolvedPaymentType,
          customer_id: userId,
        },
      });

      res.status(200).json({
        authorizationUrl: session.authorizationUrl,
        reference: session.reference,
        accessCode: session.accessCode,
        amountInKobo: amountInKobo.toString(),
        paymentType: resolvedPaymentType,
      });
    } catch (error) {
      console.error('[ICX-PAYMENTS] Checkout initialization error:', error);
      res.status(500).json({
        error: 'PAYMENT_INITIALIZATION_FAILED',
        message: 'Unable to initialize payment session.',
      });
    }
  }
);

// ============================================================================
// 2. POST /api/v1/payments/paystack/webhook (Specification 3D & NF-03)
// Strictly verifies HMAC-SHA512 signature on raw request buffer before any DB write.
// ============================================================================
paymentsRouter.post(
  '/paystack/webhook',
  async (req: Request & { rawBody?: Buffer }, res: Response): Promise<void> => {
    const signature = req.headers['x-paystack-signature'] as string | undefined;

    if (!verifyPaystackSignature(req.rawBody, signature)) {
      res.status(401).json({
        error: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'Cryptographic HMAC-SHA512 signature verification failed.',
      });
      return;
    }

    try {
      const result = await processVerifiedPaystackWebhook(req.body);
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      console.error('[ICX-PAYMENTS] Webhook transaction failed:', error);
      res.status(400).json({
        error: 'WEBHOOK_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Webhook failed',
      });
    }
  }
);

